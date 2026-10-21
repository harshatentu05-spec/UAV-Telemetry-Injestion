
from mission_lifecycle import MissionLifecycle


def test_create_mission():
    manager = MissionLifecycle()
    mission = manager.create_mission("MISSION-001")

    assert mission["status"] == "PENDING"
    print("PASS: Mission created in PENDING state")


def test_valid_transition():
    manager = MissionLifecycle()
    manager.create_mission("MISSION-002")

    manager.transition("MISSION-002", "APPROVED")
    assert manager.get_mission("MISSION-002")["status"] == "APPROVED"
    print("PASS: Valid state transition works")


def test_duplicate_mission_id():
    manager = MissionLifecycle()
    manager.create_mission("MISSION-003")

    try:
        manager.create_mission("MISSION-003")
        raise AssertionError("Duplicate mission ID was accepted")
    except ValueError:
        print("PASS: Duplicate mission ID rejected")


def test_invalid_transition():
    manager = MissionLifecycle()
    manager.create_mission("MISSION-004")

    try:
        manager.transition("MISSION-004", "COMPLETED")
        raise AssertionError("Invalid transition was accepted")
    except ValueError:
        print("PASS: Invalid transition rejected")


def test_dispatch_claim():
    manager = MissionLifecycle()
    manager.create_mission("MISSION-005")
    manager.transition("MISSION-005", "APPROVED")

    mission = manager.claim_dispatch("MISSION-005")

    assert mission["status"] == "EN_ROUTE"
    assert mission["dispatch_claimed"] is True
    print("PASS: Approved mission can be dispatched once")


def test_duplicate_dispatch_claim():
    manager = MissionLifecycle()
    manager.create_mission("MISSION-006")
    manager.transition("MISSION-006", "APPROVED")
    manager.claim_dispatch("MISSION-006")

    try:
        manager.claim_dispatch("MISSION-006")
        raise AssertionError("Duplicate dispatch was accepted")
    except ValueError:
        print("PASS: Duplicate dispatch rejected")


if __name__ == "__main__":
    test_create_mission()
    test_valid_transition()
    test_duplicate_mission_id()
    test_invalid_transition()
    test_dispatch_claim()
    test_duplicate_dispatch_claim()

    print("\nAll mission lifecycle tests passed.")
