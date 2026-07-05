import json
import logging
import time
import pika
import os
import threading
import psycopg2
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("telemetry-api")
logging.getLogger("pika").setLevel(logging.WARNING)

app = FastAPI(title="UAV Aviation Telemetry Pipeline - Production Clean")

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
    """Establish a single persistent connection to RabbitMQ on startup."""
    global rabbitmq_connection, rabbitmq_channel
    try:
        rabbitmq_connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host))
        rabbitmq_channel = rabbitmq_connection.channel()
        logger.info("Persistent RabbitMQ Connection Established.")
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ on startup: {e}")

# Call it immediately when the file loads
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

# --- THE BACKGROUND WORKER ---
def publish_to_rabbitmq(payload: dict):
    global rabbitmq_channel
    try:
        # Check if channel is closed (e.g. RabbitMQ restarted), try to reconnect
        if rabbitmq_channel is None or rabbitmq_channel.is_closed:
             init_rabbitmq()
             
        # Toss the message through the ALREADY OPEN door
        rabbitmq_channel.basic_publish(
            exchange='',
            routing_key='uav_telemetry',
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2)
        )
    except Exception as e:
        logger.error(f"RabbitMQ publish failed: {e}")
# --------------------------------------------------------

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
    return {"api_status": "healthy"}

@app.get("/drones/{drone_id}/history")
async def get_drone_history(drone_id: str, limit: int = 10):
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres")
    try:
        # Open a quick connection to fetch the data
        conn = psycopg2.connect(database_url)
        
        # RealDictCursor automatically converts PostgreSQL rows into JSON-friendly Python dictionaries
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query: Get the most recent X records for this specific drone, sorting by newest first
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
        
        return {
            "drone_id": drone_id,
            "count": len(records),
            "records": records
        }
    except Exception as e:
        logger.error(f"Database query failed for {drone_id}: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@app.post("/ingest", status_code=202) 
async def process_live_telemetry(payload: dict, background_tasks: BackgroundTasks):
    payload["processed_at_gateway"] = int(time.time())

    # 1. Instantly broadcast to React Dashboard (No waiting!)
    await swarm_manager.broadcast(payload)

    # 2. Tell the background worker to handle RabbitMQ using the persistent connection
    background_tasks.add_task(publish_to_rabbitmq, payload)

    return {"status": "QUEUED"}