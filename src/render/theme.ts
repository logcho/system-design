export type ThemeName = 'light' | 'dark';

export interface DiagramTheme {
  /** Which accent palette to use for named colors. */
  mode: ThemeName;
  font: string;
  selection: string;
  radius: number;
  weights: { title: number; node: number; group: number };
  edgeWidth: number;
  background: string;
  dot: string;
  text: string;
  mutedText: string;
  nodeFill: string;
  nodeStroke: string;
  edge: string;
  labelBg: string;
  groupFill: string;
  groupStroke: string;
}

const FONT = "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const THIN = { title: 250, node: 400, group: 400 };

/** Diagram palettes. Exports use these exact values. */
export const THEMES: Record<ThemeName, DiagramTheme> = {
  light: {
    mode: 'light',
    font: FONT,
    selection: '#3254f0',
    radius: 10,
    weights: THIN,
    edgeWidth: 1.25,
    background: '#f6f7f9',
    dot: '#dcdfe5',
    text: '#1c1f26',
    mutedText: '#6b717d',
    nodeFill: '#ffffff',
    nodeStroke: '#dadde3',
    edge: '#8a909b',
    labelBg: '#f6f7f9',
    groupFill: 'rgba(255, 255, 255, 0.55)',
    groupStroke: '#dadde3',
  },
  dark: {
    mode: 'dark',
    font: FONT,
    selection: '#8097ff',
    radius: 10,
    weights: THIN,
    edgeWidth: 1.25,
    background: '#121317',
    dot: '#25272e',
    text: '#e8eaee',
    mutedText: '#8e94a0',
    nodeFill: '#1d1f25',
    nodeStroke: '#2c2f37',
    edge: '#6c727d',
    labelBg: '#121317',
    groupFill: 'rgba(255, 255, 255, 0.02)',
    groupStroke: '#2c2f37',
  },
};

/** Named palette. Each entry: [light-mode accent, dark-mode accent]. */
const PALETTE: Record<string, [string, string]> = {
  blue: ['#3b6cf6', '#6d93ff'],
  indigo: ['#5b5bd6', '#8b8bff'],
  purple: ['#8e4ec6', '#b48aed'],
  pink: ['#d6409f', '#f07cc1'],
  red: ['#e5484d', '#ff6b70'],
  orange: ['#e8730c', '#ff9a40'],
  yellow: ['#c79500', '#f5c542'],
  green: ['#2f9e5f', '#4cc985'],
  teal: ['#12a594', '#3fd0be'],
  cyan: ['#0894b3', '#3fc5e3'],
  gray: ['#6b7186', '#9aa0b4'],
  grey: ['#6b7186', '#9aa0b4'],
  black: ['#1d2130', '#e7e9f0'],
};

export const COLOR_NAMES = Object.keys(PALETTE).filter((c) => c !== 'grey');

/** Resolve a user-provided color (name or CSS color) to a concrete accent. */
export function resolveColor(color: string | undefined, theme: ThemeName): string | undefined {
  if (!color) return undefined;
  const named = PALETTE[color.toLowerCase()];
  if (named) return theme === 'light' ? named[0] : named[1];
  if (/^#[0-9a-f]{3,8}$/i.test(color) || /^(rgb|hsl)a?\(/i.test(color)) return color;
  return undefined;
}

/** Mix a hex color with transparency for soft fills. */
export function tint(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
