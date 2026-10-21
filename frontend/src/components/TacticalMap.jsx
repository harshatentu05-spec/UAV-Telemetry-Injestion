import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Crosshair, Maximize2, ShieldAlert } from 'lucide-react';
import { TAMBARAM_HUB, GEOFENCE_RESTRICTED, GEOFENCE_CAUTION } from './DemoSimulation';

// Valid, legitimate basemap tile providers with ZERO API key watermarks
const TILE_LAYERS = {
  satellite: {
    name: 'Esri Satellite (Default)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
  osm: {
    name: 'OpenStreetMap Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  darkOsm: {
    name: 'Tactical Dark (OSM)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    className: 'dark-tactical-tile',
  },
};

export default function TacticalMap({
  drones = [],
  selectedDroneId = null,
  onSelectDrone = () => {},
  activeRoute = null,
  showGeofences = true,
  onToggleGeofences = () => {},
  topRightOffset = 0, // offset in px if right drawer is open
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentTileLayerRef = useRef(null);
  const markersRef = useRef({});
  const hubMarkerRef = useRef(null);
  const geofenceLayersRef = useRef([]);
  const routeLayersRef = useRef([]);

  const [activeTileType, setActiveTileType] = useState('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [TAMBARAM_HUB.lat, TAMBARAM_HUB.lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom attribution control placed bottom-right
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    // Initial tile layer: Esri World Imagery (satellite)
    const tileConfig = TILE_LAYERS.satellite;
    const tileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      className: tileConfig.className || '',
    }).addTo(map);

    currentTileLayerRef.current = tileLayer;

    // Tambaram Hub Tactical Marker with Launch Site Radar Ring (Reference 1 & 2)
    const hubIcon = L.divIcon({
      className: 'custom-hub-icon',
      html: `
        <div style="position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
          <!-- Glowing Launch Site Radar Ring -->
          <div style="
            position: absolute;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            border: 2px dashed #10b981;
            background: rgba(16, 185, 129, 0.12);
            animation: pulse-ring 3s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          "></div>

          <!-- Central Hub Icon -->
          <div style="
            width: 28px;
            height: 28px;
            background: #0284c7;
            border: 2px solid #38bdf8;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.9);
            color: #ffffff;
            font-weight: 900;
            font-size: 14px;
            font-family: monospace;
            z-index: 2;
          ">
            H
          </div>

          <div style="
            position: absolute;
            top: 42px;
            white-space: nowrap;
            background: rgba(13, 21, 36, 0.94);
            color: #38bdf8;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid #1e2c44;
            box-shadow: 0 4px 12px rgba(0,0,0,0.8);
            pointer-events: none;
            letter-spacing: 0.05em;
          ">
            TAMBARAM HUB
          </div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 30],
    });

    const hub = L.marker([TAMBARAM_HUB.lat, TAMBARAM_HUB.lng], { icon: hubIcon })
      .addTo(map)
      .bindPopup(`
        <div style="padding: 6px; font-family: monospace; line-height: 1.4;">
          <div style="color: #38bdf8; font-weight: 800; font-size: 13px; margin-bottom: 4px;">
            ⬡ TAMBARAM CENTRAL HUB
          </div>
          <div style="color: #94a3b8; font-size: 11px;">
            Sector: Chennai Metropolitan Base Station
          </div>
          <div style="color: #f1f5f9; font-size: 11px;">
            GPS: ${TAMBARAM_HUB.lat.toFixed(4)}° N, ${TAMBARAM_HUB.lng.toFixed(4)}° E
          </div>
          <div style="color: #10b981; font-size: 11px; margin-top: 4px; font-weight: 700;">
            ● RADAR TELEMETRY LINK: NOMINAL
          </div>
        </div>
      `);

    hubMarkerRef.current = hub;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Tile Layer Switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
    }

    const tileConfig = TILE_LAYERS[activeTileType] || TILE_LAYERS.satellite;
    const newLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      className: tileConfig.className || '',
    }).addTo(map);

    currentTileLayerRef.current = newLayer;
  }, [activeTileType]);

  // Handle Geofences
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    geofenceLayersRef.current.forEach((layer) => map.removeLayer(layer));
    geofenceLayersRef.current = [];

    if (!showGeofences) return;

    // 1. Restricted Airspace (Airport / Military)
    const restrictedPoly = L.polygon(GEOFENCE_RESTRICTED, {
      color: '#ef4444',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#dc2626',
      fillOpacity: 0.22,
    }).addTo(map);

    restrictedPoly.bindTooltip('RESTRICTED AIRSPACE (NO-FLY ZONE)', {
      permanent: true,
      direction: 'center',
      className: 'tactical-tooltip-restricted',
    });

    // 2. Caution Area (Dense Urban Transit)
    const cautionPoly = L.polygon(GEOFENCE_CAUTION, {
      color: '#f59e0b',
      weight: 2,
      dashArray: '4, 4',
      fillColor: '#d97706',
      fillOpacity: 0.16,
    }).addTo(map);

    cautionPoly.bindTooltip('CAUTION AIRSPACE // URBAN CORRIDOR', {
      permanent: true,
      direction: 'center',
      className: 'tactical-tooltip-caution',
    });

    geofenceLayersRef.current = [restrictedPoly, cautionPoly];
  }, [showGeofences]);

  // Handle Mission Flight Route Polylines
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    routeLayersRef.current.forEach((layer) => map.removeLayer(layer));
    routeLayersRef.current = [];

    if (!activeRoute) return;

    if (activeRoute.outbound && activeRoute.outbound.length > 0) {
      const outPoly = L.polyline(activeRoute.outbound, {
        color: '#00f0ff',
        weight: 3,
        dashArray: '8, 8',
        opacity: 0.9,
      }).addTo(map);

      activeRoute.outbound.forEach((pt, idx) => {
        const dot = L.circleMarker(pt, {
          radius: idx === 0 || idx === activeRoute.outbound.length - 1 ? 6 : 3.5,
          color: '#00f0ff',
          fillColor: '#090d16',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        routeLayersRef.current.push(dot);
      });

      routeLayersRef.current.push(outPoly);
    }

    if (activeRoute.return && activeRoute.return.length > 0) {
      const retPoly = L.polyline(activeRoute.return, {
        color: '#10b981',
        weight: 2.5,
        dashArray: '4, 6',
        opacity: 0.85,
      }).addTo(map);

      routeLayersRef.current.push(retPoly);
    }
  }, [activeRoute]);

  // Update Aircraft Markers with Glowing Rotational Indicators (Reference 2)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const existingMarkers = markersRef.current;
    const activeIds = new Set();

    drones.forEach((drone) => {
      if (drone.lat == null || drone.lng == null || isNaN(drone.lat) || isNaN(drone.lng)) return;
      if (drone.lat === 0 && drone.lng === 0) return;

      activeIds.add(drone.id);

      const isSelected = selectedDroneId === drone.id;
      const heading = drone.heading || 0;
      const battery = Number(drone.battery || 0).toFixed(0);
      const alt = Number(drone.altitude || 0).toFixed(0);

      let themeColor = '#00f0ff';
      let ringBorder = '#38bdf8';
      let ringText = 'AREA OF PATROL';

      if (drone.status === 'CRITICAL') {
        themeColor = '#ef4444';
        ringBorder = '#dc2626';
        ringText = 'EMERGENCY RTB';
      } else if (drone.status === 'WARNING') {
        themeColor = '#f59e0b';
        ringBorder = '#d97706';
        ringText = 'CAUTION ZONE';
      } else if (drone.status === 'CHARGING') {
        themeColor = '#10b981';
        ringBorder = '#059669';
        ringText = 'LAUNCH SITE';
      } else if (isSelected) {
        themeColor = '#38bdf8';
        ringBorder = '#00f0ff';
        ringText = 'TARGET TRACK';
      }

      // Custom Glowing Circular Radar Ring Marker (Reference 2 styling!)
      const customHtml = `
        <div style="position: relative; width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; cursor: pointer;">

          <!-- Glowing Outer Radar Patrol Ring (Reference 2) -->
          <div style="
            position: absolute;
            width: ${isSelected ? '64px' : '52px'};
            height: ${isSelected ? '64px' : '52px'};
            border-radius: 50%;
            border: 2px solid ${ringBorder};
            background: rgba(13, 21, 36, 0.45);
            box-shadow: 0 0 16px ${themeColor}60;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          ">
            <!-- Curved Area Label on Ring Top -->
            <div style="
              position: absolute;
              top: -10px;
              white-space: nowrap;
              font-size: 8px;
              font-weight: 800;
              color: ${themeColor};
              letter-spacing: 0.06em;
              text-shadow: 0 1px 4px #000;
              pointer-events: none;
            ">
              ${ringText}
            </div>
          </div>

          <!-- Central Rotating Aircraft Heading Needle -->
          <div style="
            transform: rotate(${heading}deg);
            transition: transform 0.4s ease-out;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5;
          ">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <polygon points="12 2, 21 21, 12 17, 3 21" fill="${themeColor}" stroke="${isSelected ? '#ffffff' : '#080c14'}" stroke-width="1.8" />
            </svg>
          </div>

          <!-- Tactical Callout Tag Badge -->
          <div style="
            position: absolute;
            left: 54px;
            top: 2px;
            white-space: nowrap;
            background: rgba(13, 21, 36, 0.92);
            backdrop-filter: blur(6px);
            border: 1px solid ${isSelected ? '#00f0ff' : '#1e2c44'};
            border-radius: 4px;
            padding: 3px 6px;
            font-family: monospace;
            box-shadow: 0 4px 14px rgba(0,0,0,0.85);
            z-index: 10;
          ">
            <div style="font-size: 11px; font-weight: 800; color: ${isSelected ? '#00f0ff' : '#f1f5f9'};">
              ${drone.callsign || drone.id}
            </div>
            <div style="font-size: 9px; color: #94a3b8; display: flex; gap: 4px;">
              <span>${alt}m</span>
              <span>&bull;</span>
              <span style="color: ${battery < 20 ? '#ef4444' : battery < 35 ? '#f59e0b' : '#10b981'}; font-weight: 700;">${battery}%</span>
            </div>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-drone-icon',
        html: customHtml,
        iconSize: [72, 72],
        iconAnchor: [36, 36],
      });

      if (existingMarkers[drone.id]) {
        existingMarkers[drone.id].setLatLng([drone.lat, drone.lng]);
        existingMarkers[drone.id].setIcon(icon);
      } else {
        const marker = L.marker([drone.lat, drone.lng], { icon }).addTo(map);
        marker.on('click', () => {
          onSelectDrone(drone);
        });
        existingMarkers[drone.id] = marker;
      }
    });

    Object.keys(existingMarkers).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(existingMarkers[id]);
        delete existingMarkers[id];
      }
    });
  }, [drones, selectedDroneId, onSelectDrone]);

  const handleRecenterHub = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([TAMBARAM_HUB.lat, TAMBARAM_HUB.lng], 13, { duration: 1.2 });
  };

  const handleFitFleet = () => {
    if (!mapInstanceRef.current || drones.length === 0) return;
    const validCoords = drones
      .filter((d) => d.lat != null && d.lng != null && d.lat !== 0)
      .map((d) => [d.lat, d.lng]);

    if (validCoords.length === 0) return;
    validCoords.push([TAMBARAM_HUB.lat, TAMBARAM_HUB.lng]);
    const bounds = L.latLngBounds(validCoords);
    mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1.2 });
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating HUD Controls (Positioned cleanly to avoid colliding with any side drawers) */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: topRightOffset > 0 ? `${topRightOffset + 14}px` : '18px',
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'right 0.3s ease',
      }}>
        {/* Layer Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLayerMenu((p) => !p)}
            title="Map Tile Layers"
            style={{
              height: 34,
              padding: '0 10px',
              backgroundColor: 'rgba(13, 21, 36, 0.92)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #1e2c44',
              borderRadius: 4,
              color: '#00f0ff',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            }}
          >
            <Layers size={15} />
            <span>LAYERS</span>
          </button>

          {showLayerMenu && (
            <div style={{
              position: 'absolute',
              top: 40,
              right: 0,
              backgroundColor: '#0d1524',
              border: '1px solid #1e2c44',
              borderRadius: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 190,
              fontFamily: 'monospace',
              fontSize: '11px',
              zIndex: 500,
            }}>
              {Object.entries(TILE_LAYERS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTileType(key);
                    setShowLayerMenu(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'left',
                    background: activeTileType === key ? '#162238' : 'transparent',
                    color: activeTileType === key ? '#00f0ff' : '#94a3b8',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontWeight: activeTileType === key ? 700 : 500,
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center on Hub */}
        <button
          onClick={handleRecenterHub}
          title="Recenter on Tambaram Central Hub"
          style={{
            height: 34,
            padding: '0 10px',
            backgroundColor: 'rgba(13, 21, 36, 0.92)',
            backdropFilter: 'blur(6px)',
            border: '1px solid #1e2c44',
            borderRadius: 4,
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }}
        >
          <Crosshair size={15} />
          <span>HUB</span>
        </button>

        {/* Fit Fleet */}
        <button
          onClick={handleFitFleet}
          title="Fit All Aircraft in View"
          style={{
            height: 34,
            width: 34,
            backgroundColor: 'rgba(13, 21, 36, 0.92)',
            backdropFilter: 'blur(6px)',
            border: '1px solid #1e2c44',
            borderRadius: 4,
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }}
        >
          <Maximize2 size={15} />
        </button>

        {/* Geofence Toggle */}
        <button
          onClick={onToggleGeofences}
          title={showGeofences ? 'Hide Geofences' : 'Show Geofences'}
          style={{
            height: 34,
            padding: '0 10px',
            backgroundColor: 'rgba(13, 21, 36, 0.92)',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${showGeofences ? '#ef4444' : '#1e2c44'}`,
            borderRadius: 4,
            color: showGeofences ? '#ef4444' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }}
        >
          <ShieldAlert size={15} />
          <span>ZONES</span>
        </button>
      </div>

      {/* Tactical Map Legend (Reference 1 Bottom Right) */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        right: 14,
        zIndex: 400,
        backgroundColor: 'rgba(9, 13, 22, 0.92)',
        backdropFilter: 'blur(6px)',
        border: '1px solid #1e2c44',
        borderRadius: 4,
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#94a3b8',
        boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 14, height: 2, background: '#00f0ff', borderTop: '2px dashed #00f0ff' }}></div>
          <span>Flight Path</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, border: '1px solid #f59e0b', background: 'rgba(245, 158, 11, 0.25)' }}></div>
          <span>Caution Geofence</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.3)' }}></div>
          <span>Restricted Airspace</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }}></div>
          <span>Tambaram Hub</span>
        </div>
      </div>
    </div>
  );
}
