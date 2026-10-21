
from datetime import datetime

from weather_api import fetch_weather
from weather_checker import check_weather


LIMITS = {
    "max_wind_speed_kmh": 30,
    "max_wind_gusts_kmh": 40,
    "max_precipitation_mm": 0.5,
    "min_visibility_m": 1000,
    "min_temperature_c": 0,
    "max_temperature_c": 45,
}

# Example route only; these are not live mission waypoints.
ROUTE = [
    {"name": "Hub", "lat": 12.9249, "lng": 80.1000},
    {"name": "Route point 1", "lat": 12.9235, "lng": 80.1000},
    {"name": "Route point 2", "lat": 12.9220, "lng": 80.1000},
    {"name": "Destination", "lat": 12.9204, "lng": 80.1000},
]


def main():
    decisions = []

    for point in ROUTE:
        print(f"\nChecking: {point['name']}")

        try:
            result = fetch_weather(point["lat"], point["lng"])

            decision = check_weather(
                result["weather"],
                LIMITS,
                datetime.fromisoformat(result["retrieved_at"]),
            )

            print("Forecast:", result["forecast_for"])
            print("Decision:", decision["decision"])
            print("Reasons:", decision["reasons"])

            decisions.append(decision["decision"])

        except (RuntimeError, ValueError, OSError) as exc:
            print("Weather unavailable:", exc)
            decisions.append("HOLD")

    mission_decision = (
        "GO" if decisions and all(d == "GO" for d in decisions)
        else "HOLD"
    )

    print("\nRoute-wide mission decision:", mission_decision)


if __name__ == "__main__":
    main()
