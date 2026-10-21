
def block_rectangular_zone(
        grid,
        zone_bounds,
        origin_lat,
        origin_lon,
        cell_size_m=100,
):
    """
    Mark grid cells inside a rectangular geographic zone as blocked.

    zone_bounds: {
        "min_lat": ...,
        "max_lat": ...,
        "min_lon": ...,
        "max_lon": ...
    }

    Modifies grid in place. 0 = traversable, 1 = blocked.
    """
    from geo_adapter import latlon_to_grid

    top_left = latlon_to_grid(
        zone_bounds["max_lat"],
        zone_bounds["min_lon"],
        origin_lat,
        origin_lon,
        cell_size_m,
    )
    bottom_right = latlon_to_grid(
        zone_bounds["min_lat"],
        zone_bounds["max_lon"],
        origin_lat,
        origin_lon,
        cell_size_m,
    )

    rows = len(grid)
    cols = len(grid[0]) if rows else 0

    r_start = max(0, min(top_left[0], bottom_right[0]))
    r_end = min(rows - 1, max(top_left[0], bottom_right[0]))
    c_start = max(0, min(top_left[1], bottom_right[1]))
    c_end = min(cols - 1, max(top_left[1], bottom_right[1]))

    for r in range(r_start, r_end + 1):
        for c in range(c_start, c_end + 1):
            grid[r][c] = 1

    return grid
