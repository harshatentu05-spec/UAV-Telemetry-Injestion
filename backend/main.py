import json
import logging
import time
import pika
import os
import threading
import random
import math
import asyncio
import psycopg2
import sys
from mission_coordinator import MissionCoordinator
from simulation_safety import (
    should_return_to_hub,
    move_toward_waypoint,
)
from pathlib import Path
from pydantic import BaseModel, Field
from queue import Queue, Empty
from concurrent.futures import Future, TimeoutError as FutureTimeoutError
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Body
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("telemetry-api")
logging.getLogger("pika").setLevel(logging.WARNING)

PATHFINDING_DIR = Path(__file__).resolve().parent / "pathfinding"

if str(PATHFINDING_DIR) not in sys.path:
    sys.path.insert(0, str(PATHFINDING_DIR))

from mission_planner import plan_delivery_mission
from mission_coordinator import MissionCoordinator

app = FastAPI(title="UAV Telemetry Pipeline")
mission_coordinator = MissionCoordinator()


class MissionPlanRequest(BaseModel):
    hub_lat: float
    hub_lng: float
    destination_lat: float
    destination_lng: float
    current_battery_pct: float = Field(ge=0, le=100)
    grid: list[list[int]]
    return_grid: list[list[int]] | None = None
    cell_size_m: float = Field(default=100, gt=0)
    speed_mps: float = Field(default=41.67, gt=0)
    battery_burn_per_sec: float = Field(default=0.125, ge=0)
    reserve_pct: float = Field(default=15.0, ge=0, le=100)

class MissionEvaluationRequest(MissionPlanRequest):
    mission_id: str = Field(min_length=1, max_length=100)



class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []

        for connection in self.active_connections.copy():
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


swarm_manager = ConnectionManager()
loop_ref = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL RABBITMQ CONNECTION ---
# --- THREAD-SAFE RABBITMQ PUBLISHER ---

rabbitmq_host = os.getenv("RABBITMQ_HOST", "rabbitmq")

publisher_queue = Queue()
publisher_ready = threading.Event()
publisher_stop = threading.Event()
publisher_thread = None


def rabbitmq_publisher_loop():
    """Own the RabbitMQ connection and channel in one dedicated thread."""

    while not publisher_stop.is_set():
        connection = None

        try:
            params = pika.ConnectionParameters(
                host=rabbitmq_host,
                heartbeat=30,
                blocked_connection_timeout=10
            )

            connection = pika.BlockingConnection(params)
            channel = connection.channel()

            # Match the queue configuration expected by worker.py.
            channel.exchange_declare(
                exchange="dlx_telemetry",
                exchange_type="direct"
            )
            channel.queue_declare(queue="telemetry_dead_letter")
            channel.queue_bind(
                exchange="dlx_telemetry",
                queue="telemetry_dead_letter",
                routing_key="quarantine"
            )

            queue_args = {
                "x-dead-letter-exchange": "dlx_telemetry",
                "x-dead-letter-routing-key": "quarantine"
            }

            channel.queue_declare(
                queue="uav_telemetry",
                durable=True,
                arguments=queue_args
            )

            # Ask RabbitMQ to confirm message publications.
            channel.confirm_delivery()
            publisher_ready.set()

            logger.info("RabbitMQ publisher ready.")

            while not publisher_stop.is_set():
                try:
                    payload, future = publisher_queue.get(timeout=1)
                except Empty:
                    continue

                try:
                    if future.cancelled():
                        continue

                    confirmed = channel.basic_publish(
                        exchange="",
                        routing_key="uav_telemetry",
                        body=json.dumps(payload),
                        properties=pika.BasicProperties(
                            delivery_mode=2,
                            content_type="application/json"
                        ),
                        mandatory=True
                    )

                    if confirmed is False:
                        raise RuntimeError(
                            "RabbitMQ did not confirm the message."
                        )

                    if not future.done():
                        future.set_result(True)

                except Exception as exc:
                    if not future.done():
                        future.set_exception(exc)
                    raise

                finally:
                    publisher_queue.task_done()

        except Exception as exc:
            publisher_ready.clear()
            logger.error("RabbitMQ publisher disconnected: %s", exc)
            time.sleep(3)

        finally:
            publisher_ready.clear()

            if connection is not None and connection.is_open:
                connection.close()


def publish_to_rabbitmq(payload: dict, raise_on_error=False):
    """Submit telemetry to the publisher thread and await confirmation."""

    try:
        if not publisher_ready.is_set():
            raise RuntimeError("RabbitMQ publisher is not ready.")

        future = Future()
        publisher_queue.put((payload, future))

        try:
            future.result(timeout=10)
        except FutureTimeoutError as exc:
            future.cancel()
            raise RuntimeError(
                "Timed out waiting for RabbitMQ confirmation."
            ) from exc

        return True

    except Exception as exc:
        logger.error("RabbitMQ publish failed: %s", exc)

        if raise_on_error:
            raise

        return False


def normalize_telemetry(payload: dict) -> dict:
    """Normalize simulator and synthetic load-test telemetry."""

    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object.")

    # Existing simulator format
    if all(key in payload for key in ("device_id", "location", "telemetry")):
        device_id = payload["device_id"]
        location = payload["location"]
        telemetry = payload["telemetry"]

        if not isinstance(location, dict) or not isinstance(telemetry, dict):
            raise ValueError("'location' and 'telemetry' must be objects.")

        lat = location.get("lat")
        lng = location.get("lng")
        altitude = location.get("altitude_m", 0)
        battery = telemetry.get("battery_pct")
        speed = telemetry.get("speed_mps", 0)
        state = telemetry.get("operational_state", "UNKNOWN")
        order = telemetry.get("active_order")
        destination = telemetry.get("destination")
        source_type = payload.get("source_type", "simulator")

    # Existing synthetic load-test format
    elif all(key in payload for key in (
            "drone_id", "flight_dynamics",
            "propulsion_systems", "tactical_sensors"
    )):
        device_id = payload["drone_id"]
        flight = payload["flight_dynamics"]
        propulsion = payload["propulsion_systems"]
        sensors = payload["tactical_sensors"]

        if not all(isinstance(x, dict) for x in (flight, propulsion, sensors)):
            raise ValueError("Telemetry sections must be objects.")

        gps = sensors.get("gps") or {}
        battery_state = propulsion.get("battery_state") or {}

        if not isinstance(gps, dict) or not isinstance(battery_state, dict):
            raise ValueError("'gps' and 'battery_state' must be objects.")

        lat = gps.get("latitude")
        lng = gps.get("longitude")
        altitude = flight.get("altitude_meters", 0)
        battery = battery_state.get("capacity_remaining_percent")

        knots = flight.get("airspeed_knots", 0)
        try:
            speed = float(knots) * 0.514444
        except (TypeError, ValueError):
            raise ValueError("Airspeed must be numeric.")

        state = "UNKNOWN"
        order = None
        destination = None
        source_type = payload.get("source_type", "synthetic_load")

    else:
        raise ValueError("Unsupported telemetry format.")

    if not isinstance(device_id, str) or not device_id.strip():
        raise ValueError("A non-empty device ID is required.")

    try:
        lat, lng, altitude, battery, speed = map(
            float, (lat, lng, altitude, battery, speed)
        )
        timestamp = float(payload.get("timestamp", time.time()))
    except (TypeError, ValueError):
        raise ValueError("Coordinates and telemetry values must be numeric.")

    if not all(math.isfinite(x) for x in (
            lat, lng, altitude, battery, speed, timestamp
    )):
        raise ValueError("Telemetry values must be finite.")

    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise ValueError("GPS coordinates are out of range.")

    if not 0 <= battery <= 100:
        raise ValueError("Battery must be between 0 and 100.")

    if altitude < 0 or speed < 0:
        raise ValueError("Altitude and speed cannot be negative.")

    return {
        "device_id": device_id.strip(),
        "timestamp": timestamp,
        "location": {
            "lat": lat,
            "lng": lng,
            "altitude_m": altitude,
        },
        "telemetry": {
            "battery_pct": battery,
            "speed_mps": speed,
            "operational_state": state,
            "active_order": order,
            "destination": destination,
            "source_type": source_type,
        },
        "processed_at_gateway": int(time.time()),
    }

# --- TAMBARAM SIMULATOR CONFIG & STATE ---
TAMBARAM_HUB = {"lat": 12.9249, "lng": 80.1000, "name": "Tambaram Central Hub"}

DELIVERY_LOCATIONS = [
    {"id": "ORD-01", "name": "Chromepet Market", "lat": 12.9516, "lng": 80.1409},
    {"id": "ORD-02", "name": "Pallavaram Bazaar", "lat": 12.9770, "lng": 80.1500},
    {"id": "ORD-03", "name": "St. Thomas Mount", "lat": 12.9922, "lng": 80.1931},
    {"id": "ORD-04", "name": "Alandur Metro", "lat": 13.0030, "lng": 80.2000},
    {"id": "ORD-05", "name": "Guindy Industrial Estate", "lat": 13.0107, "lng": 80.2100},
    {"id": "ORD-06", "name": "Saidapet Bridge", "lat": 13.0213, "lng": 80.2206},
    {"id": "ORD-07", "name": "T. Nagar Bus Terminus", "lat": 13.0418, "lng": 80.2341},
    {"id": "ORD-08", "name": "Nungambakkam High Road", "lat": 13.0569, "lng": 80.2425},
    {"id": "ORD-09", "name": "Vadapalani Murugan Temple", "lat": 13.0521, "lng": 80.2121},
    {"id": "ORD-10", "name": "Porur Junction", "lat": 13.0336, "lng": 80.1565},
    {"id": "ORD-11", "name": "Ramapuram DLF IT Park", "lat": 13.0250, "lng": 80.1800},
    {"id": "ORD-12", "name": "Velachery Phoenix Mall", "lat": 12.9815, "lng": 80.2180},
    {"id": "ORD-13", "name": "Adyar Bus Depot", "lat": 13.0063, "lng": 80.2574},
    {"id": "ORD-14", "name": "Madipakkam Koot Road", "lat": 12.9647, "lng": 80.2004},
    {"id": "ORD-15", "name": "Nanganallur Puzhuthivakkam", "lat": 12.9811, "lng": 80.1901},
    {"id": "ORD-16", "name": "Perungalathur", "lat": 12.9050, "lng": 80.0883},
    {"id": "ORD-17", "name": "Vandalur Zoo", "lat": 12.8878, "lng": 80.0811},
    {"id": "ORD-18", "name": "Medavakkam Junction", "lat": 12.9172, "lng": 80.1921},
    {"id": "ORD-19", "name": "Sholinganallur Junction", "lat": 12.9010, "lng": 80.2279},
    {"id": "ORD-20", "name": "Ekkattuthangal", "lat": 13.0131, "lng": 80.1947}
]

SPEED_MPS = 41.67
BATTERY_BURN_PER_SEC = 0.125
CHARGING_RATE_PER_SEC = 2.0
MIN_BATTERY_RESERVE_PCT = 15.0

drone_states = {}
for i in range(1, 21):
    drone_id = f"UAV-{i:02d}"
    if i <= 10:
        order = DELIVERY_LOCATIONS[i - 1]
        drone_states[drone_id] = {
            "device_id": drone_id, "lat": TAMBARAM_HUB["lat"], "lng": TAMBARAM_HUB["lng"],
            "start_lat": TAMBARAM_HUB["lat"], "start_lng": TAMBARAM_HUB["lng"],
            "target_lat": order["lat"], "target_lng": order["lng"],
            "destination_name": order["name"], "order_id": order["id"],
            "battery": float(random.randint(60, 95)), "state": "EN_ROUTE",
            "progress": 0.0, "speed_mps": SPEED_MPS, "altitude": 60.0,
            "outbound_waypoints": [],
            "return_waypoints": [],
            "waypoint_index": 0,
            "route_validated": False,
        }
    else:
        drone_states[drone_id] = {
            "device_id": drone_id, "lat": TAMBARAM_HUB["lat"], "lng": TAMBARAM_HUB["lng"],
            "start_lat": TAMBARAM_HUB["lat"], "start_lng": TAMBARAM_HUB["lng"],
            "target_lat": TAMBARAM_HUB["lat"], "target_lng": TAMBARAM_HUB["lng"],
            "destination_name": "Tambaram Hub (Idle)", "order_id": None,
            "battery": 100.0, "state": "RESTING", "progress": 1.0,
            "speed_mps": 0.0, "altitude": 0.0
        }

def calculate_return_battery_required(drone):
    distance_m = calculate_distance_meters(
        drone["lat"],
        drone["lng"],
        TAMBARAM_HUB["lat"],
        TAMBARAM_HUB["lng"],
    )

    speed_mps = SPEED_MPS
    estimated_return_seconds = distance_m / speed_mps

    return (
            estimated_return_seconds * BATTERY_BURN_PER_SEC
            + MIN_BATTERY_RESERVE_PCT
    )

def calculate_distance_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def run_simulation_loop():
    """Background simulator thread pushing continuous telemetry."""
    global loop_ref
    while True:
        time.sleep(1.0)
        for drone_id, drone in drone_states.items():
            state = drone["state"]
            if state in ["EN_ROUTE", "RETURNING"]:


                if (
                        state == "EN_ROUTE"
                        and should_return_to_hub(
                    battery_pct=drone["battery"],
                    return_distance_m=calculate_distance_meters(
                        drone["lat"],
                        drone["lng"],
                        TAMBARAM_HUB["lat"],
                        TAMBARAM_HUB["lng"],
                    ),
                    speed_mps=SPEED_MPS,
                    battery_burn_per_sec=BATTERY_BURN_PER_SEC,
                    reserve_pct=MIN_BATTERY_RESERVE_PCT,
                )
                ):
                    drone["state"] = "RETURNING"
                    drone["start_lat"] = drone["lat"]
                    drone["start_lng"] = drone["lng"]
                    drone["target_lat"] = TAMBARAM_HUB["lat"]
                    drone["target_lng"] = TAMBARAM_HUB["lng"]
                    drone["progress"] = 0.0
                    drone["destination_name"] = "Emergency Return to Hub"
                    state = "RETURNING"

                total_dist = calculate_distance_meters(
                    drone["start_lat"], drone["start_lng"],
                    drone["target_lat"], drone["target_lng"]
                )
                if total_dist > 0:
                    progress_delta = SPEED_MPS / total_dist
                    drone["progress"] = min(1.0, drone["progress"] + progress_delta)
                    drone["lat"] = drone["start_lat"] + (drone["target_lat"] - drone["start_lat"]) * drone["progress"]
                    drone["lng"] = drone["start_lng"] + (drone["target_lng"] - drone["start_lng"]) * drone["progress"]

                drone["battery"] = max(0.0, drone["battery"] - BATTERY_BURN_PER_SEC)
                drone["altitude"] = 60.0
                drone["speed_mps"] = SPEED_MPS

                if drone["progress"] >= 1.0 and state == "EN_ROUTE":
                    drone["state"] = "RETURNING"
                    drone["start_lat"] = drone["lat"]
                    drone["start_lng"] = drone["lng"]
                    drone["target_lat"] = TAMBARAM_HUB["lat"]
                    drone["target_lng"] = TAMBARAM_HUB["lng"]
                    drone["progress"] = 0.0
                    drone["destination_name"] = "Returning to Hub"
                elif drone["progress"] >= 1.0 and state == "RETURNING":
                    drone["state"] = "CHARGING"
                    drone["lat"] = TAMBARAM_HUB["lat"]
                    drone["lng"] = TAMBARAM_HUB["lng"]
                    drone["speed_mps"] = 0.0
                    drone["altitude"] = 0.0

            elif state == "CHARGING":
                drone["battery"] = min(100.0, drone["battery"] + CHARGING_RATE_PER_SEC)
                drone["speed_mps"] = 0.0
                drone["altitude"] = 0.0
                if drone["battery"] >= 100.0:
                    drone["state"] = "RESTING"
                    drone["destination_name"] = "Tambaram Hub (Idle)"
                    drone["order_id"] = None

            elif state == "RESTING":
                drone["lat"] = TAMBARAM_HUB["lat"]
                drone["lng"] = TAMBARAM_HUB["lng"]
                drone["speed_mps"] = 0.0
                drone["altitude"] = 0.0

            packet = {
                "device_id": drone["device_id"],
                "timestamp": time.time(),
                "location": {
                    "lat": round(drone["lat"], 6),
                    "lng": round(drone["lng"], 6),
                    "altitude_m": round(drone["altitude"], 1)
                },
                "telemetry": {
                    "battery_pct": round(drone["battery"], 2),
                    "speed_mps": round(drone["speed_mps"], 2),
                    "operational_state": drone["state"],
                    "active_order": drone["order_id"],
                    "destination": drone["destination_name"]
                },
                "processed_at_gateway": int(time.time())
            }

            # Broadcast to WebSockets & Queue to RabbitMQ safely
            if loop_ref:
                asyncio.run_coroutine_threadsafe(swarm_manager.broadcast(packet), loop_ref)
            publish_to_rabbitmq(packet)

@app.on_event("startup")
async def startup_event():
    global loop_ref, publisher_thread

    loop_ref = asyncio.get_running_loop()

    publisher_thread = threading.Thread(
        target=rabbitmq_publisher_loop,
        daemon=True,
        name="rabbitmq-publisher"
    )
    publisher_thread.start()

    ready = await asyncio.to_thread(
        publisher_ready.wait, 10
    )

    if not ready:
        logger.warning(
            "RabbitMQ is not ready yet; publishing will retry."
        )

    sim_thread = threading.Thread(
        target=run_simulation_loop,
        daemon=True,
        name="uav-simulation"
    )
    sim_thread.start()

    logger.info("UAV simulation background thread started.")

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await swarm_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        swarm_manager.disconnect(websocket)



@app.post("/missions/evaluate")
def evaluate_mission_endpoint(request: MissionEvaluationRequest):
    try:
        result = mission_coordinator.evaluate_and_register(
            mission_id=request.mission_id,
            grid=request.grid,
            hub_latlon=(request.hub_lat, request.hub_lng),
            destination_latlon=(
                request.destination_lat,
                request.destination_lng,
            ),
            current_battery_pct=request.current_battery_pct,
            speed_mps=request.speed_mps,
            battery_burn_per_sec=request.battery_burn_per_sec,
            reserve_pct=request.reserve_pct,
            cell_size_m=request.cell_size_m,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    return result

@app.post("/ingest")
async def ingest_telemetry(payload: dict = Body(...)):
    try:
        normalized = normalize_telemetry(payload)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    try:
        await asyncio.to_thread(
            publish_to_rabbitmq,
            normalized,
            True,
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Telemetry could not be confirmed by RabbitMQ.",
        )

    return {
        "status": "accepted",
        "device_id": normalized["device_id"],
        "source_type": normalized["telemetry"]["source_type"],
    }


@app.get("/health")
def health_check():
    return {"api_status": "healthy", "hub": TAMBARAM_HUB["name"]}


@app.get("/drones")
def get_live_drones():
    return {
        drone_id: {
            "state": drone["state"],
            "battery_pct": round(drone["battery"], 2),
            "lat": round(drone["lat"], 6),
            "lng": round(drone["lng"], 6),
            "destination": drone["destination_name"],
            "order_id": drone["order_id"],
        }
        for drone_id, drone in drone_states.items()
    }


@app.get("/drones/{drone_id}/history")
async def get_drone_history(drone_id: str, limit: int = 10):
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=503, detail="Database is not configured")

    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        query = """
            SELECT timestamp, flight_dynamics, propulsion_systems, tactical_sensors
            FROM drone_telemetry_records
            WHERE drone_id = %s
            ORDER BY timestamp DESC
            LIMIT %s
        """
        cur.execute(query, (drone_id, limit))
        records = cur.fetchall()
        cur.close()
        conn.close()
        return {"drone_id": drone_id, "count": len(records), "records": records}
    except Exception as e:
        logger.error(f"Database query failed for {drone_id}: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")