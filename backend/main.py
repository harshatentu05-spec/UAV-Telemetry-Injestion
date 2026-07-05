import json
import logging
import time
import pika
import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

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

# --- THE BACKGROUND WORKER (Solves the freezing bug!) ---
# --- THE BACKGROUND WORKER ---
def publish_to_rabbitmq(payload: dict):
    rabbitmq_host = os.getenv("RABBITMQ_HOST", "rabbitmq")
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters(host=rabbitmq_host))
        channel = connection.channel()
        
        # WE REMOVED queue_declare() BECAUSE THE QUEUE ALREADY EXISTS!
        
        channel.basic_publish(
            exchange='',
            routing_key='uav_telemetry',
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        connection.close()
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
    return {"drone_id": drone_id, "count": 0, "records": []}

# Notice we added 'background_tasks' here!
@app.post("/ingest", status_code=202) 
async def process_live_telemetry(payload: dict, background_tasks: BackgroundTasks):
    payload["processed_at_gateway"] = int(time.time())

    # 1. Instantly broadcast to React Dashboard (No waiting!)
    await swarm_manager.broadcast(payload)

    # 2. Tell the background worker to handle RabbitMQ so the main loop doesn't freeze
    background_tasks.add_task(publish_to_rabbitmq, payload)

    return {"status": "QUEUED"}