
from geo_adapter import (
    find_geographic_route,
    latlon_to_grid,
    grid_to_latlon,
)


def test_coordinate_round_trip():
    origin_lat, origin_lon = 12.9249, 80.1000

    cell = latlon_to_grid(
        12.9231, 80.1020, origin_lat, origin_lon
    )
    lat, lon = grid_to_latlon(
        *cell, origin_lat, origin_lon
    )

    assert abs(lat - 12.9231) < 0.0006
    assert abs(lon - 80.1020) < 0.0006
    print("PASS: coordinate conversion")


def test_geographic_route():
    grid = [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ]

    start = (12.9249, 80.1000)
    goal = (12.9222, 80.1000)
    origin = (12.9249, 80.1000)

    print("Start grid:", latlon_to_grid(*start, *origin))
    print("Goal grid:", latlon_to_grid(*goal, *origin))

    route = find_geographic_route(
        grid,
        start_latlon=start,
        goal_latlon=goal,
        origin_lat=origin[0],
        origin_lon=origin[1],
        cell_size_m=100,
    )

    print("Route:", route)

    assert route is not None
    assert len(route) > 1
    print("PASS: geographic route generation")


if __name__ == "__main__":
    test_coordinate_round_trip()
    test_geographic_route()
