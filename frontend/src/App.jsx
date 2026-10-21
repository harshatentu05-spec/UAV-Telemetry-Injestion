import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  X,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

import TacticalMap from './components/TacticalMap';
import NavigationRail from './components/NavigationRail';
import FleetOverviewOverlay from './components/FleetOverviewOverlay';
import DroneDetailPanel from './components/DroneDetailPanel';
import DroneHistoryPanel from './components/DroneHistoryPanel';
import AnalysisWorkspace from './components/AnalysisWorkspace';
import MissionsView from './components/MissionsView';
import AirspaceView from './components/AirspaceView';
import TelemetryView from './components/TelemetryView';
import WeatherView from './components/WeatherView';

import { useTelemetryStream } from './hooks/useTelemetryStream';
import { API_BASE_URL, telemetrySocketUrl } from './api';
import { useDemoSimulation } from './components/DemoSimulation';

export default function App() {
  const [activeView, setActiveView] = useState('map'); // 'map' | 'fleet' | 'missions' | 'airspace' | 'telemetry' | 'analysis' | 'weather' | 'alerts' | 'settings'
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedDroneId, setSelectedDroneId] = useState(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalDroneId, setHistoryModalDroneId] = useState('UAV-01');
  const [showGeofences, setShowGeofences] = useState(true);
  const [activeRoute, setActiveRoute] = useState(null);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  // Real dual clock (UTC & IST)
  const [currentTime, setCurrentTime] = useState({
    utc: new Date().toUTCString().slice(17, 25),
    ist: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }),
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime({
        utc: now.toUTCString().slice(17, 25),
        ist: now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false }),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global ESC key listener to dismiss topmost overlay / drawer and return to map
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showHistoryModal) {
          setShowHistoryModal(false);
        } else if (showDetailDrawer) {
          setShowDetailDrawer(false);
        } else if (activeView !== 'map' && activeView !== 'fleet') {
          setActiveView('map');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistoryModal, showDetailDrawer, activeView]);

  // Demo simulation state
  const {
    drones: demoDrones,
    isRunning: isDemoRunning,
    togglePause: toggleDemoPause,
    resetSimulation: resetDemoSimulation,
  } = useDemoSimulation(isDemoMode);

  // Live telemetry stream (or demo drones if isDemoMode is on)
  const { drones, connectionStatus } = useTelemetryStream(isDemoMode, demoDrones);

  const selectedDrone = useMemo(() => {
    return selectedDroneId ? (drones.find((d) => d.id === selectedDroneId) || null) : null;
  }, [drones, selectedDroneId]);

  // Derived Alerts stream
  const alertsList = useMemo(() => {
    const alerts = [];
    drones.forEach((d) => {
      if (d.status === 'CRITICAL') {
        alerts.push({
          id: `crit-${d.id}`,
          type: 'diagnostic',
          severity: 'critical',
          droneId: d.id,
          title: `Critical Battery Depletion [${d.battery == null ? 'N/A' : `${d.battery}%`}]`,
          desc: `${d.callsign || d.id} battery is critically depleted. Verify the aircraft state; automatic return is not confirmed by telemetry.`,
          time: new Date(d.lastSeen).toLocaleTimeString([], { hour12: false }),
        });
      } else if (d.status === 'WARNING') {
        alerts.push({
          id: `warn-${d.id}`,
          type: 'diagnostic',
          severity: 'warning',
          droneId: d.id,
          title: `Low Battery Advisory [${d.battery == null ? 'N/A' : `${d.battery}%`}]`,
          desc: `${d.callsign || d.id} is below the configured battery advisory threshold.`,
          time: new Date(d.lastSeen).toLocaleTimeString([], { hour12: false }),
        });
      }

      if (d.proximityThreat) {
        alerts.push({
          id: `prox-${d.id}`,
          type: 'airspace',
          severity: 'critical',
          droneId: d.id,
          title: `Proximity Boundary Hazard`,
          desc: `${d.callsign || d.id} radar detected obstacle or airspace perimeter warning.`,
          time: new Date(d.lastSeen).toLocaleTimeString([], { hour12: false }),
        });
      }

      if (d.status === 'OFFLINE') {
        alerts.push({
          id: `off-${d.id}`,
          type: 'system',
          severity: 'warning',
          droneId: d.id,
          title: `Telemetry Heartbeat Timeout`,
          desc: `Link lost for ${d.callsign || d.id}. Last known sector: ${d.lat?.toFixed(3)}, ${d.lng?.toFixed(3)}.`,
          time: new Date(d.lastSeen).toLocaleTimeString([], { hour12: false }),
        });
      }
    });
    return alerts;
  }, [drones]);

  const activeAlerts = useMemo(() => {
    return alertsList.filter((a) => !acknowledgedAlerts[a.id]);
  }, [alertsList, acknowledgedAlerts]);

  const handleSelectDrone = useCallback((d) => {
    if (!d?.id) return;
    setSelectedDroneId(d.id);
    setShowDetailDrawer(true);

    // Only draw a route when the selected drone supplies route/target coordinates.
    // This avoids inventing a path for live telemetry that has no route metadata.
    const routePoints = Array.isArray(d.route) ? d.route :
      (d.targetLat != null && d.targetLng != null && d.lat != null && d.lng != null &&
       Number.isFinite(Number(d.targetLat)) && Number.isFinite(Number(d.targetLng)) &&
       Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) &&
       Number(d.lat) !== 0 && Number(d.lng) !== 0
        ? [[Number(d.lat), Number(d.lng)], [Number(d.targetLat), Number(d.targetLng)]]
        : null);
    if (routePoints && routePoints.length > 1) {
      setActiveRoute({ outbound: routePoints, return: [] });
    } else {
      setActiveRoute(null);
    }
  }, []);

  const handleOpenTelemetryWorkspace = useCallback((d) => {
    if (d) setSelectedDroneId(d.id);
    setActiveView('analysis');
  }, []);

  const handleOpenDetailDrawer = useCallback((d) => {
    if (d) setSelectedDroneId(d.id);
    setShowDetailDrawer(true);
  }, []);

  const handleOpenHistoryModal = useCallback((id) => {
    setHistoryModalDroneId(id || 'UAV-01');
    setShowHistoryModal(true);
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#06090e',
      color: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'JetBrains Mono, -apple-system, sans-serif',
    }}>
      {/* ─── FLOATING TOP-RIGHT MISSION & CLOCK HUD (REFERENCE 1) ─────────── */}
      <header style={{
        position: 'absolute',
        top: 12,
        left: 78,
        right: 356,
        minHeight: '42px',
        height: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        zIndex: 420,
        pointerEvents: 'none',
      }}>
        {/* Left HUD: Active Mission & Aircraft Breadcrumb */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(13, 21, 36, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid #1e2c44',
          borderRadius: 6,
          padding: '6px 14px',
          pointerEvents: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>MISSION:</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#f1f5f9' }}>TAMBARAM-METRO</span>
          </div>

          <span style={{ color: '#334155' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>AIRCRAFT:</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#00f0ff' }}>
              {selectedDrone?.callsign || selectedDrone?.id || 'FLEET'}
            </span>
          </div>

          <span style={{ color: '#334155' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '10px', color: '#64748b' }}>STATE:</span>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              color: selectedDrone?.status === 'CRITICAL' ? '#ef4444' : selectedDrone?.status === 'WARNING' ? '#f59e0b' : '#10b981',
            }}>
              [{selectedDrone?.operationalState || selectedDrone?.status || 'ONLINE'}]
            </span>
          </div>
        </div>

        {/* Right HUD: Clocks, Connection State & Demo Mode */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'auto',
        }}>
          {/* Dual Atomic Clocks */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '11px',
            color: '#94a3b8',
            backgroundColor: 'rgba(13, 21, 36, 0.92)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #1e2c44',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}>
            <Clock size={12} color="#64748b" />
            <span>{currentTime.ist} <strong style={{ color: '#00f0ff' }}>IST</strong></span>
            <span style={{ color: '#334155' }}>|</span>
            <span>{currentTime.utc} <strong style={{ color: '#94a3b8' }}>UTC</strong></span>
          </div>

          {/* Connection Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '11px',
            fontWeight: 800,
            padding: '6px 12px',
            borderRadius: 6,
            backgroundColor:
              connectionStatus === 'demo'
                ? 'rgba(139, 92, 246, 0.25)'
                : connectionStatus === 'connected'
                ? 'rgba(16, 185, 129, 0.2)'
                : connectionStatus === 'connecting'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${
              connectionStatus === 'demo'
                ? '#8b5cf6'
                : connectionStatus === 'connected'
                ? '#10b981'
                : connectionStatus === 'connecting'
                ? '#f59e0b'
                : '#ef4444'
            }`,
            color:
              connectionStatus === 'demo'
                ? '#c084fc'
                : connectionStatus === 'connected'
                ? '#10b981'
                : connectionStatus === 'connecting'
                ? '#f59e0b'
                : '#ef4444',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            <span>
              {connectionStatus === 'demo'
                ? 'DEMO MODE'
                : connectionStatus === 'connected'
                ? 'LINK UP'
                : connectionStatus === 'connecting'
                ? 'CONNECTING'
                : 'LINK LOST'}
            </span>
          </div>

          {/* Demo Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setIsDemoMode((p) => !p)}
              style={{
                height: 32,
                padding: '0 10px',
                backgroundColor: isDemoMode ? '#8b5cf6' : 'rgba(13, 21, 36, 0.92)',
                border: `1px solid ${isDemoMode ? '#a855f7' : '#1e2c44'}`,
                borderRadius: 6,
                color: isDemoMode ? '#ffffff' : '#94a3b8',
                fontSize: '10px',
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              }}
            >
              {isDemoMode ? 'SIMULATION ACTIVE' : 'RUN DEMO'}
            </button>

            {isDemoMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={toggleDemoPause}
                  title={isDemoRunning ? 'Pause Demo' : 'Resume Demo'}
                  style={{
                    height: 32,
                    width: 32,
                    backgroundColor: '#162238',
                    border: '1px solid #2a3d5e',
                    borderRadius: 6,
                    color: '#00f0ff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isDemoRunning ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  onClick={resetDemoSimulation}
                  title="Reset Demo Simulation"
                  style={{
                    height: 32,
                    width: 32,
                    backgroundColor: '#162238',
                    border: '1px solid #2a3d5e',
                    borderRadius: 6,
                    color: '#f59e0b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Demo Mode Notice Banner (Required by Section 11) */}
      {isDemoMode && (
        <div style={{
          position: 'absolute',
          top: 62,
          left: 78,
          right: 356,
          backgroundColor: 'rgba(139, 92, 246, 0.35)',
          backdropFilter: 'blur(6px)',
          border: '1px solid #8b5cf6',
          borderRadius: 6,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#e9d5ff',
          zIndex: 420,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, color: '#c084fc' }}>[DEMO / SIMULATION MODE ACTIVE]</span>
            <span>Displaying synthetic, isolated UAV telemetry across Chennai corridors. No commands sent to real aircraft.</span>
          </div>
          <button
            onClick={() => setIsDemoMode(false)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #c084fc',
              color: '#e9d5ff',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            EXIT DEMO
          </button>
        </div>
      )}

      {/* ─── LEFT FLOATING TOOL RAIL (REFERENCE 1) ─────────────────────────── */}
      <NavigationRail
        activeView={activeView}
        onSelectView={(view) => {
          setActiveView(view);
          if (view === 'fleet') {
            // Fleet is a fleet-wide workspace, not a continuation of the last selected aircraft.
            setSelectedDroneId(null);
            setShowDetailDrawer(false);
            setActiveRoute(null);
          } else if (view === 'map') {
            // Returning to the map keeps a selected drone only when its detail drawer is open.
            if (!showDetailDrawer) {
              setSelectedDroneId(null);
              setActiveRoute(null);
            }
          }
        }}
        alertsCount={activeAlerts.length}
      />

      {/* ─── PRIMARY FULL-VIEWPORT MAP WORKSPACE (THE MAP IS THE APPLICATION) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }}>
        <TacticalMap
          drones={drones}
          selectedDroneId={selectedDroneId}
          onSelectDrone={(d) => {
            handleSelectDrone(d);
          }}
          activeRoute={activeRoute}
          showGeofences={showGeofences}
          onToggleGeofences={() => setShowGeofences((p) => !p)}
          topRightOffset={0}
        />
      </div>

      {/* ─── LEFT FLOATING TACTICAL CARDS (REFERENCE 1) ────────────────────── */}
      {(activeView === 'map' || activeView === 'fleet' || activeView === 'alerts') && (
        <FleetOverviewOverlay
          drones={drones}
          selectedDroneId={selectedDroneId}
          onSelectDrone={handleSelectDrone}
          onOpenTelemetryWorkspace={handleOpenTelemetryWorkspace}
          onOpenDetailDrawer={handleOpenDetailDrawer}
          alerts={activeAlerts}
          onAcknowledgeAlert={(id) => setAcknowledgedAlerts((prev) => ({ ...prev, [id]: true }))}
        />
      )}

      {/* ─── DEDICATED OVERLAY WORKSPACES (SECTIONS 6, 7, 8) ───────────────── */}
      
      {/* 1. Dedicated Aircraft Telemetry & Analysis Workspace */}
      {activeView === 'analysis' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 600 }}>
          <AnalysisWorkspace
            drone={selectedDrone}
            allDrones={drones}
            onSelectDrone={handleSelectDrone}
            onReturnToMap={() => setActiveView('map')}
          />
        </div>
      )}

      {/* 2. Missions Workspace */}
      {activeView === 'missions' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 24px', backgroundColor: '#0d1524', borderBottom: '1px solid #1e2c44', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => setActiveView('map')}
              style={{
                padding: '6px 14px',
                backgroundColor: '#162238',
                border: '1px solid #2a3d5e',
                color: '#00f0ff',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              &larr; RETURN TO MAP (ESC)
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MissionsView onRouteCalculated={(route) => {
              setActiveRoute(route);
              setActiveView('map');
            }} />
          </div>
        </div>
      )}

      {/* 3. Airspace Workspace */}
      {activeView === 'airspace' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 24px', backgroundColor: '#0d1524', borderBottom: '1px solid #1e2c44', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => setActiveView('map')}
              style={{
                padding: '6px 14px',
                backgroundColor: '#162238',
                border: '1px solid #2a3d5e',
                color: '#00f0ff',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              &larr; RETURN TO MAP (ESC)
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <AirspaceView drones={drones} />
          </div>
        </div>
      )}

      {/* 4. Telemetry Workspace */}
      {activeView === 'telemetry' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 24px', backgroundColor: '#0d1524', borderBottom: '1px solid #1e2c44', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => setActiveView('map')}
              style={{
                padding: '6px 14px',
                backgroundColor: '#162238',
                border: '1px solid #2a3d5e',
                color: '#00f0ff',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              &larr; RETURN TO MAP (ESC)
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TelemetryView drones={drones} onSelectDrone={handleSelectDrone} />
          </div>
        </div>
      )}

      {/* 5. Weather Workspace */}
      {activeView === 'weather' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 24px', backgroundColor: '#0d1524', borderBottom: '1px solid #1e2c44', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => setActiveView('map')}
              style={{
                padding: '6px 14px',
                backgroundColor: '#162238',
                border: '1px solid #2a3d5e',
                color: '#00f0ff',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              &larr; RETURN TO MAP (ESC)
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <WeatherView />
          </div>
        </div>
      )}

      {/* 6. Settings Workspace */}
      {activeView === 'settings' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 24px', backgroundColor: '#0d1524', borderBottom: '1px solid #1e2c44', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              onClick={() => setActiveView('map')}
              style={{
                padding: '6px 14px',
                backgroundColor: '#162238',
                border: '1px solid #2a3d5e',
                color: '#00f0ff',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              &larr; RETURN TO MAP (ESC)
            </button>
          </div>
          <div style={{ padding: 'clamp(20px, 4vw, 42px)', color: '#e7eef9', flex: 1, overflowY: 'auto', background: 'radial-gradient(ellipse at 85% 0%, rgba(14,165,233,.09), transparent 38%), #080e18' }}>
            <div style={{ maxWidth: '1040px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
                <div>
                  <div style={{ color: '#5bc9ee', fontSize: 11, fontWeight: 800, letterSpacing: '.16em', marginBottom: 8 }}>PLATFORM CONFIGURATION</div>
                  <h1 style={{ fontSize: 'clamp(24px, 3vw, 34px)', lineHeight: 1.15, margin: 0, fontWeight: 750 }}>System settings</h1>
                  <p style={{ color: '#8fa4bd', margin: '10px 0 0', fontSize: 14 }}>Read-only diagnostics for the current local development environment.</p>
                </div>
                <div style={{ border: '1px solid #245b4c', background: 'rgba(16,185,129,.08)', color: '#6ee7b7', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 700 }}>LOCAL CONFIGURATION</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
                {[
                  { title: 'Telemetry connection', label: 'WEBSOCKET ENDPOINT', value: telemetrySocketUrl(), note: 'Used for live telemetry updates.' },
                  { title: 'Operations hub', label: 'INITIAL MAP CENTER', value: '12.9249° N, 80.1000° E', note: 'Tambaram Central Hub, Chennai.' },
                  { title: 'Connection health', label: 'STALE TELEMETRY THRESHOLD', value: '8 seconds', note: 'Drones without fresh packets are marked offline.' },
                  { title: 'Map provider', label: 'AVAILABLE BASEMAPS', value: 'Esri World Imagery · OpenStreetMap', note: 'Provider attribution is displayed on the map.' },
                ].map((item) => (
                  <section key={item.title} style={{ background: 'linear-gradient(145deg, rgba(20,34,54,.95), rgba(12,22,37,.95))', border: '1px solid #263a53', borderRadius: 12, padding: 20, minWidth: 0, boxShadow: '0 10px 28px rgba(0,0,0,.16)' }}>
                    <div style={{ color: '#8fa4bd', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', marginBottom: 10 }}>{item.label}</div>
                    <h2 style={{ fontSize: 16, margin: '0 0 9px', color: '#e8f3ff' }}>{item.title}</h2>
                    <div style={{ color: '#6ee7f5', fontSize: 13, fontWeight: 650, overflowWrap: 'anywhere' }}>{item.value}</div>
                    <p style={{ color: '#8fa4bd', fontSize: 13, lineHeight: 1.55, margin: '12px 0 0' }}>{item.note}</p>
                  </section>
                ))}
              </div>
              <div style={{ marginTop: 18, padding: 16, border: '1px solid #604a25', background: 'rgba(245,158,11,.07)', borderRadius: 10, color: '#d7c19a', fontSize: 13, lineHeight: 1.6 }}>
                These values describe the current frontend configuration; this page does not change backend settings or issue commands to aircraft.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SLIDE-OUT AVIONICS DETAIL DRAWER (REFERENCE A) ────────────────── */}
      {showDetailDrawer && selectedDrone && (
        <div style={{
          position: 'absolute',
          left: 78,
          top: 68,
          bottom: 14,
          height: 'auto',
          width: 'min(360px, calc(100vw - 100px))',
          zIndex: 480,
          boxShadow: '10px 0 35px rgba(0, 0, 0, 0.55)',
        }}>
          <DroneDetailPanel
            drone={selectedDrone}
            onClose={() => { setShowDetailDrawer(false); setSelectedDroneId(null); setActiveRoute(null); }}
            onOpenHistory={(id) => handleOpenHistoryModal(id)}
            onCenterDrone={() => {}}
          />
        </div>
      )}

      {/* ─── FLIGHT DATA RECORDER (BLACK BOX) MODAL ────────────────────────── */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 700,
        }}>
          <div style={{
            position: 'relative',
            width: '92%',
            maxWidth: '960px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#0d1524',
            borderRadius: '8px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
            border: '1px solid #2a3d5e',
          }}>
            <button
              onClick={() => setShowHistoryModal(false)}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                backgroundColor: 'transparent',
                border: '1px solid #1e2c44',
                color: '#ef4444',
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                zIndex: 110,
              }}
            >
              <X size={14} />
              <span>CLOSE AUDIT (ESC)</span>
            </button>

            <DroneHistoryPanel initialDroneId={historyModalDroneId} />
          </div>
        </div>
      )}
    </div>
  );
}
