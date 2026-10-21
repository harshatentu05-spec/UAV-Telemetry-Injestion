
from astar import astar
from restricted_zones import block_rectangular_zone
from geo_adapter import latlon_to_grid


def test_astar_avoids_restricted_zone():
    grid = [[0 for _ in range(10)] for _ in range(10)]

    origin_lat = 12.9249
    origin_lon = 80.1000

    zone_bounds = {
        "min_lat": 12.9222,
        "max_lat": 12.9235,
        "min_lon": 80.1002,
        "max_lon": 80.1007,
    }

    block_rectangular_zone(
        grid,
        zone_bounds,
        origin_lat,
        origin_lon,
        cell_size_m=100,
    )

    start = (0, 0)
    goal = (9, 0)

    route = astar(grid, start, goal)

    assert route is not None, "No route found"
    assert all(grid[r][c] == 0 for r, c in route), (
        "Route crosses a restricted cell"
    )

    print("PASS: A* found a route avoiding blocked cells")
    print("Route:", route)


if __name__ == "__main__":
    test_astar_avoids_restricted_zone()
