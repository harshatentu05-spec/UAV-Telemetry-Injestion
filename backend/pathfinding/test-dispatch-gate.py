
from dispatch_gate import evaluate_dispatch


VALID_PLAN = {
    "decision": "SUFFICIENT_BATTERY",
    "outbound_waypoints": [
        {"lat": 12.9249, "lng": 80.1000},
        {"lat": 12.9204, "lng": 80.1000},
    ],
    "return_waypoints": [
        {"lat": 12.9204, "lng": 80.1000},
        {"lat": 12.9249, "lng": 80.1000},
    ],
    "battery_estimate": {
        "decision": "SUFFICIENT_BATTERY",
    },
}

SAFE_WEATHER = {
    "hub": {"decision": "GO"},
    "route": {"decision": "GO"},
    "destination": {"decision": "GO"},
}


def test_approved_mission():
    result = evaluate_dispatch(VALID_PLAN, SAFE_WEATHER)
    assert result["decision"] == "APPROVED", result
    print("PASS: Valid route, battery and weather approved")


def test_unsafe_weather():
    weather = {
        **SAFE_WEATHER,
        "route": {"decision": "HOLD"},
    }
    result = evaluate_dispatch(VALID_PLAN, weather)
    assert result["decision"] == "HOLD", result
    print("PASS: Unsafe weather blocks dispatch")


def test_insufficient_battery():
    plan = {
        **VALID_PLAN,
        "decision": "INSUFFICIENT_BATTERY",
        "battery_estimate": {"decision": "INSUFFICIENT_BATTERY"},
    }
    result = evaluate_dispatch(plan, SAFE_WEATHER)
    assert result["decision"] == "HOLD", result
    print("PASS: Insufficient battery blocks dispatch")


def test_missing_weather():
    result = evaluate_dispatch(VALID_PLAN, {})
    assert result["decision"] == "HOLD", result
    print("PASS: Missing weather blocks dispatch")


def test_missing_return_route():
    plan = {**VALID_PLAN, "return_waypoints": []}
    result = evaluate_dispatch(plan, SAFE_WEATHER)
    assert result["decision"] == "HOLD", result
    print("PASS: Missing return route blocks dispatch")


def test_invalid_mission_plan():
    result = evaluate_dispatch(None, SAFE_WEATHER)
    assert result["decision"] == "HOLD", result
    print("PASS: Invalid mission plan blocks dispatch")


if __name__ == "__main__":
    test_approved_mission()
    test_unsafe_weather()
    test_insufficient_battery()
    test_missing_weather()
    test_missing_return_route()
    test_invalid_mission_plan()

    print("\nAll dispatch gate tests passed.")
