'use client';

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
};

export default function SearchPanel({ searchQuery, onSearchChange, filteredCount, totalCount }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        background: T.card,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        zIndex: 20,
        minWidth: 280,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>
        Search Builders
      </div>
      <input
        type="text"
        placeholder="Filter by builder name..."
        value={searchQuery}
        onChange={e => onSearchChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>
        Showing {filteredCount} of {totalCount} permits
      </div>
    </div>
  );
}
