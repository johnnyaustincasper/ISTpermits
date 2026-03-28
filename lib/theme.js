export const LIQUID_GLASS = {
  // Base colors — dark luxury
  bg: '#0A0A0F',
  text: '#F0F0F5',
  textSub: 'rgba(240,240,245,0.55)',
  textMuted: 'rgba(240,240,245,0.35)',

  // Accent colors
  blue: '#00D47E',
  indigo: '#00D47E',
  green: '#00D47E',
  orange: '#f97316',
  red: '#ef4444',
  border: 'rgba(255,255,255,0.08)',
  shadow: '0 4px 24px rgba(0,0,0,0.4)',

  // Glass card surfaces
  card: 'rgba(255,255,255,0.04)',
  cardLight: 'rgba(255,255,255,0.07)',
  cardDark: 'rgba(255,255,255,0.02)',
  cardBorder: 'rgba(255,255,255,0.08)',

  blueLight: 'rgba(0,212,126,0.08)',
  accent: 'rgba(0,212,126,0.08)',
  accentBorder: 'rgba(0,212,126,0.25)',
};

export const glassStyle = (opacity = 0.04) => ({
  background: `rgba(255,255,255,${opacity})`,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
});

export const glassButton = (color = '#00D47E') => ({
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: color,
  color: '#0A0A0F',
  cursor: 'pointer',
  boxShadow: `0 4px 16px rgba(0,212,126,0.25)`,
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
  backdropFilter: 'blur(10px)',
});

export const glassButtonGhost = () => ({
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F0F0F5',
  cursor: 'pointer',
  boxShadow: 'none',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
  backdropFilter: 'blur(10px)',
});
