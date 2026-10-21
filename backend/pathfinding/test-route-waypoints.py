
from astar import astar
from geo_adapter import (
    grid_route_to_waypoints,
    calculate_route_distance_meters,
    estimate_route_flight,
)


def test_route_to_geographic_waypoints():
    grid = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
    ]

    start = (0, 0)
    goal = (4, 4)

    origin_lat = 12.9249
    origin_lon = 80.1000
    cell_size_m = 100

    grid_route = astar(grid, start, goal)

    assert grid_route is not None, "No grid route found"

    waypoints = grid_route_to_waypoints(
        grid_route,
        origin_lat,
        origin_lon,
        cell_size_m,
    )

    assert len(waypoints) == len(grid_route)
    assert abs(waypoints[0]["lat"] - origin_lat) < 1e-9
    assert abs(waypoints[0]["lng"] - origin_lon) < 1e-9

    distance = calculate_route_distance_meters(waypoints)
    estimate = estimate_route_flight(
        distance_m=distance,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
    )

    print("Flight estimate:", estimate)

    assert estimate["estimated_flight_time_sec"] > 0
    assert estimate["estimated_battery_used_pct"] > 0

    assert distance > 0, "Route distance should be positive"

    print("Route distance (meters):", round(distance, 2))

    print("PASS: grid route converted to geographic waypoints")
    print("Waypoint count:", len(waypoints))
    print("First waypoint:", waypoints[0])
    print("Last waypoint:", waypoints[-1])


if __name__ == "__main__":
    test_route_to_geographic_waypoints()
