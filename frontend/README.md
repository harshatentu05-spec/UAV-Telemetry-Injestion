# SKYGRID Frontend — Backend Integration

React + Vite + Leaflet + Three.js frontend for the existing SKYGRID UAV telemetry backend.

## Run locally

Requirements: Node.js 20.19+ or 22.12+, npm, and the existing Dockerized backend stack.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The default API URL is `http://localhost:8000`. Set `VITE_API_BASE_URL` in `.env` to the backend's reachable base URL (no trailing slash). The WebSocket URL is derived automatically (`http` → `ws`, `https` → `wss`). Restart Vite after changing `.env`.

## Backend contracts used

- `GET /health` — API health check (useful for diagnosis)
- `GET /drones` — current simulator/backend fleet snapshot
- `WS /ws/telemetry` — live telemetry stream
- `GET /drones/{drone_id}/history?limit=N` — persisted telemetry history
- `POST /missions/evaluate` — mission evaluation (evaluation only; not physical dispatch)

The UI reads backend data. It must show missing values as unavailable rather than inventing live values. Live telemetry connection does not prove a physical aircraft is safe or executing a commanded action.

## Required backend response metadata

The included `backend-integration-patch/main.py.patch` adds `speed_mps`, `altitude_m`, `target_lat`, `target_lng`, and `progress` to `GET /drones`, and target/progress metadata to simulator WebSocket packets. Without these fields, the UI can display position/battery/state but cannot reliably display the simulator's target path.

## Validate

```powershell
npm run build
npm run lint
```

## Safety boundary

This is a development UI, not a certified flight-control system. Geofence enforcement and low-battery state transitions must be enforced and tested in the authoritative backend or flight controller. `/missions/evaluate` evaluates a plan; it does not dispatch it to a real aircraft.
