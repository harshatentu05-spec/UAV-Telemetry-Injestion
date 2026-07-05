import React, { useState } from 'react';

export default function DroneHistoryPanel() {
  const [droneId, setDroneId] = useState('UAV-SWARM-042');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/drones/${droneId}/history?limit=5`);
      const data = await response.json();
      setHistoryData(data.records);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e1e', color: '#fff', borderRadius: '8px', maxWidth: '800px', margin: '20px auto', fontFamily: 'monospace' }}>
      <h2>🛰️ Flight Data Recorder (Black Box)</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          value={droneId} 
          onChange={(e) => setDroneId(e.target.value)}
          placeholder="Enter Drone ID..."
          style={{ padding: '8px', flexGrow: 1, backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
        />
        <button 
          onClick={fetchHistory}
          disabled={loading}
          style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'Downloading...' : 'Pull History'}
        </button>
      </div>

      {historyData.length > 0 && (
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #555' }}>
              <th style={{ padding: '8px' }}>Time</th>
              <th style={{ padding: '8px' }}>Alt (m)</th>
              <th style={{ padding: '8px' }}>Speed (kts)</th>
              <th style={{ padding: '8px' }}>Battery %</th>
              <th style={{ padding: '8px' }}>Coordinates</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((record, index) => {
              const date = new Date(record.timestamp * 1000);
              const timeString = date.toLocaleTimeString();

              return (
                <tr key={index} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '8px' }}>{timeString}</td>
                  <td style={{ padding: '8px', color: '#4ade80' }}>{record.flight_dynamics.altitude_meters.toFixed(1)}</td>
                  <td style={{ padding: '8px', color: '#60a5fa' }}>{record.flight_dynamics.airspeed_knots.toFixed(1)}</td>
                  <td style={{ padding: '8px', color: record.propulsion_systems.battery_state.capacity_remaining_percent < 20 ? '#ef4444' : '#fbbf24' }}>
                    {record.propulsion_systems.battery_state.capacity_remaining_percent.toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px', fontSize: '0.9em', color: '#9ca3af' }}>
                    {record.tactical_sensors.gps.latitude.toFixed(4)}, {record.tactical_sensors.gps.longitude.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}