
from mission_lifecycle import MissionLifecycle
from mission_dispatch import evaluate_mission


class MissionCoordinator:
    def __init__(self):
        self.lifecycle = MissionLifecycle()

    def evaluate_and_register(
            self,
            mission_id,
            grid,
            hub_latlon,
            destination_latlon,
            current_battery_pct,
            speed_mps=41.67,
            battery_burn_per_sec=0.125,
            reserve_pct=15.0,
            cell_size_m=100,
            weather_limits=None,
    ):
        self.lifecycle.create_mission(mission_id)

        result = evaluate_mission(
            grid=grid,
            hub_latlon=hub_latlon,
            destination_latlon=destination_latlon,
            current_battery_pct=current_battery_pct,
            speed_mps=speed_mps,
            battery_burn_per_sec=battery_burn_per_sec,
            reserve_pct=reserve_pct,
            cell_size_m=cell_size_m,
            weather_limits=weather_limits,
        )

        if result["decision"] == "APPROVED":
            self.lifecycle.transition(mission_id, "APPROVED")
        else:
            self.lifecycle.transition(mission_id, "ON_HOLD")

        return {
            "mission_id": mission_id,
            "status": self.lifecycle.get_mission(mission_id)["status"],
            "evaluation": result,
        }

    def dispatch(self, mission_id):
        return self.lifecycle.claim_dispatch(mission_id)
