const configuredBase = import.meta.env.VITE_API_BASE_URL;

// Local development defaults to the existing FastAPI service. Set
// VITE_API_BASE_URL for a deployed API (without a trailing slash).
export const API_BASE_URL = (configuredBase || 'http://localhost:8000').replace(/\/$/, '');

export const WS_BASE_URL = API_BASE_URL.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function telemetrySocketUrl() {
  return `${WS_BASE_URL}/ws/telemetry`;
}
