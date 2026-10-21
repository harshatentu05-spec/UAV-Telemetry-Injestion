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
import { useDemoSimulation } from './components/DemoSimulation';

export default function App() {
  const [activeView, setActiveView] = useState('map'); // 'map' | 'fleet' | 'missions' | 'airspace' | 'telemetry' | 'analysis' | 'weather' | 'alerts' | 'settings'
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedDroneId, setSelectedDroneId] = useState('UAV-01');
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
    return drones.find((d) => d.id === selectedDroneId) || drones[0] || null;
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
          title: `Critical Battery Depletion [${d.battery}%]`,
          desc: `${d.callsign || d.id} battery is critically depleted. Automated RTB protocol active.`,
          time: new Date(d.lastSeen).toLocaleTimeString([], { hour12: false }),
        });
      } else if (d.status === 'WARNING') {
        alerts.push({
          id: `warn-${d.id}`,
          type: 'diagnostic',
          severity: 'warning',
          droneId: d.id,
          title: `Low Battery Advisory [${d.battery}%]`,
          desc: `${d.callsign || d.id} reaching minimum return-to-base reserve ceiling.`,
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
    setSelectedDroneId(d.id);
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
        top: 14,
        left: 80,
        right: 18,
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
          top: 60,
          left: 80,
          right: 18,
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
          if (view === 'map' || view === 'fleet') {
            setActiveView(view);
          } else {
            setActiveView(view);
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
          topRightOffset={showDetailDrawer ? 380 : 0}
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
          <div style={{ padding: '32px', color: '#f1f5f9', flex: 1, overflowY: 'auto' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px', fontFamily: 'monospace' }}>SKYGRID SYSTEM SETTINGS</h1>
            <div style={{ maxWidth: '600px', backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'monospace' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>PRIMARY HUB TELEMETRY WEBSOCKET</label>
                <input readOnly value="ws://localhost:8000/ws/telemetry" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#121c2e', color: '#00f0ff', border: '1px solid #2a3d5e', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>BASE STATION HUB COORDINATES</label>
                <input readOnly value="12.9249° N, 80.1000° E (Tambaram Central Hub, Chennai)" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#121c2e', color: '#38bdf8', border: '1px solid #2a3d5e', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>STALE TIMEOUT THRESHOLD</label>
                <input readOnly value="8000 ms (auto mark OFFLINE)" style={{ width: '100%', padding: '8px 10px', backgroundColor: '#121c2e', color: '#f1f5f9', border: '1px solid #2a3d5e', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SLIDE-OUT AVIONICS DETAIL DRAWER (REFERENCE A) ────────────────── */}
      {showDetailDrawer && selectedDrone && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          zIndex: 550,
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.85)',
        }}>
          <DroneDetailPanel
            drone={selectedDrone}
            onClose={() => setShowDetailDrawer(false)}
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
