
from datetime import datetime, timezone


REQUIRED_WEATHER_FIELDS = (
    "wind_speed_kmh",
    "wind_gusts_kmh",
    "precipitation_mm",
    "visibility_m",
    "temperature_c",
)


def check_weather(
        weather: dict,
        limits: dict,
        observed_at: datetime,
        max_age_minutes: int = 60,
) -> dict:
    """
    Evaluate weather data against configured UAV operating limits.

    This is a prototype dispatch gate, not a certified flight-safety system.
    """

    if not isinstance(weather, dict) or not isinstance(limits, dict):
        return {
            "decision": "HOLD",
            "reasons": ["Invalid weather data or limits"],
        }

    if observed_at.tzinfo is None:
        return {
            "decision": "HOLD",
            "reasons": ["Weather timestamp must include a timezone"],
        }

    if max_age_minutes < 0:
        return {
            "decision": "HOLD",
            "reasons": ["Invalid maximum weather-data age"],
        }

    age_seconds = (
            datetime.now(timezone.utc) - observed_at.astimezone(timezone.utc)
    ).total_seconds()

    if age_seconds < 0 or age_seconds > max_age_minutes * 60:
        return {
            "decision": "HOLD",
            "reasons": ["Weather data is stale or timestamp is in the future"],
        }

    missing = [
        field for field in REQUIRED_WEATHER_FIELDS
        if field not in weather or weather[field] is None
    ]

    if missing:
        return {
            "decision": "HOLD",
            "reasons": [f"Missing weather fields: {', '.join(missing)}"],
        }

    if not all(
            isinstance(weather[field], (int, float))
            and not isinstance(weather[field], bool)
            for field in REQUIRED_WEATHER_FIELDS
    ):
        return {
            "decision": "HOLD",
            "reasons": ["Weather fields must contain numeric values"],
        }

    if any(
            weather[field] < 0
            for field in (
                    "wind_speed_kmh",
                    "wind_gusts_kmh",
                    "precipitation_mm",
                    "visibility_m",
            )
    ):
        return {
            "decision": "HOLD",
            "reasons": ["Weather values cannot be negative"],
        }

    if weather["wind_gusts_kmh"] < weather["wind_speed_kmh"]:
        return {
            "decision": "HOLD",
            "reasons": ["Wind gusts cannot be lower than wind speed"],
        }

    required_limits = {
        "max_wind_speed_kmh",
        "max_wind_gusts_kmh",
        "max_precipitation_mm",
        "min_visibility_m",
        "min_temperature_c",
        "max_temperature_c",
    }

    if not required_limits.issubset(limits):
        return {
            "decision": "HOLD",
            "reasons": ["One or more weather operating limits are missing"],
        }

    if not all(
            isinstance(limits[field], (int, float))
            and not isinstance(limits[field], bool)
            for field in required_limits
    ):
        return {
            "decision": "HOLD",
            "reasons": ["Weather operating limits must be numeric"],
        }

    if (
            limits["max_wind_speed_kmh"] < 0
            or limits["max_wind_gusts_kmh"] < 0
            or limits["max_precipitation_mm"] < 0
            or limits["min_visibility_m"] < 0
            or limits["min_temperature_c"] > limits["max_temperature_c"]
    ):
        return {
            "decision": "HOLD",
            "reasons": ["Weather operating limits are invalid"],
        }

    reasons = []

    checks = (
        (
            weather["wind_speed_kmh"] > limits["max_wind_speed_kmh"],
            "Wind speed exceeds the configured limit",
        ),
        (
            weather["wind_gusts_kmh"] > limits["max_wind_gusts_kmh"],
            "Wind gusts exceed the configured limit",
        ),
        (
            weather["precipitation_mm"] > limits["max_precipitation_mm"],
            "Precipitation exceeds the configured limit",
        ),
        (
            weather["visibility_m"] < limits["min_visibility_m"],
            "Visibility is below the configured minimum",
        ),
        (
            weather["temperature_c"] < limits["min_temperature_c"],
            "Temperature is below the configured minimum",
        ),
        (
            weather["temperature_c"] > limits["max_temperature_c"],
            "Temperature exceeds the configured maximum",
        ),
    )

    reasons.extend(message for failed, message in checks if failed)

    return {
        "decision": "HOLD" if reasons else "GO",
        "reasons": reasons,
        "weather_age_seconds": round(age_seconds, 1),
    }
