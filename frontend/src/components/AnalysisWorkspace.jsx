import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Battery,
  Gauge,
  Navigation,
  Activity,
  Radio,
  Clock,
  Download,
  CheckCircle,
  Database,
} from 'lucide-react';

export default function AnalysisWorkspace({
  drone,
  allDrones = [],
  onSelectDrone = () => {},
  onReturnToMap = () => {},
}) {
  const [selectedDroneId, setSelectedDroneId] = useState(drone?.id || 'UAV-01');
  const [historyRecords, setHistoryRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeMetric, setActiveMetric] = useState('battery'); // 'battery' | 'altitude' | 'speed' | 'all'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const activeDrone = useMemo(() => {
    return allDrones.find((d) => d.id === selectedDroneId) || drone || { id: selectedDroneId, callsign: selectedDroneId };
  }, [allDrones, selectedDroneId, drone]);

  // Handle escape key to return to map
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onReturnToMap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReturnToMap]);

  // Fetch real database records from backend
  useEffect(() => {
    let ignore = false;
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/drones/${encodeURIComponent(selectedDroneId)}/history?limit=30`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore && data?.records) {
          setHistoryRecords(data.records);
        }
      } catch (err) {
        console.warn('History query error:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchHistory();
    return () => { ignore = true; };
  }, [selectedDroneId]);

  // Parse records into standardized series
  const dataSeries = useMemo(() => {
    const parseField = (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return {}; }
      }
      return val || {};
    };

    if (!historyRecords || historyRecords.length === 0) {
      // If no DB records yet, synthesize the current live point
      const now = activeDrone?.lastSeen || Date.now();
      return [{
        timestamp: now,
        timeLabel: new Date(now).toLocaleTimeString([], { hour12: false }),
        battery: Number(activeDrone?.battery ?? 100),
        altitude: Number(activeDrone?.altitude ?? 60),
        speed: Number(activeDrone?.airspeed ?? 41.7),
        heading: Number(activeDrone?.heading ?? 0),
        lat: activeDrone?.lat ?? 12.9249,
        lng: activeDrone?.lng ?? 80.1000,
      }];
    }

    // Records are ordered newest first from DB; reverse for chronological left-to-right chart
    const chronological = [...historyRecords].reverse();

    return chronological.map((rec) => {
      const ts = Number(rec.timestamp);
      const timeMs = !isNaN(ts) ? ts * 1000 : Date.now();
      const flight = parseField(rec.flight_dynamics);
      const prop = parseField(rec.propulsion_systems);
      const sensors = parseField(rec.tactical_sensors);

      const alt = Number(flight.altitude_m ?? flight.altitude_meters ?? 0);
      const spd = Number(flight.speed_mps ?? (flight.airspeed_knots ? flight.airspeed_knots * 0.514444 : 0));
      const bat = Number(prop.battery_pct ?? prop.battery_state?.capacity_remaining_percent ?? 100);
      const hdg = Number(flight.heading ?? flight.heading_degrees ?? 0);
      const lat = Number(flight.lat ?? sensors.gps?.latitude ?? 0);
      const lng = Number(flight.lng ?? sensors.gps?.longitude ?? 0);

      return {
        timestamp: timeMs,
        timeLabel: new Date(timeMs).toLocaleTimeString([], { hour12: false }),
        battery: Math.min(100, Math.max(0, bat)),
        altitude: Math.max(0, alt),
        speed: Math.max(0, spd),
        heading: hdg,
        lat,
        lng,
      };
    });
  }, [historyRecords, activeDrone]);

  // Export JSON audit log
  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataSeries, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `${selectedDroneId}_telemetry_audit.json`);
    dlAnchor.click();
  };

  // Metric metadata
  const METRIC_CONFIG = {
    battery: {
      label: 'BATTERY CAPACITY',
      unit: '%',
      color: '#10b981',
      warnColor: '#f59e0b',
      critColor: '#ef4444',
      domain: [0, 100],
    },
    altitude: {
      label: 'ALTITUDE (AGL)',
      unit: 'm',
      color: '#00f0ff',
      domain: [0, Math.max(120, Math.ceil(Math.max(...dataSeries.map((d) => d.altitude), 80) / 20) * 20)],
    },
    speed: {
      label: 'GROUND AIRSPEED',
      unit: 'm/s',
      color: '#38bdf8',
      domain: [0, Math.max(60, Math.ceil(Math.max(...dataSeries.map((d) => d.speed), 45) / 10) * 10)],
    },
  };

  // SVG Chart Render Helper
  const renderLineChart = (metricKey, height = 220) => {
    const cfg = METRIC_CONFIG[metricKey];
    const width = 900;
    const padLeft = 50;
    const padRight = 30;
    const padTop = 20;
    const padBottom = 40;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const values = dataSeries.map((d) => d[metricKey]);
    const minVal = cfg.domain[0];
    const maxVal = cfg.domain[1];
    const range = maxVal - minVal || 1;

    // Coordinate mapping
    const getX = (idx) => {
      if (dataSeries.length <= 1) return padLeft + chartW / 2;
      return padLeft + (idx / (dataSeries.length - 1)) * chartW;
    };

    const getY = (val) => {
      return padTop + chartH - ((val - minVal) / range) * chartH;
    };

    // Polyline points
    const pointsStr = dataSeries.map((d, i) => `${getX(i)},${getY(d[metricKey])}`).join(' ');

    // Area fill path
    const areaPath = `M ${padLeft},${padTop + chartH} L ${pointsStr} L ${getX(dataSeries.length - 1)},${padTop + chartH} Z`;

    const latestVal = values[values.length - 1] ?? 0;
    const avgVal = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 0;
    const minMeasured = values.length > 0 ? Math.min(...values).toFixed(1) : 0;
    const maxMeasured = values.length > 0 ? Math.max(...values).toFixed(1) : 0;

    return (
      <div style={{
        backgroundColor: '#0d1524',
        border: '1px solid #1e2c44',
        borderRadius: '6px',
        padding: '16px 20px',
        marginBottom: '16px',
      }}>
        {/* Metric Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cfg.color }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>
              {cfg.label}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#94a3b8' }}>
            <span>LATEST: <strong style={{ color: cfg.color }}>{latestVal.toFixed(1)} {cfg.unit}</strong></span>
            <span>AVG: <strong style={{ color: '#f1f5f9' }}>{avgVal} {cfg.unit}</strong></span>
            <span>MIN: <strong style={{ color: '#cbd5e1' }}>{minMeasured}</strong></span>
            <span>MAX: <strong style={{ color: '#cbd5e1' }}>{maxMeasured}</strong></span>
          </div>
        </div>

        {/* SVG Drawing */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: `${height}px`, display: 'block', userSelect: 'none' }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cfg.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={cfg.color} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = padTop + chartH * pct;
              const val = maxVal - pct * range;
              return (
                <g key={idx}>
                  <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#1e2c44" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={padLeft - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {val.toFixed(0)} {cfg.unit}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            <path d={areaPath} fill={`url(#grad-${metricKey})`} />

            {/* Main Polyline */}
            <polyline
              points={pointsStr}
              fill="none"
              stroke={cfg.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {dataSeries.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(d[metricKey])}
                r={hoveredIndex === i ? 5 : 2.5}
                fill={hoveredIndex === i ? '#ffffff' : cfg.color}
                stroke="#090d16"
                strokeWidth="1.5"
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredIndex(i)}
              />
            ))}

            {/* Hover Crosshair & Tooltip */}
            {hoveredIndex != null && dataSeries[hoveredIndex] && (
              <g>
                <line
                  x1={getX(hoveredIndex)}
                  y1={padTop}
                  x2={getX(hoveredIndex)}
                  y2={padTop + chartH}
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
                <circle
                  cx={getX(hoveredIndex)}
                  cy={getY(dataSeries[hoveredIndex][metricKey])}
                  r="6"
                  fill="#ffffff"
                  stroke={cfg.color}
                  strokeWidth="2"
                />
                <g transform={`translate(${Math.min(width - padRight - 110, Math.max(padLeft, getX(hoveredIndex) - 55))}, ${padTop + 6})`}>
                  <rect width="110" height="34" rx="4" fill="#121c2e" stroke="#2a3d5e" strokeWidth="1" />
                  <text x="55" y="14" fill="#00f0ff" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    {dataSeries[hoveredIndex][metricKey].toFixed(1)} {cfg.unit}
                  </text>
                  <text x="55" y="27" fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                    {dataSeries[hoveredIndex].timeLabel}
                  </text>
                </g>
              </g>
            )}

            {/* X-Axis Time Labels */}
            {dataSeries.map((d, i) => {
              // Show up to 7 evenly spaced labels
              const step = Math.max(1, Math.floor(dataSeries.length / 6));
              if (i % step === 0 || i === dataSeries.length - 1) {
                return (
                  <text
                    key={i}
                    x={getX(i)}
                    y={height - 12}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {d.timeLabel}
                  </text>
                );
              }
              return null;
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#06090e',
      color: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'JetBrains Mono, monospace',
      overflowY: 'auto',
      zIndex: 50,
      position: 'relative',
    }}>
      {/* Top Header & Breadcrumbs */}
      <header style={{
        padding: '14px 28px',
        backgroundColor: '#0d1524',
        borderBottom: '1px solid #1e2c44',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onReturnToMap}
            style={{
              padding: '6px 12px',
              backgroundColor: '#162238',
              border: '1px solid #2a3d5e',
              borderRadius: '4px',
              color: '#00f0ff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} />
            <span>RETURN TO MAP (ESC)</span>
          </button>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>AIRCRAFT TELEMETRY & TIME-SERIES ANALYSIS</span>
              <span style={{ fontSize: '11px', padding: '1px 6px', backgroundColor: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff', borderRadius: '3px' }}>
                LIVE FEED
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              IMMUTABLE SENSOR TELEMETRY &bull; TAMBARAM RADAR STREAM
            </div>
          </div>
        </div>

        {/* Right Controls: Drone Selector & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
            <span>AIRCRAFT:</span>
            <select
              value={selectedDroneId}
              onChange={(e) => {
                setSelectedDroneId(e.target.value);
                const found = allDrones.find((d) => d.id === e.target.value);
                if (found) onSelectDrone(found);
              }}
              style={{
                backgroundColor: '#121c2e',
                color: '#00f0ff',
                border: '1px solid #2a3d5e',
                borderRadius: '4px',
                padding: '6px 10px',
                fontFamily: 'monospace',
                fontSize: '12px',
                fontWeight: 700,
                outline: 'none',
              }}
            >
              {allDrones.length > 0 ? (
                allDrones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.callsign || d.id} [{d.status}]
                  </option>
                ))
              ) : (
                <option value="UAV-01">UAV-01</option>
              )}
            </select>
          </div>

          <button
            onClick={handleExportData}
            style={{
              padding: '6px 12px',
              backgroundColor: '#121c2e',
              border: '1px solid #2a3d5e',
              borderRadius: '4px',
              color: '#f1f5f9',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={13} />
            <span>EXPORT JSON</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{ padding: '24px 28px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>

        {/* Live Status Cards Ribbon */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '4px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>AIRCRAFT STATE</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: activeDrone.status === 'CRITICAL' ? '#ef4444' : activeDrone.status === 'WARNING' ? '#f59e0b' : '#10b981', marginTop: '4px' }}>
              [{activeDrone.status || 'ACTIVE'}]
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{activeDrone.destination || 'Tambaram Hub'}</div>
          </div>

          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '4px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>BATTERY LEVEL</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
              {Number(activeDrone.battery || 0).toFixed(1)}%
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>22.8V // NOMINAL</div>
          </div>

          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '4px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>CURRENT ALTITUDE</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#00f0ff', marginTop: '4px' }}>
              {Number(activeDrone.altitude || 0).toFixed(1)} m
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>AGL CEILING: 120m</div>
          </div>

          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '4px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>AIRSPEED</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              {Number(activeDrone.airspeed || 0).toFixed(1)} m/s
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>~{(Number(activeDrone.airspeed || 0) * 3.6).toFixed(0)} km/h</div>
          </div>

          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '4px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>GPS COORDINATES</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginTop: '4px' }}>
              {Number(activeDrone.lat || 12.9249).toFixed(4)}, {Number(activeDrone.lng || 80.1000).toFixed(4)}
            </div>
            <div style={{ fontSize: '9px', color: '#10b981', marginTop: '2px' }}>● RTK FIXED</div>
          </div>
        </div>

        {/* View Metric Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'battery', label: 'Battery Capacity' },
              { id: 'altitude', label: 'Altitude (m)' },
              { id: 'speed', label: 'Airspeed (m/s)' },
              { id: 'all', label: 'Stacked Multi-Metric' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveMetric(tab.id)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: activeMetric === tab.id ? '#162238' : '#0d1524',
                  border: `1px solid ${activeMetric === tab.id ? '#00f0ff' : '#1e2c44'}`,
                  borderRadius: '4px',
                  color: activeMetric === tab.id ? '#00f0ff' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            DATA SAMPLES: <strong style={{ color: '#f1f5f9' }}>{dataSeries.length}</strong> {loading && '(SYNCHRONIZING...)'}
          </div>
        </div>

        {/* Render Charts */}
        {activeMetric === 'all' ? (
          <div>
            {renderLineChart('battery', 160)}
            {renderLineChart('altitude', 160)}
            {renderLineChart('speed', 160)}
          </div>
        ) : (
          renderLineChart(activeMetric, 240)
        )}

        {/* Telemetry Records Ledger Table */}
        <div style={{
          backgroundColor: '#0d1524',
          border: '1px solid #1e2c44',
          borderRadius: '6px',
          overflow: 'hidden',
          marginTop: '16px',
        }}>
          <div style={{ padding: '12px 16px', backgroundColor: '#121c2e', borderBottom: '1px solid #1e2c44', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>
              CHRONOLOGICAL TELEMETRY LEDGER ({dataSeries.length} SAMPLES)
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              TIMESTAMPED VIA ONBOARD RTOS
            </span>
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#090d16', color: '#64748b', borderBottom: '1px solid #1e2c44' }}>
                  <th style={{ padding: '8px 14px' }}>TIMESTAMP (LOCAL)</th>
                  <th style={{ padding: '8px 14px' }}>BATTERY</th>
                  <th style={{ padding: '8px 14px' }}>ALTITUDE</th>
                  <th style={{ padding: '8px 14px' }}>SPEED</th>
                  <th style={{ padding: '8px 14px' }}>HEADING</th>
                  <th style={{ padding: '8px 14px' }}>GPS POSITION</th>
                </tr>
              </thead>
              <tbody>
                {dataSeries.slice().reverse().map((rec, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #121c2e', backgroundColor: i % 2 === 0 ? '#0d1524' : '#0f1828' }}>
                    <td style={{ padding: '8px 14px', color: '#94a3b8' }}>{rec.timeLabel}</td>
                    <td style={{ padding: '8px 14px', color: rec.battery < 20 ? '#ef4444' : rec.battery < 40 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                      {rec.battery.toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px 14px', color: '#00f0ff' }}>{rec.altitude.toFixed(1)} m</td>
                    <td style={{ padding: '8px 14px', color: '#38bdf8' }}>{rec.speed.toFixed(1)} m/s</td>
                    <td style={{ padding: '8px 14px', color: '#cbd5e1' }}>{rec.heading.toFixed(0)}°</td>
                    <td style={{ padding: '8px 14px', color: '#64748b' }}>
                      {rec.lat.toFixed(4)}, {rec.lng.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
