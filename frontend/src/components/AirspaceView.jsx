import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import { GEOFENCE_RESTRICTED, GEOFENCE_CAUTION } from './DemoSimulation';

export default function AirspaceView({ drones = [] }) {
  // Check which drones are near or within geofences
  const restrictedDrones = drones.filter((d) => {
    if (!d.lat || !d.lng) return false;
    // Approximated bounding box check for demo/display
    return d.lat >= 12.965 && d.lat <= 13.010 && d.lng >= 80.150 && d.lng <= 80.195;
  });

  const cautionDrones = drones.filter((d) => {
    if (!d.lat || !d.lng) return false;
    return d.lat >= 12.935 && d.lat <= 12.970 && d.lng >= 80.125 && d.lng <= 80.170;
  });

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
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #1e2c44', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.05em' }}>
            AIRSPACE DECONFLICTION & GEOFENCE MONITOR
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Chennai FIR (VOMF) Sector &bull; Active No-Fly Zones &bull; Tactical Geofence Boundaries
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#10b981' }}>
          <CheckCircle size={16} />
          <span>AIRSPACE ADVISORY: ACTIVE</span>
        </div>
      </div>

      {/* Grid of Geofence Sectors */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {/* Sector 1: Restricted Airspace */}
        <div style={{
          backgroundColor: '#0d1524',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="#ef4444" />
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>
                RESTRICTED ZONE // CHENNAI AIRPORT & TAMBARAM AIRBASE
              </h2>
            </div>
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '3px 8px', borderRadius: '3px', fontWeight: 700 }}>
              CLASS B (RED)
            </span>
          </div>

          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 14px' }}>
            Strict No-Fly buffer enclosing runway approaches and military radar installations. Any UAV intrusion triggers automated RTB override and regulatory flight quarantine.
          </p>

          <div style={{ backgroundColor: '#121c2e', padding: '10px 14px', borderRadius: '4px', fontSize: '11px', marginBottom: '14px' }}>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>POLYGON VERTICES:</div>
            <div style={{ color: '#cbd5e1' }}>
              {GEOFENCE_RESTRICTED.map((pt) => `[${pt[0].toFixed(3)}, ${pt[1].toFixed(3)}]`).join(' → ')}
            </div>
          </div>

          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>AIRCRAFT IN PROXIMITY:</span>
            <strong style={{ color: restrictedDrones.length > 0 ? '#ef4444' : '#10b981' }}>
              {restrictedDrones.length} AIRCRAFT DETECTED
            </strong>
          </div>
        </div>

        {/* Sector 2: Caution Area */}
        <div style={{
          backgroundColor: '#0d1524',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#f59e0b" />
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                CAUTION ZONE // PALLAVARAM-CHROMEPET TRANSIT BELT
              </h2>
            </div>
            <span style={{ fontSize: '10px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '3px 8px', borderRadius: '3px', fontWeight: 700 }}>
              URBAN DENSITY (AMBER)
            </span>
          </div>

          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 14px' }}>
            High-density arterial roads and elevated metro rail corridors. Minimum altitude requirement of 60m AGL; maximum ground speed capped at 45 m/s.
          </p>

          <div style={{ backgroundColor: '#121c2e', padding: '10px 14px', borderRadius: '4px', fontSize: '11px', marginBottom: '14px' }}>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>POLYGON VERTICES:</div>
            <div style={{ color: '#cbd5e1' }}>
              {GEOFENCE_CAUTION.map((pt) => `[${pt[0].toFixed(3)}, ${pt[1].toFixed(3)}]`).join(' → ')}
            </div>
          </div>

          <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>AIRCRAFT IN PROXIMITY:</span>
            <strong style={{ color: cautionDrones.length > 0 ? '#f59e0b' : '#10b981' }}>
              {cautionDrones.length} AIRCRAFT DETECTED
            </strong>
          </div>
        </div>
      </div>

      {/* Fleet Separation & Proximity Matrix */}
      <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: '#00f0ff' }}>
          RADAR PROXIMITY & SEPARATION AUDIT
        </h2>

        {drones.length > 0 ? (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#121c2e', color: '#94a3b8', borderBottom: '1px solid #1e2c44' }}>
                <th style={{ padding: '8px 12px' }}>AIRCRAFT</th>
                <th style={{ padding: '8px 12px' }}>STATUS</th>
                <th style={{ padding: '8px 12px' }}>COORDINATES</th>
                <th style={{ padding: '8px 12px' }}>ALTITUDE</th>
                <th style={{ padding: '8px 12px' }}>AIRSPACE ZONE</th>
                <th style={{ padding: '8px 12px' }}>PROXIMITY THREAT</th>
              </tr>
            </thead>
            <tbody>
              {drones.map((d, idx) => {
                const inRestricted = restrictedDrones.some((r) => r.id === d.id);
                const inCaution = cautionDrones.some((c) => c.id === d.id);

                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #152238', backgroundColor: idx % 2 === 0 ? '#0d1524' : '#0f1828' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#f1f5f9' }}>{d.callsign || d.id}</td>
                    <td style={{ padding: '8px 12px', color: d.status === 'CRITICAL' ? '#ef4444' : d.status === 'WARNING' ? '#f59e0b' : '#10b981' }}>
                      {d.status}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                      {d.lat?.toFixed(4)}, {d.lng?.toFixed(4)}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#00f0ff' }}>{Number(d.altitude || 0).toFixed(0)} m</td>
                    <td style={{ padding: '8px 12px' }}>
                      {inRestricted ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>RESTRICTED BOUNDARY</span>
                      ) : inCaution ? (
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>CAUTION CORRIDOR</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>CLEAR AIRSPACE</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', color: d.proximityThreat ? '#ef4444' : '#64748b' }}>
                      {d.proximityThreat ? '⚠ ALERT' : 'NOMINAL (SEPARATED)'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
            No live aircraft connected to evaluate separation.
          </div>
        )}
      </div>
    </div>
  );
}
