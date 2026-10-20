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
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("telemetry-api")
logging.getLogger("pika").setLevel(logging.WARNING)

app = FastAPI(title="Tambaram UAV Aviation Telemetry Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL RABBITMQ CONNECTION ---
rabbitmq_host = os.getenv("RABBITMQ_HOST", "rabbitmq")
rabbitmq_connection = None
rabbitmq_channel = None

def init_rabbitmq():
    global rabbitmq_connection, rabbitmq_channel
    try:
        rabbitmq_connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host))
        rabbitmq_channel = rabbitmq_connection.channel()
        rabbitmq_channel.queue_declare(queue='uav_telemetry', durable=True)
        logger.info("Persistent RabbitMQ Connection Established.")
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ on startup: {e}")

init_rabbitmq()

# --- THE BROADCASTER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

swarm_manager = ConnectionManager()
loop_ref = None

def publish_to_rabbitmq(payload: dict):
    global rabbitmq_channel
    try:
        if rabbitmq_channel is None or rabbitmq_channel.is_closed:
            init_rabbitmq()
        rabbitmq_channel.basic_publish(
            exchange='',
            routing_key='uav_telemetry',
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2)
        )
    except Exception as e:
        logger.error(f"RabbitMQ publish failed: {e}")

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
            "progress": 0.0, "speed_mps": SPEED_MPS, "altitude": 60.0
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

                if drone["battery"] <= 15.0 and state == "EN_ROUTE":
                    drone["state"] = "RETURNING"
                    drone["start_lat"] = drone["lat"]
                    drone["start_lng"] = drone["lng"]
                    drone["target_lat"] = TAMBARAM_HUB["lat"]
                    drone["target_lng"] = TAMBARAM_HUB["lng"]
                    drone["progress"] = 0.0
                    drone["destination_name"] = "Emergency Return to Hub"
                elif drone["progress"] >= 1.0 and state == "EN_ROUTE":
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
    global loop_ref
    loop_ref = asyncio.get_running_loop()
    sim_thread = threading.Thread(target=run_simulation_loop, daemon=True)
    sim_thread.start()
    logger.info("Tambaram UAV Simulator Background Thread Started.")

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await swarm_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        swarm_manager.disconnect(websocket)

@app.get("/health")
def health_check():
    return {"api_status": "healthy", "hub": TAMBARAM_HUB["name"]}

@app.get("/drones/{drone_id}/history")
async def get_drone_history(drone_id: str, limit: int = 10):
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres")
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