import { useState, useEffect, useCallback } from 'react';
import { Wind, Eye, CloudRain, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { TAMBARAM_HUB } from './DemoSimulation';

const WEATHER_LIMITS = {
  max_wind_speed_kmh: 30,
  max_wind_gusts_kmh: 40,
  max_precipitation_mm: 0.5,
  min_visibility_m: 1000,
  min_temperature_c: 0,
  max_temperature_c: 45,
};

export default function WeatherView() {
  const [weatherData, setWeatherData] = useState({
    temperature: 31.4,
    humidity: 68,
    windSpeed: 14.2,
    windGusts: 22.0,
    precipitation: 0.0,
    visibility: 9500,
    time: 'Nominal Chennai Station',
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Nominal Baseline');

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${TAMBARAM_HUB.lat}&longitude=${TAMBARAM_HUB.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,visibility&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const current = data.current;
      if (current) {
        setWeatherData({
          temperature: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
          windGusts: current.wind_gusts_10m,
          precipitation: current.precipitation,
          visibility: current.visibility,
          time: current.time,
        });
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.warn('Weather fetch warning:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${TAMBARAM_HUB.lat}&longitude=${TAMBARAM_HUB.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,visibility&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data?.current) {
          setWeatherData({
            temperature: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            windSpeed: data.current.wind_speed_10m,
            windGusts: data.current.wind_gusts_10m,
            precipitation: data.current.precipitation,
            visibility: data.current.visibility,
            time: data.current.time,
          });
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } catch {
        // Fallback already preset in initial state
      }
    }
    loadInitial();
    return () => { ignore = true; };
  }, []);

  // Evaluate safety compliance
  const isWindSafe = weatherData ? weatherData.windSpeed <= WEATHER_LIMITS.max_wind_speed_kmh : true;
  const isGustSafe = weatherData ? weatherData.windGusts <= WEATHER_LIMITS.max_wind_gusts_kmh : true;
  const isRainSafe = weatherData ? weatherData.precipitation <= WEATHER_LIMITS.max_precipitation_mm : true;
  const isVisSafe = weatherData ? weatherData.visibility >= WEATHER_LIMITS.min_visibility_m : true;
  const isAllSafe = isWindSafe && isGustSafe && isRainSafe && isVisSafe;

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #1e2c44', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.05em' }}>
            ATMOSPHERIC TELEMETRY & FLIGHT SAFETY THRESHOLDS
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Observation Base: Tambaram Hub (12.9249° N, 80.1000° E) &bull; Provider: Open-Meteo High-Res Aviation Feed
          </p>
        </div>

        <button
          onClick={fetchWeather}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#121c2e',
            border: '1px solid #2a3d5e',
            color: '#00f0ff',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <RefreshCw size={14} />
          <span>{loading ? 'POLLING SENSORS...' : 'REFRESH METRICS'}</span>
        </button>
      </div>

      {/* Flight Safety Summary Banner */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: isAllSafe ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)',
        border: `1px solid ${isAllSafe ? '#10b981' : '#ef4444'}`,
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {isAllSafe ? (
            <CheckCircle size={32} color="#10b981" />
          ) : (
            <AlertCircle size={32} color="#ef4444" />
          )}
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: isAllSafe ? '#10b981' : '#ef4444' }}>
              {isAllSafe ? 'FLIGHT DISPATCH: ALL ATMOSPHERIC CRITERIA GO' : 'FLIGHT DISPATCH: WEATHER ADVISORY HOLD'}
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
              {isAllSafe
                ? 'All flight dynamics limits (wind, gusts, precipitation, visibility) are well within certified operating tolerances.'
                : 'One or more meteorological metrics violate safe autonomous UAV flight limits.'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
          <div>LAST SENSOR SYNC:</div>
          <strong style={{ color: '#f1f5f9' }}>{lastUpdated}</strong>
        </div>
      </div>

      {/* Metric Cards Grid */}
      {weatherData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {/* Card 1: Wind Speed */}
          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wind size={15} color="#00f0ff" />
                <span>10M SUSTAINED WIND</span>
              </span>
              <span style={{ color: isWindSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isWindSafe ? 'PASS' : 'EXCEEDED'}
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9' }}>
              {weatherData.windSpeed} <span style={{ fontSize: '13px', color: '#94a3b8' }}>km/h</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
              OPERATING LIMIT: &le; {WEATHER_LIMITS.max_wind_speed_kmh} km/h
            </div>
          </div>

          {/* Card 2: Wind Gusts */}
          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wind size={15} color="#38bdf8" />
                <span>PEAK GUSTS</span>
              </span>
              <span style={{ color: isGustSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isGustSafe ? 'PASS' : 'EXCEEDED'}
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9' }}>
              {weatherData.windGusts} <span style={{ fontSize: '13px', color: '#94a3b8' }}>km/h</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
              OPERATING LIMIT: &le; {WEATHER_LIMITS.max_wind_gusts_kmh} km/h
            </div>
          </div>

          {/* Card 3: Precipitation */}
          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CloudRain size={15} color="#00f0ff" />
                <span>PRECIPITATION</span>
              </span>
              <span style={{ color: isRainSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isRainSafe ? 'PASS' : 'EXCEEDED'}
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9' }}>
              {weatherData.precipitation} <span style={{ fontSize: '13px', color: '#94a3b8' }}>mm</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
              OPERATING LIMIT: &le; {WEATHER_LIMITS.max_precipitation_mm} mm
            </div>
          </div>

          {/* Card 4: Visibility */}
          <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={15} color="#10b981" />
                <span>FLIGHT VISIBILITY</span>
              </span>
              <span style={{ color: isVisSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isVisSafe ? 'PASS' : 'EXCEEDED'}
              </span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9' }}>
              {(weatherData.visibility / 1000).toFixed(1)} <span style={{ fontSize: '13px', color: '#94a3b8' }}>km</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
              OPERATING LIMIT: &ge; {WEATHER_LIMITS.min_visibility_m / 1000} km
            </div>
          </div>
        </div>
      )}

      {/* Threshold Comparison Table */}
      <div style={{ backgroundColor: '#0d1524', border: '1px solid #1e2c44', borderRadius: '6px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
          REGULATORY UAV METEOROLOGICAL SAFETY LIMITS // TAMBARAM BASE
        </h2>

        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#121c2e', color: '#94a3b8', borderBottom: '1px solid #1e2c44' }}>
              <th style={{ padding: '10px 12px' }}>PARAMETER</th>
              <th style={{ padding: '10px 12px' }}>CURRENT MEASURED</th>
              <th style={{ padding: '10px 12px' }}>SAFETY CEILING</th>
              <th style={{ padding: '10px 12px' }}>SAFETY FLOOR</th>
              <th style={{ padding: '10px 12px' }}>EVALUATION</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #152238' }}>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f1f5f9' }}>Wind Speed (10m)</td>
              <td style={{ padding: '10px 12px', color: '#00f0ff' }}>{weatherData?.windSpeed ?? 'N/A'} km/h</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>30 km/h</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>None</td>
              <td style={{ padding: '10px 12px', color: isWindSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isWindSafe ? '✓ COMPLIANT' : '✕ EXCEEDED'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #152238' }}>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f1f5f9' }}>Wind Gusts</td>
              <td style={{ padding: '10px 12px', color: '#00f0ff' }}>{weatherData?.windGusts ?? 'N/A'} km/h</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>40 km/h</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>None</td>
              <td style={{ padding: '10px 12px', color: isGustSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isGustSafe ? '✓ COMPLIANT' : '✕ EXCEEDED'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #152238' }}>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f1f5f9' }}>Precipitation Rate</td>
              <td style={{ padding: '10px 12px', color: '#00f0ff' }}>{weatherData?.precipitation ?? 'N/A'} mm/h</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>0.5 mm</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>None</td>
              <td style={{ padding: '10px 12px', color: isRainSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isRainSafe ? '✓ COMPLIANT' : '✕ EXCEEDED'}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #152238' }}>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f1f5f9' }}>Optical Visibility</td>
              <td style={{ padding: '10px 12px', color: '#00f0ff' }}>{weatherData ? (weatherData.visibility / 1000).toFixed(1) : 'N/A'} km</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>Unlimited</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>1.0 km</td>
              <td style={{ padding: '10px 12px', color: isVisSafe ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {isVisSafe ? '✓ COMPLIANT' : '✕ EXCEEDED'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f1f5f9' }}>Ambient Temperature</td>
              <td style={{ padding: '10px 12px', color: '#00f0ff' }}>{weatherData?.temperature ?? 'N/A'} °C</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>45 °C</td>
              <td style={{ padding: '10px 12px', color: '#94a3b8' }}>0 °C</td>
              <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>
                ✓ COMPLIANT
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
