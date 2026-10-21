import { useState } from 'react';
import { Target, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TAMBARAM_HUB, CHENNAI_TARGETS } from './DemoSimulation';

export default function MissionsView({
  onRouteCalculated = () => {},
}) {
  const [selectedTarget, setSelectedTarget] = useState(CHENNAI_TARGETS[0]);
  const [currentBattery, setCurrentBattery] = useState(85);
  const [reservePct, setReservePct] = useState(15);
  const [speedMps, setSpeedMps] = useState(41.67);
  const [cellSizeM, setCellSizeM] = useState(100);
  const [loading, setLoading] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Generate an open grid for A* pathfinding
  // By default 60x60 open cells (0 = traversable)
  const generateOpenGrid = (size = 60) => {
    return Array.from({ length: size }, () => Array(size).fill(0));
  };

  const handleEvaluateMission = async () => {
    setLoading(true);
    setErrorMsg(null);
    setEvaluationResult(null);

    const missionId = `MSN-${Date.now().toString().slice(-6)}`;
    const grid = generateOpenGrid(60);

    const payload = {
      mission_id: missionId,
      hub_lat: TAMBARAM_HUB.lat,
      hub_lng: TAMBARAM_HUB.lng,
      destination_lat: selectedTarget.lat,
      destination_lng: selectedTarget.lng,
      current_battery_pct: Number(currentBattery),
      grid: grid,
      cell_size_m: Number(cellSizeM),
      speed_mps: Number(speedMps),
      battery_burn_per_sec: 0.125,
      reserve_pct: Number(reservePct),
    };

    try {
      const response = await fetch('http://localhost:8000/missions/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      setEvaluationResult(data);

      // Extract waypoints to plot on map
      const plan = data?.evaluation?.mission_plan;
      if (plan?.outbound_waypoints && plan?.return_waypoints) {
        const outPts = plan.outbound_waypoints.map((w) => [w.lat, w.lng]);
        const retPts = plan.return_waypoints.map((w) => [w.lat, w.lng]);
        onRouteCalculated({ outbound: outPts, return: retPts });
      }
    } catch (err) {
      console.error('Mission evaluation failed:', err);
      setErrorMsg(err.message || 'Mission evaluation service unavailable');
    } finally {
      setLoading(false);
    }
  };

  const decision = evaluationResult?.evaluation?.decision;
  const isApproved = decision === 'APPROVED';

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
            MISSION PLANNING & EVALUATION ENGINE
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            A* Pathfinding • Real-Time Weather Gate • Energy Budget Optimization
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#00f0ff' }}>
          <Target size={16} />
          <span>HUB: TAMBARAM (12.9249° N, 80.1000° E)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', flexGrow: 1 }}>
        {/* Left Form: Mission Parameters */}
        <div style={{
          backgroundColor: '#0d1524',
          border: '1px solid #1e2c44',
          borderRadius: '6px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', borderBottom: '1px solid #1e2c44', paddingBottom: '8px' }}>
            MISSION CONFIGURATION
          </div>

          {/* Destination Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
              DELIVERY DESTINATION (CHENNAI CORRIDOR)
            </label>
            <select
              value={selectedTarget.id}
              onChange={(e) => {
                const target = CHENNAI_TARGETS.find((t) => t.id === e.target.value);
                if (target) setSelectedTarget(target);
              }}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#121c2e',
                color: '#f1f5f9',
                border: '1px solid #2a3d5e',
                borderRadius: '4px',
                fontFamily: 'inherit',
                fontSize: '12px',
                outline: 'none',
              }}
            >
              {CHENNAI_TARGETS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.id}) &mdash; {t.lat.toFixed(4)}°N, {t.lng.toFixed(4)}°E
                </option>
              ))}
            </select>
          </div>

          {/* Battery State */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
              <span>CURRENT UAV BATTERY</span>
              <strong style={{ color: '#00f0ff' }}>{currentBattery}%</strong>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={currentBattery}
              onChange={(e) => setCurrentBattery(e.target.value)}
              style={{ width: '100%', accentColor: '#00f0ff' }}
            />
          </div>

          {/* Reserve Pct */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
              <span>MIN SAFETY RESERVE</span>
              <strong style={{ color: '#f59e0b' }}>{reservePct}%</strong>
            </div>
            <input
              type="range"
              min="10"
              max="30"
              value={reservePct}
              onChange={(e) => setReservePct(e.target.value)}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>

          {/* Cruise Speed */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
              NOMINAL AIRSPEED (m/s)
            </label>
            <input
              type="number"
              value={speedMps}
              onChange={(e) => setSpeedMps(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: '#121c2e',
                color: '#f1f5f9',
                border: '1px solid #2a3d5e',
                borderRadius: '4px',
                fontFamily: 'inherit',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Cell Size */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
              GRID RESOLUTION (m/cell)
            </label>
            <input
              type="number"
              value={cellSizeM}
              onChange={(e) => setCellSizeM(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: '#121c2e',
                color: '#f1f5f9',
                border: '1px solid #2a3d5e',
                borderRadius: '4px',
                fontFamily: 'inherit',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Run Evaluation Button */}
          <button
            onClick={handleEvaluateMission}
            disabled={loading}
            style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: loading ? '#1e293b' : '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.05em',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Send size={15} />
            <span>{loading ? 'COMPUTING ROUTE & WEATHER...' : 'EVALUATE DISPATCH GATE'}</span>
          </button>

          {errorMsg && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '4px',
              color: '#ef4444',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertTriangle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right Panel: Evaluation Decision & Telemetry Breakdown */}
        <div style={{
          backgroundColor: '#0d1524',
          border: '1px solid #1e2c44',
          borderRadius: '6px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {evaluationResult ? (
            <>
              {/* Decision Header */}
              <div style={{
                padding: '16px',
                borderRadius: '6px',
                border: `1px solid ${isApproved ? '#10b981' : '#f59e0b'}`,
                backgroundColor: isApproved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isApproved ? (
                    <CheckCircle2 size={32} color="#10b981" />
                  ) : (
                    <AlertTriangle size={32} color="#f59e0b" />
                  )}
                  <div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>GATE EVALUATION DECISION</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: isApproved ? '#10b981' : '#f59e0b' }}>
                      {decision}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>MISSION IDENTIFIER</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                    {evaluationResult.mission_id}
                  </div>
                </div>
              </div>

              {/* Reasons if any */}
              {evaluationResult.evaluation?.reasons?.length > 0 && (
                <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>DECISION ADVISORIES</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#cbd5e1' }}>
                    {evaluationResult.evaluation.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Path & Energy Metrics */}
              {evaluationResult.evaluation?.mission_plan && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>OUTBOUND DISTANCE</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#00f0ff', marginTop: '4px' }}>
                      {evaluationResult.evaluation.mission_plan.outbound_distance_m} m
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>RETURN DISTANCE</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                      {evaluationResult.evaluation.mission_plan.return_distance_m} m
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>BATTERY REQUIRED</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
                      {evaluationResult.evaluation.mission_plan.battery_estimate?.total_battery_required_pct ?? 'N/A'}%
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#121c2e', padding: '12px', borderRadius: '4px', border: '1px solid #1e2c44' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>RESERVE MARGIN</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                      {evaluationResult.evaluation.mission_plan.battery_estimate?.remaining_margin_pct ?? 'N/A'}%
                    </div>
                  </div>
                </div>
              )}

              {/* Weather Checkpoints Grid */}
              {evaluationResult.evaluation?.weather_decisions && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                    CHECKPOINT ATMOSPHERIC EVALUATIONS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                    {Object.entries(evaluationResult.evaluation.weather_decisions).map(([name, w]) => (
                      <div
                        key={name}
                        style={{
                          backgroundColor: '#121c2e',
                          border: `1px solid ${w.decision === 'GO' ? '#1e2c44' : '#f59e0b'}`,
                          borderRadius: '4px',
                          padding: '10px',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8' }}>{name.toUpperCase()}</span>
                          <span style={{ fontWeight: 700, color: w.decision === 'GO' ? '#10b981' : '#f59e0b' }}>
                            {w.decision}
                          </span>
                        </div>
                        {w.reasons?.length > 0 && (
                          <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>
                            {w.reasons[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <Target size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
              <h3 style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '8px' }}>No Mission Evaluated Yet</h3>
              <p style={{ fontSize: '12px', maxWidth: '440px', margin: '0 auto' }}>
                Select a Chennai destination, adjust battery thresholds, and click "Evaluate Dispatch Gate" to run A* routing and atmospheric verification against the backend.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
