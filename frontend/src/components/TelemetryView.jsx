import { useState } from 'react';
import { Activity, Battery, Gauge, Radio, ArrowUpRight } from 'lucide-react';
import DroneHistoryPanel from './DroneHistoryPanel';

export default function TelemetryView({
  drones = [],
  onSelectDrone,
}) {
  const [selectedDroneForHistory, setSelectedDroneForHistory] = useState('UAV-01');

  // Compute fleet averages
  const activeDrones = drones.filter((d) => d.status !== 'OFFLINE');
  const avgBattery = activeDrones.length > 0
    ? (activeDrones.reduce((sum, d) => sum + Number(d.battery || 0), 0) / activeDrones.length).toFixed(1)
    : '0.0';
  const avgSpeed = activeDrones.length > 0
    ? (activeDrones.reduce((sum, d) => sum + Number(d.airspeed || 0), 0) / activeDrones.length).toFixed(1)
    : '0.0';
  const avgAlt = activeDrones.length > 0
    ? (activeDrones.reduce((sum, d) => sum + Number(d.altitude || 0), 0) / activeDrones.length).toFixed(1)
    : '0.0';

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f1f5f9',
      fontFamily: 'JetBrains Mono, monospace',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      padding: '24px 32px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #1e2c44', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.05em' }}>
            FLEET TELEMETRY & SYSTEM HEALTH MATRIX
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Subsystem Health Diagnostics &bull; Propulsion Metrics &bull; Black Box Audit
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#00f0ff' }}>
          <Activity size={16} />
          <span>REAL-TIME TELEMETRY FEED: 1000ms SAMPLING</span>
        </div>
      </div>

      {/* Fleet Summary Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}>
            <span>FLEET CONNECTIVITY</span>
            <Radio size={14} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#00f0ff' }}>
            {activeDrones.length} <span style={{ fontSize: '12px', color: '#64748b' }}>/ {drones.length} ONLINE</span>
          </div>
          <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
            LINK AVAILABILITY: {drones.length > 0 ? ((activeDrones.length / drones.length) * 100).toFixed(0) : 100}%
          </div>
        </div>

        <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}>
            <span>FLEET AVERAGE BATTERY</span>
            <Battery size={14} color="#10b981" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
            {avgBattery}%
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            EST. FLEET ENDURANCE: ~32m
          </div>
        </div>

        <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}>
            <span>MEAN AIRSPEED</span>
            <Gauge size={14} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>
            {avgSpeed} <span style={{ fontSize: '12px', color: '#94a3b8' }}>m/s</span>
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            NOMINAL CRUISE: 41.7 m/s
          </div>
        </div>

        <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '6px' }}>
            <span>MEAN ALTITUDE</span>
            <ArrowUpRight size={14} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9' }}>
            {avgAlt} <span style={{ fontSize: '12px', color: '#94a3b8' }}>m</span>
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            ASSIGNED CEILING: 120 m AGL
          </div>
        </div>
      </div>

      {/* Subsystem Health Status Matrix */}
      <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
          AVIONICS SENSOR & PROPULSION INTEGRITY STATUS
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>RTK / MULTI-BAND GPS</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              ● 3D FIX (18 SATS)
            </div>
          </div>

          <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>DUAL REDUNDANT IMU</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              ● CALIBRATED
            </div>
          </div>

          <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>OPTICAL RADAR PROXIMITY</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              ● 360° ACTIVE
            </div>
          </div>

          <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>BMS THERMAL MONITOR</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
              ● 38°C NOMINAL
            </div>
          </div>

          <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>DOCK STATION LINK</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#00f0ff', marginTop: '4px' }}>
              ● 22.2 GHz SECURE
            </div>
          </div>
        </div>
      </div>

      {/* Select Aircraft for History Quick Bar */}
      {drones.length > 0 && (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>SELECT AIRCRAFT AUDIT:</span>
          {drones.slice(0, 8).map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDroneForHistory(d.id);
                if (onSelectDrone) onSelectDrone(d);
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: selectedDroneForHistory === d.id ? '#162238' : '#121c2e',
                border: `1px solid ${selectedDroneForHistory === d.id ? '#00f0ff' : '#1e2c44'}`,
                borderRadius: '3px',
                color: selectedDroneForHistory === d.id ? '#00f0ff' : '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              {d.callsign || d.id}
            </button>
          ))}
        </div>
      )}

      {/* Embedded Flight Data Recorder Panel */}
      <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', overflow: 'hidden' }}>
        <DroneHistoryPanel initialDroneId={selectedDroneForHistory} />
      </div>
    </div>
  );
}
