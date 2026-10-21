import { useMemo, useState } from 'react';
import { Activity, BatteryWarning, Radio, ShieldAlert, Clock, ArrowRight, Check } from 'lucide-react';

const cardStyle = {
  background: 'rgba(13, 21, 36, 0.96)',
  border: '1px solid #243750',
  borderRadius: 10,
  padding: 14,
  boxShadow: '0 10px 28px rgba(0,0,0,.24)',
  backdropFilter: 'blur(12px)',
};

function batteryTone(value) {
  if (value == null || !Number.isFinite(Number(value))) return '#71839b';
  if (Number(value) <= 15) return '#fb7185';
  if (Number(value) <= 30) return '#fbbf24';
  return '#6ee7b7';
}

export default function FleetOverviewOverlay({
  drones = [],
  selectedDroneId = null,
  onSelectDrone = () => {},
  alerts = [],
  onAcknowledgeAlert = () => {},
}) {
  const [fleetFilter, setFleetFilter] = useState('ALL');

  const counts = useMemo(() => ({
    total: drones.length,
    online: drones.filter((d) => !['OFFLINE', 'UNKNOWN'].includes(d.status)).length,
    critical: drones.filter((d) => d.status === 'CRITICAL' || (d.battery != null && Number(d.battery) <= 15)).length,
    warnings: drones.filter((d) => d.status === 'WARNING' || (d.battery != null && Number(d.battery) > 15 && Number(d.battery) <= 30)).length,
    activeMissions: drones.filter((d) => ['EN_ROUTE', 'RETURNING', 'ACTIVE'].includes(d.status)).length,
  }), [drones]);

  const filteredDrones = useMemo(() => {
    if (fleetFilter === 'CRITICAL') return drones.filter((d) => d.status === 'CRITICAL' || (d.battery != null && Number(d.battery) <= 15));
    if (fleetFilter === 'WARNING') return drones.filter((d) => d.status === 'WARNING' || (d.battery != null && Number(d.battery) > 15 && Number(d.battery) <= 30));
    if (fleetFilter === 'OFFLINE') return drones.filter((d) => d.status === 'OFFLINE' || d.status === 'UNKNOWN');
    return drones;
  }, [drones, fleetFilter]);

  const visibleAlerts = alerts.slice(0, 5);

  return (
    <aside style={{
      position: 'absolute',
      top: 14,
      right: 14,
      bottom: 14,
      width: 'min(320px, calc(100vw - 96px))',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 450,
      pointerEvents: 'none',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2, pointerEvents: 'auto' }}>
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 800, letterSpacing: '.14em' }}>LIVE OPERATIONS</div>
              <h2 style={{ fontSize: 16, margin: '5px 0 0', color: '#edf6ff' }}>Fleet overview</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8fa4bd', fontSize: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
              CURRENT DATA
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {[
              ['TOTAL FLEET', counts.total, '#e5eef9', Activity],
              ['ONLINE', counts.online, '#6ee7b7', Radio],
              ['CRITICAL', counts.critical, '#fb7185', BatteryWarning],
              ['LOW BATTERY', counts.warnings, '#fbbf24', ShieldAlert],
            ].map(([label, value, color, Icon]) => (
              <div key={label} style={{ background: '#101d2e', border: '1px solid #263951', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, color: '#8fa4bd', fontSize: 9, fontWeight: 800 }}>
                  {label}<Icon size={13} color={color} />
                </div>
                <div style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '9px 10px', borderRadius: 7, background: '#101d2e', color: '#9fb2c8', fontSize: 11 }}>
            <span>Active missions</span><strong style={{ color: '#7dd3fc', fontSize: 14 }}>{counts.activeMissions}</strong>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: '#e7f0fb', fontSize: 13 }}>Aircraft</h3>
            <select aria-label="Filter fleet" value={fleetFilter} onChange={(e) => setFleetFilter(e.target.value)} style={{ maxWidth: 130, background: '#101d2e', border: '1px solid #2a3d56', color: '#c8d7e9', padding: '5px 7px', borderRadius: 6, fontSize: 10 }}>
              <option value="ALL">All aircraft</option>
              <option value="CRITICAL">Critical battery</option>
              <option value="WARNING">Low battery</option>
              <option value="OFFLINE">Offline / unknown</option>
            </select>
          </div>
          {filteredDrones.length === 0 ? (
            <div style={{ color: '#8fa4bd', fontSize: 12, padding: '14px 4px' }}>No aircraft match this filter.</div>
          ) : filteredDrones.map((drone) => {
            const selected = drone.id === selectedDroneId;
            const color = batteryTone(drone.battery);
            return (
              <button key={drone.id} onClick={() => onSelectDrone(drone)} style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                padding: '10px 8px', borderRadius: 7, border: `1px solid ${selected ? '#247da0' : 'transparent'}`,
                background: selected ? 'rgba(14,165,233,.12)' : 'transparent', color: '#dbe7f5', cursor: 'pointer',
              }}>
                <span style={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: 99, background: drone.status === 'OFFLINE' ? '#64748b' : color }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{drone.callsign || drone.id}</span>
                  <span style={{ display: 'block', color: '#8297b0', fontSize: 10, marginTop: 3 }}>{drone.operationalState || drone.status || 'STATUS UNKNOWN'}</span>
                </span>
                <span style={{ color, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{drone.battery == null ? 'N/A' : `${Number(drone.battery).toFixed(0)}%`}</span>
                <ArrowRight size={13} color="#68829e" />
              </button>
            );
          })}
        </section>

        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: '#e7f0fb', fontSize: 13 }}>Alerts & events</h3>
            <span style={{ color: alerts.length ? '#fbbf24' : '#6ee7b7', fontSize: 10, fontWeight: 800 }}>{alerts.length} OPEN</span>
          </div>
          {visibleAlerts.length === 0 ? (
            <div style={{ color: '#8fa4bd', fontSize: 12, padding: '8px 0' }}>No unacknowledged alerts.</div>
          ) : visibleAlerts.map((alert) => (
            <div key={alert.id} style={{ padding: '9px 0', borderTop: '1px solid #23364e', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <ShieldAlert size={14} color={alert.severity === 'critical' ? '#fb7185' : '#fbbf24'} style={{ flex: '0 0 auto', marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#dce8f5', fontSize: 11, lineHeight: 1.4, fontWeight: 700 }}>{alert.title}</div>
                <div style={{ color: '#8fa4bd', fontSize: 10, lineHeight: 1.5, marginTop: 3 }}>{alert.desc}</div>
                <div style={{ color: '#647c97', fontSize: 9, marginTop: 4 }}><Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />{alert.time || 'Time unavailable'}</div>
              </div>
              <button aria-label={`Acknowledge ${alert.title}`} title="Acknowledge alert" onClick={() => onAcknowledgeAlert(alert.id)} style={{ flex: '0 0 auto', border: '1px solid #2c435d', background: '#13243a', color: '#9db2c9', borderRadius: 5, padding: 5, cursor: 'pointer' }}><Check size={12} /></button>
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}
