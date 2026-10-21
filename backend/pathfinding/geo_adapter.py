
from math import cos, radians, asin, sqrt, sin

from astar import astar



def latlon_to_grid(lat, lon, origin_lat, origin_lon, cell_size_m=100):
    """Convert latitude/longitude to approximate local grid coordinates."""
    meters_per_degree_lat = 111_320
    meters_per_degree_lon = (
            111_320 * cos(radians(origin_lat))
    )

    row = round((origin_lat - lat) * meters_per_degree_lat / cell_size_m)
    col = round((lon - origin_lon) * meters_per_degree_lon / cell_size_m)

    return row, col


def grid_to_latlon(row, col, origin_lat, origin_lon, cell_size_m=100):
    """Convert grid coordinates back to approximate latitude/longitude."""
    meters_per_degree_lat = 111_320
    meters_per_degree_lon = (
            111_320 * cos(radians(origin_lat))
    )

    lat = origin_lat - (row * cell_size_m / meters_per_degree_lat)
    lon = origin_lon + (col * cell_size_m / meters_per_degree_lon)

    return lat, lon


def find_geographic_route(
        grid,
        start_latlon,
        goal_latlon,
        origin_lat,
        origin_lon,
        cell_size_m=100,
):
    """Find a route and return its waypoints as latitude/longitude pairs."""
    start = latlon_to_grid(
        start_latlon[0], start_latlon[1],
        origin_lat, origin_lon, cell_size_m
    )
    goal = latlon_to_grid(
        goal_latlon[0], goal_latlon[1],
        origin_lat, origin_lon, cell_size_m
    )

    grid_path = astar(grid, start, goal)

    if grid_path is None:
        return None

    return [
        grid_to_latlon(
            row, col, origin_lat, origin_lon, cell_size_m
        )
        for row, col in grid_path
    ]

def grid_route_to_waypoints(
        grid_path,
        origin_lat,
        origin_lon,
        cell_size_m=100,
):
    """Convert an A* grid path into geographic waypoints."""
    return [
        {
            "lat": lat,
            "lng": lon,
        }
        for row, col in grid_path
        for lat, lon in [
            grid_to_latlon(
                row,
                col,
                origin_lat,
                origin_lon,
                cell_size_m,
            )
        ]
    ]

def calculate_route_distance_meters(waypoints):
    """Calculate total route distance using the Haversine formula."""
    total_distance = 0.0
    earth_radius_m = 6_371_000

    for i in range(1, len(waypoints)):
        lat1 = radians(waypoints[i - 1]["lat"])
        lon1 = radians(waypoints[i - 1]["lng"])
        lat2 = radians(waypoints[i]["lat"])
        lon2 = radians(waypoints[i]["lng"])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = (
                sin(dlat / 2) ** 2
                + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        )

        c = 2 * asin(sqrt(min(1.0, a)))
        total_distance += earth_radius_m * c

    return total_distance


def estimate_route_flight(
        distance_m,
        speed_mps,
        battery_burn_per_sec,
):
    """Estimate flight time and battery use from route distance."""
    if distance_m < 0:
        raise ValueError("Distance cannot be negative")
    if speed_mps <= 0:
        raise ValueError("Speed must be greater than zero")
    if battery_burn_per_sec < 0:
        raise ValueError("Battery burn cannot be negative")

    flight_time_sec = distance_m / speed_mps
    battery_used_pct = flight_time_sec * battery_burn_per_sec

    return {
        "distance_m": round(distance_m, 2),
        "estimated_flight_time_sec": round(flight_time_sec, 2),
        "estimated_battery_used_pct": round(battery_used_pct, 2),
    }

def estimate_delivery_mission(
        outbound_distance_m,
        return_distance_m,
        current_battery_pct,
        speed_mps,
        battery_burn_per_sec,
        reserve_pct=15.0,
):
    """Estimate whether battery is sufficient for a round-trip mission."""

    if outbound_distance_m < 0 or return_distance_m < 0:
        raise ValueError("Route distances cannot be negative")
    if speed_mps <= 0:
        raise ValueError("Speed must be greater than zero")
    if battery_burn_per_sec < 0:
        raise ValueError("Battery burn cannot be negative")
    if not 0 <= current_battery_pct <= 100:
        raise ValueError("Battery must be between 0 and 100")
    if not 0 <= reserve_pct <= 100:
        raise ValueError("Reserve must be between 0 and 100")

    outbound = estimate_route_flight(
        outbound_distance_m,
        speed_mps,
        battery_burn_per_sec,
    )

    return_route = estimate_route_flight(
        return_distance_m,
        speed_mps,
        battery_burn_per_sec,
    )

    total_battery_needed = (
            outbound["estimated_battery_used_pct"]
            + return_route["estimated_battery_used_pct"]
            + reserve_pct
    )

    return {
        "outbound_distance_m": round(outbound_distance_m, 2),
        "return_distance_m": round(return_distance_m, 2),
        "estimated_total_flight_time_sec": round(
            outbound["estimated_flight_time_sec"]
            + return_route["estimated_flight_time_sec"],
            2,
            ),
        "estimated_battery_needed_pct": round(total_battery_needed, 2),
        "current_battery_pct": round(current_battery_pct, 2),
        "reserve_pct": reserve_pct,
        "decision": (
            "SUFFICIENT_BATTERY"
            if current_battery_pct >= total_battery_needed
            else "INSUFFICIENT_BATTERY"
        ),
    }
