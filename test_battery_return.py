
SPEED_MPS = 41.67
BATTERY_BURN_PER_SEC = 0.125
MIN_BATTERY_RESERVE_PCT = 15.0


def calculate_return_battery_required(distance_m):
    estimated_return_seconds = distance_m / SPEED_MPS
    return (
            estimated_return_seconds * BATTERY_BURN_PER_SEC
            + MIN_BATTERY_RESERVE_PCT
    )


def should_return(battery, distance_m):
    required = calculate_return_battery_required(distance_m)
    return battery <= required + BATTERY_BURN_PER_SEC


# Test 1: Battery comfortably above the requirement
assert not should_return(80.0, 1000.0)

# Test 2: Battery at the return threshold
required = calculate_return_battery_required(5000.0)
assert should_return(required, 5000.0)

# Test 3: Battery below the return threshold
assert should_return(10.0, 5000.0)

print("All 3 battery-threshold tests passed.")
