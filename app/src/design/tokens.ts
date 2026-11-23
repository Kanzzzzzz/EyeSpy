/**
 * EyeSpy design tokens: the single source for colour, type, spacing, radii
 * and motion. Tailwind reads this file (tailwind.config.ts), and components
 * import it for anything Tailwind can't express (SVG fills, canvas effects,
 * animation timings).
 *
 * Look: "sakuga night". Anime title-card energy on a dark manga page:
 * paper-white panel borders, hard offset shadows, speed lines, screentone,
 * one hot crimson, an electric cyan for eye contact and a gold spotlight.
 * Never use a raw hex outside this file.
 */

export const color = {
  // The page: backgrounds and surfaces, darkest first.
  ink: {
    950: '#05050B',
    900: '#0A0A15',
    850: '#10101E',
    800: '#16162A',
    700: '#20203D',
    600: '#2F2F58',
    500: '#45457E',
    400: '#6A6AA8',
    300: '#9B9BCC',
    200: '#C9C9E8',
  },
  // Manga paper white: panel borders and text.
  paper: { DEFAULT: '#F7F2E8', dim: '#CFC8B8', faint: '#8C8677' },
  // The spotlight: gold.
  spot: { DEFAULT: '#FFC83A', soft: '#FFE08A', deep: '#E29A00', glow: 'rgba(255, 200, 58, 0.38)' },
  // Hot accents.
  crimson: { DEFAULT: '#FF2D55', deep: '#B5002B', glow: 'rgba(255, 45, 85, 0.45)' },
  cyan: { DEFAULT: '#2EE6FF', deep: '#0096B4', glow: 'rgba(46, 230, 255, 0.45)' },
  violet: { DEFAULT: '#A66BFF', deep: '#6A2BD9', glow: 'rgba(166, 107, 255, 0.45)' },
  // Teams. Each also has an icon and a pattern, so colour is never the only cue.
  team: {
    killers: '#FF3B5C',
    town: '#3DD6FF',
    alone: '#B07CFF',
  },
  ok: '#5CF2A5',
  warn: '#FFC83A',
  danger: '#FF3B5C',
} as const;

/** A token colour with transparency, for gradients and glows: alpha(color.spot.DEFAULT, 0.4). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const font = {
  display: '"Anton", "Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif',
  body: '"Outfit Variable", "Outfit", system-ui, sans-serif',
  // Decorative Japanese lettering uses the phone's own CJK font (nothing bundled).
  jp: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
} as const;

/** Type scale in px: [size, line-height]. */
export const type = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [19, 26],
  xl: [23, 28],
  '2xl': [29, 32],
  '3xl': [38, 40],
  '4xl': [50, 50],
  '5xl': [68, 64],
  '6xl': [92, 84],
} as const;

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '22px',
  full: '9999px',
} as const;

/** Minimum tap target, from the accessibility goals. */
export const TAP = 48;

/**
 * Motion: anime timing. Snappy anticipation, overshoot on springs, and holds
 * on the big moments.
 */
export const motion = {
  fast: 0.12,
  base: 0.22,
  slow: 0.4,
  dramatic: 0.8,
  ease: [0.22, 1, 0.36, 1] as const,
  easeIn: [0.55, 0, 1, 0.45] as const,
  /** Buttons and panels: squash then overshoot. */
  spring: { type: 'spring', stiffness: 520, damping: 22 } as const,
  bouncy: { type: 'spring', stiffness: 640, damping: 14 } as const,
  soft: { type: 'spring', stiffness: 240, damping: 26 } as const,
  snap: { type: 'spring', stiffness: 900, damping: 30 } as const,
} as const;

export const shadow = {
  /** The hard manga offset shadow. */
  hard: '4px 4px 0 0 #000',
  hardCrimson: '4px 4px 0 0 #FF2D55',
  hardCyan: '4px 4px 0 0 #2EE6FF',
  card: '0 14px 30px -14px rgba(0, 0, 0, 0.85)',
  spot: '0 0 0 3px #FFC83A, 0 0 26px rgba(255, 200, 58, 0.5)',
  cyan: '0 0 0 3px #2EE6FF, 0 0 30px rgba(46, 230, 255, 0.55)',
  crimson: '0 0 0 3px #FF2D55, 0 0 30px rgba(255, 45, 85, 0.55)',
  lift: '0 18px 40px -16px rgba(0, 0, 0, 0.85)',
} as const;

export type TeamKey = keyof typeof color.team;
