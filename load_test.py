import requests
import concurrent.futures
import random
import time

API_URL = "http://localhost:8000/drone-telemetry"
TOTAL_REQUESTS = 50

def generate_random_payload(drone_index):
    """Generates a schema-compliant payload with slightly randomized data."""
    return {
        "drone_id": f"SWARM-DRONE-{drone_index}",
        "flight_dynamics": {
            "altitude_meters": round(random.uniform(100.0, 500.0), 2),
            "airspeed_knots": round(random.uniform(50.0, 150.0), 1),
            "heading_degrees": round(random.uniform(0.0, 360.0), 1),
            "pitch_roll_yaw": [1.0, -0.5, 180.0]
        },
        "propulsion_systems": {
            "motor_rpm": [8200, 8150, 8210, 8190],
            "battery_state": {
                "voltage": 22.1,
                "current_draw_amps": round(random.uniform(20.0, 60.0), 1),
                "capacity_remaining_percent": round(random.uniform(10.0, 100.0), 1),
                "core_temperature_celsius": round(random.uniform(30.0, 50.0), 1)
            }
        },
        "tactical_sensors": {
            "gps": {
                "latitude": 12.8231 + random.uniform(-0.01, 0.01),
                "longitude": 80.0442 + random.uniform(-0.01, 0.01)
            },
            "airframe_g_force": 1.02,
            "obstacle_closure_rate_mps": 0.0,
            "threat_matrix": {
                "proximity_alert": random.choice([True, False, False, False]), # 25% chance of alert
                "threat_type": "TEST_SWARM"
            }
        }
    }

def send_telemetry(drone_index):
    """Sends a single POST request to the API."""
    payload = generate_random_payload(drone_index)
    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        return response.status_code
    except requests.exceptions.RequestException as e:
        return str(e)

if __name__ == "__main__":
    print(f" Initiating Swarm Load Test: Firing {TOTAL_REQUESTS} requests concurrently...")
    start_time = time.time()
    
    # Use ThreadPoolExecutor to send requests simultaneously
    success_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        # Map the drone indexes (1 to 50) to the send_telemetry function
        results = executor.map(send_telemetry, range(1, TOTAL_REQUESTS + 1))
        
        for status in results:
            if status == 202:
                success_count += 1

    end_time = time.time()
    print("--- Swarm Test Complete ---")
    print(f"Successfully queued: {success_count}/{TOTAL_REQUESTS}")
    print(f" Time taken: {round(end_time - start_time, 2)} seconds")