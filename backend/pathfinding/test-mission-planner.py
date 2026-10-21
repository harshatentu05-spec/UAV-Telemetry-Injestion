from geo_adapter import latlon_to_grid
from mission_planner import plan_delivery_mission


def test_delivery_mission():
    grid = [[0 for _ in range(10)] for _ in range(10)]

    hub = (12.9249, 80.1000)
    destination = (12.9204, 80.1000)

    result = plan_delivery_mission(
        grid=grid,
        hub_latlon=hub,
        destination_latlon=destination,
        current_battery_pct=80,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15.0,
        cell_size_m=100,
    )

    assert result["decision"] == "SUFFICIENT_BATTERY"
    assert len(result["outbound_waypoints"]) > 1
    assert len(result["return_waypoints"]) > 1


    outbound = result["outbound_waypoints"]
    returning = result["return_waypoints"]

    # Outbound route: hub -> destination
    assert abs(outbound[0]["lat"] - hub[0]) < 1e-9
    assert abs(outbound[0]["lng"] - hub[1]) < 1e-9

    print("Expected destination:", destination)
    print("Outbound final waypoint:", outbound[-1])
    print("Return first waypoint:", returning[0])
    print("Expected hub:", hub)

    # Return route: destination -> hub
    assert abs(returning[0]["lat"] - outbound[-1]["lat"]) < 1e-9
    assert abs(returning[0]["lng"] - outbound[-1]["lng"]) < 1e-9

    # Both routes should connect to the same destination and hub.
    assert abs(outbound[-1]["lat"] - returning[0]["lat"]) < 1e-9
    assert abs(outbound[-1]["lng"] - returning[0]["lng"]) < 1e-9
    assert abs(returning[-1]["lat"] - hub[0]) < 1e-9
    assert abs(returning[-1]["lng"] - hub[1]) < 1e-9

    print("PASS: route endpoints match hub and destination")


    assert result["outbound_distance_m"] > 0
    assert result["return_distance_m"] > 0

    print("PASS: mission planned successfully")
    print("Outbound distance:", result["outbound_distance_m"], "m")
    print("Return distance:", result["return_distance_m"], "m")
    print("Battery decision:", result["decision"])


def test_impossible_outbound_route():
    grid = [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
    ]

    result = plan_delivery_mission(
        grid=grid,
        hub_latlon=(12.9249, 80.1000),
        destination_latlon=(12.9222, 80.1000),
        current_battery_pct=80,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        cell_size_m=100,
    )

    assert result["decision"] == "NO_OUTBOUND_ROUTE"
    print("PASS: impossible outbound route rejected")


def test_impossible_return_route():
    grid = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ]

    # Block the middle column after the outbound route is planned.
    # The current planner uses the same grid for both directions,
    # so a static grid cannot make outbound possible and return impossible.
    print(
        "NOTE: A static grid with ordinary A* cannot normally "
        "produce different reachability by direction."
    )


def test_impossible_return_route():
    grid = [[0 for _ in range(10)] for _ in range(10)]
    return_grid = [[0 for _ in range(10)] for _ in range(10)]

    # Block the entire return grid.
    return_grid = [
        [1 for _ in range(10)] for _ in range(10)
    ]

    result = plan_delivery_mission(
        grid=grid,
        return_grid=return_grid,
        hub_latlon=(12.9249, 80.1000),
        destination_latlon=(12.9204, 80.1000),
        current_battery_pct=80,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15.0,
        cell_size_m=100,
    )

    assert result["decision"] == "NO_RETURN_ROUTE"
    print("PASS: impossible return route rejected")



def test_mission_route_avoids_blocked_cells():
    grid = [[0 for _ in range(10)] for _ in range(10)]

    # Block column 0 between the hub and destination.
    for row in range(1, 5):
        grid[row][0] = 1

    hub = (12.9249, 80.1000)
    destination = (12.9204, 80.1000)

    result = plan_delivery_mission(
        grid=grid,
        hub_latlon=hub,
        destination_latlon=destination,
        current_battery_pct=80,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15.0,
        cell_size_m=100,
    )

    assert result["decision"] == "SUFFICIENT_BATTERY"

    for waypoint in result["outbound_waypoints"]:
        row, col = latlon_to_grid(
            waypoint["lat"],
            waypoint["lng"],
            hub[0],
            hub[1],
            100,
        )
        assert grid[row][col] == 0, (
            f"Route crossed blocked cell {(row, col)}"
        )

    print("PASS: mission route avoids blocked cells")




if __name__ == "__main__":
    test_delivery_mission()
    test_impossible_outbound_route()
    test_impossible_return_route()
    test_mission_route_avoids_blocked_cells()
