import { Battery, Compass, Navigation, Database, X, ArrowUpRight } from 'lucide-react';
import { TAMBARAM_HUB } from './DemoSimulation';

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return '0.0';
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(2);
}

export default function DroneDetailPanel({
  drone,
  onClose,
  onOpenHistory,
  onCenterDrone,
}) {
  if (!drone) return null;

  const battery = Number(drone.battery || 0);
  const distFromHub = calculateDistanceKm(drone.lat, drone.lng, TAMBARAM_HUB.lat, TAMBARAM_HUB.lng);
  const heading = Math.round(drone.heading || 0);
  const estMinutesRemaining = Math.max(0, Math.round((battery / 100) * 45));

  // Battery bar color
  const batColor = battery < 20 ? '#ef4444' : battery < 40 ? '#f59e0b' : '#10b981';

  return (
    <div style={{
      width: '380px',
      height: '100%',
      backgroundColor: '#0d1524',
      borderLeft: '1px solid #1e2c44',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      color: '#f1f5f9',
      zIndex: 60,
      boxShadow: '-8px 0 25px rgba(0, 0, 0, 0.7)',
      overflowY: 'auto',
    }}>
      {/* Top Header */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: '#121c2e',
        borderBottom: '1px solid #1e2c44',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: drone.status === 'CRITICAL' ? '#ef4444' : drone.status === 'WARNING' ? '#f59e0b' : drone.status === 'OFFLINE' ? '#64748b' : '#00f0ff',
            boxShadow: `0 0 10px ${drone.status === 'CRITICAL' ? '#ef4444' : '#00f0ff'}`,
          }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.05em' }}>
              {drone.callsign || drone.id}
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              SYS_ID: {drone.id} // SEC-ALPHA
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Operational State Banner */}
      <div style={{
        padding: '8px 18px',
        backgroundColor: drone.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)',
        borderBottom: '1px solid #1e2c44',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11px',
      }}>
        <span style={{ color: '#94a3b8' }}>CURRENT MISSION STATE</span>
        <span style={{
          fontWeight: 800,
          color: drone.status === 'CRITICAL' ? '#ef4444' : drone.status === 'WARNING' ? '#f59e0b' : '#00f0ff',
        }}>
          [{drone.operationalState || drone.status}]
        </span>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* SECTION 1: Dual Cell Battery Telemetry (Reference A) */}
        <div style={{
          backgroundColor: '#121c2e',
          border: '1px solid #1e2c44',
          borderRadius: '4px',
          padding: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <Battery size={14} color={batColor} />
              <span>POWER PACK // LIPO 6S</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              EST. TIME: <strong style={{ color: '#f1f5f9' }}>{estMinutesRemaining}m</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '26px', fontWeight: 800, color: batColor }}>
              {battery.toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>22.8V // 45°C</span>
          </div>

          {/* Dual Cell Balance Bar */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', marginBottom: '2px' }}>
                <span>CELL L</span>
                <span>{battery.toFixed(0)}%</span>
              </div>
              <div style={{ height: '5px', backgroundColor: '#090d16', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${battery}%`, height: '100%', backgroundColor: batColor }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', marginBottom: '2px' }}>
                <span>CELL R</span>
                <span>{Math.max(0, battery - 0.5).toFixed(0)}%</span>
              </div>
              <div style={{ height: '5px', backgroundColor: '#090d16', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, battery - 0.5)}%`, height: '100%', backgroundColor: batColor }} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <span>MIN RTB RESERVE: 15%</span>
            <span>DRAIN RATE: ~0.12 %/s</span>
          </div>
        </div>

        {/* SECTION 2: Flight Dynamics Metric Grid (Reference A) */}
        <div style={{
          backgroundColor: '#121c2e',
          border: '1px solid #1e2c44',
          borderRadius: '4px',
          padding: '12px',
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Navigation size={13} color="#00f0ff" />
            <span>FLIGHT DYNAMICS</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}>
            <div style={{ backgroundColor: '#090d16', padding: '8px', borderRadius: '3px' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>ALTITUDE (AGL)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#00f0ff' }}>
                {Number(drone.altitude || 0).toFixed(1)} <span style={{ fontSize: '10px', color: '#94a3b8' }}>m</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '8px', borderRadius: '3px' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>GROUND SPEED</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8' }}>
                {Number(drone.airspeed || 0).toFixed(1)} <span style={{ fontSize: '10px', color: '#94a3b8' }}>m/s</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '8px', borderRadius: '3px' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>HEADING</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
                {heading}° <span style={{ fontSize: '10px', color: '#94a3b8' }}>MAG</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#090d16', padding: '8px', borderRadius: '3px' }}>
              <div style={{ fontSize: '10px', color: '#64748b' }}>DIST FROM HOME</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
                {distFromHub} <span style={{ fontSize: '10px', color: '#94a3b8' }}>km</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Tactical Compass / Attitude Widget (Reference A) */}
        <div style={{
          backgroundColor: '#121c2e',
          border: '1px solid #1e2c44',
          borderRadius: '4px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Compass size={13} color="#00f0ff" />
              <span>GIMBAL & ATTITUDE</span>
            </span>
            <span style={{ color: '#00f0ff' }}>{heading}° N</span>
          </div>

          {/* Graphical Compass Dial */}
          <div style={{
            position: 'relative',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '2px solid #2a3d5e',
            backgroundColor: '#080c14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)',
            margin: '8px 0',
          }}>
            {/* Cardinal Markers */}
            <span style={{ position: 'absolute', top: 4, fontSize: '10px', fontWeight: 800, color: '#00f0ff' }}>N</span>
            <span style={{ position: 'absolute', right: 6, fontSize: '9px', color: '#64748b' }}>E</span>
            <span style={{ position: 'absolute', bottom: 4, fontSize: '9px', color: '#64748b' }}>S</span>
            <span style={{ position: 'absolute', left: 6, fontSize: '9px', color: '#64748b' }}>W</span>

            {/* Inner Attitude Crosshair */}
            <div style={{ width: '40px', height: '1px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <div style={{ height: '40px', width: '1px', backgroundColor: 'rgba(255,255,255,0.2)', position: 'absolute' }} />

            {/* Rotating Needle */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              transform: `rotate(${heading}deg)`,
              transition: 'transform 0.4s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute',
                top: 14,
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: '16px solid #00f0ff',
              }} />
            </div>
          </div>
        </div>

        {/* SECTION 4: Mission & Destination */}
        <div style={{
          backgroundColor: '#121c2e',
          border: '1px solid #1e2c44',
          borderRadius: '4px',
          padding: '12px',
          fontSize: '11px',
        }}>
          <div style={{ color: '#94a3b8', marginBottom: '6px' }}>DESTINATION CORRIDOR</div>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
            {drone.destination || 'Tambaram Central Hub'}
          </div>
          <div style={{ color: '#64748b', fontSize: '10px' }}>
            ORDER: {drone.activeOrder || 'NON-COMMERCIAL PATROL'}
          </div>
          <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '10px' }}>
            GPS: {drone.lat?.toFixed(5)}° N, {drone.lng?.toFixed(5)}° E
          </div>
        </div>

        {/* SECTION 5: Tactical Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={() => onCenterDrone(drone)}
            style={{
              padding: '10px',
              backgroundColor: '#162238',
              border: '1px solid #2a3d5e',
              borderRadius: '4px',
              color: '#00f0ff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ArrowUpRight size={14} />
            <span>TRACK ON MAP</span>
          </button>

          <button
            onClick={() => onOpenHistory(drone.id)}
            style={{
              padding: '10px',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Database size={14} />
            <span>ACCESS FLIGHT RECORDER (BLACK BOX)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
