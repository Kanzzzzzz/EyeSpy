import type { Config } from 'tailwindcss';
import { color, font, radius, shadow, type } from './src/design/tokens';

const fontSize = Object.fromEntries(
  Object.entries(type).map(([k, [size, lh]]) => [k, [`${size}px`, `${lh}px`]]),
) as Record<string, [string, string]>;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replace the default palette entirely: only token colours exist.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000',
      ink: color.ink,
      paper: color.paper,
      spot: color.spot,
      crimson: color.crimson,
      cyan: color.cyan,
      violet: color.violet,
      team: color.team,
      ok: color.ok,
      warn: color.warn,
      danger: color.danger,
    },
    fontFamily: {
      display: [font.display],
      body: [font.body],
      jp: [font.jp],
    },
    fontSize,
    borderRadius: { none: '0', ...radius },
    extend: {
      boxShadow: shadow,
      minHeight: { tap: '48px' },
      minWidth: { tap: '48px' },
      height: { tap: '48px' },
    },
  },
  plugins: [],
} satisfies Config;
