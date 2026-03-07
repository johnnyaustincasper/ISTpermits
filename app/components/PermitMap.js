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
    features: permits.filter(p => p.lat !== 0 && p.lng !== 0).map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id, builder: p.builder, address: p.address, city: p.city,
        sqft: p.sqft, value: p.value, week: p.week, production: p.production,
        phone: p.phone, subdivision: p.subdivision, contact: p.contact,
        radius: Math.max(5, Math.sqrt((p.value || 50000) / 6000)),
      },
    })),
  };
}

function fmt(v) { return '$' + v.toLocaleString(); }

function addLayers(map, data, onClickPermit) {
  if (map.getLayer('permits-labels')) map.removeLayer('permits-labels');
  if (map.getLayer('permits-main')) map.removeLayer('permits-main');
  if (map.getSource('permits')) map.removeSource('permits');

  map.addSource('permits', { type: 'geojson', data });

  map.addLayer({
    id: 'permits-main',
    type: 'circle',
    source: 'permits',
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['case', ['get', 'production'], '#ff6b35', '#22c55e'],
      'circle-opacity': 0.85,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.5,
    },
  });

  map.addLayer({
    id: 'permits-labels',
    type: 'symbol',
    source: 'permits',
    minzoom: 13,
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

  if (map._permitClick) map.off('click', 'permits-main', map._permitClick);
  map._permitClick = (e) => {
    const f = e.features[0];
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    onClickPermit({ ...p, lat, lng, production: p.production === true || p.production === 'true' });
  };
  map.on('click', 'permits-main', map._permitClick);
  map.on('mouseenter', 'permits-main', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'permits-main', () => { map.getCanvas().style.cursor = ''; });
}

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
  const [geocoding, setGeocoding] = useState(false);
  const [routeList, setRouteList] = useState([]);
  const [currentMonth, setCurrentMonth] = useState('All');

  const isMobile = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      isMobile.current = window.innerWidth < 768;
      if (isMobile.current) setPanelOpen(false);
    }
  }, []);

  const selectPermit = useCallback((props) => {
    setSelected(props);
    if (isMobile.current) {
      setPanelOpen(false);
      // Pan the map so the pin is in the upper third, leaving room for the detail card
      if (mapRef.current) {
        const coords = [Number(props.lng || 0), Number(props.lat || 0)];
        if (coords[0] && coords[1]) {
          const cardHeight = Math.round(window.innerHeight * 0.55) + 40
          mapRef.current.easeTo({
            center: coords,
            padding: { bottom: cardHeight },
            duration: 400,
          });
        }
      }
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
    if (isMobile.current && mapRef.current) {
      mapRef.current.easeTo({ padding: { bottom: 0 }, duration: 300 });
    }
  }, []);

  const addToRoute = useCallback((permit) => {
    setRouteList(prev => {
      if (prev.find(p => p.id === permit.id)) return prev; // already added
      return [...prev, permit];
    });
  }, []);

  const removeFromRoute = useCallback((id) => {
    setRouteList(prev => prev.filter(p => p.id !== id));
  }, []);

  const openAppleMapsRoute = useCallback(() => {
    if (routeList.length === 0) return;
    // Apple Maps multi-stop URL scheme using "to:" separator
    // Format: maps://?saddr=&daddr=STOP1+to:STOP2+to:STOP3
    const addresses = routeList.map(p => p.address + ', ' + p.city + ', OK');
    if (addresses.length === 1) {
      window.open(`maps://?daddr=${encodeURIComponent(addresses[0])}&dirflg=d`, '_blank');
      return;
    }
    const first = encodeURIComponent(addresses[0]);
    const rest = addresses.slice(1).map(a => encodeURIComponent(a)).join('+to:');
    window.open(`maps://?saddr=&daddr=${first}+to:${rest}&dirflg=d`, '_blank');
  }, [routeList]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Geocode once — only 2 state updates: start and finish
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      setGeocoding(true);
      const geocoded = await geocodePermits(PERMITS, token);
      if (!cancelled) {
        setPermits(applyGeocodedCoords(PERMITS, geocoded));
        setGeocoding(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [token]);

  // Extract available months from permit weeks e.g. "11/2-11/8" → "Nov"
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const availableMonths = useMemo(() => {
    const seen = new Set();
    permits.forEach(p => {
      const m = parseInt((p.week || '').split('/')[0]);
      if (m >= 1 && m <= 12) seen.add(m);
    });
    return ['All', ...Array.from(seen).sort((a,b) => a-b).map(m => MONTH_NAMES[m-1])];
  }, [permits]);

  const filtered = useMemo(() => {
    return permits.filter(p => {
      if (customOnly && p.production) return false;
      if (currentCity !== 'All' && p.city !== currentCity) return false;
      if (currentMonth !== 'All') {
        const m = parseInt((p.week || '').split('/')[0]);
        if (MONTH_NAMES[m-1] !== currentMonth) return false;
      }
      return true;
    });
  }, [permits, customOnly, currentCity, currentMonth]);

  const geoJSON = useMemo(() => buildGeoJSON(filtered), [filtered]);
  const customCount = useMemo(() => filtered.filter(p => !p.production).length, [filtered]);
  const totalValue = useMemo(() => filtered.filter(p => !p.production).reduce((s, p) => s + p.value, 0), [filtered]);
  const cityBreakdown = useMemo(() => {
    const bd = {};
    filtered.forEach(p => { bd[p.city] = (bd[p.city] || 0) + 1; });
    return Object.entries(bd).sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const maxCount = cityBreakdown[0]?.[1] || 1;

  useEffect(() => {
    if (!token || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: STYLES.hybrid,
      center: [-95.85, 36.10],
      zoom: 10.3,
      pitch: 40,
      bearing: -10,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.on('load', () => {
      map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });
      addLayers(map, buildGeoJSON(PERMITS), selectPermit);
      setLoaded(true);
      map.flyTo({ center: [-95.88, 36.08], zoom: 10.5, pitch: 45, bearing: -12, duration: 2000 });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [token, selectPermit]);

  useEffect(() => {
    if (!mapRef.current || !loaded) return;
    const src = mapRef.current.getSource('permits');
    if (src) src.setData(geoJSON);
  }, [geoJSON, loaded]);

  const flyToCity = useCallback((city) => {
    setCurrentCity(city);
    closeDetail();
    if (!mapRef.current) return;
    const coords = CITY_COORDS[city] || CITY_COORDS.All;
    mapRef.current.flyTo({ center: coords.center, zoom: coords.zoom, duration: 1000 });
  }, [closeDetail]);

  const changeStyle = useCallback((style) => {
    setMapStyle(style);
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.setStyle(STYLES[style]);
    map.once('style.load', () => {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });
      addLayers(map, geoJSON, selectPermit);
    });
  }, [geoJSON, selectPermit]);

  if (!token) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: 8 }}>Mapbox Token Required</h2>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>
            Add <code style={{ background: '#111', padding: '2px 6px', borderRadius: 4, color: '#4da6ff' }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> to your Vercel environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)', padding: '12px 16px 28px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
              <span style={{ color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: 0.5 }}>IST Permit Intel</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>NE Oklahoma — Nov 2025 through Feb 2026</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'right', fontFamily: 'monospace' }}>
            <div>{filtered.length} permits shown</div>
            <div>{geocoding ? 'Geocoding...' : 'NOW Report Data'}</div>
          </div>
        </div>
      </div>

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

      <button onClick={() => setPanelOpen(prev => !prev)} style={{
        position: 'absolute', top: 68, left: panelOpen ? 248 : 12, zIndex: 20,
        width: 36, height: 36, borderRadius: 8,
        background: 'rgba(10,10,10,0.88)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', cursor: 'pointer', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontFamily: 'monospace', transition: 'left 0.3s ease',
      }}>{panelOpen ? '◀' : '☰'}</button>

      <div style={{ position: 'absolute', top: 64, left: panelOpen ? 12 : -250, zIndex: 10, width: 230, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', transition: 'left 0.3s ease' }}>
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
            <input type="checkbox" checked={customOnly} onChange={e => { setCustomOnly(e.target.checked); closeDetail(); }} style={{ accentColor: '#22c55e' }} />
            Custom builders only
          </label>
        </div>

        <div style={cardStyle}>
          <div style={cardTitleStyle}>Month</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {availableMonths.map(m => (
              <button key={m} onClick={() => { setCurrentMonth(m); closeDetail(); }} style={{
                padding: '4px 9px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: currentMonth === m ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                background: currentMonth === m ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                color: currentMonth === m ? '#22c55e' : 'rgba(255,255,255,0.5)',
                fontFamily: 'inherit',
              }}>{m}</button>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardTitleStyle}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={statLabelStyle}>Showing</div><div style={statValStyle}>{filtered.length}</div></div>
            <div><div style={statLabelStyle}>Custom</div><div style={{ ...statValStyle, color: '#22c55e' }}>{customCount}</div></div>
            <div><div style={statLabelStyle}>Indie Value</div><div style={statValStyle}>${(totalValue / 1000000).toFixed(1)}M</div></div>
            <div><div style={statLabelStyle}>Top Zone</div><div style={statValStyle}>{cityBreakdown[0]?.[0] || '—'}</div></div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardTitleStyle}>By City</div>
          {cityBreakdown.slice(0, 8).map(([city, count]) => (
            <div key={city} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                <span>{city}</span><span style={{ color: '#22c55e', fontWeight: 600 }}>{count}</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #22c55e, #16a34a)', width: `${(count / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

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
          <button onClick={() => { clearGeocodeCache(); window.location.reload(); }} style={{
            marginTop: 10, width: '100%', padding: '5px 0', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.35)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
          }}>Re-geocode addresses</button>
        </div>
      </div>

      {routeList.length > 0 && !selected && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: 'rgba(10,10,10,0.97)', borderTop: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px 14px 0 0', padding: '14px 16px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          backdropFilter: 'blur(16px)', boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🗺 Route — {routeList.length} stop{routeList.length > 1 ? 's' : ''}</span>
            <button onClick={() => setRouteList([])} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontFamily: 'inherit',
            }}>Clear</button>
          </div>
          <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 10 }}>
            {routeList.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 11, minWidth: 18 }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)', truncate: 'true' }}>{p.builder} — {p.address}</span>
                <button onClick={() => removeFromRoute(p.id)} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontSize: 14, padding: '0 4px',
                }}>✕</button>
              </div>
            ))}
          </div>
          <button onClick={openAppleMapsRoute} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(0,122,255,0.9)', border: 'none',
            color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          }}>
            🗺 Map Route in Apple Maps
          </button>
        </div>
      )}

      {selected && (
        <div style={{
          position: 'fixed', bottom: 0,
          left: 0, right: 0, zIndex: 20,
          background: 'rgba(10,10,10,0.97)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px 14px 0 0',
          padding: '14px 16px 24px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.6)',
          maxHeight: '55vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selected.builder}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {selected.address} — {selected.city}{selected.subdivision ? ` — ${selected.subdivision}` : ''}
              </div>
            </div>
            <button onClick={closeDetail} style={{
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
          {selected.contact && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Contact: {selected.contact}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <a
              href={`maps://maps.apple.com/?q=${encodeURIComponent(selected.address + ', ' + selected.city + ', OK')}&ll=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 8,
                background: 'rgba(0,122,255,0.15)', border: '1px solid rgba(0,122,255,0.3)',
                color: '#4da6ff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}
            >
              📍 Maps
            </a>
            <button
              onClick={() => addToRoute(selected)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                background: routeList.find(p => p.id === selected.id) ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                border: routeList.find(p => p.id === selected.id) ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: routeList.find(p => p.id === selected.id) ? '#22c55e' : 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 600,
              }}
            >
              {routeList.find(p => p.id === selected.id) ? '✓ Added' : '＋ Route'}
            </button>
          </div>
          {routeList.length > 0 && (
            <button
              onClick={() => { closeDetail(); openAppleMapsRoute(); }}
              style={{
                width: '100%', marginTop: 8, padding: '11px 0', borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                background: 'rgba(0,122,255,0.9)', border: 'none', color: '#fff',
              }}
            >
              🗺 Map Route ({routeList.length} stop{routeList.length > 1 ? 's' : ''})
            </button>
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

const cardStyle = {
  background: 'rgba(10,10,10,0.88)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: 12, backdropFilter: 'blur(12px)',
};
const cardTitleStyle = {
  fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)',
  letterSpacing: 1.5, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase',
};
const statLabelStyle = { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' };
const statValStyle = { fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 1 };
