import { useState } from 'react';
import { Database, Search, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

export default function DroneHistoryPanel({ initialDroneId = 'UAV-01' }) {
  const [droneId, setDroneId] = useState(initialDroneId);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchHistory = async () => {
    if (!droneId.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`http://localhost:8000/drones/${encodeURIComponent(droneId.trim())}/history?limit=15`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setHistoryData(data.records || []);
      if (!data.records || data.records.length === 0) {
        setErrorMsg(`No historical records found for ${droneId}`);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
      setErrorMsg(`Database connection error or no records: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper to safely parse JSON field if stringified
  const parseField = (val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }
    return val || {};
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0d1524', color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #1e2c44', paddingBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={20} color="#00f0ff" />
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '0.05em', color: '#f1f5f9' }}>
            FLIGHT DATA RECORDER // BLACK BOX AUDIT
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>CRYPTOGRAPHIC LEDGER</span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search size={14} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input
            type="text"
            value={droneId}
            onChange={(e) => setDroneId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchHistory()}
            placeholder="Search Callsign (e.g. UAV-01, UAV-02)..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              backgroundColor: '#121c2e',
              color: '#00f0ff',
              border: '1px solid #2a3d5e',
              borderRadius: '4px',
              fontFamily: 'inherit',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#1e293b' : '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {loading ? 'RETRIEVING...' : 'QUERY TELEMETRY'}
        </button>
      </div>

      {/* Error / Empty Notification */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '4px',
          color: '#ef4444',
          fontSize: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Data Table */}
      {historyData.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid #1e2c44', borderRadius: '4px' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#121c2e', color: '#94a3b8', borderBottom: '1px solid #1e2c44' }}>
                <th style={{ padding: '10px 12px' }}>TIMESTAMP (UTC)</th>
                <th style={{ padding: '10px 12px' }}>ALTITUDE</th>
                <th style={{ padding: '10px 12px' }}>SPEED</th>
                <th style={{ padding: '10px 12px' }}>BATTERY</th>
                <th style={{ padding: '10px 12px' }}>COORDINATES</th>
                <th style={{ padding: '10px 12px' }}>DESTINATION</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((rawRecord, index) => {
                const ts = Number(rawRecord.timestamp);
                const date = !isNaN(ts) ? new Date(ts * 1000) : new Date();
                const timeString = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

                const flight = parseField(rawRecord.flight_dynamics);
                const prop = parseField(rawRecord.propulsion_systems);
                const sensors = parseField(rawRecord.tactical_sensors);

                // Altitude resolution
                const alt = flight.altitude_m ?? flight.altitude_meters ?? 0;

                // Speed resolution (mps or knots)
                const speed = flight.speed_mps ?? (flight.airspeed_knots ? flight.airspeed_knots * 0.514444 : 0);

                // Battery resolution
                const battery = prop.battery_pct ?? prop.battery_state?.capacity_remaining_percent ?? 0;

                // Coordinates resolution
                const lat = flight.lat ?? sensors.gps?.latitude ?? 0;
                const lng = flight.lng ?? sensors.gps?.longitude ?? 0;

                const dest = sensors.destination ?? sensors.active_order ?? "TAMBARAM HUB";

                return (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid #152238',
                      backgroundColor: index % 2 === 0 ? '#0d1524' : '#0f1828'
                    }}
                  >
                    <td style={{ padding: '10px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} color="#64748b" />
                        {timeString}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#00f0ff', fontWeight: 600 }}>
                      {Number(alt).toFixed(1)} m
                    </td>
                    <td style={{ padding: '10px 12px', color: '#38bdf8' }}>
                      {Number(speed).toFixed(1)} m/s
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: battery < 20 ? '#ef4444' : battery < 40 ? '#f59e0b' : '#10b981' }}>
                      {Number(battery).toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                      {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                      {dest}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && !errorMsg && (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b', fontSize: '13px' }}>
            <Database size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p>Enter an aircraft callsign above and select "Query Telemetry" to inspect immutable black box records.</p>
          </div>
        )
      )}
    </div>
  );
}