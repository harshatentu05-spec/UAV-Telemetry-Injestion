from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List
from databases import Database
import pika
import json
import time

DATABASE_URL = "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres"
database = Database(DATABASE_URL)

app = FastAPI(title="UAV Aviation Telemetry Pipeline")

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
    print("🔌 Booting system infrastructure... Opening Database Connection Pool.")
    await database.connect()
    
    # Upgraded table schema using JSONB for complex nested metrics
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
    print("✅ System Infrastructure Active: Upgraded JSONB Schema Table Verified.")

@app.on_event("shutdown")
async def shutdown():
    print("🛑 System Shutdown Initiated: Closing Database Connection Pool safely.")
    await database.disconnect()

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
                delivery_mode=2,  # Makes the message persistent on disk
            )
        )
        connection.close()
    except Exception as e:
        print(f"🛑 Pipeline Critical Failure: Could not route message to RabbitMQ: {e}")
        raise HTTPException(status_code=500, detail="Telemetry pipeline backpressure fault.")

# --- INGESTION ENDPOINT ---
@app.post("/drone-telemetry", status_code=202)
async def process_live_telemetry(packet: TelemetryPacket):
    print(f"📡 Inbound Data Vector Intercepted from device: {packet.drone_id}")
    
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