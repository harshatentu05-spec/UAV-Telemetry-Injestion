
import pytest

from simulation_safety import (
    should_return_to_hub,
    move_toward_waypoint,
)


def test_low_battery_triggers_return():
    assert should_return_to_hub(
        battery_pct=14,
        return_distance_m=1000,
        speed_mps=10,
        battery_burn_per_sec=0.1,
        reserve_pct=5,
    )


def test_sufficient_battery_does_not_trigger_return():
    assert not should_return_to_hub(
        battery_pct=50,
        return_distance_m=1000,
        speed_mps=10,
        battery_burn_per_sec=0.1,
        reserve_pct=5,
    )


def test_movement_stops_at_waypoint():
    lat, lng, arrived = move_toward_waypoint(
        12.9249, 80.1000,
        12.9249, 80.1001,
        max_step_m=100,
    )
    assert arrived
    assert lat == pytest.approx(12.9249)
    assert lng == pytest.approx(80.1001)


def test_movement_is_limited_to_step():
    start_lat, start_lng = 12.9249, 80.1000
    lat, lng, arrived = move_toward_waypoint(
        start_lat, start_lng,
        12.9349, 80.1000,
        max_step_m=10,
    )
    assert not arrived
    assert 12.9249 < lat < 12.9349
    assert lng == pytest.approx(start_lng)


def test_invalid_speed_is_rejected():
    with pytest.raises(ValueError):
        should_return_to_hub(50, 100, 0, 0.1)



from simulation_safety import advance_route


def test_route_advances_to_next_waypoint():
    route = [
        {"lat": 12.9249, "lng": 80.1000},
        {"lat": 12.9249, "lng": 80.1001},
    ]

    lat, lng, index, complete = advance_route(
        12.9249, 80.1000, route, 0, 1
    )

    assert index == 1
    assert not complete


def test_empty_route_fails_closed():
    import pytest

    with pytest.raises(ValueError):
        advance_route(12.9249, 80.1000, [], 0, 10)
