import { useState, useEffect, useRef, useMemo } from 'react';
import { apiUrl, telemetrySocketUrl } from '../api';

const WS_URL = telemetrySocketUrl();
const REST_DRONES_URL = apiUrl('/drones');
const STALE_TIMEOUT_MS = 8000;
const STALE_CHECK_INTERVAL_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;

function normalizeStatus(state, battery) {
  const normalized = String(state || '').toUpperCase();
  if (['OFFLINE', 'UNKNOWN', 'RESTING', 'CHARGING', 'EN_ROUTE', 'RETURNING', 'HOLD', 'LANDED', 'EMERGENCY'].includes(normalized)) {
    if (battery != null && battery <= 15 && !['CHARGING', 'RESTING', 'LANDED'].includes(normalized)) return 'CRITICAL';
    if (battery != null && battery <= 30 && battery > 15 && ['ACTIVE', 'EN_ROUTE'].includes(normalized)) return 'WARNING';
    return normalized;
  }
  if (battery == null) return 'UNKNOWN';
  if (battery <= 15) return 'CRITICAL';
  if (battery <= 30) return 'WARNING';
  return normalized || 'ACTIVE';
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat1 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return Math.round(bearing);
}

export function useTelemetryStream(isDemoMode = false, demoDrones = []) {
  const [swarm, setSwarm] = useState({});
  const [rawConnectionStatus, setRawConnectionStatus] = useState('connecting'); // connecting | connected | disconnected
  const [lastPacketTime, setLastPacketTime] = useState(null);

  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Initial REST fetch to bootstrap fleet state if backend is running
  useEffect(() => {
    if (isDemoMode) return;

    let cancelled = false;
    async function bootstrapDrones() {
      try {
        const res = await fetch(REST_DRONES_URL);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data) return;

        setSwarm((prev) => {
          const next = { ...prev };
          for (const [id, info] of Object.entries(data)) {
            if (!next[id]) {
              const battery = toNumberOrNull(info.battery_pct);
              const status = normalizeStatus(info.state, battery);
              next[id] = {
                id,
                callsign: id.toUpperCase(),
                status,
                altitude: toNumberOrNull(info.altitude_m),
                airspeed: toNumberOrNull(info.speed_mps),
                heading: toNumberOrNull(info.heading_degrees),
                route: Array.isArray(info.route) ? info.route : null,
                targetLat: toNumberOrNull(info.target_lat),
                targetLng: toNumberOrNull(info.target_lng),
                battery,
                lat: toNumberOrNull(info.lat),
                lng: toNumberOrNull(info.lng),
                signal: toNumberOrNull(info.signal_strength),
                destination: info.destination || null,
                activeOrder: info.order_id || null,
                proximityThreat: Boolean(info.proximityThreat),
                lastSeen: Date.now(),
              };
            }
          }
          return next;
        });
      } catch {
        // Backend offline or unreachable
      }
    }

    bootstrapDrones();
    return () => { cancelled = true; };
  }, [isDemoMode]);

  // Live WebSocket stream
  useEffect(() => {
    if (isDemoMode) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      setRawConnectionStatus((prev) => (prev === 'connected' ? prev : 'connecting'));
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setRawConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        setLastPacketTime(Date.now());
        let packet;
        try {
          packet = JSON.parse(event.data);
        } catch (err) {
          console.error('Packet parse error:', err);
          return;
        }

        const droneId = packet.device_id || packet.drone_id;
        if (!droneId) return;

        setSwarm((prev) => {
          const existing = prev[droneId];

          let lat, lng, alt, speed, battery, state, order, destination, proximity;

          if (packet.location && packet.telemetry) {
            lat = toNumberOrNull(packet.location.lat);
            lng = toNumberOrNull(packet.location.lng);
            alt = toNumberOrNull(packet.location.altitude_m);
            battery = toNumberOrNull(packet.telemetry.battery_pct);
            speed = toNumberOrNull(packet.telemetry.speed_mps);
            state = packet.telemetry.operational_state || normalizeStatus(null, battery);
            order = packet.telemetry.active_order || null;
            destination = packet.telemetry.destination || 'Tambaram Hub';
            proximity = false;
          } else {
            const gps = packet.tactical_sensors?.gps || {};
            lat = toNumberOrNull(gps.latitude);
            lng = toNumberOrNull(gps.longitude);
            alt = toNumberOrNull(packet.flight_dynamics?.altitude_meters);
            const knots = toNumberOrNull(packet.flight_dynamics?.airspeed_knots);
            speed = knots == null ? null : knots * 0.514444;
            battery = toNumberOrNull(packet.propulsion_systems?.battery_state?.capacity_remaining_percent);
            state = normalizeStatus(null, battery);
            order = null;
            destination = 'Tactical Route';
            proximity = packet.tactical_sensors?.threat_matrix?.proximity_alert ?? false;
          }

          let heading = existing?.heading ?? null;
          if (packet.flight_dynamics?.heading_degrees != null) {
            heading = Number(packet.flight_dynamics.heading_degrees);
          } else if (existing?.lat != null && existing?.lng != null && (lat !== existing.lat || lng !== existing.lng)) {
            heading = calculateBearing(existing.lat, existing.lng, lat, lng);
          }

          const status = normalizeStatus(state, battery);

          return {
            ...prev,
            [droneId]: {
              id: droneId,
              callsign: droneId.toUpperCase(),
              status,
              operationalState: state,
              altitude: alt,
              airspeed: speed,
              heading,
              battery,
              lat,
              lng,
              signal: status === 'OFFLINE' ? 0 : toNumberOrNull(packet.signal_strength ?? packet.telemetry?.signal_strength),
              destination,
              targetLat: toNumberOrNull(packet.target_lat ?? packet.telemetry?.target_lat) ?? existing?.targetLat ?? null,
              targetLng: toNumberOrNull(packet.target_lng ?? packet.telemetry?.target_lng) ?? existing?.targetLng ?? null,
              route: Array.isArray(packet.route) ? packet.route : (existing?.route ?? null),
              activeOrder: order,
              proximityThreat: proximity,
              lastSeen: Date.now(),
            },
          };
        });
      };

      ws.onerror = (err) => {
        console.warn('Telemetry WebSocket error:', err);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setRawConnectionStatus('disconnected');
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isDemoMode]);

  // Prune / flag stale aircraft
  useEffect(() => {
    if (isDemoMode) return;

    const interval = setInterval(() => {
      setSwarm((prev) => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          const isStale = now - next[id].lastSeen > STALE_TIMEOUT_MS;
          if (isStale && next[id].status !== 'OFFLINE') {
            next[id] = { ...next[id], status: 'OFFLINE', signal: 0 };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, STALE_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isDemoMode]);

  const drones = useMemo(() => {
    if (isDemoMode) return demoDrones;
    return Object.values(swarm);
  }, [isDemoMode, demoDrones, swarm]);

  const stats = useMemo(() => {
    const total = drones.length;
    const active = drones.filter((d) => ['ACTIVE', 'EN_ROUTE'].includes(d.status)).length;
    const returning = drones.filter((d) => d.status === 'RETURNING').length;
    const charging = drones.filter((d) => d.status === 'CHARGING' || d.status === 'RESTING').length;
    const warning = drones.filter((d) => d.status === 'WARNING').length;
    const critical = drones.filter((d) => d.status === 'CRITICAL').length;
    const offline = drones.filter((d) => d.status === 'OFFLINE').length;

    return { total, active, returning, charging, warning, critical, offline };
  }, [drones]);

  const connectionStatus = isDemoMode ? 'demo' : rawConnectionStatus;

  return {
    drones,
    swarmMap: swarm,
    connectionStatus,
    stats,
    lastPacketTime,
  };
}
