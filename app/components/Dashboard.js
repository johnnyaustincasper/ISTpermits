'use client';

import { useEffect, useState, useMemo } from 'react';
import { PERMITS } from '../../lib/permits';
import { PHASES, INSULATION_TYPES, getFollowUpReminders, completeReminder } from '../../lib/phaseTracking';
import { getVisitsForSalesman } from '../../lib/visitTracking';

const LG = {
  bg: 'rgba(255, 255, 255, 0.5)',
  card: 'rgba(255, 255, 255, 0.7)',
  cardBorder: 'rgba(255, 255, 255, 0.5)',
  text: '#1a1a2e',
  textSub: '#6b7280',
  textMuted: '#9ca3af',
  blue: '#2563eb',
  indigo: '#4f46e5',
  green: '#10b981',
  accent: 'rgba(79, 70, 229, 0.1)',
  accentBorder: 'rgba(79, 70, 229, 0.3)',
};

const glassStyle = (opacity = 0.7) => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.6)',
  boxShadow: '0 4px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
});

export default function Dashboard({ salesman, permits, onClose, onSelectBuilder }) {
  const [tab, setTab] = useState('analytics'); // analytics | timeline | reminders
  const [visits, setVisits] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [filterBuilder, setFilterBuilder] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [salesman]);

  async function loadData() {
    setLoading(true);
    const visitList = await getVisitsForSalesman(salesman);
    const reminderList = await getFollowUpReminders(salesman);
    setVisits(visitList);
    setReminders(reminderList);
    setLoading(false);
  }

  // Builder analytics
  const builderStats = useMemo(() => {
    const stats = {};
    PERMITS.forEach(p => {
      if (!stats[p.builder]) {
        stats[p.builder] = {
          builder: p.builder,
          totalPermits: 0,
          contact: p.contact || '',
          phone: p.phone || '',
          permitIds: [],
          phases: {},
          insulationTypes: new Set(),
          avgValue: 0,
          totalValue: 0,
        };
      }
      stats[p.builder].totalPermits++;
      stats[p.builder].permitIds.push(p.id);
      stats[p.builder].totalValue += Number(p.value) || 0;
    });

    // Add visit & phase data
    Object.keys(stats).forEach(builder => {
      const s = stats[builder];
      s.avgValue = Math.round(s.totalValue / s.totalPermits);
      s.visitCount = visits.filter(v => v.builderName === builder).length;
      s.lastVisit = visits
        .filter(v => v.builderName === builder)
        .sort((a, b) => b.visitDate - a.visitDate)[0]?.visitDate;
    });

    return Object.values(stats).sort((a, b) => b.totalPermits - a.totalPermits);
  }, [visits]);

  const filteredBuilders = useMemo(() => {
    return builderStats.filter(s => {
      if (filterBuilder && !s.builder.toLowerCase().includes(filterBuilder.toLowerCase())) return false;
      return true;
    });
  }, [builderStats, filterBuilder]);

  const upcomingReminders = reminders.filter(r => new Date(r.reminderDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'linear-gradient(135deg, rgba(240,242,245,0.95) 0%, rgba(248,250,252,0.95) 100%)',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Header */}
      <div style={{ ...glassStyle(0.85), padding: '16px', borderBottom: `1px solid rgba(255,255,255,0.6)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: LG.text, margin: 0 }}>📊 Builder Intel</h1>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: LG.textMuted }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid rgba(255,255,255,0.6)`, background: 'rgba(255,255,255,0.3)' }}>
        {['analytics', 'timeline', 'reminders'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: tab === t ? 'rgba(255,255,255,0.8)' : 'transparent',
              border: 'none',
              borderBottom: tab === t ? `3px solid ${LG.blue}` : 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: tab === t ? LG.blue : LG.textMuted,
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {t === 'analytics' && '📈 Analytics'}
            {t === 'timeline' && '📅 Timeline'}
            {t === 'reminders' && '⏰ Reminders'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {tab === 'analytics' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Filter builders…"
                value={filterBuilder}
                onChange={e => setFilterBuilder(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  ...glassStyle(0.9),
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filteredBuilders.map(s => (
                <div
                  key={s.builder}
                  onClick={() => {
                    onSelectBuilder(s.builder);
                    onClose();
                  }}
                  style={{
                    ...glassStyle(0.8),
                    borderRadius: 12,
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid rgba(79, 70, 229, 0.3)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.boxShadow = '0 4px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: LG.text, marginBottom: 2 }}>{s.builder}</div>
                  {s.phone && (
                    <div style={{ fontSize: 12, color: LG.blue, marginBottom: 10, fontWeight: 600 }}>
                      📞 {s.phone}
                    </div>
                  )}
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div style={{ background: 'rgba(79, 70, 229, 0.1)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 11, color: LG.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Permits</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: LG.indigo }}>{s.totalPermits}</div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 11, color: LG.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Visits</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: LG.green }}>{s.visitCount || 0}</div>
                    </div>
                  </div>

                  {s.contact && (
                    <div style={{ fontSize: 12, color: LG.textSub, marginBottom: 6 }}>
                      <strong>Contact:</strong> {s.contact}
                    </div>
                  )}

                  {s.lastVisit && (
                    <div style={{ fontSize: 11, color: LG.textMuted, marginBottom: 8 }}>
                      Last visit: {s.lastVisit.toLocaleDateString()}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: LG.textMuted }}>
                    Avg permit: ${Math.round(s.avgValue / 1000)}k
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', color: LG.textMuted, padding: '40px 0' }}>Loading…</div>
            ) : visits.length === 0 ? (
              <div style={{ textAlign: 'center', color: LG.textMuted, padding: '40px 0' }}>No visits yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visits.sort((a, b) => b.visitDate - a.visitDate).map(v => (
                  <div key={v.id} style={{ ...glassStyle(0.8), borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: LG.text }}>{v.builderName}</div>
                        <div style={{ fontSize: 11, color: LG.textMuted, marginTop: 2 }}>
                          {v.visitDate.toLocaleDateString()} at {v.visitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: LG.textMuted }}>{v.salesman}</div>
                    </div>
                    {v.notes && (
                      <div style={{ fontSize: 12, color: LG.textSub, fontStyle: 'italic', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.4)' }}>
                        "{v.notes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reminders' && (
          <div>
            {upcomingReminders.length === 0 ? (
              <div style={{ textAlign: 'center', color: LG.textMuted, padding: '40px 0' }}>No upcoming reminders</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingReminders.map(r => (
                  <div
                    key={r.id}
                    style={{
                      ...glassStyle(0.8),
                      borderRadius: 10,
                      padding: 12,
                      borderLeft: `4px solid ${LG.blue}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: LG.text }}>{r.builderName}</div>
                        <div style={{ fontSize: 12, color: LG.textMuted, marginTop: 2 }}>
                          📅 {r.reminderDate.toLocaleDateString()} at {r.reminderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={() => { completeReminder(r.id); loadData(); }}
                        style={{
                          background: LG.green,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Done
                      </button>
                    </div>
                    {r.notes && (
                      <div style={{ fontSize: 12, color: LG.textSub, marginTop: 8 }}>
                        {r.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
