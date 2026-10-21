
from datetime import datetime
from weather_api import fetch_weather
from weather_checker import check_weather


HUB_LAT = 12.9249
HUB_LNG = 80.1000

LIMITS = {
    "max_wind_speed_kmh": 30,
    "max_wind_gusts_kmh": 40,
    "max_precipitation_mm": 0.5,
    "min_visibility_m": 1000,
    "min_temperature_c": 0,
    "max_temperature_c": 45,
}


if __name__ == "__main__":
    result = fetch_weather(HUB_LAT, HUB_LNG)

    print("Weather source:", result["source"])
    print("Forecast for:", result["forecast_for"])
    print("Retrieved at:", result["retrieved_at"])
    print("Weather:", result["weather"])

    # Use retrieval time for data freshness, not the forecast hour.
    observed_at = datetime.fromisoformat(result["retrieved_at"])

    decision = check_weather(
        result["weather"],
        LIMITS,
        observed_at,
    )

    print("Dispatch decision:", decision)
