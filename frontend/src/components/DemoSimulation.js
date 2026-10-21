import { useState, useEffect } from 'react';

export const TAMBARAM_HUB = {
  lat: 12.9249,
  lng: 80.1000,
  name: 'Tambaram Central Hub',
  city: 'Chennai, Tamil Nadu',
  country: 'India',
};

export const CHENNAI_TARGETS = [
  { id: 'ORD-01', name: 'Chromepet Market', lat: 12.9516, lng: 80.1409 },
  { id: 'ORD-02', name: 'Pallavaram Bazaar', lat: 12.9770, lng: 80.1500 },
  { id: 'ORD-03', name: 'St. Thomas Mount', lat: 12.9922, lng: 80.1931 },
  { id: 'ORD-04', name: 'Alandur Metro Station', lat: 13.0030, lng: 80.2000 },
  { id: 'ORD-05', name: 'Guindy Industrial Park', lat: 13.0107, lng: 80.2100 },
  { id: 'ORD-06', name: 'Saidapet Bridge Hub', lat: 13.0213, lng: 80.2206 },
  { id: 'ORD-12', name: 'Velachery Phoenix Corridor', lat: 12.9815, lng: 80.2180 },
  { id: 'ORD-18', name: 'Medavakkam Junction', lat: 12.9172, lng: 80.1921 },
];

export const GEOFENCE_RESTRICTED = [
  // Chennai International Airport / Tambaram Military Airbase No-Fly Zone Polygon
  [12.9800, 80.1500],
  [13.0100, 80.1650],
  [13.0050, 80.1950],
  [12.9750, 80.1850],
  [12.9650, 80.1600],
];

export const GEOFENCE_CAUTION = [
  // Dense urban caution corridor (Pallavaram / Chromepet transit belt)
  [12.9400, 80.1250],
  [12.9700, 80.1450],
  [12.9650, 80.1700],
  [12.9350, 80.1500],
];

function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat1 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
}

const STATIC_SIM_DRONES = [
  {
    id: 'SIM-01',
    callsign: 'SIM-UAV-01',
    lat: 12.9380,
    lng: 80.1200,
    startLat: TAMBARAM_HUB.lat,
    startLng: TAMBARAM_HUB.lng,
    targetLat: CHENNAI_TARGETS[0].lat,
    targetLng: CHENNAI_TARGETS[0].lng,
    altitude: 72,
    airspeed: 41.5,
    heading: 42,
    battery: 84.5,
    status: 'EN_ROUTE',
    destination: CHENNAI_TARGETS[0].name,
    activeOrder: CHENNAI_TARGETS[0].id,
    signal: 98,
    progress: 0.35,
    isSimulated: true,
    proximityThreat: false,
    lastSeen: 1700000000000,
  },
  {
    id: 'SIM-02',
    callsign: 'SIM-UAV-02',
    lat: 12.9600,
    lng: 80.1400,
    startLat: TAMBARAM_HUB.lat,
    startLng: TAMBARAM_HUB.lng,
    targetLat: CHENNAI_TARGETS[7].lat,
    targetLng: CHENNAI_TARGETS[7].lng,
    altitude: 85,
    airspeed: 39.8,
    heading: 38,
    battery: 67.2,
    status: 'EN_ROUTE',
    destination: CHENNAI_TARGETS[7].name,
    activeOrder: CHENNAI_TARGETS[7].id,
    signal: 92,
    progress: 0.60,
    isSimulated: true,
    proximityThreat: false,
    lastSeen: 1700000000000,
  },
  {
    id: 'SIM-03',
    callsign: 'SIM-UAV-03',
    lat: 12.9560,
    lng: 80.1350,
    startLat: 12.9560,
    startLng: 80.1350,
    targetLat: CHENNAI_TARGETS[7].lat,
    targetLng: CHENNAI_TARGETS[7].lng,
    altitude: 64,
    airspeed: 42.0,
    heading: 215,
    battery: 28.4,
    status: 'WARNING',
    destination: CHENNAI_TARGETS[7].name,
    activeOrder: CHENNAI_TARGETS[7].id,
    signal: 86,
    progress: 0.25,
    isSimulated: true,
    proximityThreat: true,
    lastSeen: 1700000000000,
  },
  {
    id: 'SIM-04',
    callsign: 'SIM-UAV-04',
    lat: 12.9300,
    lng: 80.1250,
    startLat: TAMBARAM_HUB.lat,
    startLng: TAMBARAM_HUB.lng,
    targetLat: CHENNAI_TARGETS[7].lat,
    targetLng: CHENNAI_TARGETS[7].lng,
    altitude: 90,
    airspeed: 40.2,
    heading: 48,
    battery: 73.0,
    status: 'EN_ROUTE',
    destination: CHENNAI_TARGETS[7].name,
    activeOrder: CHENNAI_TARGETS[7].id,
    signal: 95,
    progress: 0.82,
    isSimulated: true,
    proximityThreat: false,
    lastSeen: 1700000000000,
  },
  {
    id: 'SIM-05',
    callsign: 'SIM-UAV-05',
    lat: TAMBARAM_HUB.lat,
    lng: TAMBARAM_HUB.lng,
    startLat: TAMBARAM_HUB.lat,
    startLng: TAMBARAM_HUB.lng,
    targetLat: TAMBARAM_HUB.lat,
    targetLng: TAMBARAM_HUB.lng,
    altitude: 0,
    airspeed: 0,
    heading: 0,
    battery: 98.5,
    status: 'CHARGING',
    destination: 'Dock 02 // Rapid Charge',
    activeOrder: null,
    signal: 100,
    progress: 1.0,
    isSimulated: true,
    proximityThreat: false,
    lastSeen: 1700000000000,
  },
  {
    id: 'SIM-06',
    callsign: 'SIM-UAV-06',
    lat: 12.9150,
    lng: 80.0900,
    startLat: TAMBARAM_HUB.lat,
    startLng: TAMBARAM_HUB.lng,
    targetLat: TAMBARAM_HUB.lat,
    targetLng: TAMBARAM_HUB.lng,
    altitude: 0,
    airspeed: 0,
    heading: 0,
    battery: 12.0,
    status: 'CRITICAL',
    destination: 'Dock 04 // Service Required',
    activeOrder: null,
    signal: 0,
    progress: 1.0,
    isSimulated: true,
    proximityThreat: false,
    lastSeen: 1700000000000,
  },
];

function pointInPolygon(point, polygon) {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersects = ((xi > lng) !== (xj > lng)) &&
      (lat < ((yj - yi) * (lng - xi)) / ((xj - xi) || Number.EPSILON) + yi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function segmentCrossesRestrictedZone(fromLat, fromLng, toLat, toLng) {
  // Sample the segment so a long movement step cannot jump across a polygon.
  for (let step = 0; step <= 20; step += 1) {
    const t = step / 20;
    const lat = fromLat + (toLat - fromLat) * t;
    const lng = fromLng + (toLng - fromLng) * t;
    if (pointInPolygon([lat, lng], GEOFENCE_RESTRICTED)) return true;
  }
  return false;
}

export function useDemoSimulation(active = false) {
  const [isRunning, setIsRunning] = useState(true);
  const [drones, setDrones] = useState(STATIC_SIM_DRONES);

  useEffect(() => {
    if (!active || !isRunning) return;

    const interval = setInterval(() => {
      setDrones((prev) =>
        prev.map((d) => {
          if (d.status === 'CHARGING') {
            const nextBat = Math.min(100, d.battery + 0.4);
            return {
              ...d,
              battery: Number(nextBat.toFixed(1)),
              status: nextBat >= 100 ? 'RESTING' : 'CHARGING',
              lastSeen: Date.now(),
            };
          }

          if (d.status === 'CRITICAL' && d.altitude === 0) {
            return { ...d, lastSeen: Date.now() };
          }

          // A critically depleted simulated aircraft must not continue normal mission movement.
          // This demo has no physical return/landing controller, so it enters an explicit hold.
          if (Number(d.battery) <= 10 || d.status === 'CRITICAL') {
            return {
              ...d,
              battery: Math.max(0, Number(d.battery)),
              status: 'CRITICAL',
              operationalState: 'LOW_BATTERY_HOLD',
              airspeed: 0,
              lastSeen: Date.now(),
            };
          }

          // Advance only when the next segment stays outside the configured restricted polygon.
          const step = 0.006;
          let progress = d.progress + step;
          let startLat = d.startLat;
          let startLng = d.startLng;
          let targetLat = d.targetLat;
          let targetLng = d.targetLng;
          let status = d.status;
          let destination = d.destination;
          let battery = Math.max(5, d.battery - 0.08);

          if (progress >= 1.0) {
            progress = 0;
            const tempLat = startLat;
            const tempLng = startLng;
            startLat = targetLat;
            startLng = targetLng;
            targetLat = tempLat;
            targetLng = tempLng;

            if (status === 'EN_ROUTE') {
              status = 'RETURNING';
              destination = 'Returning to Tambaram Hub';
            } else {
              status = 'EN_ROUTE';
              destination = 'Dispatched to Delivery Sector';
            }
          }

          const curLat = startLat + (targetLat - startLat) * progress;
          const curLng = startLng + (targetLng - startLng) * progress;

          if (segmentCrossesRestrictedZone(d.lat, d.lng, curLat, curLng)) {
            return {
              ...d,
              status: 'AIRSPACE_HOLD',
              operationalState: 'RESTRICTED_ZONE_HOLD',
              proximityThreat: true,
              airspeed: 0,
              lastSeen: Date.now(),
            };
          }

          const heading = calculateBearing(d.lat, d.lng, curLat, curLng) || d.heading;

          if (battery < 20 && status !== 'CRITICAL') {
            status = 'CRITICAL';
          } else if (battery < 35 && status !== 'WARNING' && status !== 'CRITICAL') {
            status = 'WARNING';
          }

          return {
            ...d,
            lat: Number(curLat.toFixed(6)),
            lng: Number(curLng.toFixed(6)),
            startLat,
            startLng,
            targetLat,
            targetLng,
            progress,
            heading,
            battery: Number(battery.toFixed(1)),
            status,
            destination,
            lastSeen: Date.now(),
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [active, isRunning]);

  return {
    drones,
    isRunning,
    togglePause: () => setIsRunning((p) => !p),
    resetSimulation: () => setDrones(STATIC_SIM_DRONES),
  };
}
