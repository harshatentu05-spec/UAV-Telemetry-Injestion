
VALID_TRANSITIONS = {
    "PENDING": {"APPROVED", "ON_HOLD", "CANCELLED"},
    "APPROVED": {"EN_ROUTE", "CANCELLED", "ON_HOLD"},
    "ON_HOLD": {"PENDING", "CANCELLED"},
    "EN_ROUTE": {"COMPLETED", "ON_HOLD"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}


class MissionLifecycle:
    def __init__(self):
        self.missions = {}

    def create_mission(self, mission_id):
        if mission_id in self.missions:
            raise ValueError("Mission ID already exists")

        self.missions[mission_id] = {
            "status": "PENDING",
            "dispatch_claimed": False,
        }

        return self.get_mission(mission_id)

    def get_mission(self, mission_id):
        if mission_id not in self.missions:
            raise KeyError("Mission not found")

        return dict(self.missions[mission_id])

    def transition(self, mission_id, new_status):
        if mission_id not in self.missions:
            raise KeyError("Mission not found")

        mission = self.missions[mission_id]
        current_status = mission["status"]

        if new_status not in VALID_TRANSITIONS[current_status]:
            raise ValueError(
                f"Invalid transition: {current_status} -> {new_status}"
            )

        mission["status"] = new_status

        return self.get_mission(mission_id)

    def claim_dispatch(self, mission_id):
        if mission_id not in self.missions:
            raise KeyError("Mission not found")

        mission = self.missions[mission_id]

        if mission["status"] != "APPROVED":
            raise ValueError("Only approved missions can be dispatched")

        if mission["dispatch_claimed"]:
            raise ValueError("Dispatch already claimed")

        mission["dispatch_claimed"] = True
        mission["status"] = "EN_ROUTE"

        return self.get_mission(mission_id)
