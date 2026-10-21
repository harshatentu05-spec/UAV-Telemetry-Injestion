
from astar import astar
from geo_adapter import (
    find_geographic_route,
    grid_route_to_waypoints,
    calculate_route_distance_meters,
    estimate_delivery_mission,
)


def plan_delivery_mission(
        grid,
        hub_latlon,
        destination_latlon,
        current_battery_pct,
        speed_mps,
        battery_burn_per_sec,
        reserve_pct=15.0,
        origin_lat=None,
        origin_lon=None,
        cell_size_m=100,
        return_grid=None,

):
    """Plan outbound and return routes and estimate battery feasibility."""

    if origin_lat is None:
        origin_lat = hub_latlon[0]
    if origin_lon is None:
        origin_lon = hub_latlon[1]

    outbound_grid_route = astar(
        grid,
        _coordinate_to_grid(
            hub_latlon, origin_lat, origin_lon, cell_size_m
        ),
        _coordinate_to_grid(
            destination_latlon, origin_lat, origin_lon, cell_size_m
        ),
    )

    if outbound_grid_route is None:
        return {"decision": "NO_OUTBOUND_ROUTE"}

    # Return route is calculated separately, starting at the destination.
    return_grid_route = astar(
        return_grid if return_grid is not None else grid,
        _coordinate_to_grid(
            destination_latlon, origin_lat, origin_lon, cell_size_m
        ),
        _coordinate_to_grid(
            hub_latlon, origin_lat, origin_lon, cell_size_m
        ),
    )

    if return_grid_route is None:
        return {"decision": "NO_RETURN_ROUTE"}

    outbound_waypoints = grid_route_to_waypoints(
        outbound_grid_route, origin_lat, origin_lon, cell_size_m
    )
    return_waypoints = grid_route_to_waypoints(
        return_grid_route, origin_lat, origin_lon, cell_size_m
    )

    outbound_distance = calculate_route_distance_meters(
        outbound_waypoints
    )
    return_distance = calculate_route_distance_meters(return_waypoints)

    battery = estimate_delivery_mission(
        outbound_distance_m=outbound_distance,
        return_distance_m=return_distance,
        current_battery_pct=current_battery_pct,
        speed_mps=speed_mps,
        battery_burn_per_sec=battery_burn_per_sec,
        reserve_pct=reserve_pct,
    )

    return {
        "decision": battery["decision"],
        "outbound_waypoints": outbound_waypoints,
        "return_waypoints": return_waypoints,
        "outbound_distance_m": round(outbound_distance, 2),
        "return_distance_m": round(return_distance, 2),
        "battery_estimate": battery,
    }


def _coordinate_to_grid(latlon, origin_lat, origin_lon, cell_size_m):
    from geo_adapter import latlon_to_grid

    return latlon_to_grid(
        latlon[0],
        latlon[1],
        origin_lat,
        origin_lon,
        cell_size_m,
    )
