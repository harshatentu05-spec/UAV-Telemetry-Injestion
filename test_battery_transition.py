
SPEED_MPS = 41.67
BATTERY_BURN_PER_SEC = 0.125
MIN_BATTERY_RESERVE_PCT = 15.0

hub = {"lat": 12.9249, "lng": 80.1000}


def calculate_distance_meters(lat1, lon1, lat2, lon2):
    import math

    radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2)
            * math.sin(dlambda / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_return_battery_required(drone):
    distance = calculate_distance_meters(
        drone["lat"], drone["lng"], hub["lat"], hub["lng"]
    )
    return distance / SPEED_MPS * BATTERY_BURN_PER_SEC + MIN_BATTERY_RESERVE_PCT


drone = {
    "lat": 13.05,
    "lng": 80.20,
    "battery": 20.0,
    "state": "EN_ROUTE",
    "start_lat": 13.05,
    "start_lng": 80.20,
    "target_lat": 13.20,
    "target_lng": 80.30,
    "progress": 0.5,
    "destination_name": "Test Delivery",
}

if (
        drone["state"] == "EN_ROUTE"
        and drone["battery"]
        <= calculate_return_battery_required(drone) + BATTERY_BURN_PER_SEC
):
    drone["state"] = "RETURNING"
    drone["start_lat"] = drone["lat"]
    drone["start_lng"] = drone["lng"]
    drone["target_lat"] = hub["lat"]
    drone["target_lng"] = hub["lng"]
    drone["progress"] = 0.0
    drone["destination_name"] = "Emergency Return to Hub"

assert drone["state"] == "RETURNING"
assert drone["target_lat"] == hub["lat"]
assert drone["target_lng"] == hub["lng"]

print("Battery-triggered return transition passed.")
