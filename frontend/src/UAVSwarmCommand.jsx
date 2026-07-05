import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  BatteryWarning,
  Navigation,
  Wind,
  ArrowUp,
  Activity,
  AlertTriangle,
  Radio,
  Crosshair,
  MapPin,
  ChevronRight,
  Gauge,
  TrendingUp,
  Clock,
  ListChecks,
  X,
  BarChart3,
  Search,
  Home,
} from "lucide-react";

// ─── Config ──────────────────────────────────────────────────────────────────

const WS_URL = "ws://localhost:8000/ws/telemetry";
const STALE_TIMEOUT_MS = 8000; // mark a drone OFFLINE if no packet in this window
const STALE_CHECK_INTERVAL_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
const ASSUMED_FULL_ENDURANCE_MIN = 40; // heuristic full-charge endurance, for decision support only

// ─── Live WebSocket Hook ─────────────────────────────────────────────────────
// Handles reconnection with backoff, prunes drones that go silent, and exposes
// a connection status so the UI can distinguish "no drones yet" from "server
// unreachable".

function useLiveSwarmStream(url = WS_URL) {
  const [swarm, setSwarm] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // connecting | connected | disconnected

  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConnectionStatus((prev) => (prev === "connected" ? prev : "connecting"));

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        let packet;
        try {
          packet = JSON.parse(event.data);
        } catch (err) {
          console.error("Packet parse error:", err);
          return;
        }
        if (!packet?.drone_id) return;

        const batteryLevel =
          packet?.propulsion_systems?.battery_state?.capacity_remaining_percent ?? 100;
        const currentStatus =
          batteryLevel < 10 ? "CRITICAL" : batteryLevel < 20 ? "WARNING" : "ACTIVE";

        setSwarm((prev) => ({
          ...prev,
          [packet.drone_id]: {
            id: packet.drone_id,
            callsign: packet.drone_id.toUpperCase(),
            status: currentStatus,
            altitude: packet?.flight_dynamics?.altitude_meters ?? 0,
            airspeed: packet?.flight_dynamics?.airspeed_knots ?? 0,
            heading: packet?.flight_dynamics?.heading_degrees ?? 0,
            battery: batteryLevel,
            lat: packet?.tactical_sensors?.gps?.latitude ?? 0,
            lng: packet?.tactical_sensors?.gps?.longitude ?? 0,
            signal: 95,
            proximityThreat: packet?.tactical_sensors?.threat_matrix?.proximity_alert ?? false,
            missionPhase: "LIVE-OPS",
            lastSeen: Date.now(),
          },
        }));
      };

      ws.onerror = (err) => {
        console.error("Swarm telemetry socket error:", err);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("disconnected");
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [url]);

  // Prune / flag drones that have gone quiet instead of leaving stale data
  // on screen forever.
  useEffect(() => {
    const interval = setInterval(() => {
      setSwarm((prev) => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          const isStale = now - next[id].lastSeen > STALE_TIMEOUT_MS;
          if (isStale && next[id].status !== "OFFLINE") {
            next[id] = { ...next[id], status: "OFFLINE", signal: 0 };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const drones = useMemo(() => Object.values(swarm), [swarm]);

  return { drones, connectionStatus };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function batteryColor(pct) {
  if (pct < 20) return "#ef4444";
  if (pct < 40) return "#f97316";
  return "#22c55e";
}

function statusColor(status) {
  if (status === "CRITICAL") return "#ef4444";
  if (status === "WARNING") return "#f97316";
  if (status === "OFFLINE") return "#475569";
  return "#22c55e";
}

function BatteryIcon({ pct, size = 16 }) {
  if (pct < 20) return <BatteryWarning size={size} color="#ef4444" />;
  if (pct < 40) return <BatteryLow size={size} color="#f97316" />;
  return <Battery size={size} color="#22c55e" />;
}

// Very simple heuristic — assumes a fixed full-charge endurance. Good enough
// for operator triage, not a substitute for a real energy model.
function estimateFlightMinutes(drone) {
  if (drone.status === "OFFLINE") return null;
  return Math.max(0, (drone.battery / 100) * ASSUMED_FULL_ENDURANCE_MIN);
}

function getRecommendedAction(drone) {
  if (drone.status === "OFFLINE") {
    return { label: "REESTABLISH LINK", Icon: Radio, color: "#475569" };
  }
  if (drone.status === "CRITICAL") {
    return { label: "RETURN TO BASE", Icon: Home, color: "#ef4444" };
  }
  if (drone.proximityThreat) {
    return { label: "EVASIVE MANEUVER ADVISED", Icon: AlertTriangle, color: "#ef4444" };
  }
  if (drone.status === "WARNING") {
    return { label: "MONITOR / PREPARE RTB", Icon: Clock, color: "#f97316" };
  }
  return { label: "CONTINUE MISSION", Icon: ListChecks, color: "#22c55e" };
}

const STATUS_FILTERS = ["ALL", "ACTIVE", "WARNING", "CRITICAL", "OFFLINE"];

// ─── Components ──────────────────────────────────────────────────────────────

function Header({ drones, connectionStatus }) {
  const criticalCount = drones.filter((d) => d.status !== "ACTIVE" && d.status !== "OFFLINE").length;
  const offlineCount = drones.filter((d) => d.status === "OFFLINE").length;
  const allOnline = criticalCount === 0 && offlineCount === 0 && connectionStatus === "connected";

  const linkBadge = {
    connected: { label: "LINK UP", color: "#22c55e" },
    connecting: { label: "CONNECTING…", color: "#f97316" },
    disconnected: { label: "LINK LOST", color: "#ef4444" },
  }[connectionStatus];

  return (
    <header
      style={{
        background: "#0f172a",
        borderBottom: "1px solid #1e3a5f",
        padding: "0 1.5rem",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: "#0ea5e9",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Crosshair size={18} color="#0f172a" />
        </div>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#f1f5f9",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}
          >
            UAV Swarm Command
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b", letterSpacing: "0.05em" }}>
            TACTICAL OPERATIONS CENTER
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 6,
            border: `1px solid ${linkBadge.color}55`,
            background: `${linkBadge.color}1a`,
          }}
        >
          {connectionStatus === "disconnected" ? (
            <WifiOff size={12} color={linkBadge.color} />
          ) : (
            <Wifi size={12} color={linkBadge.color} />
          )}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: linkBadge.color,
              letterSpacing: "0.06em",
              fontFamily: "monospace",
            }}
          >
            {linkBadge.label}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b", letterSpacing: "0.05em" }}>
            ACTIVE UNITS
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>
            {drones.filter((d) => d.status === "ACTIVE").length}/{drones.length}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 6,
            border: `1px solid ${allOnline ? "#166534" : "#7c2d12"}`,
            background: allOnline ? "rgba(22,101,52,0.2)" : "rgba(124,45,18,0.2)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: allOnline ? "#22c55e" : "#ef4444",
              boxShadow: `0 0 6px ${allOnline ? "#22c55e" : "#ef4444"}`,
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: allOnline ? "#22c55e" : "#ef4444",
              letterSpacing: "0.06em",
              fontFamily: "monospace",
            }}
          >
            {allOnline ? "SYS NOMINAL" : `${criticalCount + offlineCount} DEGRADED`}
          </span>
        </div>
      </div>
    </header>
  );
}

// Fixed-height ribbon — values change but the box count and sizes never do,
// so this never reflows the layout beneath it.
const AnalyticsBox = memo(function AnalyticsBox({ icon, label, value, unit, color }) {
  return (
    <div
      style={{
        background: "#0d1f35",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: `${color}1a`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 9, color: "#475569", fontFamily: "monospace", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color, fontFamily: "monospace", whiteSpace: "nowrap" }}>
          {value}
          <span style={{ fontSize: 10, color: "#475569", marginLeft: 3 }}>{unit}</span>
        </p>
      </div>
    </div>
  );
});

function FleetAnalytics({ drones }) {
  const stats = useMemo(() => {
    const total = drones.length;
    if (total === 0) {
      return {
        healthScore: 100,
        completionRate: 0,
        availabilityPct: 0,
        avgBattery: 0,
        avgAltitude: 0,
        avgAirspeed: 0,
      };
    }
    const activeCount = drones.filter((d) => d.status === "ACTIVE").length;
    const availableCount = drones.filter((d) => d.status === "ACTIVE" || d.status === "WARNING").length;
    const offlineCount = drones.filter((d) => d.status === "OFFLINE").length;
    const threatCount = drones.filter((d) => d.proximityThreat).length;
    const avgBattery = drones.reduce((s, d) => s + d.battery, 0) / total;

    const flying = drones.filter((d) => d.status !== "OFFLINE");
    const avgAltitude = flying.length ? flying.reduce((s, d) => s + d.altitude, 0) / flying.length : 0;
    const avgAirspeed = flying.length ? flying.reduce((s, d) => s + d.airspeed, 0) / flying.length : 0;

    const availabilityPct = (availableCount / total) * 100;
    const completionRate = (activeCount / total) * 100;
    const offlinePenalty = (offlineCount / total) * 100;
    const threatPenalty = (threatCount / total) * 100;

    const healthScore = Math.max(
      0,
      Math.min(100, avgBattery * 0.5 + availabilityPct * 0.5 - offlinePenalty * 0.5 - threatPenalty * 0.3)
    );

    return { healthScore, completionRate, availabilityPct, avgBattery, avgAltitude, avgAirspeed };
  }, [drones]);

  const healthColor = stats.healthScore >= 80 ? "#22c55e" : stats.healthScore >= 50 ? "#f97316" : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "10px 14px",
        background: "#0a1628",
        borderBottom: "1px solid #1e3a5f",
        flexShrink: 0,
        overflowX: "auto",
      }}
    >
      <AnalyticsBox
        icon={<Gauge size={14} color={healthColor} />}
        label="FLEET HEALTH"
        value={Math.round(stats.healthScore)}
        unit="/100"
        color={healthColor}
      />
      <AnalyticsBox
        icon={<TrendingUp size={14} color="#7dd3fc" />}
        label="MISSION COMPLETION"
        value={Math.round(stats.completionRate)}
        unit="%"
        color="#7dd3fc"
      />
      <AnalyticsBox
        icon={<ListChecks size={14} color="#a78bfa" />}
        label="AVAILABILITY"
        value={Math.round(stats.availabilityPct)}
        unit="%"
        color="#a78bfa"
      />
      <AnalyticsBox
        icon={<Battery size={14} color={batteryColor(stats.avgBattery)} />}
        label="AVG BATTERY"
        value={Math.round(stats.avgBattery)}
        unit="%"
        color={batteryColor(stats.avgBattery)}
      />
      <AnalyticsBox
        icon={<ArrowUp size={14} color="#67e8f9" />}
        label="AVG ALTITUDE"
        value={Math.round(stats.avgAltitude)}
        unit="m"
        color="#67e8f9"
      />
      <AnalyticsBox
        icon={<Wind size={14} color="#4ade80" />}
        label="AVG AIRSPEED"
        value={Math.round(stats.avgAirspeed)}
        unit="km/h"
        color="#4ade80"
      />
    </div>
  );
}

// Floats over the map in a fixed-size window so incoming alerts never push
// or resize the radar — it only ever scrolls internally.
function ThreatBanner({ drones }) {
  const lowBattery = useMemo(
    () => drones.filter((d) => d.status !== "OFFLINE" && d.battery < 20),
    [drones]
  );
  const proxThreats = useMemo(
    () => drones.filter((d) => d.status !== "OFFLINE" && d.proximityThreat),
    [drones]
  );
  const alerts = useMemo(
    () => [
      ...lowBattery.map((d) => ({
        key: d.id + "-batt",
        text: `${d.callsign}: BATTERY CRITICAL (${Math.round(d.battery)}%)`,
      })),
      ...proxThreats.map((d) => ({
        key: d.id + "-prox",
        text: `${d.callsign}: PROXIMITY THREAT DETECTED`,
      })),
    ],
    [lowBattery, proxThreats]
  );

  const show = alerts.length > 0;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        right: 10,
        maxHeight: 96,
        zIndex: 20,
        pointerEvents: show ? "auto" : "none",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        background: "rgba(69,10,10,0.92)",
        border: "1px solid #991b1b",
        borderRadius: 8,
        backdropFilter: "blur(2px)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "7px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: alerts.length > 3 ? "1px solid #7f1d1d" : "none",
          animation: show ? "flashBorder 1.5s ease-in-out infinite" : "none",
        }}
      >
        <AlertTriangle size={15} color="#fca5a5" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#fca5a5", fontFamily: "monospace", letterSpacing: "0.05em", fontWeight: 700 }}>
          {alerts.length} ACTIVE ALERT{alerts.length === 1 ? "" : "S"}
        </span>
      </div>
      <div style={{ maxHeight: 66, overflowY: "auto", padding: "4px 12px 8px" }}>
        {alerts.map((a) => (
          <div
            key={a.key}
            style={{
              fontSize: 11,
              color: "#fca5a5",
              fontFamily: "monospace",
              letterSpacing: "0.03em",
              padding: "3px 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            ⚠ {a.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
const CLUSTER_BASE_DISTANCE = 34; // px-equivalent grouping radius at zoom 1

function MapArea({ drones, allDronesCount, selectedId, onSelect }) {
  const W = 560;
  const H = 360;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgWrapRef = useRef(null);
  const dragRef = useRef(null); // { startX, startY, panX, panY, moved }

  const bounds = useMemo(() => {
    if (drones.length === 0) {
      return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    }
    const lats = drones.map((d) => d.lat);
    const lngs = drones.map((d) => d.lng);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [drones]);

  const toXY = useCallback(
    (lat, lng) => {
      const padPct = 0.15;
      const lngRange = bounds.maxLng - bounds.minLng || 0.01;
      const latRange = bounds.maxLat - bounds.minLat || 0.01;
      const padX = W * padPct;
      const padY = H * padPct;
      const x = padX + ((lng - bounds.minLng) / lngRange) * (W - padX * 2);
      const y = padY + ((bounds.maxLat - lat) / latRange) * (H - padY * 2);
      return { x, y };
    },
    [bounds]
  );

  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomBy = useCallback((factor) => {
    setZoom((z) => clampZoom(z * factor));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIntoPoint = useCallback((cx, cy) => {
    setZoom((z) => {
      const newZoom = clampZoom(z * 2);
      setPan({ x: -(cx - W / 2) * newZoom, y: -(cy - H / 2) * newZoom });
      return newZoom;
    });
  }, []);

  // Wheel-to-zoom, attached as a native non-passive listener so preventDefault
  // actually stops the page from scrolling while zooming the radar.
  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setZoom((z) => clampZoom(z * factor));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const handlePointerDown = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Grid-bucket clustering so hundreds of nearby units collapse into a single
  // marker instead of an unreadable pile of overlapping icons. Bucket size
  // shrinks as you zoom in, so clusters naturally split apart.
  const items = useMemo(() => {
    const cellSize = CLUSTER_BASE_DISTANCE / zoom;
    const buckets = new Map();
    for (const d of drones) {
      const { x, y } = toXY(d.lat, d.lng);
      const key = `${Math.round(x / cellSize)}_${Math.round(y / cellSize)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ ...d, _x: x, _y: y });
    }
    const rank = { CRITICAL: 3, WARNING: 2, OFFLINE: 1, ACTIVE: 0 };
    return Array.from(buckets.values()).map((group) => {
      if (group.length === 1) {
        return { type: "single", drone: group[0] };
      }
      const cx = group.reduce((s, d) => s + d._x, 0) / group.length;
      const cy = group.reduce((s, d) => s + d._y, 0) / group.length;
      const worst = group.reduce((w, d) => (rank[d.status] > rank[w.status] ? d : w), group[0]);
      return { type: "cluster", x: cx, y: cy, count: group.length, color: statusColor(worst.status) };
    });
  }, [drones, zoom, toXY]);

  return (
    <div
      style={{
        flex: 1,
        background: "#070f1a",
        borderRadius: 8,
        border: "1px solid #1e3a5f",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid #1e3a5f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#0d1f35",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={14} color="#0ea5e9" />
          <span style={{ fontSize: 12, color: "#7dd3fc", fontFamily: "monospace", letterSpacing: "0.05em" }}>
            AIRSPACE OVERVIEW · LIVE TELEMETRY
          </span>
          {allDronesCount !== drones.length && (
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>
              ({drones.length}/{allDronesCount} SHOWN)
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{Math.round(zoom * 100)}%</span>
      </div>

      <div
        ref={svgWrapRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          cursor: dragRef.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
          <g transform={`translate(${pan.x},${pan.y})`}>
            <g transform={`translate(${W / 2},${H / 2}) scale(${zoom}) translate(${-W / 2},${-H / 2})`}>
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={`v${i}`} x1={(W / 8) * i} y1={0} x2={(W / 8) * i} y2={H} stroke="#0ea5e920" strokeWidth={0.5 / zoom} />
              ))}
              {Array.from({ length: 6 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={(H / 6) * i} x2={W} y2={(H / 6) * i} stroke="#0ea5e920" strokeWidth={0.5 / zoom} />
              ))}

              <circle cx={W / 2} cy={H / 2} r={80} fill="none" stroke="#0ea5e912" strokeWidth={0.5 / zoom} />
              <circle cx={W / 2} cy={H / 2} r={150} fill="none" stroke="#0ea5e912" strokeWidth={0.5 / zoom} />
              <circle cx={W / 2} cy={H / 2} r={220} fill="none" stroke="#0ea5e912" strokeWidth={0.5 / zoom} />

              {items.map((item) => {
                if (item.type === "cluster") {
                  const r = Math.min(20, 10 + Math.log2(item.count) * 3);
                  return (
                    <g
                      key={`cluster-${item.x}-${item.y}`}
                      transform={`translate(${item.x},${item.y}) scale(${1 / zoom})`}
                      onClick={() => {
                        if (!dragRef.current?.moved) zoomIntoPoint(item.x, item.y);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <circle r={r} fill={item.color} fillOpacity={0.25} stroke={item.color} strokeWidth={1.5} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={11}
                        fontWeight={700}
                        fill={item.color}
                        fontFamily="monospace"
                      >
                        {item.count}
                      </text>
                    </g>
                  );
                }

                const drone = item.drone;
                const isSelected = drone.id === selectedId;
                const col = statusColor(drone.status);
                const isOffline = drone.status === "OFFLINE";

                return (
                  <g
                    key={drone.id}
                    transform={`translate(${drone._x},${drone._y}) scale(${1 / zoom})`}
                    onClick={() => {
                      if (!dragRef.current?.moved) onSelect(drone.id);
                    }}
                    style={{ cursor: "pointer", opacity: isOffline ? 0.4 : 1 }}
                  >
                    {isSelected && <circle r={22} fill="none" stroke={col} strokeWidth={1} opacity={0.4} />}
                    {drone.proximityThreat && !isOffline && (
                      <circle r={28} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
                    )}
                    <line
                      x1={0}
                      y1={0}
                      x2={Math.sin((drone.heading * Math.PI) / 180) * 18}
                      y2={-Math.cos((drone.heading * Math.PI) / 180) * 18}
                      stroke={col}
                      strokeWidth={1.5}
                      opacity={0.8}
                    />
                    <circle r={8} fill={isSelected ? col : "#0f172a"} stroke={col} strokeWidth={isSelected ? 2 : 1.5} />
                    <circle r={3} fill={col} />
                    <text x={12} y={-10} fontSize={9} fill={col} fontFamily="monospace" fontWeight={600}>
                      {drone.callsign}
                    </text>
                    <text x={12} y={2} fontSize={8} fill={col} opacity={0.7} fontFamily="monospace">
                      {isOffline ? "NO LINK" : `${Math.round(drone.altitude)}m`}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        <ThreatBanner drones={drones} />

        <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", flexDirection: "column", gap: 4, zIndex: 15 }}>
          <button onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in" style={mapButtonStyle}>
            +
          </button>
          <button onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom out" style={mapButtonStyle}>
            −
          </button>
          <button onClick={resetView} aria-label="Reset view" style={{ ...mapButtonStyle, fontSize: 10 }}>
            ⟲
          </button>
        </div>
      </div>
    </div>
  );
}

const mapButtonStyle = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid #1e3a5f",
  background: "#0d1f35",
  color: "#7dd3fc",
  fontFamily: "monospace",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
};

const DroneCard = memo(function DroneCard({ drone, isSelected, onSelect }) {
  const col = statusColor(drone.status);
  const isOffline = drone.status === "OFFLINE";
  return (
    <div
      onClick={() => onSelect(drone.id)}
      style={{
        background: isSelected ? "#0d1f35" : "#0f172a",
        border: `1px solid ${isSelected ? "#0ea5e9" : "#1e3a5f"}`,
        borderRadius: 8,
        padding: "10px 14px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: isOffline ? 0.55 : 1,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: col, boxShadow: `0 0 5px ${col}` }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
            {drone.callsign}
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              color: col,
              background: `${col}1a`,
              padding: "2px 6px",
              borderRadius: 4,
              letterSpacing: "0.05em",
            }}
          >
            {drone.status}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{drone.missionPhase}</span>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
            HDG {Math.round(drone.heading)}°
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <BatteryIcon pct={drone.battery} size={13} />
          <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, drone.battery))}%`,
                height: "100%",
                background: batteryColor(drone.battery),
                borderRadius: 2,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <span
            style={{ fontSize: 10, color: batteryColor(drone.battery), fontFamily: "monospace", minWidth: 28, textAlign: "right" }}
          >
            {Math.round(drone.battery)}%
          </span>
        </div>
      </div>
      <ChevronRight size={14} color={isSelected ? "#0ea5e9" : "#334155"} />
    </div>
  );
});

function TacticalSidebar({ drones, totalCount, selectedId, onSelect, searchTerm, onSearchChange, statusFilter, onStatusFilterChange }) {
  const filtersActive = searchTerm.trim() !== "" || statusFilter !== "ALL";

  return (
    <aside style={{ width: 260, background: "#0a1628", borderLeft: "1px solid #1e3a5f", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 8 }}>
        <Radio size={14} color="#0ea5e9" />
        <span style={{ fontSize: 12, color: "#7dd3fc", fontFamily: "monospace", letterSpacing: "0.05em" }}>CONNECTED UNITS</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "#22c55e",
            fontFamily: "monospace",
            background: "rgba(34,197,94,0.12)",
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          {drones.length}
          {filtersActive ? `/${totalCount}` : ""}
        </span>
      </div>

      <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid #1e3a5f", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <Search size={12} color="#475569" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="SEARCH CALLSIGN…"
            style={{
              width: "100%",
              background: "#0f172a",
              border: "1px solid #1e3a5f",
              borderRadius: 6,
              padding: "6px 8px 6px 26px",
              fontSize: 11,
              color: "#f1f5f9",
              fontFamily: "monospace",
              letterSpacing: "0.04em",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {filtersActive && (
            <button
              onClick={() => {
                onSearchChange("");
                onStatusFilterChange("ALL");
              }}
              aria-label="Clear filters"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                padding: 2,
              }}
            >
              <X size={12} color="#64748b" />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((s) => {
            const active = statusFilter === s;
            const col = s === "ALL" ? "#7dd3fc" : statusColor(s);
            return (
              <button
                key={s}
                onClick={() => onStatusFilterChange(s)}
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                  padding: "3px 7px",
                  borderRadius: 4,
                  border: `1px solid ${active ? col : "#1e3a5f"}`,
                  background: active ? `${col}1a` : "transparent",
                  color: active ? col : "#475569",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {drones.length === 0 && (
          <p style={{ fontSize: 11, color: "#334155", fontFamily: "monospace", textAlign: "center", marginTop: 20 }}>
            {totalCount === 0 ? "NO UNITS REPORTING" : "NO UNITS MATCH FILTER"}
          </p>
        )}
        {drones.map((drone) => (
          <DroneCard key={drone.id} drone={drone} isSelected={drone.id === selectedId} onSelect={onSelect} />
        ))}
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid #1e3a5f", display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: "0.04em" }}>STATUS KEY</p>
        {[
          { col: "#22c55e", label: "ACTIVE" },
          { col: "#f97316", label: "WARNING" },
          { col: "#ef4444", label: "CRITICAL" },
          { col: "#475569", label: "OFFLINE" },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.col }} />
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

const StatBox = memo(function StatBox({ icon, label, value, unit, color = "#7dd3fc" }) {
  return (
    <div style={{ background: "#0d1f35", border: "1px solid #1e3a5f", borderRadius: 8, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
        <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>{unit}</span>
      </div>
    </div>
  );
});

function DecisionSupport({ drone }) {
  const minutes = estimateFlightMinutes(drone);
  const { label, Icon, color } = getRecommendedAction(drone);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginTop: 10,
        padding: "8px 14px",
        background: `${color}0d`,
        border: `1px solid ${color}40`,
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={13} color="#7dd3fc" />
        <span style={{ fontSize: 11, color: "#7dd3fc", fontFamily: "monospace" }}>
          EST. FLIGHT TIME: <strong>{minutes === null ? "—" : `${Math.round(minutes)} min`}</strong>
        </span>
      </div>
      <div style={{ width: 1, height: 16, background: "#1e3a5f" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.03em" }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function TelemetryPanel({ drone }) {
  if (!drone) {
    return (
      <div style={{ height: 140, background: "#0a1628", borderTop: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <Crosshair size={24} color="#1e3a5f" style={{ margin: "0 auto 8px" }} />
          <p style={{ margin: 0, fontSize: 12, color: "#334155", fontFamily: "monospace" }}>WAITING FOR TELEMETRY OR SELECT A UNIT</p>
        </div>
      </div>
    );
  }

  const col = statusColor(drone.status);
  const isOffline = drone.status === "OFFLINE";

  return (
    <div style={{ background: "#0a1628", borderTop: "1px solid #1e3a5f", padding: "14px 1.5rem", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, boxShadow: `0 0 6px ${col}` }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>{drone.callsign}</span>
        </div>
        <span style={{ fontSize: 11, color: col, fontFamily: "monospace", background: `${col}1a`, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>{drone.status}</span>
        <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>PHASE: {drone.missionPhase}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {!isOffline && drone.signal > 70 ? <Wifi size={14} color="#22c55e" /> : <WifiOff size={14} color="#ef4444" />}
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
            {isOffline ? "NO SIGNAL" : `${Math.round(drone.signal)}% SIG`}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <StatBox icon={<ArrowUp size={13} color="#7dd3fc" />} label="ALTITUDE" value={Math.round(drone.altitude)} unit="m AGL" color="#7dd3fc" />
        <StatBox icon={<Wind size={13} color="#a78bfa" />} label="AIRSPEED" value={Math.round(drone.airspeed)} unit="km/h" color="#a78bfa" />
        <StatBox icon={<Navigation size={13} color="#67e8f9" />} label="HEADING" value={Math.round(drone.heading)} unit="°" color="#67e8f9" />
        <StatBox icon={<BatteryIcon pct={drone.battery} size={13} />} label="BATTERY" value={Math.round(drone.battery)} unit="%" color={batteryColor(drone.battery)} />
        <StatBox
          icon={<Activity size={13} color="#4ade80" />}
          label="POSITION"
          value={`${drone.lat.toFixed(3)}, ${drone.lng.toFixed(3)}`}
          unit=""
          color="#4ade80"
        />
      </div>

      <DecisionSupport drone={drone} />
    </div>
  );
}

// ─── Main Application Component ──────────────────────────────────────────────

export default function UAVSwarmCommand() {
  const { drones, connectionStatus } = useLiveSwarmStream();
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredDrones = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return drones.filter((d) => {
      const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
      const matchesSearch = term === "" || d.callsign.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [drones, searchTerm, statusFilter]);

  const selectedDrone = useMemo(
    () => drones.find((d) => d.id === selectedId) ?? null,
    [drones, selectedId]
  );

  const handleSelect = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes flashBorder { 0%, 100% { border-bottom-color: #991b1b; } 50% { border-bottom-color: #ef4444; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a1628; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#070f1a", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
        <Header drones={drones} connectionStatus={connectionStatus} />
        <FleetAnalytics drones={drones} />

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px", gap: 10, overflow: "hidden" }}>
            <MapArea drones={filteredDrones} allDronesCount={drones.length} selectedId={selectedId} onSelect={handleSelect} />
          </div>
          <TacticalSidebar
            drones={filteredDrones}
            totalCount={drones.length}
            selectedId={selectedId}
            onSelect={handleSelect}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </div>

        <TelemetryPanel drone={selectedDrone} />
      </div>
    </>
  );
}

