import { useState } from 'react';
import {
  Map,
  Crosshair,
  Target,
  ShieldAlert,
  Radio,
  LineChart,
  Cloud,
  Bell,
  Settings,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

const TOOL_ITEMS = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'fleet', label: 'Fleet', icon: Crosshair },
  { id: 'missions', label: 'Missions', icon: Target },
  { id: 'airspace', label: 'Airspace', icon: ShieldAlert },
  { id: 'telemetry', label: 'Telemetry', icon: Radio },
  { id: 'analysis', label: 'Analysis', icon: LineChart },
  { id: 'weather', label: 'Weather', icon: Cloud },
  { id: 'alerts', label: 'Alerts / Logs', icon: Bell, badge: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function NavigationRail({
  activeView = 'map',
  onSelectView = () => {},
  alertsCount = 0,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        bottom: 14,
        width: isExpanded ? '180px' : '52px',
        backgroundColor: 'rgba(13, 21, 36, 0.94)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #1e2c44',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 6px',
        zIndex: 500,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Top Brand Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 6px 10px',
          borderBottom: '1px solid #1e2c44',
        }}>
          <div style={{
            width: 32,
            height: 32,
            minWidth: 32,
            backgroundColor: '#0284c7',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0, 240, 255, 0.5)',
          }}>
            <Crosshair size={18} color="#ffffff" />
          </div>
          {isExpanded && (
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '0.1em' }}>
                SKYGRID
              </div>
              <div style={{ fontSize: '8px', color: '#00f0ff', letterSpacing: '0.04em' }}>
                TAMBARAM HUB
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tool Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {TOOL_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                title={item.label}
                style={{
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 8px',
                  backgroundColor: isActive ? '#162238' : 'transparent',
                  border: isActive ? '1px solid #00f0ff' : '1px solid transparent',
                  borderRadius: 6,
                  color: isActive ? '#00f0ff' : '#94a3b8',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <div style={{ minWidth: 20, display: 'flex', justifyContent: 'center' }}>
                  <Icon size={18} color={isActive ? '#00f0ff' : '#94a3b8'} />
                </div>

                {isExpanded && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: isActive ? 800 : 500,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.04em',
                    flex: 1,
                  }}>
                    {item.label}
                  </span>
                )}

                {/* Badge Indicator for Alerts */}
                {item.badge && alertsCount > 0 && (
                  <span style={{
                    position: isExpanded ? 'static' : 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    borderRadius: 8,
                    fontSize: '9px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {alertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Rail Expand/Collapse Toggle */}
      <button
        onClick={() => setIsExpanded((p) => !p)}
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          padding: '0 8px',
          backgroundColor: '#121c2e',
          border: '1px solid #1e2c44',
          borderRadius: 6,
          color: '#64748b',
          cursor: 'pointer',
        }}
      >
        {isExpanded && <span style={{ fontSize: '10px', color: '#94a3b8' }}>COLLAPSE RAIL</span>}
        {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>
    </aside>
  );
}
