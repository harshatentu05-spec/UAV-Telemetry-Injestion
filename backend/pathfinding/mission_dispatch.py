
from datetime import datetime

from dispatch_gate import evaluate_dispatch
from mission_planner import plan_delivery_mission
from weather_api import fetch_weather
from weather_checker import check_weather


DEFAULT_WEATHER_LIMITS = {
    "max_wind_speed_kmh": 30,
    "max_wind_gusts_kmh": 40,
    "max_precipitation_mm": 0.5,
    "min_visibility_m": 1000,
    "min_temperature_c": 0,
    "max_temperature_c": 45,
}


def evaluate_mission(
        grid,
        hub_latlon,
        destination_latlon,
        current_battery_pct,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15.0,
        cell_size_m=100,
        weather_limits=None,
):
    """Plan a mission and evaluate weather and battery feasibility."""

    limits = (
        weather_limits
        if weather_limits is not None
        else DEFAULT_WEATHER_LIMITS
    )

    # First, plan the outbound and return routes.
    plan = plan_delivery_mission(
        grid=grid,
        hub_latlon=hub_latlon,
        destination_latlon=destination_latlon,
        current_battery_pct=current_battery_pct,
        speed_mps=speed_mps,
        battery_burn_per_sec=battery_burn_per_sec,
        reserve_pct=reserve_pct,
        cell_size_m=cell_size_m,
    )

    # Do not fetch weather if route planning or battery estimation failed.
    if plan.get("decision") != "SUFFICIENT_BATTERY":
        return evaluate_dispatch(plan, {})

    # Check weather at the hub, destination, and outbound waypoints.
    checkpoints = {
        "hub": hub_latlon,
        "destination": destination_latlon,
    }

    for index, waypoint in enumerate(plan["outbound_waypoints"]):
        checkpoints[f"outbound_point_{index}"] = (
            waypoint["lat"],
            waypoint["lng"],
        )

    for index, waypoint in enumerate(plan["return_waypoints"]):
         checkpoints[f"return_point_{index}"] = (
             waypoint["lat"],
             waypoint["lng"],
         )

    weather_decisions = {}

    for name, (latitude, longitude) in checkpoints.items():
        try:
            result = fetch_weather(latitude, longitude)

            weather_decisions[name] = check_weather(
                result["weather"],
                limits,
                datetime.fromisoformat(result["retrieved_at"]),
            )

        except (RuntimeError, ValueError, OSError) as exc:
            weather_decisions[name] = {
                "decision": "HOLD",
                "reasons": [f"Weather unavailable: {exc}"],
            }

    gate = evaluate_dispatch(plan, weather_decisions)

    return {
        "decision": gate["decision"],
        "reasons": gate["reasons"],
        "mission_plan": plan,
        "weather_decisions": weather_decisions,
    }
