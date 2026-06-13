import json
import logging
import time
from typing import List

import pika
import psycopg2
from databases import Database
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("telemetry-api")
logging.getLogger("pika").setLevel(logging.WARNING)

DATABASE_URL = "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres"
database = Database(DATABASE_URL)

app = FastAPI(title="UAV Aviation Telemetry Pipeline")

# --- GLOBAL EXCEPTION HANDLERS ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        "Validation failed",
        extra={"path": request.url.path, "errors": exc.errors()},
    )
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid telemetry payload", "errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logger.exception(
        "Unhandled error",
        extra={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# --- PRODUCTION GRADE AVIATION SCHEMAS ---
class FlightDynamics(BaseModel):
    altitude_meters: float = Field(..., example=450.25)
    airspeed_knots: float = Field(..., example=120.5)
    heading_degrees: float = Field(..., ge=0, le=360, example=184.2)
    pitch_roll_yaw: List[float] = Field(..., min_items=3, max_items=3, example=[1.2, -0.4, 184.2])

class BatteryState(BaseModel):
    voltage: float = Field(..., example=22.1)
    current_draw_amps: float = Field(..., example=45.8)
    capacity_remaining_percent: float = Field(..., ge=0, le=100, example=74.5)
    core_temperature_celsius: float = Field(..., example=38.5)

class PropulsionSystems(BaseModel):
    motor_rpm: List[int] = Field(..., min_items=4, max_items=4, example=[8200, 8150, 8210, 8190])
    battery_state: BatteryState

class GPSCoordinates(BaseModel):
    latitude: float = Field(..., example=12.8231)
    longitude: float = Field(..., example=80.0442)

class ThreatMatrix(BaseModel):
    proximity_alert: bool = Field(..., example=False)
    threat_type: str = Field(..., example="NONE")

class TacticalSensors(BaseModel):
    gps: GPSCoordinates
    airframe_g_force: float = Field(..., example=1.02)
    obstacle_closure_rate_mps: float = Field(..., example=0.0)
    threat_matrix: ThreatMatrix

class TelemetryPacket(BaseModel):
    drone_id: str = Field(..., example="UAV-NX-704")
    timestamp: int = Field(default_factory=lambda: int(time.time()))
    flight_dynamics: FlightDynamics
    propulsion_systems: PropulsionSystems
    tactical_sensors: TacticalSensors

# --- INFRASTRUCTURE STARTUP & SHUTDOWN LIFECYCLES ---
@app.on_event("startup")
async def startup():
    try:
        logger.info("Booting system infrastructure — opening database connection pool")
        await database.connect()

        query = """
        CREATE TABLE IF NOT EXISTS drone_telemetry_records (
            id SERIAL PRIMARY KEY,
            drone_id VARCHAR(50) NOT NULL,
            timestamp bigint NOT NULL,
            flight_dynamics JSONB NOT NULL,
            propulsion_systems JSONB NOT NULL,
            tactical_sensors JSONB NOT NULL,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        await database.execute(query=query)
        logger.info("System infrastructure active — JSONB schema table verified")
    except Exception:
        logger.exception("Startup failed — database unavailable")
        raise

@app.on_event("shutdown")
async def shutdown():
    logger.info("System shutdown initiated — closing database connection pool")
    await database.disconnect()

# --- SYSTEM MONITORING ---
@app.get("/health", tags=["System Monitoring"])
def health_check():
    """
    Heartbeat endpoint to verify API and message broker connectivity.
    """
    system_status = {
        "api_status": "healthy",
        "rabbitmq_connection": "unknown"
    }

    try:
        # Attempt a short-lived connection to RabbitMQ
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host='rabbitmq')
        )
        
        if connection.is_open:
            system_status["rabbitmq_connection"] = "connected"
            connection.close()  # Clean up immediately
            
    except pika.exceptions.AMQPConnectionError:
        system_status["rabbitmq_connection"] = "disconnected"
        # Return a 503 Service Unavailable if a critical dependency is down
        raise HTTPException(status_code=503, detail=system_status)
    except Exception as e:
        system_status["rabbitmq_connection"] = f"error: {str(e)}"
        raise HTTPException(status_code=500, detail=system_status)

    # Return a 200 OK if everything is green
    return system_status

# --- PIKA / RABBITMQ INFRASTRUCTURE HANDSHAKE ---
def send_to_queue(payload: dict):
    """
    Establishes a connection handshake with RabbitMQ via pika and publishes the message.
    """
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host='rabbitmq')
        )
        channel = connection.channel()
        channel.queue_declare(queue='uav_telemetry', durable=True)

        channel.basic_publish(
            exchange='',
            routing_key='uav_telemetry',
            body=json.dumps(payload),
            properties=pika.BasicProperties(
                delivery_mode=2,
            )
        )
        connection.close()
        logger.info("Telemetry queued to RabbitMQ for drone_id=%s", payload.get("drone_id"))
    except pika.exceptions.AMQPError:
        logger.exception(
            "RabbitMQ publish failed",
            extra={"queue": "uav_telemetry", "drone_id": payload.get("drone_id")},
        )
        raise HTTPException(status_code=503, detail="Telemetry pipeline backpressure fault.")
    except (TypeError, ValueError):
        logger.exception(
            "Failed to serialize telemetry payload",
            extra={"drone_id": payload.get("drone_id")},
        )
        raise HTTPException(status_code=500, detail="Telemetry pipeline backpressure fault.")

# --- HISTORICAL DATA RETRIEVAL ---
def fetch_drone_history(drone_id: str, limit: int = 10) -> List[dict]:
    """
    Retrieves the most recent telemetry records for a drone, ordered by timestamp descending.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, drone_id, timestamp, flight_dynamics, propulsion_systems,
                       tactical_sensors, processed_at
                FROM drone_telemetry_records
                WHERE drone_id = %s
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (drone_id, limit),
            )
            records = [dict(row) for row in cur.fetchall()]
        conn.close()
        return records
    except psycopg2.OperationalError:
        logger.exception("Database unreachable", extra={"drone_id": drone_id})
        raise HTTPException(status_code=503, detail="Telemetry history retrieval fault.")
    except psycopg2.Error:
        logger.exception("Database query failed", extra={"drone_id": drone_id})
        raise HTTPException(status_code=500, detail="Telemetry history retrieval fault.")

@app.get("/drones/{drone_id}/history")
async def get_drone_history(drone_id: str, limit: int = 10):
    logger.info("Historical data request for drone_id=%s limit=%s", drone_id, limit)
    records = fetch_drone_history(drone_id, limit)
    return {
        "drone_id": drone_id,
        "count": len(records),
        "records": records,
    }

# --- INGESTION ENDPOINT ---
@app.post("/drone-telemetry", status_code=202)
async def process_live_telemetry(packet: TelemetryPacket):
    logger.info("Telemetry received for drone_id=%s", packet.drone_id)

    payload = packet.dict()
    payload["processed_at_gateway"] = int(time.time())

    send_to_queue(payload)

    if packet.propulsion_systems.battery_state.capacity_remaining_percent < 20.0:
        return {
            "status": "CRITICAL_ALERT",
            "action": "Triggering Automated Fail-Safe. Return to base hangar immediately!"
        }

    if packet.tactical_sensors.threat_matrix.proximity_alert:
        return {
            "status": "TACTICAL_EVASION",
            "action": f"Threat detected: {packet.tactical_sensors.threat_matrix.threat_type}. Executing evasive vectors!"
        }

    return {
        "status": "QUEUED",
        "action": "Telemetry buffered safely to messaging pipeline."
    }
