/**
 * EyeSpy design tokens: the single source for colour, type, spacing, radii
 * and motion. Tailwind reads this file (tailwind.config.ts), and components
 * import it for anything Tailwind can't express (SVG fills, animation timings).
 *
 * Look: "playful noir". Deep ink-blue night, one warm spotlight colour,
 * chunky rounded shapes. Never use a raw hex outside this file.
 */

export const color = {
  // The night: backgrounds and surfaces, darkest first.
  ink: {
    950: '#070B17',
    900: '#0B1020',
    850: '#10172D',
    800: '#151E3A',
    700: '#1E2A52',
    600: '#2B3A6E',
    500: '#3D4F8F',
    400: '#5F72B3',
    300: '#8C9BD0',
    200: '#B9C3E6',
  },
  // Warm paper white for text; never pure white on the dark ground.
  paper: { DEFAULT: '#F4EEDF', dim: '#C9C2B2', faint: '#8E8879' },
  // The one warm spotlight colour.
  spot: { DEFAULT: '#FFB547', soft: '#FFD58A', deep: '#E08A12', glow: 'rgba(255, 181, 71, 0.35)' },
  // Teams. Each also has an icon and a pattern, so colour is never the only cue.
  team: {
    killers: '#FF5A6E',
    town: '#5AB0FF',
    alone: '#C792FF',
  },
  ok: '#6EE7B7',
  warn: '#FFB547',
  danger: '#FF5A6E',
  // Avatar skin tones and accents.
  skin: ['#F7D7C4', '#EDBB99', '#D9A066', '#B9774E', '#8D5524', '#5C3A21'],
  accent: ['#FF7A59', '#FFC145', '#7BD389', '#4FC3F7', '#9B8CFF', '#FF6FB5', '#2EC4B6', '#F4EEDF'],
} as const;

export const font = {
  display: '"Fraunces Variable", "Fraunces", Georgia, serif',
  body: '"Outfit Variable", "Outfit", system-ui, sans-serif',
} as const;

/** Type scale in px: [size, line-height]. */
export const type = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [19, 26],
  xl: [23, 30],
  '2xl': [29, 34],
  '3xl': [37, 40],
  '4xl': [48, 50],
  '5xl': [64, 64],
} as const;

export const radius = {
  sm: '10px',
  md: '16px',
  lg: '22px',
  xl: '30px',
  full: '9999px',
} as const;

/** Minimum tap target, from the accessibility goals. */
export const TAP = 48;

/** Motion timings (seconds) and easings, shared by Motion and CSS. */
export const motion = {
  fast: 0.14,
  base: 0.24,
  slow: 0.42,
  dramatic: 0.8,
  ease: [0.22, 1, 0.36, 1] as const,
  easeIn: [0.55, 0, 1, 0.45] as const,
  spring: { type: 'spring', stiffness: 420, damping: 30 } as const,
  bouncy: { type: 'spring', stiffness: 520, damping: 18 } as const,
  soft: { type: 'spring', stiffness: 200, damping: 26 } as const,
} as const;

export const shadow = {
  card: '0 10px 30px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  spot: '0 0 0 2px #FFB547, 0 0 28px rgba(255, 181, 71, 0.45)',
  lift: '0 18px 40px -16px rgba(0, 0, 0, 0.75)',
} as const;

export type TeamKey = keyof typeof color.team;
