from fastapi import FastAPI
from pydantic import BaseModel
from databases import Database

# 1. Database Connection String (Points to your live Docker container box)
# Format: postgresql://username:password@hostname:port/database_name
DATABASE_URL = "postgresql://postgres:alphaflight7@drone-postgres:5432/postgres"

# Initialize the Database abstraction manager
database = Database(DATABASE_URL)

# 2. Initialize the FastAPI web server core engine
app = FastAPI()

# 3. Define the strict Data Validation Schema matching incoming drone payloads
class TelemetryPacket(BaseModel):
    drone_id: str
    latitude: float
    longitude: float
    altitude_meters: float
    battery_percentage: float

# 4. Lifecycle Hooks: Automate secure database network tunnels
@app.on_event("startup")
async def startup():
    print("🔌 Booting system infrastructure... Opening Database Connection Pool.")
    await database.connect()
    
    # Automatically execute a structural SQL query to generate our flight log schema table if missing
    query = """
    CREATE TABLE IF NOT EXISTS drone_logs (
        id SERIAL PRIMARY KEY,
        drone_id VARCHAR(50) NOT NULL,
        latitude TEXT NOT NULL,
        longitude TEXT NOT NULL,
        altitude_meters REAL NOT NULL,
        battery_percentage REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    await database.execute(query=query)
    print("✅ System Infrastructure Active: Database Schema Table Verified.")

@app.on_event("shutdown")
async def shutdown():
    print("🛑 System Shutdown Initiated: Closing Database Connection Pool safely.")
    await database.disconnect()

# 5. Live Ingestion Ingress Endpoint Route
@app.post("/drone-telemetry")
async def process_live_telemetry(packet: TelemetryPacket):
    print(f"📡 Inbound Data Vector Intercepted from device: {packet.drone_id}")
    
    # Prepare the relational SQL command string to permanently write data to hard disk blocks
    query = """
    INSERT INTO drone_logs (drone_id, latitude, longitude, altitude_meters, battery_percentage)
    VALUES (:drone_id, :latitude, :longitude, :altitude_meters, :battery_percentage)
    """
    
    # Bind variables to parameters safely to prevent database script injection attacks
    values = {
        "drone_id": packet.drone_id,
        "latitude": str(packet.latitude),
        "longitude": str(packet.longitude),
        "altitude_meters": packet.altitude_meters,
        "battery_percentage": packet.battery_percentage
    }
    
    # Fire the query asynchronously over the asyncpg translator wire
    await database.execute(query=query, values=values)
    print(f"💾 Transaction Finalized: Packet payload written to non-volatile disk sectors.")
    
    # Core Safety Gate Evaluation
    if packet.battery_percentage < 20.0:
        return {
            "status": "CRITICAL_ALERT",
            "action": "Triggering Automated Fail-Safe. Return to base hangar immediately!"
        }
    
    return {
        "status": "NOMINAL",
        "action": "Telemetry persistently logged to infrastructure database."
    }

