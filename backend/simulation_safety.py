
from math import hypot


def should_return_to_hub(
        battery_pct: float,
        return_distance_m: float,
        speed_mps: float,
        battery_burn_per_sec: float,
        reserve_pct: float = 15.0,
) -> bool:
    """Return when battery cannot cover estimated return use plus reserve."""
    if speed_mps <= 0:
        raise ValueError("speed_mps must be greater than zero")
    if return_distance_m < 0 or battery_burn_per_sec < 0:
        raise ValueError("Distance and battery burn cannot be negative")

    required = (
            return_distance_m / speed_mps * battery_burn_per_sec
            + reserve_pct
    )
    return battery_pct <= required


def move_toward_waypoint(
        lat: float,
        lng: float,
        target_lat: float,
        target_lng: float,
        max_step_m: float,
) -> tuple[float, float, bool]:
    """Move a simulated position toward one waypoint by at most max_step_m."""
    if max_step_m < 0:
        raise ValueError("max_step_m cannot be negative")

    # Local approximation suitable for short simulation steps.
    meters_per_lat_degree = 111_320.0
    meters_per_lng_degree = (
            111_320.0 * __import__("math").cos(__import__("math").radians(lat))
    )

    dx = (target_lng - lng) * meters_per_lng_degree
    dy = (target_lat - lat) * meters_per_lat_degree
    distance = hypot(dx, dy)

    if distance <= max_step_m or distance == 0:
        return target_lat, target_lng, True

    ratio = max_step_m / distance
    next_lat = lat + (target_lat - lat) * ratio
    next_lng = lng + (target_lng - lng) * ratio
    return next_lat, next_lng, False


def advance_route(
        lat: float,
        lng: float,
        waypoints: list[dict],
        waypoint_index: int,
        max_step_m: float,
) -> tuple[float, float, int, bool]:
    """Advance a drone along an existing route, one waypoint at a time."""
    if not waypoints:
        raise ValueError("Cannot move without a validated route")

    if not 0 <= waypoint_index < len(waypoints):
        raise ValueError("Invalid waypoint index")

    target = waypoints[waypoint_index]

    next_lat, next_lng, arrived = move_toward_waypoint(
        lat,
        lng,
        target["lat"],
        target["lng"],
        max_step_m,
    )

    next_index = waypoint_index + 1 if arrived else waypoint_index
    route_complete = arrived and next_index >= len(waypoints)

    return next_lat, next_lng, next_index, route_complete
