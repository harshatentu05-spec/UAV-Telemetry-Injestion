
from geo_adapter import estimate_delivery_mission


def test_sufficient_battery():
    result = estimate_delivery_mission(
        outbound_distance_m=1000,
        return_distance_m=1000,
        current_battery_pct=50,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15.0,
    )

    assert result["decision"] == "SUFFICIENT_BATTERY"
    print("PASS: sufficient battery")
    print(result)


def test_insufficient_battery():
    result = estimate_delivery_mission(
        outbound_distance_m=5000,
        return_distance_m=5000,
        current_battery_pct=30,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15.0,
    )

    assert result["decision"] == "INSUFFICIENT_BATTERY"
    print("PASS: insufficient battery")
    print(result)


def test_invalid_inputs():
    try:
        estimate_delivery_mission(
            outbound_distance_m=-100,
            return_distance_m=100,
            current_battery_pct=50,
            speed_mps=41.67,
            battery_burn_per_sec=0.125,
        )
    except ValueError:
        print("PASS: negative distance rejected")
    else:
        raise AssertionError("Negative distance was accepted")

    try:
        estimate_delivery_mission(
            outbound_distance_m=100,
            return_distance_m=100,
            current_battery_pct=50,
            speed_mps=0,
            battery_burn_per_sec=0.125,
        )
    except ValueError:
        print("PASS: zero speed rejected")
    else:
        raise AssertionError("Zero speed was accepted")

    try:
        estimate_delivery_mission(
            outbound_distance_m=100,
            return_distance_m=100,
            current_battery_pct=120,
            speed_mps=41.67,
            battery_burn_per_sec=0.125,
        )
    except ValueError:
        print("PASS: invalid battery percentage rejected")
    else:
        raise AssertionError("Invalid battery percentage was accepted")



if __name__ == "__main__":
    test_sufficient_battery()
    test_insufficient_battery()
    test_invalid_inputs()
