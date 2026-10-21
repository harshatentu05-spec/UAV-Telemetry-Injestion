
import json
import time
import random
import statistics
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

API_URL = "http://localhost:8000/ingest"
NUM_SOURCES = 100
DURATION_SECONDS = 30
INTERVAL_SECONDS = 1.0

results = []
results_lock = Lock()


def make_payload(source_id):
    return {
        "drone_id": source_id,
        "source_type": "benchmark",
        "timestamp": time.time(),
        "flight_dynamics": {
            "altitude_meters": round(random.uniform(50, 150), 2),
            "airspeed_knots": round(random.uniform(50, 120), 1),
        },
        "propulsion_systems": {
            "battery_state": {
                "capacity_remaining_percent": round(
                    random.uniform(40, 100), 1
                )
            }
        },
        "tactical_sensors": {
            "gps": {
                "latitude": round(random.uniform(12.8, 13.1), 5),
                "longitude": round(random.uniform(80.0, 80.3), 5),
            }
        },
    }


def source_worker(source_id, deadline):
    while time.monotonic() < deadline:
        started = time.perf_counter()
        status = None

        try:
            body = json.dumps(make_payload(source_id)).encode("utf-8")
            request = urllib.request.Request(
                API_URL,
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=5) as response:
                status = response.status
                response.read()

        except urllib.error.HTTPError as exc:
            status = exc.code
            exc.read()
        except Exception:
            status = None

        latency_ms = (time.perf_counter() - started) * 1000

        with results_lock:
            results.append({
                "status": status,
                "latency_ms": latency_ms,
            })

        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(INTERVAL_SECONDS, remaining))


def percentile(values, percent):
    if not values:
        return 0
    ordered = sorted(values)
    index = round((percent / 100) * (len(ordered) - 1))
    return ordered[index]


if __name__ == "__main__":
    run_id = int(time.time())
    prefix = f"UAV-BENCH-{run_id}"

    print(f"Sources: {NUM_SOURCES}")
    print(f"Duration: {DURATION_SECONDS}s")
    print(f"Benchmark ID: {run_id}")
    print("Starting benchmark...")

    start = time.monotonic()
    deadline = start + DURATION_SECONDS

    with ThreadPoolExecutor(max_workers=NUM_SOURCES) as pool:
        futures = [
            pool.submit(
                source_worker,
                f"{prefix}-{i:03d}",
                deadline,
            )
            for i in range(1, NUM_SOURCES + 1)
        ]
        for future in futures:
            future.result()

    elapsed = time.monotonic() - start
    successful = sum(
        1 for result in results
        if result["status"] is not None
        and 200 <= result["status"] < 300
    )
    failed = len(results) - successful
    latencies = [r["latency_ms"] for r in results]

    print("\n--- BENCHMARK RESULTS ---")
    print(f"Benchmark ID: {run_id}")
    print(f"Elapsed: {elapsed:.2f}s")
    print(f"Requests attempted: {len(results)}")
    print(f"HTTP successes: {successful}")
    print(f"Failures/timeouts: {failed}")
    print(f"Throughput: {len(results) / elapsed:.2f} requests/sec")

    if latencies:
        print(f"Mean latency: {statistics.mean(latencies):.2f} ms")
        print(f"p50 latency: {percentile(latencies, 50):.2f} ms")
        print(f"p95 latency: {percentile(latencies, 95):.2f} ms")
        print(f"p99 latency: {percentile(latencies, 99):.2f} ms")

    print(f"\nDatabase source prefix: {prefix}")
