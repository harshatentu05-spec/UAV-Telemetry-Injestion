
from mission_dispatch import evaluate_mission


# Small open grid for testing only.
GRID = [[0 for _ in range(10)] for _ in range(10)]

HUB = (12.9249, 80.1000)
DESTINATION = (12.9204, 80.1000)


if __name__ == "__main__":
    result = evaluate_mission(
        grid=GRID,
        hub_latlon=HUB,
        destination_latlon=DESTINATION,
        current_battery_pct=80,
        speed_mps=41.67,
        battery_burn_per_sec=0.125,
        reserve_pct=15,
        cell_size_m=100,
    )

    print("Mission decision:", result["decision"])
    print("Reasons:", result["reasons"])

    if "mission_plan" in result:
        print(
            "Outbound distance:",
            result["mission_plan"]["outbound_distance_m"],
            "m",
        )
        print(
            "Return distance:",
            result["mission_plan"]["return_distance_m"],
            "m",
        )

    print("\nWeather decisions:")
    for location, decision in result.get("weather_decisions", {}).items():
        print(location, "->", decision["decision"], decision["reasons"])
