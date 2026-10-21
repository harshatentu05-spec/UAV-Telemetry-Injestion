
from mission_coordinator import MissionCoordinator
import mission_coordinator


def test_weather_hold_cannot_dispatch():
    def fake_evaluate_mission(*args, **kwargs):
        return {
            "decision": "HOLD",
            "reasons": ["Test weather is unsafe"],
            "mission_plan": {
                "decision": "SUFFICIENT_BATTERY",
                "outbound_waypoints": [{"lat": 12.9204, "lng": 80.1000}],
                "return_waypoints": [{"lat": 12.9249, "lng": 80.1000}],
                "battery_estimate": {"decision": "SUFFICIENT_BATTERY"},
            },
            "weather_decisions": {
                "hub": {
                    "decision": "HOLD",
                    "reasons": ["Test wind exceeds limit"],
                }
            },
        }

    original_evaluate_mission = mission_coordinator.evaluate_mission
    mission_coordinator.evaluate_mission = fake_evaluate_mission

    try:
        coordinator = MissionCoordinator()

        result = coordinator.evaluate_and_register(
            mission_id="TEST-HOLD-001",
            grid=[[0 for _ in range(10)] for _ in range(10)],
            hub_latlon=(12.9249, 80.1000),
            destination_latlon=(12.9204, 80.1000),
            current_battery_pct=80,
        )

        assert result["status"] == "ON_HOLD", result

        try:
            coordinator.dispatch("TEST-HOLD-001")
            raise AssertionError("Held mission was dispatched")
        except ValueError:
            pass

        print("PASS: Unsafe-weather mission is held")
        print("PASS: Held mission cannot be dispatched")
    finally:
        mission_coordinator.evaluate_mission = original_evaluate_mission


def test_duplicate_mission_rejected():
    coordinator = MissionCoordinator()
    coordinator.lifecycle.create_mission("TEST-DUPLICATE")

    try:
        coordinator.lifecycle.create_mission("TEST-DUPLICATE")
        raise AssertionError("Duplicate mission ID was accepted")
    except ValueError:
        print("PASS: Duplicate mission ID rejected")


if __name__ == "__main__":
    test_weather_hold_cannot_dispatch()
    test_duplicate_mission_rejected()
