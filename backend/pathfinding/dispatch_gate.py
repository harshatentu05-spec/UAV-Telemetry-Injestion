
def evaluate_dispatch(mission_plan, weather_decisions):
    """
    Decide whether a planned mission may proceed.

    This gate evaluates route feasibility, battery sufficiency,
    and weather decisions. It does not physically command a drone.
    """

    if not isinstance(mission_plan, dict):
        return {
            "decision": "HOLD",
            "reasons": ["Invalid mission plan"],
        }

    if not isinstance(weather_decisions, dict) or not weather_decisions:
        return {
            "decision": "HOLD",
            "reasons": ["Weather decisions are missing"],
        }

    reasons = []

    # A valid mission requires both outbound and return routes.
    if mission_plan.get("decision") != "SUFFICIENT_BATTERY":
        reasons.append(
            f"Mission planning rejected: {mission_plan.get('decision', 'UNKNOWN')}"
        )

    if not mission_plan.get("outbound_waypoints"):
        reasons.append("Outbound route is missing")

    if not mission_plan.get("return_waypoints"):
        reasons.append("Return route is missing")

    battery = mission_plan.get("battery_estimate", {})

    if not isinstance(battery, dict):
        reasons.append("Battery estimate is invalid")
    elif battery.get("decision") != "SUFFICIENT_BATTERY":
        reasons.append("Battery reserve requirement is not satisfied")

    # Every required weather checkpoint must explicitly return GO.
    for location, result in weather_decisions.items():
        if not isinstance(result, dict):
            reasons.append(f"{location}: invalid weather result")
            continue

        if result.get("decision") != "GO":
            reasons.append(f"{location}: weather is not approved")

    return {
        "decision": "APPROVED" if not reasons else "HOLD",
        "reasons": reasons,
    }
