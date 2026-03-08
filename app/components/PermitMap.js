'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PERMITS, CITIES, CITY_COORDS } from '../../lib/permits';
import { geocodePermits, applyGeocodedCoords, clearGeocodeCache } from '../../lib/geocode';

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: '#f5f7fa',
  card: 'rgba(255,255,255,0.97)',
  cardBorder: 'rgba(0,0,0,0.08)',
  text: '#1a1a2e',
  textSub: '#6b7280',
  textMuted: '#9ca3af',
  blue: '#2563eb',
  blueLight: '#eff6ff',
  blueBorder: '#bfdbfe',
  blueDark: '#1d4ed8',
  green: '#16a34a',
  greenLight: '#f0fdf4',
  greenBorder: '#bbf7d0',
  orange: '#ea580c',
  orangeLight: '#fff7ed',
  shadow: '0 2px 16px rgba(0,0,0,0.10)',
  shadowLg: '0 -4px 32px rgba(0,0,0,0.12)',
};

const STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/light-v11',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NOTES_KEY = (user) => `ist-permit-notes-${user}`;
const ROUTE_KEY = (user) => `ist-route-list-${user}`;
const STATUS_KEY = (user) => `ist-permit-status-${user}`;
const SESSION_KEY = 'ist-active-user';
const SALESMEN = ['Johnny', 'Jordan', 'Skip'];

const STATUSES = [
  { key: 'called',    label: 'Called',        color: '#f59e0b', dot: '#f59e0b' },
  { key: 'quoted',    label: 'Quoted',        color: '#8b5cf6', dot: '#8b5cf6' },
  { key: 'won',       label: 'Won ✓',         color: '#16a34a', dot: '#16a34a' },
  { key: 'pass',      label: 'Not Interested', color: '#6b7280', dot: '#9ca3af' },
];

function loadStatuses(user) {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(STATUS_KEY(user)) || '{}'); } catch { return {}; }
}
function saveStatuses(user, s) {
  if (typeof window !== 'undefined') localStorage.setItem(STATUS_KEY(user), JSON.stringify(s));
}
function loadNotes(user) {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(NOTES_KEY(user)) || '{}'); } catch { return {}; }
}
function saveNotes(user, n) {
  if (typeof window !== 'undefined') localStorage.setItem(NOTES_KEY(user), JSON.stringify(n));
}
function loadRoute(user) {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(ROUTE_KEY(user)) || '[]'); } catch { return []; }
}
function saveRoute(user, r) {
  if (typeof window !== 'undefined') localStorage.setItem(ROUTE_KEY(user), JSON.stringify(r));
}
function loadSession() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_KEY) || null;
}
function saveSession(user) {
  if (typeof window !== 'undefined') localStorage.setItem(SESSION_KEY, user || '');
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('pick');
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  function handleSelectUser(name) {
    setSelectedUser(name);
    setPin('');
    setError('');
    setStep('pin');
  }

  async function handlePinDigit(digit) {
    const next = pin + digit;
    if (next.length > 4) return;
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      try {
        const res = await fetch('/api/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: selectedUser, pin: next }),
        });
        const data = await res.json();
        if (data.ok) {
          saveSession(selectedUser);
          onLogin(selectedUser);
        } else {
          setError('Wrong PIN. Try again.');
          setPin('');
        }
      } catch {
        setError('Connection error. Try again.');
        setPin('');
      } finally {
        setChecking(false);
      }
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1));
    setError('');
  }

  const title = step === 'pick' ? 'Who are you?' : `Welcome, ${selectedUser}`;
  const subtitle = step === 'pick' ? 'Select your name to continue' : 'Enter your PIN';

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Insulation Services of Tulsa</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.text, letterSpacing: 1 }}>IST Permits</div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, color: T.text, textAlign: 'center', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: T.textSub, textAlign: 'center', marginBottom: 32 }}>{subtitle}</div>

        {step === 'pick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SALESMEN.map(name => (
              <button key={name} onClick={() => handleSelectUser(name)} style={{
                padding: '18px 24px', borderRadius: 14, fontSize: 20, fontWeight: 700,
                background: '#fff', border: `2px solid ${T.cardBorder}`, color: T.text,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>{name}</button>
            ))}
          </div>
        )}

        {step === 'pin' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: i < pin.length ? T.blue : 'rgba(0,0,0,0.12)',
                  transition: 'background 0.15s',
                }} />
              ))}
            </div>

            {error && <div style={{ textAlign: 'center', color: '#dc2626', fontSize: 14, marginBottom: 16, fontWeight: 500 }}>{error}</div>}
            {checking && <div style={{ textAlign: 'center', color: T.textSub, fontSize: 14, marginBottom: 16 }}>Checking…</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => {
                if (d === '') return <div key={i} />;
                return (
                  <button key={i} onClick={() => d === '⌫' ? handleBackspace() : handlePinDigit(String(d))}
                    disabled={checking}
                    style={{
                      padding: '20px 0', borderRadius: 14, fontSize: d === '⌫' ? 22 : 24, fontWeight: 600,
                      background: '#fff', border: `1.5px solid ${T.cardBorder}`, color: T.text,
                      cursor: checking ? 'default' : 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      WebkitTapHighlightColor: 'transparent',
                      opacity: checking ? 0.5 : 1,
                    }}>{d}</button>
                );
              })}
            </div>

            <button onClick={() => { setStep('pick'); setPin(''); setError(''); }} style={{
              width: '100%', padding: '12px', background: 'none', border: 'none',
              color: T.textSub, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_COLORS = { called: '#f59e0b', quoted: '#8b5cf6', won: '#16a34a', pass: '#9ca3af' };

function buildGeoJSON(permits, statuses = {}) {
  return {
    type: 'FeatureCollection',
    features: permits.filter(p => p.lat !== 0 && p.lng !== 0).map(p => {
      const st = statuses[p.id];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id, builder: p.builder, address: p.address, city: p.city,
          sqft: p.sqft, value: p.value, week: p.week, production: p.production,
          phone: p.phone, subdivision: p.subdivision, contact: p.contact,
          radius: Math.max(14, Math.sqrt((p.value || 50000) / 4000)),
          dotColor: st ? STATUS_COLORS[st] : (p.production ? '#ea580c' : '#2563eb'),
        },
      };
    }),
  };
}

function fmt(v) { return '$' + Number(v).toLocaleString(); }

function addLayers(map, data, onClickPermit) {
  if (map.getLayer('permits-hit')) map.removeLayer('permits-hit');
  if (map.getLayer('permits-labels')) map.removeLayer('permits-labels');
  if (map.getLayer('permits-main')) map.removeLayer('permits-main');
  if (map.getSource('permits')) map.removeSource('permits');

  map.addSource('permits', { type: 'geojson', data });

  // Visual circle
  map.addLayer({
    id: 'permits-main',
    type: 'circle',
    source: 'permits',
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['get', 'dotColor'],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.9,
    },
  });

  // Invisible oversized hit-target layer for easier tapping
  map.addLayer({
    id: 'permits-hit',
    type: 'circle',
    source: 'permits',
    paint: {
      'circle-radius': ['+', ['get', 'radius'], 14],
      'circle-opacity': 0,
      'circle-stroke-width': 0,
    },
  });

  map.addLayer({
    id: 'permits-labels',
    type: 'symbol',
    source: 'permits',
    minzoom: 13,
    layout: {
      'text-field': ['get', 'builder'],
      'text-size': 11,
      'text-offset': [0, -1.8],
      'text-anchor': 'bottom',
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-max-width': 12,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': 'rgba(0,0,0,0.75)',
      'text-halo-width': 1.5,
    },
  });

  if (map._permitClick) map.off('click', 'permits-hit', map._permitClick);
  map._permitClick = (e) => {
    const f = e.features[0];
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    onClickPermit({ ...p, lat, lng, production: p.production === true || p.production === 'true' });
  };
  map.on('click', 'permits-hit', map._permitClick);
  map.on('mouseenter', 'permits-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'permits-hit', () => { map.getCanvas().style.cursor = ''; });
}

export default function PermitMap() {
  const [activeUser, setActiveUser] = useState(() => loadSession());

  if (!activeUser) return <LoginScreen onLogin={setActiveUser} />;
  return <PermitMapInner activeUser={activeUser} onLogout={() => { saveSession(null); setActiveUser(null); }} />;
}

function PermitMapInner({ activeUser, onLogout }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [currentCity, setCurrentCity] = useState('All');
  const [customOnly, setCustomOnly] = useState(false);
  const [mapStyle, setMapStyle] = useState('hybrid');
  const [selected, setSelected] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [permits, setPermits] = useState(PERMITS);
  const [geocoding, setGeocoding] = useState(false);
  const [routeList, setRouteList] = useState(() => loadRoute(activeUser));
  const [currentMonth, setCurrentMonth] = useState('All');
  const [notes, setNotes] = useState(() => loadNotes(activeUser));
  const [noteText, setNoteText] = useState('');
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [statuses, setStatuses] = useState(() => loadStatuses(activeUser));

  const isMobile = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      isMobile.current = window.innerWidth < 768;
    }
  }, []);

  const selectPermit = useCallback((props) => {
    setSelected(props);
    setShowRoutePanel(false);
    setNoteText('');
    if (mapRef.current) {
      const coords = [Number(props.lng || 0), Number(props.lat || 0)];
      if (coords[0] && coords[1]) {
        const cardHeight = isMobile.current ? Math.round(window.innerHeight * 0.55) + 40 : 300;
        mapRef.current.easeTo({ center: coords, padding: { bottom: cardHeight }, duration: 400 });
      }
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelected(null);
    if (mapRef.current) mapRef.current.easeTo({ padding: { bottom: 0 }, duration: 300 });
  }, []);

  const saveNote = useCallback((id, text) => {
    const updated = { ...notes, [id]: text };
    setNotes(updated);
    saveNotes(activeUser, updated);
  }, [notes, activeUser]);

  const setStatus = useCallback((id, statusKey) => {
    setStatuses(prev => {
      const updated = statusKey ? { ...prev, [id]: statusKey } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id));
      saveStatuses(activeUser, updated);
      return updated;
    });
  }, [activeUser]);

  const addToRoute = useCallback((permit) => {
    setRouteList(prev => {
      if (prev.find(p => p.id === permit.id)) return prev;
      const next = [...prev, permit];
      saveRoute(activeUser, next);
      return next;
    });
  }, [activeUser]);

  const removeFromRoute = useCallback((id) => {
    setRouteList(prev => {
      const next = prev.filter(p => p.id !== id);
      saveRoute(activeUser, next);
      return next;
    });
  }, [activeUser]);

  const clearRoute = useCallback(() => {
    setRouteList([]);
    saveRoute(activeUser, []);
  }, [activeUser]);

  const openAppleMapsRoute = useCallback(() => {
    if (routeList.length === 0) return;
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

  const geoJSON = useMemo(() => buildGeoJSON(filtered, statuses), [filtered, statuses]);

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
      addLayers(map, buildGeoJSON(PERMITS, loadStatuses()), selectPermit);
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

  const isInRoute = selected ? !!routeList.find(p => p.id === selected.id) : false;

  if (!token) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 32, maxWidth: 500, width: '90%', textAlign: 'center', boxShadow: T.shadow }}>
          <h2 style={{ color: T.text, marginBottom: 8 }}>Mapbox Token Required</h2>
          <p style={{ color: T.textSub, fontSize: 15, lineHeight: 1.6 }}>Add <code style={{ background: T.blueLight, padding: '2px 8px', borderRadius: 4, color: T.blue }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> to Vercel environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', background: T.bg }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 75%, transparent 100%)', padding: '14px 16px 32px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: T.blue }} />
              <span style={{ color: T.text, fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>IST Permit Intel</span>
            </div>
            <div style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>NE Oklahoma — Nov 2025 through Feb 2026</div>
          </div>
          <div style={{ textAlign: 'right', pointerEvents: 'auto' }}>
            <div style={{ color: T.textMuted, fontSize: 11, marginBottom: 5 }}>
              <div style={{ fontWeight: 600 }}>{filtered.length} permits</div>
              <div>{geocoding ? 'Geocoding...' : 'NOW Report Data'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>{activeUser}</span>
              <button onClick={onLogout} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#fff', border: `1px solid ${T.cardBorder}`, color: T.textSub, cursor: 'pointer', fontFamily: 'inherit' }}>Log out</button>
            </div>
          </div>
        </div>
      </div>

      {/* Map style buttons */}
      <div style={{ position: 'absolute', top: 'calc(76px + env(safe-area-inset-top, 0px))', right: 12, zIndex: 10, display: 'flex', gap: 5 }}>
        {Object.keys(STYLES).map(s => (
          <button key={s} onClick={() => changeStyle(s)} style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600,
            border: mapStyle === s ? `1.5px solid ${T.blue}` : `1px solid ${T.cardBorder}`,
            background: mapStyle === s ? T.blueLight : T.card,
            color: mapStyle === s ? T.blue : T.textSub,
            boxShadow: T.shadow, fontFamily: 'inherit', textTransform: 'capitalize',
          }}>{s}</button>
        ))}
      </div>

      {/* Sidebar toggle */}
      <button onClick={() => { setPanelOpen(prev => !prev); setShowRoutePanel(false); }} style={{
        position: 'absolute', top: 'calc(80px + env(safe-area-inset-top, 0px))', left: panelOpen ? 256 : 12, zIndex: 20,
        width: 42, height: 42, borderRadius: 10,
        background: T.card, border: `1px solid ${T.cardBorder}`,
        color: T.text, cursor: 'pointer', boxShadow: T.shadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, transition: 'left 0.3s ease',
      }}>{panelOpen ? '◀' : '☰'}</button>

      {/* Route list toggle button */}
      {routeList.length > 0 && !selected && (
        <button onClick={() => { setShowRoutePanel(prev => !prev); setShowTeamPanel(false); setPanelOpen(false); }} style={{
          position: 'absolute', top: 'calc(132px + env(safe-area-inset-top, 0px))', left: 12, zIndex: 20,
          padding: '10px 16px', borderRadius: 10,
          background: T.blue, border: 'none',
          color: '#fff', cursor: 'pointer', boxShadow: T.shadow,
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        }}>🗺 Route ({routeList.length})</button>
      )}

      {/* Team button */}
      {!selected && (
        <button onClick={() => { setShowTeamPanel(prev => !prev); setShowRoutePanel(false); setPanelOpen(false); }} style={{
          position: 'absolute', top: 'calc(132px + env(safe-area-inset-top, 0px))', right: 12, zIndex: 20,
          padding: '10px 16px', borderRadius: 10,
          background: showTeamPanel ? T.blue : T.card,
          border: showTeamPanel ? 'none' : `1px solid ${T.cardBorder}`,
          color: showTeamPanel ? '#fff' : T.text,
          cursor: 'pointer', boxShadow: T.shadow,
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        }}>👥 Team</button>
      )}

      {/* Team Panel */}
      {showTeamPanel && !selected && (() => {
        const teamData = SALESMEN.map(name => ({
          name,
          statuses: loadStatuses(name),
          route: loadRoute(name),
        }));

        // Build builder → [{ user, permitId, address }] map
        const builderMap = {};
        teamData.forEach(({ name, statuses, route }) => {
          // From statuses (called/quoted/won)
          Object.entries(statuses).forEach(([id, status]) => {
            if (status === 'pass') return;
            const permit = PERMITS.find(p => String(p.id) === String(id));
            if (!permit) return;
            const key = permit.builder.toLowerCase().trim();
            if (!builderMap[key]) builderMap[key] = [];
            builderMap[key].push({ user: name, permitId: id, address: permit.address, status, builder: permit.builder });
          });
          // From route
          route.forEach(permit => {
            const key = permit.builder.toLowerCase().trim();
            if (!builderMap[key]) builderMap[key] = [];
            // Avoid dupes
            if (!builderMap[key].find(e => e.user === name && e.permitId === String(permit.id))) {
              builderMap[key].push({ user: name, permitId: String(permit.id), address: permit.address, status: 'route', builder: permit.builder });
            }
          });
        });

        // Builders with multiple users = conflict
        const conflicts = Object.entries(builderMap).filter(([, entries]) => {
          const users = [...new Set(entries.map(e => e.user))];
          return users.length > 1;
        });

        const statusColors = { called: '#f59e0b', quoted: '#8b5cf6', won: '#16a34a', route: T.blue };
        const statusLabels = { called: 'Called', quoted: 'Quoted', won: 'Won', route: 'On Route' };

        return (
          <div style={{
            position: 'absolute', top: 'calc(76px + env(safe-area-inset-top, 0px))', right: 12, zIndex: 30,
            width: 300, maxHeight: 'calc(100vh - 160px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))',
            background: T.card, borderRadius: 16, boxShadow: T.shadowLg,
            border: `1px solid ${T.cardBorder}`, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: T.text }}>👥 Team Overview</span>
              <button onClick={() => setShowTeamPanel(false)} style={ghostBtn}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Conflicts */}
              {conflicts.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚠️ OVERLAP — {conflicts.length} builder{conflicts.length > 1 ? 's' : ''}
                  </div>
                  {conflicts.map(([key, entries]) => {
                    const builderName = entries[0].builder;
                    const byUser = {};
                    entries.forEach(e => { if (!byUser[e.user]) byUser[e.user] = []; byUser[e.user].push(e); });
                    return (
                      <div key={key} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b', marginBottom: 6 }}>{builderName}</div>
                        {Object.entries(byUser).map(([user, items]) => (
                          <div key={user} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, minWidth: 52 }}>{user}</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {items.map((e, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColors[e.status] || T.textSub, background: `${statusColors[e.status]}20`, padding: '1px 5px', borderRadius: 4 }}>{statusLabels[e.status] || e.status}</span>
                                  <span style={{ fontSize: 11, color: T.textSub }}>{e.address}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Per-salesman summary */}
              {teamData.map(({ name, statuses, route }) => {
                const activeStatuses = Object.entries(statuses).filter(([, s]) => s !== 'pass');
                return (
                  <div key={name}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: name === activeUser ? T.blue : T.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {name} {name === activeUser && <span style={{ fontSize: 10, color: T.blue, fontWeight: 600 }}>(you)</span>}
                    </div>
                    {route.length === 0 && activeStatuses.length === 0 ? (
                      <div style={{ fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>No activity yet</div>
                    ) : (
                      <>
                        {route.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>🗺 Route ({route.length})</div>
                            {route.map(p => (
                              <div key={p.id} style={{ fontSize: 12, color: T.text, padding: '3px 0', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 600 }}>{p.builder}</span>
                                <span style={{ color: T.textMuted }}>{p.address}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {activeStatuses.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>📋 Working ({activeStatuses.length})</div>
                            {activeStatuses.map(([id, status]) => {
                              const permit = PERMITS.find(p => String(p.id) === String(id));
                              if (!permit) return null;
                              return (
                                <div key={id} style={{ fontSize: 12, color: T.text, padding: '3px 0', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600 }}>{permit.builder}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColors[status], background: `${statusColors[status]}20`, padding: '1px 6px', borderRadius: 4 }}>{statusLabels[status]}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Sidebar */}
      <div style={{ position: 'absolute', top: 'calc(76px + env(safe-area-inset-top, 0px))', left: panelOpen ? 12 : -260, zIndex: 10, width: 238, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 120px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))', overflowY: 'auto', transition: 'left 0.3s ease', paddingBottom: 16 }}>

        {/* City filter */}
        <div style={card}>
          <div style={cardTitle}>City</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {CITIES.map(c => (
              <button key={c} onClick={() => flyToCity(c)} style={filterBtn(currentCity === c)}>{c}</button>
            ))}
          </div>
        </div>

        {/* Month filter */}
        <div style={card}>
          <div style={cardTitle}>Month</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {availableMonths.map(m => (
              <button key={m} onClick={() => { setCurrentMonth(m); closeDetail(); }} style={filterBtn(currentMonth === m)}>{m}</button>
            ))}
          </div>
        </div>

        {/* Custom only toggle */}
        <div style={card}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={customOnly} onChange={e => { setCustomOnly(e.target.checked); closeDetail(); }} style={{ accentColor: T.blue, width: 18, height: 18 }} />
            <span style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>Custom builders only</span>
          </label>
        </div>

        {/* Legend */}
        <div style={card}>
          <div style={cardTitle}>Legend</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: T.blue, border: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }} />
            <span style={{ fontSize: 13, color: T.text }}>Custom / Indie Builder</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: T.orange, border: '2px solid #fff', boxShadow: '0 0 0 1px #ddd' }} />
            <span style={{ fontSize: 13, color: T.text }}>Production Builder</span>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Circle size = permit value</div>
          {STATUSES.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.textSub }}>{s.label}</span>
            </div>
          ))}
          <button onClick={() => { clearGeocodeCache(); window.location.reload(); }} style={{
            marginTop: 10, width: '100%', padding: '7px 0', borderRadius: 6,
            background: T.bg, border: `1px solid ${T.cardBorder}`,
            color: T.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>↺ Re-geocode addresses</button>
        </div>
      </div>

      {/* Route panel */}
      {showRoutePanel && !selected && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 25,
          background: T.card, borderTop: `1px solid ${T.cardBorder}`,
          borderRadius: '20px 20px 0 0', padding: '18px 18px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          boxShadow: T.shadowLg, maxHeight: '65vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ color: T.text, fontWeight: 800, fontSize: 17 }}>🗺 Route — {routeList.length} stop{routeList.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={clearRoute} style={{ ...ghostBtn, color: T.orange }}>Clear all</button>
              <button onClick={() => setShowRoutePanel(false)} style={ghostBtn}>✕</button>
            </div>
          </div>
          {routeList.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '10px 12px', background: T.bg, borderRadius: 10 }}>
              <span style={{ color: T.blue, fontWeight: 800, fontSize: 15, minWidth: 22 }}>{i + 1}.</span>
              <div
                onClick={() => { selectPermit(p); setShowRoutePanel(false); }}
                style={{ flex: 1, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{p.builder}</div>
                <div style={{ fontSize: 13, color: T.textSub }}>{p.address}, {p.city}</div>
                {p.phone && <div style={{ fontSize: 13, color: T.blue, marginTop: 2 }}>📞 {p.phone}</div>}
              </div>
              <button onClick={() => removeFromRoute(p.id)} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 18, padding: '4px 6px' }}>✕</button>
            </div>
          ))}
          <button onClick={openAppleMapsRoute} style={{
            width: '100%', padding: '15px 0', borderRadius: 12, cursor: 'pointer',
            background: T.blue, border: 'none', color: '#fff',
            fontSize: 16, fontWeight: 800, fontFamily: 'inherit', marginTop: 6,
          }}>
            🗺 Open Route in Apple Maps
          </button>
        </div>
      )}

      {/* Detail card */}
      {selected && (
        <div
          onTouchStart={e => { e.currentTarget._swipeY = e.touches[0].clientY; }}
          onTouchEnd={e => {
            const startY = e.currentTarget._swipeY || 0;
            const dy = e.changedTouches[0].clientY - startY;
            if (dy > 60) closeDetail();
          }}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
            background: T.card, borderTop: `1px solid ${T.cardBorder}`,
            borderRadius: '20px 20px 0 0',
            padding: '18px 18px',
            paddingBottom: 'max(28px, env(safe-area-inset-bottom, 28px))',
            boxShadow: T.shadowLg,
            maxHeight: '60vh', overflowY: 'auto',
          }}>
          {/* Drag handle */}
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 14px' }} />

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>{selected.builder}</div>
              <div style={{ fontSize: 14, color: T.textSub, marginTop: 4 }}>
                {selected.address} · {selected.city}{selected.subdivision ? ` · ${selected.subdivision}` : ''}
              </div>
            </div>
            <button onClick={closeDetail} style={{ ...ghostBtn, marginLeft: 12, flexShrink: 0 }}>✕</button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { l: 'Value', v: Number(selected.value) > 0 ? fmt(Number(selected.value)) : 'N/A' },
              { l: 'Sq Ft', v: Number(selected.sqft) > 0 ? Number(selected.sqft).toLocaleString() : 'N/A' },
              { l: 'Week', v: selected.week || 'N/A' },
            ].map(f => (
              <div key={f.l} style={{ background: T.bg, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{f.l}</div>
                <div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Contact */}
          {selected.contact && (
            <div style={{ fontSize: 14, color: T.textSub, marginBottom: 10 }}>
              Contact: <span style={{ color: T.text, fontWeight: 600 }}>{selected.contact}</span>
            </div>
          )}

          {/* Phone — tap to call */}
          {selected.phone && selected.phone !== 'N/A' && (
            <a href={`tel:${selected.phone.replace(/\D/g,'')}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 0', borderRadius: 12, marginBottom: 10,
              background: T.greenLight, border: `1.5px solid ${T.greenBorder}`,
              color: T.green, fontSize: 17, fontWeight: 800, textDecoration: 'none',
            }}>
              📞 Call {selected.phone}
            </a>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <a href={`maps://maps.apple.com/?q=${encodeURIComponent(selected.address + ', ' + selected.city + ', OK')}&ll=${selected.lat},${selected.lng}`}
              target="_blank" rel="noopener noreferrer" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '13px 0', borderRadius: 12,
                background: T.blueLight, border: `1.5px solid ${T.blueBorder}`,
                color: T.blue, fontSize: 15, fontWeight: 700, textDecoration: 'none',
              }}>
              📍 Maps
            </a>
            <button onClick={() => addToRoute(selected)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '13px 0', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              background: isInRoute ? T.blueLight : T.bg,
              border: isInRoute ? `1.5px solid ${T.blueBorder}` : `1px solid ${T.cardBorder}`,
              color: isInRoute ? T.blue : T.textSub,
              fontSize: 15, fontWeight: 700,
            }}>
              {isInRoute ? '✓ Added' : '＋ Route'}
            </button>
          </div>

          {/* Map Route button — visible when stops are queued */}
          {routeList.length > 0 && (
            <button onClick={() => { closeDetail(); openAppleMapsRoute(); }} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, cursor: 'pointer',
              background: T.blue, border: 'none', color: '#fff',
              fontSize: 16, fontWeight: 800, fontFamily: 'inherit', marginBottom: 10,
            }}>
              🗺 Map Route ({routeList.length} stop{routeList.length !== 1 ? 's' : ''})
            </button>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Notes</div>
            <textarea
              value={noteText || notes[selected.id] || ''}
              onChange={e => setNoteText(e.target.value)}
              onBlur={e => saveNote(selected.id, e.target.value)}
              placeholder="Add a note (saved automatically)…"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${T.cardBorder}`, background: T.bg,
                color: T.text, fontSize: 14, fontFamily: 'inherit', resize: 'none',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Status tags */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Status</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {STATUSES.map(s => {
                const active = statuses[selected.id] === s.key;
                return (
                  <button key={s.key} onClick={() => setStatus(selected.id, active ? null : s.key)} style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? s.color : T.bg,
                    border: active ? `1.5px solid ${s.color}` : `1px solid ${T.cardBorder}`,
                    color: active ? '#fff' : T.textSub,
                    transition: 'all 0.15s',
                  }}>{s.label}</button>
                );
              })}
            </div>
          </div>

          {/* Builder type badge */}
          <div style={{
            display: 'inline-block', padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: selected.production ? T.orangeLight : T.blueLight,
            color: selected.production ? T.orange : T.blue,
            border: `1px solid ${selected.production ? '#fed7aa' : T.blueBorder}`,
          }}>
            {selected.production ? 'Production Builder' : (Number(selected.value) >= 500000 ? '★ Premium Custom Lead' : '★ Indie Builder Lead')}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const card = {
  background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 12, padding: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
};
const cardTitle = {
  fontSize: 11, color: '#6b7280', letterSpacing: 1, fontWeight: 700,
  marginBottom: 10, textTransform: 'uppercase',
};
const filterBtn = (active) => ({
  padding: '6px 12px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: active ? 700 : 500,
  border: active ? '1.5px solid #2563eb' : '1px solid rgba(0,0,0,0.1)',
  background: active ? '#eff6ff' : '#f9fafb',
  color: active ? '#2563eb' : '#374151',
  fontFamily: 'inherit',
});
const ghostBtn = {
  background: 'none', border: '1px solid rgba(0,0,0,0.1)', color: '#6b7280',
  cursor: 'pointer', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit',
};
