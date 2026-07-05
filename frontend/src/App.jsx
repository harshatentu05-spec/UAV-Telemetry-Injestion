import React, { useState } from 'react';
import UAVSwarmCommand from './UAVSwarmCommand';
import DroneHistoryPanel from './components/DroneHistoryPanel'; 

export default function App() { 
  // State to track if the History Window is open or closed
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#0f172a', overflow: 'hidden' }}>
      
      {/* 1. The Home Screen: Full Screen Live Radar */}
      <div style={{ width: '100%', height: '100%' }}>
        <UAVSwarmCommand />
      </div>

      {/* 2. The Floating Action Button */}
      <button 
        onClick={() => setShowHistory(true)}
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          padding: '14px 28px',
          backgroundColor: '#3b82f6', // Bright Blue
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '16px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
          zIndex: 10,
          transition: 'transform 0.2s'
        }}
      >
        📡 Access Flight Recorder
      </button>

      {/* 3. The Pop-Up Window (Modal) */}
      {showHistory && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dark semi-transparent background
          backdropFilter: 'blur(8px)', // Gives that modern frosted glass look
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50 // Ensures it floats above absolutely everything else
        }}>
          
          {/* The actual window container */}
          <div style={{
            position: 'relative',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            border: '1px solid #334155'
          }}>
            
            {/* The Close (X) Button */}
            <button 
              onClick={() => setShowHistory(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: '#ef4444', // Red
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 'bold',
                zIndex: 60
              }}
            >
              ✕ Close Window
            </button>

            {/* Your Black Box Component */}
            <DroneHistoryPanel />

          </div>
        </div>
      )}

    </div>
  );
}