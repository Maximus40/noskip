export const colors = {
  map: '#16171A',
  bg: '#111214',
  card: '#1D1E22',
  cardAlt: '#202125',
  glass: 'rgba(30,31,35,0.66)',
  glassBorder: 'rgba(255,255,255,0.13)',
  offWhite: '#F5F5F0',
  paper: '#ECECE8',
  ink: '#0E0E0F',
  muted: '#A3A4A9',
  accent: '#FF6A3D',
  plates: ['#F5F5F0', '#B9BBC0', '#7C7E84', '#5E6066', '#D9DADD', '#9A9CA1'],
} as const;

export const radii = {
  button: 14,
  card: 20,
  cardLarge: 22,
  glass: 28,
  glassLarge: 34,
  round: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const glass = {
  blurIntensity: 40,
  roundButton: 50,
  roundButtonMain: 70,
} as const;

/** Minimum touch target, in points. */
export const minTouch = 44;
