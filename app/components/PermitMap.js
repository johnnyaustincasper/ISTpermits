'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PERMITS, CITIES, CITY_COORDS } from '../../lib/permits';
import { geocodePermits, applyGeocodedCoords, clearGeocodeCache } from '../../lib/geocode';

const STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

function buildGeoJSON(permits) {
  return {
    type: 'FeatureCollection',
    features: permits.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        builder: p.builder,
        address: p.address,
        city: p.city,
        sqft: p.sqft,
        value: p.value,
        week: p.week,
        production: p.production,
        phone: p.phone,
        subdivision: p.subdivision,
        contact: p.contact,
        radius: Math.max(5, Math.sqrt((p.value || 50000) / 6000)),
      },
    })),
  };
}

function fmt(v) { return '$' + v.toLocaleString(); }

export default function PermitMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [currentCity, setCurrentCity] = useState('All');
  const [customOnly, setCustomOnly] = useState(false);
  const [mapStyle, setMapStyle] = useState('hybrid');
  const [selected, setSelected] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [permits, setPermits] = useState(PERMITS);
  const [geocodeProgress, setGeocodeProgress] = useState(null); // null = not started, {done, total} = in progress, 'complete' = done

  // Auto-collapse on mobile
  useEffect(() => {
    if (window.innerWidth < 768) setPanelOpen(false);
  }, []);

  const selectPermit = useCallback((props) => {
    setSelected(props);
    if (window.innerWidth < 768) setPanelOpen(false);
  }, []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Run geocoding on first load
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      setGeocodeProgress({ done: 0, total: PERMITS.length });
      const geocoded = await geocodePermits(PERMITS, token, (done, total) => {
        if (!cancelled) setGeocodeProgress({ done, total });
      });
      if (!cancelled) {
        const updated = applyGeocodedCoords(PERMITS, geocoded);
        setPermits(updated);
        setGeocodeProgress('complete');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [token]);

  // Get filtered permits
  const filtered = useMemo(() => {
    return permits.filter(p => {
      if (customOnly && p.production) return false;
      if (currentCity !== 'All' && p.city !== currentCity) return false;
      return true;
    });
  }, [permits, customOnly, currentCity]);

  const customCount = filtered.filter(p => !p.production).length;
  const totalValue = filtered.filter(p => !p.production).reduce((s, p) => s + p.value, 0);

  // City breakdown
  const cityBreakdown = {};
  filtered.forEach(p => { cityBreakdown[p.city] = (cityBreakdown[p.city] || 0) + 1; });
  const sortedCities = Object.entries(cityBreakdown).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedCities[0]?.[1] || 1;

  // Initialize map
  useEffect(() => {
    if (!token || mapRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: STYLES.hybrid,
      center: [-95.85, 36.10],
      zoom: 10.3,
      pitch: 45,
      bearing: -10,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      // 3D terrain
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });

      // Add permit data
      map.addSource('permits', { type: 'geojson', data: buildGeoJSON(PERMITS) });

      // Glow layer
      map.addLayer({
        id: 'permits-glow',
        type: 'circle',
        source: 'permits',
        paint: {
          'circle-radius': ['*', ['get', 'radius'], 2.2],
          'circle-color': ['case', ['get', 'production'], 'rgba(255,107,53,0.1)', 'rgba(34,197,94,0.15)'],
          'circle-blur': 1,
        },
      });

      // Main circles
      map.addLayer({
        id: 'permits-main',
        type: 'circle',
        source: 'permits',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['case', ['get', 'production'], '#ff6b35', '#22c55e'],
          'circle-opacity': 0.88,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.5,
        },
      });

      // Labels at zoom
      map.addLayer({
        id: 'permits-labels',
        type: 'symbol',
        source: 'permits',
        minzoom: 12,
        layout: {
          'text-field': ['get', 'builder'],
          'text-size': 10,
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom',
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-max-width': 12,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1,
        },
      });

      // Click
      map.on('click', 'permits-main', (e) => {
        const props = e.features[0].properties;
        selectPermit({
          ...props,
          production: props.production === true || props.production === 'true',
        });
      });

      map.on('mouseenter', 'permits-main', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'permits-main', () => { map.getCanvas().style.cursor = ''; });

      // Fly in
      setTimeout(() => {
        map.flyTo({ center: [-95.88, 36.08], zoom: 10.5, pitch: 50, bearing: -12, duration: 2500 });
      }, 500);

      setLoaded(true);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [token]);

  // Update data when filters change
  useEffect(() => {
    if (!mapRef.current || !loaded) return;
    const src = mapRef.current.getSource('permits');
    if (src) src.setData(buildGeoJSON(filtered));
  }, [currentCity, customOnly, loaded, filtered]);

  // Fly to city
  const flyToCity = useCallback((city) => {
    setCurrentCity(city);
    setSelected(null);
    if (!mapRef.current) return;
    const coords = CITY_COORDS[city] || CITY_COORDS.All;
    mapRef.current.flyTo({ center: coords.center, zoom: coords.zoom, duration: 1200 });
  }, []);

  // Change map style
  const changeStyle = useCallback((style) => {
    setMapStyle(style);
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.setStyle(STYLES[style]);
    map.once('style.load', () => {
      // Re-add terrain
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });
      // Re-add data
      if (!map.getSource('permits')) {
        map.addSource('permits', { type: 'geojson', data: buildGeoJSON(filtered) });
      }
      map.addLayer({ id: 'permits-glow', type: 'circle', source: 'permits', paint: { 'circle-radius': ['*', ['get', 'radius'], 2.2], 'circle-color': ['case', ['get', 'production'], 'rgba(255,107,53,0.1)', 'rgba(34,197,94,0.15)'], 'circle-blur': 1 } });
      map.addLayer({ id: 'permits-main', type: 'circle', source: 'permits', paint: { 'circle-radius': ['get', 'radius'], 'circle-color': ['case', ['get', 'production'], '#ff6b35', '#22c55e'], 'circle-opacity': 0.88, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5 } });
      map.addLayer({ id: 'permits-labels', type: 'symbol', source: 'permits', minzoom: 12, layout: { 'text-field': ['get', 'builder'], 'text-size': 10, 'text-offset': [0, -1.6], 'text-anchor': 'bottom', 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-max-width': 12 }, paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1 } });
      map.on('click', 'permits-main', (e) => { const p = e.features[0].properties; selectPermit({ ...p, production: p.production === true || p.production === 'true' }); });
      map.on('mouseenter', 'permits-main', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'permits-main', () => { map.getCanvas().style.cursor = ''; });
    });
  }, [filtered]);

  // No token screen
  if (!token) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: 8 }}>Mapbox Token Required</h2>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Add <code style={{ background: '#111', padding: '2px 6px', borderRadius: 4, color: '#4da6ff' }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> to your Vercel environment variables.
          </p>
          <p style={{ color: '#666', fontSize: 13 }}>
            Get a free token at <a href="https://account.mapbox.com/auth/signup/" target="_blank" style={{ color: '#4da6ff' }}>mapbox.com</a> — no credit card needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Map */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)', padding: '12px 16px 28px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span style={{ color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: 0.5 }}>IST Permit Intel</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>NE Oklahoma — November 2025</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'right', fontFamily: 'monospace' }}>
            <div>176 permits / 83 custom</div>
            <div>NOW Report Data</div>
          </div>
        </div>
      </div>

      {/* Geocoding Progress */}
      {geocodeProgress && geocodeProgress !== 'complete' && (
        <div style={{
          position: 'absolute', top: 56, left: 0, right: 0, zIndex: 15,
          padding: '6px 16px', background: 'rgba(10,10,10,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
            Geocoding addresses... {geocodeProgress.done}/{geocodeProgress.total}
          </div>
          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: '#22c55e',
              width: `${(geocodeProgress.done / geocodeProgress.total) * 100}%`,
              transition: 'width 0.2s',
            }} />
          </div>
        </div>
      )}

      {/* Style toggle */}
      <div style={{ position: 'absolute', top: 64, right: 12, zIndex: 10, display: 'flex', gap: 4 }}>
        {Object.keys(STYLES).map(s => (
          <button key={s} onClick={() => changeStyle(s)} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            border: mapStyle === s ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
            background: mapStyle === s ? 'rgba(34,197,94,0.15)' : 'rgba(15,15,15,0.85)',
            color: mapStyle === s ? '#22c55e' : 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(8px)', fontFamily: 'inherit', textTransform: 'capitalize',
          }}>{s}</button>
        ))}
      </div>

      {/* Panel Toggle Button */}
      <button
        onClick={() => setPanelOpen(prev => !prev)}
        style={{
          position: 'absolute', top: 68, left: panelOpen ? 248 : 12, zIndex: 20,
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(10,10,10,0.88)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', cursor: 'pointer', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontFamily: 'monospace',
          transition: 'left 0.3s ease',
        }}
        title={panelOpen ? 'Collapse panel' : 'Expand panel'}
      >
        {panelOpen ? '◀' : '☰'}
      </button>

      {/* Left Panel */}
      <div style={{
        position: 'absolute', top: 64, left: panelOpen ? 12 : -250, zIndex: 10,
        width: 230, display: 'flex', flexDirection: 'column', gap: 8,
        maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
        transition: 'left 0.3s ease',
      }}>
        {/* Filters */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Filter</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CITIES.map(c => (
              <button key={c} onClick={() => flyToCity(c)} style={{
                padding: '4px 9px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: currentCity === c ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                background: currentCity === c ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                color: currentCity === c ? '#22c55e' : 'rgba(255,255,255,0.5)',
                fontFamily: 'inherit',
              }}>{c}</button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
            <input type="checkbox" checked={customOnly} onChange={e => { setCustomOnly(e.target.checked); setSelected(null); }} style={{ accentColor: '#22c55e' }} />
            Custom builders only
          </label>
        </div>

        {/* Stats */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={statLabelStyle}>Showing</div>
              <div style={statValStyle}>{filtered.length}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Custom</div>
              <div style={{ ...statValStyle, color: '#22c55e' }}>{customCount}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Indie Value</div>
              <div style={statValStyle}>${(totalValue / 1000000).toFixed(1)}M</div>
            </div>
            <div>
              <div style={statLabelStyle}>Top Zone</div>
              <div style={statValStyle}>{sortedCities[0]?.[0] || '—'}</div>
            </div>
          </div>
        </div>

        {/* Density */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>By City</div>
          {sortedCities.slice(0, 8).map(([city, count]) => (
            <div key={city} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                <span>{city}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{count}</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #22c55e, #16a34a)', width: `${(count / maxCount) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Custom / Indie</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff6b35', boxShadow: '0 0 6px #ff6b35' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Production</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>Circle size = permit value</div>
          <button
            onClick={() => {
              clearGeocodeCache();
              window.location.reload();
            }}
            style={{
              marginTop: 10, width: '100%', padding: '5px 0', borderRadius: 4,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.35)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Re-geocode addresses</button>
        </div>
      </div>

      {/* Selected Permit Detail */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          width: 'calc(100% - 24px)', maxWidth: 560, background: 'rgba(10,10,10,0.94)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '14px 16px', backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selected.builder}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {selected.address} — {selected.city}
                {selected.subdivision ? ` — ${selected.subdivision}` : ''}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontFamily: 'inherit',
            }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10 }}>
            {[
              { l: 'Value', v: selected.value > 0 ? fmt(Number(selected.value)) : 'N/A' },
              { l: 'Sqft', v: Number(selected.sqft) > 0 ? Number(selected.sqft).toLocaleString() : 'N/A' },
              { l: 'Week', v: selected.week },
              { l: 'Phone', v: selected.phone || 'N/A' },
            ].map(f => (
              <div key={f.l}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace' }}>{f.l}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 1 }}>{f.v}</div>
              </div>
            ))}
          </div>
          {selected.contact && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Contact: {selected.contact}</div>
          )}
          <div style={{
            marginTop: 10, padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
            background: selected.production ? 'rgba(255,107,53,0.1)' : 'rgba(34,197,94,0.1)',
            color: selected.production ? '#ff6b35' : '#22c55e',
            border: `1px solid ${selected.production ? 'rgba(255,107,53,0.2)' : 'rgba(34,197,94,0.2)'}`,
            display: 'inline-block',
          }}>
            {selected.production ? 'Production Builder' : (Number(selected.value) >= 500000 ? '★ Premium Custom Lead' : '★ Indie Builder Lead')}
          </div>
        </div>
      )}
    </div>
  );
}

// Shared styles
const cardStyle = {
  background: 'rgba(10,10,10,0.88)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: 12,
  backdropFilter: 'blur(12px)',
};
const cardTitleStyle = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'rgba(255,255,255,0.35)',
  letterSpacing: 1.5,
  fontWeight: 600,
  marginBottom: 8,
  textTransform: 'uppercase',
};
const statLabelStyle = { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' };
const statValStyle = { fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 1 };
