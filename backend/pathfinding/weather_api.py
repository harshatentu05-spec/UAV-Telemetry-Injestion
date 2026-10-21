
import json
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_weather(latitude: float, longitude: float) -> dict:
    """Fetch the next hourly forecast for a geographic location."""

    if not (-90 <= latitude <= 90):
        raise ValueError("Latitude must be between -90 and 90")

    if not (-180 <= longitude <= 180):
        raise ValueError("Longitude must be between -180 and 180")

    params = urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "hourly": (
            "temperature_2m,wind_speed_10m,wind_gusts_10m,"
            "precipitation,visibility"
        ),
        "forecast_hours": 6,
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "timezone": "UTC",
    })

    request = Request(
        f"{API_URL}?{params}",
        headers={"User-Agent": "UAV-Delivery-Prototype/1.0"},
    )

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RuntimeError("Unable to retrieve weather forecast") from exc

    hourly = payload.get("hourly")
    if not isinstance(hourly, dict):
        raise RuntimeError("Weather provider returned no hourly forecast")

    required = (
        "time",
        "temperature_2m",
        "wind_speed_10m",
        "wind_gusts_10m",
        "precipitation",
        "visibility",
    )

    if any(not isinstance(hourly.get(key), list) for key in required):
        raise RuntimeError("Weather provider response is incomplete")

    if not hourly["time"]:
        raise RuntimeError("Weather provider returned no forecast hours")

    # Find the forecast hour closest to the current time.
    now = datetime.now(timezone.utc)
    forecast_times = [
        datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        for value in hourly["time"]
    ]

    future_indices = [
        i for i, forecast_time in enumerate(forecast_times)
        if forecast_time >= now
    ]

    if not future_indices:
        raise RuntimeError("No upcoming forecast hour is available")

    index = future_indices[0]

    weather = {
        "temperature_c": hourly["temperature_2m"][index],
        "wind_speed_kmh": hourly["wind_speed_10m"][index],
        "wind_gusts_kmh": hourly["wind_gusts_10m"][index],
        "precipitation_mm": hourly["precipitation"][index],
        "visibility_m": hourly["visibility"][index],
    }

    if any(value is None for value in weather.values()):
        raise RuntimeError("Forecast contains missing weather values")

    return {
        "weather": weather,
        "forecast_for": forecast_times[index].isoformat(),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "source": "Open-Meteo",
    }
