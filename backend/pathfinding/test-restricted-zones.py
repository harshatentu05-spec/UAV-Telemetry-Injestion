
from restricted_zones import block_rectangular_zone


def test_zone_blocks_cells():
    grid = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ]

    origin_lat = 12.9249
    origin_lon = 80.1000

    zone_bounds = {
        "min_lat": 12.9228,
        "max_lat": 12.9240,
        "min_lon": 80.1010,
        "max_lon": 80.1020,
    }

    block_rectangular_zone(
        grid,
        zone_bounds,
        origin_lat,
        origin_lon,
        cell_size_m=100,
    )

    blocked_cells = sum(
        cell == 1
        for row in grid
        for cell in row
    )

    assert blocked_cells > 0, "No cells were blocked"
    assert all(
        cell in (0, 1)
        for row in grid
        for cell in row
    ), "Grid contains unexpected values"

    print("PASS: geographic restricted zone blocks grid cells")
    print("Blocked cells:", blocked_cells)
    print("Updated grid:")
    for row in grid:
        print(row)


if __name__ == "__main__":
    test_zone_blocks_cells()
