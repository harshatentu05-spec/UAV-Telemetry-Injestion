import time
import random
import requests
import concurrent.futures

API_URL = "http://telemetry-api:8000/ingest"
NUM_DRONES = 400

def generate_payload(drone_id):
    # Generates a randomized, schema-compliant JSON payload
    return {
        "drone_id": f"UAV-SWARM-{drone_id:03d}",
        "flight_dynamics": {
            "altitude_meters": round(random.uniform(100.0, 800.0), 2),
            "airspeed_knots": round(random.uniform(50.0, 150.0), 1),
            "heading_degrees": round(random.uniform(0, 360), 1),
            "pitch_roll_yaw": [round(random.uniform(-5, 5), 1), round(random.uniform(-5, 5), 1), round(random.uniform(0, 360), 1)]
        },
        "propulsion_systems": {
            "motor_rpm": [8200, 8150, 8210, 8190],
            "battery_state": {
                "voltage": round(random.uniform(20.0, 24.0), 1),
                "current_draw_amps": round(random.uniform(30.0, 50.0), 1),
                # Occasionally drop battery low to trigger your CRITICAL ALERTS!
                "capacity_remaining_percent": round(random.uniform(15.0, 100.0), 1), 
                "core_temperature_celsius": round(random.uniform(30.0, 45.0), 1)
            }
        },
        "tactical_sensors": {
            "gps": {
                # Spawning drones randomly around the Chennai/SRM area coordinates
                "latitude": round(random.uniform(12.8, 12.9), 4),
                "longitude": round(random.uniform(80.0, 80.1), 4)
            },
            "airframe_g_force": round(random.uniform(0.9, 1.5), 2),
            "obstacle_closure_rate_mps": 0.0,
            "threat_matrix": {
                "proximity_alert": False,
                "threat_type": "NONE"
            }
        }
    }

def simulate_drone(drone_id):
    print(f" Drone UAV-SWARM-{drone_id:03d} online and transmitting...")
    while True:
        payload = generate_payload(drone_id)
        try:
            requests.post(API_URL, json=payload, timeout=2)
        except Exception:
            pass # Ignore dropped connections, keep firing!
            
        # Fire a packet every 0.5 to 2 seconds randomly per drone
        time.sleep(random.uniform(0.5, 2.0)) 

if __name__ == "__main__":
    print(f" INITIATING SWARM LOAD TEST: {NUM_DRONES} DRONES 🔥")
    # Launch 200 independent threads firing simultaneously
    with concurrent.futures.ThreadPoolExecutor(max_workers=NUM_DRONES) as executor:
        executor.map(simulate_drone, range(1, NUM_DRONES + 1))