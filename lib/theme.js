export const LIQUID_GLASS = {
  // Base colors
  bg: 'linear-gradient(135deg, rgba(240,242,245,0.95) 0%, rgba(248,250,252,0.95) 100%)',
  text: '#1a1a2e',
  textSub: '#6b7280',
  textMuted: '#9ca3af',
  
  // Accent colors
  blue: '#2563eb',
  indigo: '#4f46e5',
  green: '#10b981',
  orange: '#ea580c',
  red: '#ef4444',
  
  // Glass effects
  card: 'rgba(255, 255, 255, 0.7)',
  cardLight: 'rgba(255, 255, 255, 0.8)',
  cardDark: 'rgba(255, 255, 255, 0.5)',
  cardBorder: 'rgba(255, 255, 255, 0.6)',
  
  accent: 'rgba(79, 70, 229, 0.1)',
  accentBorder: 'rgba(79, 70, 229, 0.3)',
};

export const glassStyle = (opacity = 0.7) => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid rgba(255, 255, 255, 0.6)`,
  boxShadow: '0 4px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
});

export const glassButton = (color = '#2563eb') => ({
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: color,
  color: '#fff',
  cursor: 'pointer',
  boxShadow: `0 4px 12px rgba(${color === '#2563eb' ? '37, 99, 235' : '255, 255, 255'}, 0.3)`,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'all 0.2s ease',
  backdropFilter: 'blur(10px)',
});

export const glassButtonGhost = () => ({
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255, 255, 255, 0.6)',
  background: 'rgba(255, 255, 255, 0.3)',
  color: LIQUID_GLASS.text,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'all 0.2s ease',
  backdropFilter: 'blur(10px)',
});
