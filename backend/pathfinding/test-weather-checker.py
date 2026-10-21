
from datetime import datetime, timezone, timedelta

from weather_checker import check_weather


LIMITS = {
    "max_wind_speed_kmh": 30,
    "max_wind_gusts_kmh": 40,
    "max_precipitation_mm": 0.5,
    "min_visibility_m": 1000,
    "min_temperature_c": 0,
    "max_temperature_c": 45,
}

SAFE_WEATHER = {
    "wind_speed_kmh": 12,
    "wind_gusts_kmh": 18,
    "precipitation_mm": 0,
    "visibility_m": 5000,
    "temperature_c": 28,
}


def test_safe_weather():
    result = check_weather(
        SAFE_WEATHER,
        LIMITS,
        datetime.now(timezone.utc),
    )
    assert result["decision"] == "GO"
    print("PASS: Safe weather returns GO")


def test_high_wind():
    weather = {**SAFE_WEATHER, "wind_speed_kmh": 35, "wind_gusts_kmh": 38}
    result = check_weather(weather, LIMITS, datetime.now(timezone.utc))
    assert result["decision"] == "HOLD"
    print("PASS: High wind returns HOLD")


def test_missing_data():
    weather = {**SAFE_WEATHER}
    del weather["visibility_m"]
    result = check_weather(weather, LIMITS, datetime.now(timezone.utc))
    assert result["decision"] == "HOLD"
    print("PASS: Missing data returns HOLD")


def test_stale_data():
    old_timestamp = datetime.now(timezone.utc) - timedelta(hours=2)
    result = check_weather(SAFE_WEATHER, LIMITS, old_timestamp)
    assert result["decision"] == "HOLD"
    print("PASS: Stale data returns HOLD")


def test_invalid_wind():
    weather = {**SAFE_WEATHER, "wind_speed_kmh": 50, "wind_gusts_kmh": 20}
    result = check_weather(weather, LIMITS, datetime.now(timezone.utc))
    assert result["decision"] == "HOLD"
    print("PASS: Invalid wind data returns HOLD")


if __name__ == "__main__":
    test_safe_weather()
    test_high_wind()
    test_missing_data()
    test_stale_data()
    test_invalid_wind()
    print("\nAll weather checker tests passed.")
