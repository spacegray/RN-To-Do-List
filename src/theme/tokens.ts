/** Design tokens. Components read colors from useTheme() and never hardcode hex. */

export const palette = {
  coral: '#FF5E57',
  violet: '#4B2BFF',
  violetBright: '#8A75FF',
  pink: '#FFB3D1',
  lime: '#D8F55B',
  paper: '#FAF8F3',
  ink: '#111111',
  night: '#0E0D14',
};

export type ThemeColors = {
  mode: 'light' | 'dark';
  bg: string; grid: string; card: string; cardAlt: string;
  ink: string; muted: string; edge: string; inverseInk: string;
  violet: string; coral: string; pink: string; lime: string;
  onAccent: string; danger: string; scrim: string;
  taupe: string; paper: string; rule: string;
  gradient: [string, string, string];
};

export const light: ThemeColors = {
  mode: 'light',
  bg: palette.paper, grid: 'rgba(17,17,17,0.06)', card: '#FFFFFF', cardAlt: '#F1EEE6',
  ink: palette.ink, muted: '#5F5E66', edge: palette.ink, inverseInk: palette.paper,
  violet: palette.violet, coral: palette.coral, pink: palette.pink, lime: palette.lime,
  onAccent: palette.ink, danger: '#D93A33', scrim: 'rgba(14,13,20,0.55)',
  taupe: '#E9E3D8', paper: '#FFFDF6', rule: '#DCE6F2',
  gradient: [palette.violet, palette.pink, palette.coral],
};

export const dark: ThemeColors = {
  mode: 'dark',
  bg: palette.night, grid: 'rgba(255,255,255,0.055)', card: '#1A1824', cardAlt: '#24212F',
  ink: '#F4F1EA', muted: '#A9A6B6', edge: '#F4F1EA', inverseInk: palette.night,
  violet: palette.violetBright, coral: palette.coral, pink: palette.pink, lime: palette.lime,
  onAccent: palette.ink, danger: '#FF7A73', scrim: 'rgba(0,0,0,0.6)',
  taupe: '#26222C', paper: '#15131D', rule: 'rgba(255,255,255,0.07)',
  gradient: [palette.violetBright, palette.pink, palette.coral],
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const stroke = 2;

export const font = {
  regular: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
  black: 'BricolageGrotesque_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_600SemiBold',
} as const;

export const type = {
  hero: { fontFamily: font.black, fontSize: 36, lineHeight: 38, letterSpacing: -1 },
  title: { fontFamily: font.black, fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
  body: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase' as const },
} as const;

/** Motion: one spring and two durations, so every animation feels related. */
export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.8 },
  fast: 160,
  base: 260,
} as const;

export const minTap = 44;
