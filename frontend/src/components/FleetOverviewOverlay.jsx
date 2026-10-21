import { useState, useMemo } from 'react';
import {
  Battery,
  Radio,
  Clock,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import DroneViewer3D from './DroneViewer3D';

export default function FleetOverviewOverlay({
  drones = [],
  selectedDroneId = null,
  onSelectDrone = () => {},
  onOpenTelemetryWorkspace = () => {},
  onOpenDetailDrawer = () => {},
  alerts = [],
  onAcknowledgeAlert = () => {},
}) {
  const [fleetFilter, setFleetFilter] = useState('ALL');
  const [logTab, setLogTab] = useState('ALL');

  const selectedDrone = useMemo(() => {
    return drones.find((d) => d.id === selectedDroneId) || drones[0] || null;
  }, [drones, selectedDroneId]);

  const filteredDrones = useMemo(() => {
    if (fleetFilter === 'ALL') return drones;
    if (fleetFilter === 'EN_ROUTE') return drones.filter((d) => d.status === 'EN_ROUTE' || d.operationalState === 'EN_ROUTE');
    if (fleetFilter === 'WARNING') return drones.filter((d) => d.status === 'WARNING');
    if (fleetFilter === 'CRITICAL') return drones.filter((d) => d.status === 'CRITICAL');
    return drones;
  }, [drones, fleetFilter]);

  const filteredLogs = useMemo(() => {
    if (logTab === 'ALL') return alerts;
    if (logTab === 'ALERTS') return alerts.filter((a) => a.severity === 'critical' || a.severity === 'warning');
    if (logTab === 'INFO') return alerts.filter((a) => a.type === 'system' || a.type === 'diagnostic');
    if (logTab === 'MISSION') return alerts.filter((a) => a.type === 'airspace' || a.type === 'mission');
    return alerts;
  }, [alerts, logTab]);

  if (!selectedDrone && drones.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: 76,
      bottom: 14,
      width: '380px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      zIndex: 450,
      pointerEvents: 'none', // Allows map clicks around the cards
      fontFamily: 'monospace',
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
        pointerEvents: 'auto', // Card content captures clicks
        paddingRight: 4,
      }}>

        {/* ─── CARD 1: SELECTED DRONE (WITH 3D VIEWER) (REFERENCE 1) ─────────── */}
        <div style={{
          backgroundColor: 'rgba(13, 21, 36, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #1e2c44',
          borderRadius: 8,
          padding: '14px 16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
        }}>
          {/* Header Row: Title & Drone Switcher Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.06em', fontWeight: 700 }}>
              SELECTED DRONE
            </span>

            {/* Quick Drone Selector Dropdown */}
            <select
              value={selectedDrone?.id || ''}
              onChange={(e) => {
                const found = drones.find((d) => d.id === e.target.value);
                if (found) onSelectDrone(found);
              }}
              style={{
                backgroundColor: '#162238',
                color: '#00f0ff',
                border: '1px solid #2a3d5e',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {drones.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.callsign || d.id}
                </option>
              ))}
            </select>
          </div>

          {/* Callsign & Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '0.04em' }}>
              {selectedDrone?.callsign || selectedDrone?.id}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 4,
              backgroundColor:
                selectedDrone?.status === 'CRITICAL'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : selectedDrone?.status === 'WARNING'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : selectedDrone?.status === 'CHARGING'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : 'rgba(0, 240, 255, 0.15)',
              border: `1px solid ${
                selectedDrone?.status === 'CRITICAL'
                  ? '#ef4444'
                  : selectedDrone?.status === 'WARNING'
                  ? '#f59e0b'
                  : selectedDrone?.status === 'CHARGING'
                  ? '#10b981'
                  : '#00f0ff'
              }`,
              fontSize: '10px',
              fontWeight: 800,
              color:
                selectedDrone?.status === 'CRITICAL'
                  ? '#ef4444'
                  : selectedDrone?.status === 'WARNING'
                  ? '#f59e0b'
                  : selectedDrone?.status === 'CHARGING'
                  ? '#10b981'
                  : '#00f0ff',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
              <span>{selectedDrone?.operationalState || selectedDrone?.status || 'ONLINE'}</span>
            </div>
          </div>

          {/* 3D Drone Model Display */}
          <div style={{
            backgroundColor: '#090d16',
            borderRadius: 6,
            border: '1px solid #1e2c44',
            overflow: 'hidden',
            marginBottom: 12,
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
          }}>
            <DroneViewer3D
              status={selectedDrone?.status}
              battery={selectedDrone?.battery}
              heading={selectedDrone?.heading}
            />
          </div>

          {/* Metrics Ribbon (Battery, Signal, ETA) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <div style={{ backgroundColor: '#121c2e', padding: '6px 8px', borderRadius: 4 }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Battery size={11} color="#10b981" />
                <span>Battery</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>
                {Number(selectedDrone?.battery || 0).toFixed(0)}%
              </div>
            </div>

            <div style={{ backgroundColor: '#121c2e', padding: '6px 8px', borderRadius: 4 }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Radio size={11} color="#00f0ff" />
                <span>Signal</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#00f0ff', marginTop: 2 }}>
                {selectedDrone?.status === 'OFFLINE' ? 'Lost' : 'Strong'}
              </div>
            </div>

            <div style={{ backgroundColor: '#121c2e', padding: '6px 8px', borderRadius: 4 }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={11} color="#f59e0b" />
                <span>ETA (Base)</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>
                {Math.max(0, Math.round(((selectedDrone?.battery || 100) / 100) * 45))}m
              </div>
            </div>
          </div>

          {/* Dual Action Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onOpenTelemetryWorkspace(selectedDrone)}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#0284c7',
                border: 'none',
                borderRadius: 4,
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)',
              }}
            >
              <span>VIEW TELEMETRY</span>
              <ArrowRight size={13} />
            </button>

            <button
              onClick={() => onOpenDetailDrawer(selectedDrone)}
              title="Open Full Avionics Detail Drawer"
              style={{
                padding: '8px 12px',
                backgroundColor: '#162238',
                border: '1px solid #2a3d5e',
                borderRadius: 4,
                color: '#00f0ff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>AVIONICS</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* ─── CARD 2: FLEET LIST (REFERENCE 1) ──────────────────────────────── */}
        <div style={{
          backgroundColor: 'rgba(13, 21, 36, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #1e2c44',
          borderRadius: 8,
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em' }}>
              FLEET LIST ({filteredDrones.length})
            </span>

            <select
              value={fleetFilter}
              onChange={(e) => setFleetFilter(e.target.value)}
              style={{
                backgroundColor: '#121c2e',
                color: '#94a3b8',
                border: '1px solid #1e2c44',
                borderRadius: 3,
                fontSize: '10px',
                padding: '2px 6px',
                outline: 'none',
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Aircraft</option>
              <option value="EN_ROUTE">En Route</option>
              <option value="WARNING">Warnings</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '160px', overflowY: 'auto' }}>
            {filteredDrones.slice(0, 6).map((d) => {
              const isSel = selectedDrone?.id === d.id;
              const statusColor =
                d.status === 'CRITICAL' ? '#ef4444' : d.status === 'WARNING' ? '#f59e0b' : d.status === 'OFFLINE' ? '#64748b' : '#10b981';

              return (
                <div
                  key={d.id}
                  onClick={() => onSelectDrone(d)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    backgroundColor: isSel ? '#162238' : '#090d16',
                    border: `1px solid ${isSel ? '#00f0ff' : '#1e2c44'}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '11px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                    <span style={{ fontWeight: 800, color: isSel ? '#00f0ff' : '#f1f5f9' }}>
                      {d.callsign || d.id}
                    </span>
                  </div>

                  <span style={{ color: '#38bdf8' }}>
                    {(Number(d.airspeed || 0) * 3.6).toFixed(0)} km/h
                  </span>

                  <span style={{ color: '#00f0ff' }}>
                    {Number(d.altitude || 0).toFixed(0)} m
                  </span>

                  <span style={{ color: statusColor, fontSize: '10px', fontWeight: 700 }}>
                    {d.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── CARD 3: PLATFORM HEALTH (REFERENCE 1) ─────────────────────────── */}
        <div style={{
          backgroundColor: 'rgba(13, 21, 36, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #1e2c44',
          borderRadius: 8,
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em' }}>
              PLATFORM HEALTH
            </span>
            <span style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={12} />
              <span>NOMINAL</span>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            <div style={{ backgroundColor: '#121c2e', padding: '6px', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>Battery</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}>9/10</div>
            </div>
            <div style={{ backgroundColor: '#121c2e', padding: '6px', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>Propulsion</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}>10/10</div>
            </div>
            <div style={{ backgroundColor: '#121c2e', padding: '6px', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>Storage</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>5/10</div>
            </div>
            <div style={{ backgroundColor: '#121c2e', padding: '6px', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>Payload</div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}>8/10</div>
            </div>
          </div>
        </div>

        {/* ─── CARD 4: EVENT LOG (REFERENCE 1) ───────────────────────────────── */}
        <div style={{
          backgroundColor: 'rgba(13, 21, 36, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #1e2c44',
          borderRadius: 8,
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
        }}>
          {/* Header & Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em' }}>
              EVENT LOG
            </span>

            <div style={{ display: 'flex', gap: 2 }}>
              {['ALL', 'ALERTS', 'INFO', 'MISSION'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLogTab(tab)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '9px',
                    fontWeight: logTab === tab ? 800 : 500,
                    backgroundColor: logTab === tab ? '#162238' : 'transparent',
                    border: `1px solid ${logTab === tab ? '#00f0ff' : 'transparent'}`,
                    borderRadius: 3,
                    color: logTab === tab ? '#00f0ff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Events Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '140px', overflowY: 'auto' }}>
            {filteredLogs.length > 0 ? (
              filteredLogs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '6px 8px',
                    backgroundColor: log.severity === 'critical' ? 'rgba(239, 68, 68, 0.12)' : '#121c2e',
                    border: `1px solid ${log.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : '#1e2c44'}`,
                    borderRadius: 4,
                    fontSize: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{
                        color: log.severity === 'critical' ? '#ef4444' : log.severity === 'warning' ? '#f59e0b' : '#38bdf8',
                        fontWeight: 800,
                      }}>
                        [{log.type?.toUpperCase() || 'INFO'}]
                      </span>
                      <strong style={{ color: '#f1f5f9' }}>{log.droneId}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#64748b', fontSize: '9px' }}>{log.time}</span>
                      <button
                        onClick={() => onAcknowledgeAlert(log.id)}
                        title="Acknowledge alert"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: '0 2px',
                          fontSize: '10px',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '10px', lineHeight: 1.3 }}>
                    {log.title}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '12px', fontSize: '10px' }}>
                All sector telemetry logs nominal.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
