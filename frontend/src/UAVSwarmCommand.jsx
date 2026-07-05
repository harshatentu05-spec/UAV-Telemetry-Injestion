import { useState, useEffect } from "react";
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
} from "lucide-react";

// ─── Live WebSocket Hook ─────────────────────────────────────────────────────

function useLiveSwarmStream() {
  const [swarm, setSwarm] = useState({});

  useEffect(() => {
    // Connect to your actual FastAPI backend
    const ws = new WebSocket("ws://localhost:8000/ws/telemetry");

    ws.onopen = () => console.log("🟢 Connected to Live Swarm Telemetry");

    ws.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        console.log("🛸 INCOMING DRONE:", packet.drone_id); // This will prove data is arriving!

        if (!packet.drone_id) return; // Ignore empty packets

        // The '?.' protects the UI from crashing if a packet is missing a piece of data
        const batteryLevel = packet?.propulsion_systems?.battery_state?.capacity_remaining_percent ?? 100;
        const currentStatus = batteryLevel < 10 ? "CRITICAL" : batteryLevel < 20 ? "WARNING" : "ACTIVE";

        setSwarm(prev => ({
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
          }
        }));
      } catch (err) {
        console.error("Packet read error:", err);
      }
    };

    ws.onclose = () => console.log("🔴 Disconnected from Swarm");

    return () => ws.close();
  }, []);

  return Object.values(swarm);
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
  return "#22c55e";
}

function BatteryIcon({ pct, size = 16 }) {
  if (pct < 20) return <BatteryWarning size={size} color="#ef4444" />;
  if (pct < 40) return <BatteryLow size={size} color="#f97316" />;
  return <Battery size={size} color="#22c55e" />;
}

// ─── Components ──────────────────────────────────────────────────────────────

function Header({ drones }) {
  const criticalCount = drones.filter((d) => d.status !== "ACTIVE").length;
  const allOnline = criticalCount === 0;

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
            {allOnline ? "SYS NOMINAL" : `${criticalCount} DEGRADED`}
          </span>
        </div>
      </div>
    </header>
  );
}

function ThreatBanner({ drones }) {
  const lowBattery = drones.filter((d) => d.battery < 20);
  const proxThreats = drones.filter((d) => d.proximityThreat);
  const show = lowBattery.length > 0 || proxThreats.length > 0;

  if (!show) return null;

  return (
    <div
      style={{
        background: "rgba(127,29,29,0.95)",
        borderBottom: "1px solid #991b1b",
        padding: "8px 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
        animation: "flashBorder 1.5s ease-in-out infinite",
      }}
    >
      <AlertTriangle size={18} color="#fca5a5" />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {lowBattery.map((d) => (
          <span
            key={d.id}
            style={{
              fontSize: 12,
              color: "#fca5a5",
              fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}
          >
            ⚠ {d.callsign}: BATTERY CRITICAL ({Math.round(d.battery)}%)
          </span>
        ))}
        {proxThreats.map((d) => (
          <span
            key={d.id + "-prox"}
            style={{
              fontSize: 12,
              color: "#fca5a5",
              fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}
          >
            ⚠ {d.callsign}: PROXIMITY THREAT DETECTED
          </span>
        ))}
      </div>
    </div>
  );
}

function MapArea({ drones, selectedId, onSelect }) {
  const lats = drones.map((d) => d.lat);
  const lngs = drones.map((d) => d.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padPct = 0.15;

  function toXY(lat, lng, w, h) {
    const lngRange = maxLng - minLng || 0.01;
    const latRange = maxLat - minLat || 0.01;
    const padX = w * padPct;
    const padY = h * padPct;
    const x = padX + ((lng - minLng) / lngRange) * (w - padX * 2);
    const y = padY + ((maxLat - lat) / latRange) * (h - padY * 2);
    return { x, y };
  }

  const W = 560, H = 360;

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
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`v${i}`} x1={(W / 8) * i} y1={0} x2={(W / 8) * i} y2={H} stroke="#0ea5e920" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={(H / 6) * i} x2={W} y2={(H / 6) * i} stroke="#0ea5e920" strokeWidth={0.5} />
          ))}

          <circle cx={W / 2} cy={H / 2} r={80} fill="none" stroke="#0ea5e912" strokeWidth={0.5} />
          <circle cx={W / 2} cy={H / 2} r={150} fill="none" stroke="#0ea5e912" strokeWidth={0.5} />
          <circle cx={W / 2} cy={H / 2} r={220} fill="none" stroke="#0ea5e912" strokeWidth={0.5} />

          {drones.map((drone) => {
            const { x, y } = toXY(drone.lat, drone.lng, W, H);
            const isSelected = drone.id === selectedId;
            const col = statusColor(drone.status);

            return (
              <g key={drone.id} transform={`translate(${x || W/2},${y || H/2})`} onClick={() => onSelect(drone.id)} style={{ cursor: "pointer" }}>
                {isSelected && <circle r={22} fill="none" stroke={col} strokeWidth={1} opacity={0.4} />}
                {drone.proximityThreat && <circle r={28} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />}
                <line x1={0} y1={0} x2={Math.sin((drone.heading * Math.PI) / 180) * 18} y2={-Math.cos((drone.heading * Math.PI) / 180) * 18} stroke={col} strokeWidth={1.5} opacity={0.8} />
                <circle r={8} fill={isSelected ? col : "#0f172a"} stroke={col} strokeWidth={isSelected ? 2 : 1.5} />
                <circle r={3} fill={col} />
                <text x={12} y={-10} fontSize={9} fill={col} fontFamily="monospace" fontWeight={600}>{drone.callsign}</text>
                <text x={12} y={2} fontSize={8} fill={col} opacity={0.7} fontFamily="monospace">{Math.round(drone.altitude)}m</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function DroneCard({ drone, isSelected, onSelect }) {
  const col = statusColor(drone.status);
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
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: col, boxShadow: `0 0 5px ${col}` }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>{drone.callsign}</span>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: col, background: `${col}1a`, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.05em" }}>{drone.status}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{drone.missionPhase}</span>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>HDG {Math.round(drone.heading)}°</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <BatteryIcon pct={drone.battery} size={13} />
          <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, drone.battery))}%`, height: "100%", background: batteryColor(drone.battery), borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontSize: 10, color: batteryColor(drone.battery), fontFamily: "monospace", minWidth: 28, textAlign: "right" }}>{Math.round(drone.battery)}%</span>
        </div>
      </div>
      <ChevronRight size={14} color={isSelected ? "#0ea5e9" : "#334155"} />
    </div>
  );
}

function TacticalSidebar({ drones, selectedId, onSelect }) {
  return (
    <aside style={{ width: 240, background: "#0a1628", borderLeft: "1px solid #1e3a5f", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 8 }}>
        <Radio size={14} color="#0ea5e9" />
        <span style={{ fontSize: 12, color: "#7dd3fc", fontFamily: "monospace", letterSpacing: "0.05em" }}>CONNECTED UNITS</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#22c55e", fontFamily: "monospace", background: "rgba(34,197,94,0.12)", padding: "1px 6px", borderRadius: 4 }}>{drones.length}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {drones.map((drone) => (
          <DroneCard key={drone.id} drone={drone} isSelected={drone.id === selectedId} onSelect={onSelect} />
        ))}
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid #1e3a5f", display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: "0.04em" }}>STATUS KEY</p>
        {[{ col: "#22c55e", label: "ACTIVE" }, { col: "#f97316", label: "WARNING" }, { col: "#ef4444", label: "CRITICAL" }].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.col }} />
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function StatBox({ icon, label, value, unit, color = "#7dd3fc" }) {
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
          {drone.signal > 70 ? <Wifi size={14} color="#22c55e" /> : <WifiOff size={14} color="#ef4444" />}
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>{Math.round(drone.signal)}% SIG</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <StatBox icon={<ArrowUp size={13} color="#7dd3fc" />} label="ALTITUDE" value={Math.round(drone.altitude)} unit="m AGL" color="#7dd3fc" />
        <StatBox icon={<Wind size={13} color="#a78bfa" />} label="AIRSPEED" value={Math.round(drone.airspeed)} unit="km/h" color="#a78bfa" />
        <StatBox icon={<Navigation size={13} color="#67e8f9" />} label="HEADING" value={Math.round(drone.heading)} unit="°" color="#67e8f9" />
        <StatBox icon={<BatteryIcon pct={drone.battery} size={13} />} label="BATTERY" value={Math.round(drone.battery)} unit="%" color={batteryColor(drone.battery)} />
        <StatBox icon={<Activity size={13} color="#4ade80" />} label="POSITION" value={`${drone.lat.toFixed(3)}°N`} unit="" color="#4ade80" />
      </div>
    </div>
  );
}

// ─── Main Application Component ──────────────────────────────────────────────

export default function UAVSwarmCommand() {
  const drones = useLiveSwarmStream(); // <-- NOW USING LIVE DATA
  const [selectedId, setSelectedId] = useState(null);

  const selectedDrone = drones.find((d) => d.id === selectedId) ?? null;

  const handleSelect = (id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

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
        <Header drones={drones} />
        <ThreatBanner drones={drones} />

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px", gap: 10, overflow: "hidden" }}>
            <MapArea drones={drones} selectedId={selectedId} onSelect={handleSelect} />
          </div>
          <TacticalSidebar drones={drones} selectedId={selectedId} onSelect={handleSelect} />
        </div>

        <TelemetryPanel drone={selectedDrone} />
      </div>
    </>
  );
}