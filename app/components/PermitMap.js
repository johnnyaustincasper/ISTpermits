'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PERMITS, CITIES, CITY_COORDS } from '../../lib/permits';
import { geocodePermits, applyGeocodedCoords, clearGeocodeCache } from '../../lib/geocode';
import VisitModal from './VisitModal';

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
const VISIT_LOG_KEY = (user) => `ist-visit-log-${user}`;
const DAILY_ROUTES_KEY = (user) => `ist-daily-routes-${user}`;
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
function loadVisitLog(user) {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(VISIT_LOG_KEY(user)) || '[]'); } catch { return []; }
}
function saveVisitLog(user, log) {
  if (typeof window !== 'undefined') localStorage.setItem(VISIT_LOG_KEY(user), JSON.stringify(log));
}
function logVisit(user, permit, statusKey) {
  if (!permit || !statusKey || statusKey === 'pass') return;
  const log = loadVisitLog(user);
  const today = new Date().toISOString().slice(0, 10);
  // Update existing entry for this permit today, or add new
  const existingIdx = log.findIndex(e => e.permitId === String(permit.id) && e.date === today);
  const entry = { permitId: String(permit.id), builder: permit.builder, address: permit.address, city: permit.city || '', status: statusKey, date: today, ts: Date.now() };
  if (existingIdx >= 0) log[existingIdx] = entry;
  else log.unshift(entry);
  saveVisitLog(user, log.slice(0, 500)); // cap at 500 entries
}
function loadDailyRoutes(user) {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(DAILY_ROUTES_KEY(user)) || '{}'); } catch { return {}; }
}
function saveDailyRoutes(user, routes) {
  if (typeof window !== 'undefined') localStorage.setItem(DAILY_ROUTES_KEY(user), JSON.stringify(routes));
}

// ─── Intro Animation ──────────────────────────────────────────────────────────
// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('pick'); // pick | pin | setup | confirm
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [hasPin, setHasPin] = useState(null);

  async function handleSelectUser(name) {
    setSelectedUser(name);
    setPin(''); setSetupPin(''); setError('');
    setChecking(true);
    try {
      const res = await fetch(`/api/pin?user=${name}`);
      const data = await res.json();
      setHasPin(data.hasPin);
      setStep(data.hasPin ? 'pin' : 'setup');
    } catch {
      setError('Connection error.'); setStep('pin');
    } finally { setChecking(false); }
  }

  async function handlePinDigit(digit) {
    if (checking) return;

    if (step === 'setup') {
      const next = setupPin + digit;
      if (next.length > 4) return;
      setSetupPin(next);
      if (next.length === 4) { setStep('confirm'); setPin(''); setError(''); }
      return;
    }

    if (step === 'confirm') {
      const next = pin + digit;
      if (next.length > 4) return;
      setPin(next);
      if (next.length === 4) {
        if (next !== setupPin) {
          setError("PINs don't match. Try again.");
          setPin(''); setSetupPin(''); setStep('setup');
          return;
        }
        setChecking(true);
        try {
          await fetch('/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: selectedUser, pin: next, action: 'set' }) });
          saveSession(selectedUser);
          onLogin(selectedUser);
        } catch { setError('Connection error.'); } finally { setChecking(false); }
      }
      return;
    }

    // step === 'pin' — verify
    const next = pin + digit;
    if (next.length > 4) return;
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      try {
        const res = await fetch('/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: selectedUser, pin: next }) });
        const data = await res.json();
        if (data.ok) { saveSession(selectedUser); onLogin(selectedUser); }
        else { setError('Wrong PIN. Try again.'); setPin(''); }
      } catch { setError('Connection error.'); setPin(''); }
      finally { setChecking(false); }
    }
  }

  function handleBackspace() {
    if (step === 'setup') setSetupPin(p => p.slice(0, -1));
    else setPin(p => p.slice(0, -1));
    setError('');
  }

  const displayPin = step === 'setup' ? setupPin : pin;
  const title = step === 'pick' ? 'Who are you?' :
    step === 'setup' ? 'Create your PIN' :
    step === 'confirm' ? 'Confirm your PIN' : `Hi, ${selectedUser}`;
  const subtitle = step === 'pick' ? 'Select your name to continue' :
    step === 'setup' ? "You'll use this every time you log in" :
    step === 'confirm' ? 'Enter your PIN one more time' : 'Enter your PIN';

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.0) translate(0%,0%); }
          50%  { transform: scale(1.12) translate(-2%,-1%); }
          100% { transform: scale(1.0) translate(0%,0%); }
        }
        @keyframes authFadeIn {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .kb-img { position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;animation:kenburns 20s ease-in-out infinite;transform-origin:center center; }
        .kb-overlay { position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.35) 50%,rgba(0,0,0,0.65) 100%); }
        .kb-content { animation:authFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .kb-card { background:rgba(255,255,255,0.1)!important;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.2)!important;box-shadow:0 4px 24px rgba(0,0,0,0.3)!important;transition:background 0.2s,transform 0.2s!important; }
        .kb-card:hover { background:rgba(255,255,255,0.18)!important;transform:translateY(-2px); }
      `}</style>
      <img className="kb-img" src="/tulsa.jpg" alt="" />
      <div className="kb-overlay" />
      <div className="kb-content" style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'20px 24px 40px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Insulation Services of Tulsa</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>IST Permits</div>
          <div style={{ width: 40, height: 2, background: T.blue, margin: '12px auto 0', borderRadius: 1 }} />
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 32 }}>{subtitle}</div>

        {step === 'pick' && !checking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SALESMEN.map(name => (
              <button key={name} onClick={() => handleSelectUser(name)} className="kb-card" style={{
                padding: '18px 24px', borderRadius: 14, fontSize: 20, fontWeight: 700,
                color: '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', border: 'none', width: '100%',
              }}>{name}</button>
            ))}
          </div>
        )}

        {step === 'pick' && checking && (
          <div style={{ textAlign: 'center', color: T.textSub, fontSize: 15 }}>Loading…</div>
        )}

        {(step === 'pin' || step === 'setup' || step === 'confirm') && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: i < displayPin.length ? T.blue : 'rgba(0,0,0,0.12)',
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
                      background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                      cursor: checking ? 'default' : 'pointer', fontFamily: 'inherit',
                      backdropFilter: 'blur(8px)',
                      WebkitTapHighlightColor: 'transparent',
                      opacity: checking ? 0.5 : 1,
                    }}>{d}</button>
                );
              })}
            </div>

            <button onClick={() => { setStep('pick'); setPin(''); setSetupPin(''); setError(''); }} style={{
              width: '100%', padding: '12px', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.55)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>← Back</button>
          </>
        )}
      </div>
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

// ─── Team Page ────────────────────────────────────────────────────────────────
function TeamPage({ activeUser, onClose, permits: allPermits, dailyRoutes, addToDailyRoute, removeFromDailyRoute, myRoute }) {
  // Load each salesman's daily routes independently from their own localStorage key
  const allDailyRoutes = useMemo(() => {
    const result = {};
    SALESMEN.forEach(name => { result[name] = loadDailyRoutes(name); });
    return result;
  }, []);
  const today = new Date();
  const dow = today.getDay();
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = today.toISOString().slice(0, 10);

  const statusColors = { called: '#f59e0b', quoted: '#8b5cf6', won: '#16a34a', route: T.blue, pass: '#9ca3af' };
  const statusLabels = { called: 'Called', quoted: 'Quoted', won: 'Won', route: 'Route', pass: 'Pass' };

  const [profileUser, setProfileUser] = useState(null);
  const [dayPlanner, setDayPlanner] = useState(null); // { dateStr, name } — whose day we're planning
  const [plannerSearch, setPlannerSearch] = useState('');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = next, -1 = last

  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

  const teamData = SALESMEN.map(name => {
    const statuses = loadStatuses(name);
    const route = loadRoute(name);
    const visitLog = loadVisitLog(name);
    const activeStatuses = Object.entries(statuses).filter(([, s]) => s !== 'pass');
    const passStatuses = Object.entries(statuses).filter(([, s]) => s === 'pass');
    return { name, statuses, route, visitLog, activeStatuses, passStatuses };
  });

  // Overlap detection
  const builderMap = {};
  teamData.forEach(({ name, statuses, route }) => {
    Object.entries(statuses).forEach(([id, status]) => {
      if (status === 'pass') return;
      const p = PERMITS.find(p => String(p.id) === String(id)); if (!p) return;
      const key = p.builder.toLowerCase().trim();
      if (!builderMap[key]) builderMap[key] = [];
      builderMap[key].push({ user: name, permitId: id, address: p.address, status, builder: p.builder });
    });
    route.forEach(p => {
      const key = p.builder.toLowerCase().trim();
      if (!builderMap[key]) builderMap[key] = [];
      if (!builderMap[key].find(e => e.user === name && e.permitId === String(p.id)))
        builderMap[key].push({ user: name, permitId: String(p.id), address: p.address, status: 'route', builder: p.builder });
    });
  });
  const conflicts = Object.entries(builderMap).filter(([, entries]) => [...new Set(entries.map(e => e.user))].length > 1);

  // ── Profile Page ──────────────────────────────────────────────────────────
  if (profileUser) {
    const d = teamData.find(t => t.name === profileUser);
    const visitLog = loadVisitLog(profileUser);
    const totalVisited = d.activeStatuses.length;
    const byStatus = { called: 0, quoted: 0, won: 0 };
    d.activeStatuses.forEach(([, s]) => { if (byStatus[s] !== undefined) byStatus[s]++; });

    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: T.bg, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', borderBottom: `1px solid ${T.cardBorder}`, background: T.card }}>
          <button onClick={() => setProfileUser(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: T.text, padding: '0 4px', fontFamily: 'inherit' }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: profileUser === activeUser ? T.blue : T.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: profileUser === activeUser ? '#fff' : T.textSub }}>{profileUser[0]}</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>{profileUser} {profileUser === activeUser && <span style={{ fontSize: 11, color: T.blue }}>(you)</span>}</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>Salesman Profile</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 24px' }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
            {[
              { label: 'Visited', value: totalVisited, color: T.blue },
              { label: 'Called', value: byStatus.called, color: '#f59e0b' },
              { label: 'Quoted', value: byStatus.quoted, color: '#8b5cf6' },
              { label: 'Won', value: byStatus.won, color: '#16a34a' },
            ].map(s => (
              <div key={s.label} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center', boxShadow: T.shadow }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center', boxShadow: T.shadow }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#9ca3af' }}>{d.passStatuses.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Passed</div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center', boxShadow: T.shadow }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{d.route.length}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>On Route</div>
            </div>
          </div>

          {/* Visit history */}
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>📋 Visit History</div>
          {visitLog.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textMuted, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No logged visits yet — statuses set going forward will appear here.</div>
          ) : (
            visitLog.map((entry, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{entry.builder}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{entry.address?.split(',')[0]} {entry.city ? `· ${entry.city}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[entry.status], background: `${statusColors[entry.status]}18`, padding: '2px 8px', borderRadius: 5, display: 'block', marginBottom: 3 }}>{statusLabels[entry.status]}</span>
                  <span style={{ fontSize: 10, color: T.textMuted }}>{entry.date}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Day Planner ──────────────────────────────────────────────────────────
  if (dayPlanner) {
    const { dateStr, name } = dayPlanner;
    const dayRoute = ((allDailyRoutes[name] || {})[dateStr] || []);
    const isOwn = name === activeUser;
    const d = new Date(dateStr + 'T12:00:00');
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const filteredPermits = PERMITS.filter(p => {
      if (!plannerSearch.trim()) return true;
      const q = plannerSearch.toLowerCase();
      return (p.builder || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q);
    }).slice(0, 30);

    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: T.bg, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', borderBottom: `1px solid ${T.cardBorder}`, background: T.card }}>
          <button onClick={() => { setDayPlanner(null); setPlannerSearch(''); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: T.text, padding: '0 4px', fontFamily: 'inherit' }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>🗓 {name}'s Route</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{dayLabel}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{dayRoute.length} stop{dayRoute.length !== 1 ? 's' : ''}</div>
            {dayRoute.length > 0 && (() => {
              // Build Apple Maps multi-stop directions URL
              const stops = dayRoute.map(p => encodeURIComponent((p.address || '') + (p.city ? ', ' + p.city + ', OK' : ', OK')));
              let mapsUrl;
              if (stops.length === 1) {
                mapsUrl = `maps://?daddr=${stops[0]}&dirflg=d`;
              } else {
                // Apple Maps multi-stop: daddr=stop1+to:stop2+to:stop3
                const chain = stops.join('+to:');
                mapsUrl = `maps://?daddr=${chain}&dirflg=d`;
              }
              return (
                <a href={mapsUrl} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9, background: T.blue, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  🗺 Map Route
                </a>
              );
            })()}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 24px' }}>
          {/* Planned stops */}
          {dayRoute.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Planned Stops</div>
              {dayRoute.map((p, idx) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', background: T.blue, color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{p.builder}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{p.address?.split(',')[0]}{p.city ? ` · ${p.city}` : ''}</div>
                    </div>
                  </div>
                  {isOwn && <button onClick={() => removeFromDailyRoute(dateStr, p.id)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#dc2626', padding: '4px 6px' }}>✕</button>}
                </div>
              ))}
            </div>
          )}

          {/* Add permits (own day only) */}
          {isOwn && (
            <div>
              {/* Import from route */}
              {myRoute && myRoute.length > 0 && (() => {
                const importable = myRoute.filter(p => !dayRoute.find(r => r.id === p.id));
                return importable.length > 0 ? (
                  <button onClick={() => importable.forEach(p => addToDailyRoute(dateStr, p))} style={{ width: '100%', padding: '11px 16px', borderRadius: 10, background: T.blueLight, border: `1.5px dashed ${T.blue}`, color: T.blue, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    📥 Import my route ({importable.length} builder{importable.length !== 1 ? 's' : ''})
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', marginBottom: 14, fontStyle: 'italic' }}>✓ All route builders already added</div>
                );
              })()}
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Add Builders</div>
              <input
                value={plannerSearch}
                onChange={e => setPlannerSearch(e.target.value)}
                placeholder="Search by name, address, city..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.cardBorder}`, fontSize: 14, fontFamily: 'inherit', background: T.card, color: T.text, boxSizing: 'border-box', marginBottom: 10, outline: 'none' }}
              />
              {filteredPermits.map(p => {
                const already = dayRoute.find(r => r.id === p.id);
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${T.cardBorder}`, opacity: already ? 0.4 : 1 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.builder}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{p.address?.split(',')[0]}{p.city ? ` · ${p.city}` : ''}</div>
                    </div>
                    <button onClick={() => { if (!already) addToDailyRoute(dateStr, p); }} disabled={!!already} style={{ padding: '6px 14px', borderRadius: 8, background: already ? T.bg : T.blue, color: already ? T.textMuted : '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: already ? 'default' : 'pointer', fontFamily: 'inherit' }}>{already ? '✓' : '+ Add'}</button>
                  </div>
                );
              })}
              {filteredPermits.length === 0 && <div style={{ fontSize: 13, color: T.textMuted, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>No results</div>}
            </div>
          )}
          {!isOwn && dayRoute.length === 0 && <div style={{ fontSize: 13, color: T.textMuted, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No stops planned for this day.</div>}
        </div>
      </div>
    );
  }

  // ── Main Team View ────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: T.bg, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 10px', borderBottom: `1px solid ${T.cardBorder}`, background: T.card }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: T.text, padding: '0 4px', fontFamily: 'inherit' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>👥 Team</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: T.textMuted, padding: '0 2px', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
            <span style={{ fontSize: 11, color: weekOffset === 0 ? T.blue : T.textMuted, fontWeight: weekOffset === 0 ? 700 : 400 }}>
              {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekOffset === -1 ? 'Last week' : `${weekOffset > 0 ? '+' : ''}${weekOffset}w`}
              {' · '}{monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: T.textMuted, padding: '0 2px', fontFamily: 'inherit', lineHeight: 1 }}>›</button>
            {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ fontSize: 10, color: T.blue, background: T.blueLight, border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Today</button>}
          </div>
        </div>
        {conflicts.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>⚠️ {conflicts.length}</div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 24px' }}>
        {/* Overlaps */}
        {conflicts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>⚠️ OVERLAPPING BUILDERS</div>
            {conflicts.map(([key, entries]) => {
              const builderName = entries[0].builder;
              const byUser = {};
              entries.forEach(e => { if (!byUser[e.user]) byUser[e.user] = []; byUser[e.user].push(e); });
              return (
                <div key={key} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b', marginBottom: 6 }}>{builderName}</div>
                  {Object.entries(byUser).map(([user, items]) => (
                    <div key={user} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, minWidth: 52 }}>{user}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {items.map((e, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, color: statusColors[e.status] || T.textSub, background: `${(statusColors[e.status] || '#ccc')}22`, padding: '2px 6px', borderRadius: 4 }}>{statusLabels[e.status] || e.status}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Per-salesman cards */}
        {teamData.map(({ name, route, activeStatuses, passStatuses }) => (
          <div key={name} style={{ marginBottom: 20, background: T.card, borderRadius: 14, border: `1px solid ${T.cardBorder}`, overflow: 'hidden', boxShadow: T.shadow }}>
            {/* Salesman header — tappable → profile */}
            <button onClick={() => setProfileUser(name)} style={{ width: '100%', padding: '12px 14px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', gap: 10, background: name === activeUser ? T.blueLight : T.card, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: name === activeUser ? T.blue : T.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: name === activeUser ? '#fff' : T.textSub, flexShrink: 0 }}>{name[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: name === activeUser ? T.blue : T.text }}>{name} {name === activeUser && <span style={{ fontSize: 10, fontWeight: 600 }}>(you)</span>}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{route.length} route · {activeStatuses.length} active · {passStatuses.length} passed</div>
              </div>
              <span style={{ fontSize: 16, color: T.textMuted }}>›</span>
            </button>

            {/* Weekly calendar strip — each day tappable */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {weekDays.map((d, i) => {
                const ds = d.toISOString().slice(0, 10);
                const isToday = ds === todayStr;
                const dayStops = ((allDailyRoutes[name] || {})[ds] || []);
                const isOwn = name === activeUser;
                return (
                  <button key={i} onClick={() => setDayPlanner({ dateStr: ds, name })} style={{ padding: '8px 2px', background: isToday ? T.blueLight : 'transparent', borderRight: i < 6 ? `1px solid ${T.cardBorder}` : 'none', borderBottom: 'none', borderTop: `1px solid ${T.cardBorder}`, borderLeft: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: isToday ? T.blue : T.textMuted, textTransform: 'uppercase' }}>{DAY_LABELS[i]}</div>
                    <div style={{ fontSize: 14, fontWeight: isToday ? 800 : 500, color: isToday ? T.blue : T.text, marginTop: 1 }}>{d.getDate()}</div>
                    {dayStops.length > 0 && (
                      <div style={{ marginTop: 3, fontSize: 9, fontWeight: 700, background: `${T.blue}22`, color: T.blue, borderRadius: 3, padding: '1px 3px' }}>{dayStops.length}</div>
                    )}
                    {isOwn && isToday && dayStops.length === 0 && (
                      <div style={{ marginTop: 3, fontSize: 10, color: T.textMuted }}>+</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active statuses summary */}
            {activeStatuses.length > 0 && (
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>📋 Active ({activeStatuses.length})</div>
                {activeStatuses.slice(0, 5).map(([id, status]) => {
                  const permit = PERMITS.find(p => String(p.id) === String(id));
                  if (!permit) return null;
                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${T.cardBorder}` }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{permit.builder}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColors[status], background: `${statusColors[status]}18`, padding: '2px 7px', borderRadius: 5 }}>{statusLabels[status]}</span>
                    </div>
                  );
                })}
                {activeStatuses.length > 5 && <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 6 }}>+{activeStatuses.length - 5} more — tap name to see all</div>}
              </div>
            )}
            {activeStatuses.length === 0 && <div style={{ padding: '12px 14px', fontSize: 12, color: T.textMuted, fontStyle: 'italic' }}>No active builders yet.</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PermitMap() {
  const [activeUser, setActiveUser] = useState(() => loadSession());  if (!activeUser) return <LoginScreen onLogin={setActiveUser} />;
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
  const [teamView, setTeamView] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dailyRoutes, setDailyRoutes] = useState(() => loadDailyRoutes(activeUser));
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

  const setStatus = useCallback((id, statusKey, permit) => {
    setStatuses(prev => {
      const updated = statusKey ? { ...prev, [id]: statusKey } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id));
      saveStatuses(activeUser, updated);
      return updated;
    });
    if (permit && statusKey && statusKey !== 'pass') logVisit(activeUser, permit, statusKey);
  }, [activeUser]);

  const addToDailyRoute = useCallback((dateStr, permit) => {
    setDailyRoutes(prev => {
      const day = prev[dateStr] || [];
      if (day.find(p => p.id === permit.id)) return prev;
      const updated = { ...prev, [dateStr]: [...day, permit] };
      saveDailyRoutes(activeUser, updated);
      return updated;
    });
  }, [activeUser]);

  const removeFromDailyRoute = useCallback((dateStr, permitId) => {
    setDailyRoutes(prev => {
      const updated = { ...prev, [dateStr]: (prev[dateStr] || []).filter(p => p.id !== permitId) };
      saveDailyRoutes(activeUser, updated);
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!(p.builder || '').toLowerCase().includes(q) &&
            !(p.address || '').toLowerCase().includes(q) &&
            !(p.city || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [permits, customOnly, currentCity, currentMonth, searchQuery]);

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
              <span style={{ color: T.text, fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>IST Intel</span>
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
          position: 'absolute', top: 'calc(180px + env(safe-area-inset-top, 0px))', right: 12, zIndex: 20,
          padding: '10px 16px', borderRadius: 10,
          background: T.blue, border: 'none',
          color: '#fff', cursor: 'pointer', boxShadow: T.shadow,
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        }}>🗺 Route ({routeList.length})</button>
      )}

      {/* Team button */}
      {!selected && (
        <button onClick={() => { setTeamView(true); setShowRoutePanel(false); setShowTeamPanel(false); setPanelOpen(false); }} style={{
          position: 'absolute', top: 'calc(132px + env(safe-area-inset-top, 0px))', right: 12, zIndex: 20,
          padding: '10px 16px', borderRadius: 10,
          background: T.card,
          border: `1px solid ${T.cardBorder}`,
          color: T.text,
          cursor: 'pointer', boxShadow: T.shadow,
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        }}>👥 Team</button>
      )}

      {/* Team Full Page */}
      {teamView && <TeamPage activeUser={activeUser} onClose={() => setTeamView(false)} permits={permits} dailyRoutes={dailyRoutes} addToDailyRoute={addToDailyRoute} removeFromDailyRoute={removeFromDailyRoute} myRoute={routeList} />}

      {/* Team Panel (legacy, unused) */}
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
          <div style={cardTitle}>Search & Legend</div>
          <input
            type="text"
            placeholder="Filter builders…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: `1px solid ${T.cardBorder}`,
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'inherit',
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>
            {PERMITS.filter(p => !searchQuery.trim() || (p.builder || '').toLowerCase().includes(searchQuery.toLowerCase())).length} of {PERMITS.length} permits
          </div>
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
            padding: '14px 16px',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
            boxShadow: T.shadowLg,
            maxHeight: '35vh', overflowY: 'auto',
          }}>
          {/* Drag handle */}
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 10px' }} />

          {/* Header — compact */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, lineHeight: 1.1 }}>{selected.builder}</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                {selected.address}
              </div>
              {selected.week && (
                <div style={{ fontSize: 11, color: T.textSub, marginTop: 4, fontWeight: 600 }}>
                  Week: {selected.week}
                </div>
              )}
            </div>
            <button onClick={closeDetail} style={{ ...ghostBtn, marginLeft: 8, flexShrink: 0, padding: '4px 8px' }}>✕</button>
          </div>

          {/* Stats — compact */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
            {[
              { l: 'Value', v: Number(selected.value) > 0 ? fmt(Number(selected.value)) : 'N/A' },
              { l: 'Sq Ft', v: Number(selected.sqft) > 0 ? Number(selected.sqft).toLocaleString() : 'N/A' },
            ].map(f => (
              <div key={f.l} style={{ background: T.bg, borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Phone — tap to call */}
          {selected.phone && selected.phone !== 'N/A' && (
            <a href={`tel:${selected.phone.replace(/\D/g,'')}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '10px 0', borderRadius: 10, marginBottom: 8,
              background: T.greenLight, border: `1.5px solid ${T.greenBorder}`,
              color: T.green, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>
              📞 {selected.phone}
            </a>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 0 }}>
            <a href={`maps://maps.apple.com/?q=${encodeURIComponent(selected.address + ', ' + selected.city + ', OK')}&ll=${selected.lat},${selected.lng}`}
              target="_blank" rel="noopener noreferrer" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '10px 0', borderRadius: 10,
                background: T.blueLight, border: `1.5px solid ${T.blueBorder}`,
                color: T.blue, fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>
              📍 Maps
            </a>
            <button onClick={() => addToRoute(selected)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              background: isInRoute ? T.blueLight : T.bg,
              border: isInRoute ? `1.5px solid ${T.blueBorder}` : `1px solid ${T.cardBorder}`,
              color: isInRoute ? T.blue : T.textSub,
              fontSize: 13, fontWeight: 700,
            }}>
              {isInRoute ? '✓ Added' : '＋ Route'}
            </button>
            <button onClick={() => { setSelectedPermit(selected); setShowVisitModal(true); }} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              background: T.blueLight,
              border: `1.5px solid ${T.blueBorder}`,
              color: T.blue,
              fontSize: 13, fontWeight: 700,
            }}>
              📝 Visit
            </button>
          </div>

          {/* Map Route button — hidden in compact view */}

          {/* Notes — collapsed in compact view */}
          <details style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}>Notes</summary>
            <textarea
              value={noteText || notes[selected.id] || ''}
              onChange={e => setNoteText(e.target.value)}
              onBlur={e => saveNote(selected.id, e.target.value)}
              placeholder="Add a note…"
              rows={2}
              style={{
                width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${T.cardBorder}`, background: T.bg,
                color: T.text, fontSize: 12, fontFamily: 'inherit', resize: 'none',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </details>

          {/* Status tags — collapsed */}
          <details style={{ marginBottom: 8 }}>
            <summary style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, cursor: 'pointer' }}>Status</summary>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {STATUSES.map(s => {
                const active = statuses[selected.id] === s.key;
                return (
                  <button key={s.key} onClick={() => setStatus(selected.id, active ? null : s.key, selected)} style={{
                    padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? s.color : T.bg,
                    border: active ? `1.5px solid ${s.color}` : `1px solid ${T.cardBorder}`,
                    color: active ? '#fff' : T.textSub,
                    transition: 'all 0.15s',
                  }}>{s.label}</button>
                );
              })}
            </div>
          </details>

          {/* Builder type badge — hidden in compact view */}
        </div>
      )}

      {/* Search Panel */}
      {/* Visit Modal */}
      {showVisitModal && selectedPermit && (
        <VisitModal 
          permit={selectedPermit}
          salesman={activeUser}
          onClose={() => {
            setShowVisitModal(false);
            setSelectedPermit(null);
          }}
        />
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
