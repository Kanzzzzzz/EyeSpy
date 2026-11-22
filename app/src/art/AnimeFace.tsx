import { motion, useReducedMotion } from 'motion/react';
import { memo, useEffect, useId, useState } from 'react';

/**
 * The EyeSpy anime character kit. Every character is built from shared parts
 * (hair, eyes, brows, mouth, outfit, marks and accessories) described by a
 * `Look`. Eyes and brows are separate layers, so looking at someone, a wink
 * or a raised eyebrow is just an animation of those layers, and a panel can
 * crop to the classic anime eye close-up. Original art, drawn in code.
 */

export type HairStyle =
  | 'spiky'
  | 'wild'
  | 'messy'
  | 'long'
  | 'hime'
  | 'bob'
  | 'twintails'
  | 'ponytail'
  | 'bun'
  | 'slick'
  | 'buzz'
  | 'bald'
  | 'curly'
  | 'sidepart';
export type EyeStyle = 'round' | 'sharp' | 'narrow' | 'big' | 'fierce';
export type BrowStyle = 'soft' | 'sharp' | 'angry' | 'worried';
export type MouthStyle = 'smile' | 'smirk' | 'flat' | 'grin' | 'frown' | 'open';
export type OutfitStyle =
  | 'gakuran'
  | 'coat'
  | 'suit'
  | 'hoodie'
  | 'haori'
  | 'robe'
  | 'armor'
  | 'cloak'
  | 'dress'
  | 'shrine'
  | 'uniform';
export type Mark =
  | 'horns'
  | 'catEars'
  | 'foxEars'
  | 'tanukiEars'
  | 'cap'
  | 'tophat'
  | 'headband'
  | 'headphones'
  | 'tiara'
  | 'halo'
  | 'leaf'
  | 'flower'
  | 'bell'
  | 'hairSticks'
  | 'sideMask'
  | 'glasses'
  | 'monocle'
  | 'eyepatch'
  | 'scar'
  | 'cheekMarks'
  | 'mask'
  | 'talisman'
  | 'eyebags'
  | 'tears'
  | 'sweat'
  | 'bandage'
  | 'earring'
  | 'beard'
  | 'stubble'
  | 'freckles'
  | 'mole'
  | 'blush'
  | 'beads'
  | 'shades';

export interface Look {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  eyes: EyeStyle;
  eyeColor: string;
  brows?: BrowStyle;
  mouth?: MouthStyle;
  outfit: OutfitStyle;
  outfitColor: string;
  /** Trim, tie or lining colour. */
  trim?: string;
  marks?: Mark[];
  /** Signature colour: card backgrounds and auras. */
  accent: string;
}

export type Gaze = 'you' | 'left' | 'right' | 'down' | 'up';
export type Expression = 'neutral' | 'wink' | 'raise' | 'happy' | 'shock' | 'dead' | 'angry' | 'sly' | 'closed';
export type Crop = 'bust' | 'face' | 'eyes';

const LINE = '#16101E';

const VIEWBOX: Record<Crop, string> = {
  bust: '0 0 200 240',
  face: '34 18 132 160',
  eyes: '44 88 112 54',
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const a = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (t - c) * a);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// ---------------------------------------------------------------------------
// Eyes
// ---------------------------------------------------------------------------

interface EyeShape {
  white: string;
  lash: string;
  flick: string;
  lower: string;
  rx: number;
  ry: number;
  slit?: boolean;
}

/** Shapes for the viewer's-left eye, centred at 0,0, outer corner at -x. The right eye is mirrored. */
const EYES: Record<EyeStyle, EyeShape> = {
  round: {
    white: 'M-14 1 C-12 -10 9 -12 14 -1 C11 9 -9 11 -14 1 Z',
    lash: 'M-16 1 C-12 -12 9 -14 15 -2',
    flick: 'M-14 -1 L-19 -6',
    lower: 'M-10 7 C-3 10 6 9 11 4',
    rx: 7.5,
    ry: 9.5,
  },
  big: {
    white: 'M-15 2 C-13 -13 11 -15 15 -2 C12 11 -10 13 -15 2 Z',
    lash: 'M-17 2 C-13 -15 11 -17 16 -3',
    flick: 'M-15 0 L-20 -5',
    lower: 'M-11 8 C-3 12 7 11 12 5',
    rx: 8.5,
    ry: 11,
  },
  sharp: {
    white: 'M-14 -2 C-9 -10 9 -9 14 1 C9 7 -8 7 -14 -2 Z',
    lash: 'M-16 -2 C-9 -12 9 -11 15 0',
    flick: 'M-14 -3 L-20 -9',
    lower: 'M-9 5 C-2 7 6 7 11 3',
    rx: 6.5,
    ry: 7.5,
  },
  narrow: {
    white: 'M-14 0 C-8 -6 9 -6 14 1 C9 6 -8 6 -14 0 Z',
    lash: 'M-16 -1 C-8 -8 9 -8 15 0',
    flick: 'M-14 -1 L-19 -4',
    lower: 'M-9 4 C-2 6 6 6 10 3',
    rx: 6,
    ry: 6,
  },
  fierce: {
    white: 'M-14 -1 C-8 -8 9 -9 14 0 C9 5 -8 5 -14 -1 Z',
    lash: 'M-17 -2 C-8 -11 9 -12 15 -1',
    flick: 'M-15 -3 L-21 -10',
    lower: 'M-9 4 C-2 6 6 6 11 2',
    rx: 5.5,
    ry: 6.5,
    slit: true,
  },
};

const GAZE: Record<Gaze, [number, number]> = {
  you: [0, 0],
  left: [-5, 0],
  right: [5, 0],
  down: [0, 3.5],
  up: [0, -3],
};

function Eye({
  side,
  look,
  gaze,
  closed,
  happy,
  dead,
  shock,
  glow,
  uid,
}: {
  side: 'l' | 'r';
  look: Look;
  gaze: Gaze;
  closed: boolean;
  happy: boolean;
  dead: boolean;
  shock: boolean;
  glow: boolean;
  uid: string;
}) {
  const shape = EYES[look.eyes];
  const cx = side === 'l' ? 81 : 119;
  const [gx, gy] = GAZE[gaze];
  // Local x runs outward for the left eye; mirror it for the right eye.
  const dx = side === 'l' ? gx : -gx;
  const clip = `${uid}-clip-${side}`;
  const grad = `${uid}-iris`;
  const transform = `translate(${cx} 116) ${side === 'r' ? 'scale(-1 1)' : ''}`;
  if (dead) {
    return (
      <g transform={transform} stroke={LINE} strokeWidth={3} strokeLinecap="round">
        <path d="M-8 -6 L8 6 M8 -6 L-8 6" />
      </g>
    );
  }
  const rx = shock ? shape.rx * 0.55 : shape.rx;
  const ry = shock ? shape.ry * 0.6 : shape.ry;
  return (
    <g transform={transform}>
      <defs>
        <clipPath id={clip}>
          <path d={shape.white} />
        </clipPath>
      </defs>
      <motion.g
        initial={false}
        animate={{ scaleY: closed || happy ? 0.08 : 1, opacity: closed || happy ? 0 : 1 }}
        transition={{ duration: 0.09 }}
      >
        <path d={shape.white} fill="#FFFFFF" />
        <g clipPath={`url(#${clip})`}>
          <motion.g initial={false} animate={{ x: dx, y: gy }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
            <ellipse cx={1} cy={0} rx={rx} ry={ry} fill={`url(#${grad})`} />
            {shape.slit ? (
              <ellipse cx={1} cy={0} rx={1.3} ry={ry * 0.8} fill={LINE} />
            ) : (
              <ellipse cx={1} cy={0.5} rx={rx * 0.42} ry={ry * 0.5} fill={LINE} />
            )}
            <circle cx={1 - rx * 0.35} cy={-ry * 0.42} r={rx * 0.34} fill="#FFFFFF" />
            <circle cx={1 + rx * 0.42} cy={ry * 0.36} r={rx * 0.15} fill="#FFFFFF" opacity={0.9} />
          </motion.g>
          {/* lid shadow */}
          <path d={shape.lash} fill="none" stroke={shade(look.skin, -0.35)} strokeWidth={6} opacity={0.25} transform="translate(0 2)" />
        </g>
        <path d={shape.lash} fill="none" stroke={LINE} strokeWidth={3.4} strokeLinecap="round" />
        <path d={shape.flick} fill="none" stroke={LINE} strokeWidth={2.6} strokeLinecap="round" />
        <path d={shape.lower} fill="none" stroke={LINE} strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
        {glow && <ellipse cx={1 + dx} cy={gy} rx={rx + 3} ry={ry + 3} fill={look.eyeColor} opacity={0.25} />}
      </motion.g>
      {(closed || happy) && (
        <path
          d={happy ? 'M-13 3 Q0 -8 13 3' : 'M-14 0 Q0 7 14 0'}
          fill="none"
          stroke={LINE}
          strokeWidth={3.2}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Brows, mouths
// ---------------------------------------------------------------------------

const BROWS: Record<BrowStyle, string> = {
  soft: 'M-13 -16 Q0 -21 12 -17',
  sharp: 'M-14 -19 Q-1 -21 12 -14',
  angry: 'M-14 -21 L12 -12',
  worried: 'M-13 -14 Q0 -19 12 -21',
};

function Brow({ side, look, raise, angry }: { side: 'l' | 'r'; look: Look; raise: number; angry: boolean }) {
  const reduce = useReducedMotion();
  const cx = side === 'l' ? 81 : 119;
  const style = angry ? 'angry' : (look.brows ?? 'soft');
  const color = look.hair === 'bald' || look.hair === 'buzz' ? shade(look.skin, -0.55) : shade(look.hairColor, -0.35);
  return (
    <g transform={`translate(${cx} 116) ${side === 'r' ? 'scale(-1 1)' : ''}`}>
      <motion.path
        d={BROWS[style]}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        initial={false}
        animate={{ y: -raise, rotate: raise > 0 ? -6 : 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 560, damping: 13 }}
      />
    </g>
  );
}

function Mouth({ style }: { style: MouthStyle }) {
  const s = { fill: 'none', stroke: '#3B1A22', strokeWidth: 2.2, strokeLinecap: 'round' as const };
  switch (style) {
    case 'smile':
      return <path d="M92 150 Q100 156 108 150" {...s} />;
    case 'smirk':
      return <path d="M92 152 Q102 155 109 147" {...s} />;
    case 'flat':
      return <path d="M94 151 L106 151" {...s} />;
    case 'frown':
      return <path d="M93 153 Q100 148 107 153" {...s} />;
    case 'open':
      return (
        <g>
          <path d="M92 148 Q100 160 108 148 Z" fill="#5A1D2A" stroke="#3B1A22" strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M95 153 Q100 157 105 153" fill="#E66A7C" />
        </g>
      );
    case 'grin':
      return (
        <g>
          <path d="M89 147 Q100 160 111 147 Z" fill="#2A0D16" stroke="#3B1A22" strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M92 147.5 L94.5 153 L97 148 Z M103 148 L105.5 153 L108 147.5 Z" fill="#FFFFFF" />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Hair
// ---------------------------------------------------------------------------

const HAIR_BACK: Partial<Record<HairStyle, string>> = {
  spiky:
    'M46 124 L34 98 L50 92 L36 66 L60 70 L54 40 L78 54 L84 24 L100 44 L116 24 L122 54 L146 40 L140 70 L164 66 L150 92 L166 98 L154 124 Z',
  wild: 'M40 150 L22 112 L40 104 L24 74 L50 76 L42 42 L68 56 L70 18 L92 40 L100 10 L108 40 L130 18 L132 56 L158 42 L150 76 L176 74 L160 104 L178 112 L160 150 Z',
  messy: 'M50 132 C40 102 42 62 62 46 C80 30 120 30 138 46 C158 62 160 102 150 132 Z',
  long: 'M52 96 C50 60 74 42 100 42 C126 42 150 60 148 96 L158 198 C140 210 122 202 118 192 L82 192 C78 202 60 210 42 198 Z',
  hime: 'M52 96 C50 58 74 40 100 40 C126 40 150 58 148 96 L152 204 L48 204 Z',
  bob: 'M52 100 C48 62 74 42 100 42 C126 42 152 62 148 100 L150 152 C138 160 128 154 126 148 L74 148 C72 154 62 160 50 152 Z',
  twintails: 'M52 100 C48 62 74 42 100 42 C126 42 152 62 148 100 C146 110 140 114 132 112 L68 112 C60 114 54 110 52 100 Z',
  ponytail: 'M54 110 C46 70 70 42 100 42 C130 42 154 70 146 110 Z',
  bun: 'M56 104 C50 66 74 44 100 44 C126 44 150 66 144 104 Z',
  curly: 'M44 132 C30 116 34 96 44 88 C34 70 46 52 60 52 C62 36 80 28 92 36 C100 26 118 28 124 38 C138 32 154 44 152 60 C166 66 168 86 158 96 C168 110 164 128 152 134 Z',
  sidepart: 'M52 120 C44 80 60 44 100 42 C140 44 156 80 148 120 Z',
  slick: 'M56 100 C52 60 76 38 100 38 C124 38 148 60 144 100 Z',
};

const HAIR_FRONT: Partial<Record<HairStyle, string>> = {
  spiky:
    'M58 102 C55 70 74 50 100 48 C126 50 145 70 142 102 L134 86 L128 100 L118 78 L110 96 L100 72 L90 96 L82 78 L72 100 L66 86 Z',
  wild: 'M56 106 C52 70 72 48 100 46 C128 48 148 70 144 106 L134 84 L128 102 L116 74 L108 96 L100 66 L92 96 L84 74 L72 102 L66 84 Z',
  messy:
    'M58 102 C54 66 76 44 100 44 C124 44 146 66 142 102 L136 88 C132 96 128 98 124 92 L118 100 L112 84 C108 92 104 94 100 86 C96 94 90 96 86 84 L80 100 L74 90 C70 98 66 96 62 88 Z',
  long: 'M58 104 C54 64 80 44 104 44 C128 46 146 66 142 104 C134 90 124 80 108 76 C96 84 80 92 66 100 Z',
  hime: 'M58 94 C58 58 80 40 100 40 C120 40 142 58 142 94 Z',
  bob: 'M58 100 C56 64 78 44 100 44 C122 44 144 64 142 100 C132 92 122 84 110 82 L104 92 L98 82 C86 84 70 92 58 100 Z',
  twintails: 'M58 98 C56 62 78 44 100 44 C122 44 144 62 142 98 L136 90 L128 96 L120 84 L110 94 L100 82 L90 94 L80 84 L72 96 L64 90 Z',
  ponytail: 'M58 100 C56 64 78 44 100 44 C122 44 144 64 142 100 C136 86 128 80 120 78 L112 90 L106 78 C94 80 72 86 58 100 Z',
  bun: 'M58 100 C56 64 78 46 100 46 C122 46 144 64 142 100 C132 82 118 74 100 76 C82 74 68 82 58 100 Z',
  curly: 'M58 98 C56 66 74 48 100 48 C126 48 144 66 142 98 C138 88 132 86 128 92 C124 84 116 84 112 90 C108 82 100 82 96 90 C92 82 84 84 80 92 C76 86 68 86 64 94 Z',
  sidepart: 'M58 104 C56 60 84 42 112 46 C134 50 146 70 142 104 C136 92 126 84 114 82 C104 86 96 80 92 72 C84 84 70 96 58 104 Z',
  slick: 'M60 86 C64 58 84 44 100 44 C116 44 136 58 140 86 C128 66 112 62 100 62 C88 62 72 66 60 86 Z',
  buzz: 'M60 92 C60 58 80 44 100 44 C120 44 140 58 140 92 C130 70 70 70 60 92 Z',
};

function HairExtras({ hair, fill }: { hair: HairStyle; fill: string }) {
  const s = { fill, stroke: LINE, strokeWidth: 2.4, strokeLinejoin: 'round' as const };
  if (hair === 'twintails') {
    return (
      <g>
        <path d="M54 80 C26 92 16 146 32 186 C42 166 50 124 62 98 Z" {...s} />
        <path d="M146 80 C174 92 184 146 168 186 C158 166 150 124 138 98 Z" {...s} />
      </g>
    );
  }
  if (hair === 'ponytail') return <path d="M138 66 C178 72 188 140 162 182 C166 144 158 104 134 86 Z" {...s} />;
  if (hair === 'bun') return <circle cx={100} cy={34} r={15} {...s} />;
  if (hair === 'hime') {
    return (
      <g>
        <path d="M56 92 L68 92 L70 152 L58 158 Z" {...s} />
        <path d="M144 92 L132 92 L130 152 L142 158 Z" {...s} />
      </g>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Outfit
// ---------------------------------------------------------------------------

const SHOULDERS = 'M12 240 C16 214 44 196 74 192 L100 202 L126 192 C156 196 184 214 188 240 Z';

function Outfit({ look }: { look: Look }) {
  const c = look.outfitColor;
  const trim = look.trim ?? '#F7F2E8';
  const s = { stroke: LINE, strokeWidth: 2.4, strokeLinejoin: 'round' as const };
  const base = <path d={SHOULDERS} fill={c} {...s} />;
  switch (look.outfit) {
    case 'gakuran':
      return (
        <g>
          {base}
          <path d="M76 186 L100 198 L124 186 L126 202 L100 212 L74 202 Z" fill={shade(c, 0.12)} {...s} />
          <circle cx={100} cy={222} r={3} fill={trim} />
          <circle cx={100} cy={236} r={3} fill={trim} />
        </g>
      );
    case 'coat':
    case 'uniform':
      return (
        <g>
          {base}
          <path d="M86 194 L100 226 L114 194 Z" fill={trim} {...s} />
          <path d="M74 192 L86 194 L96 222 L82 240 L62 240 Z M126 192 L114 194 L104 222 L118 240 L138 240 Z" fill={shade(c, -0.15)} {...s} />
          {look.outfit === 'uniform' && <path d="M132 214 l3 6 6 1 -5 4 2 6 -6 -3 -6 3 2 -6 -5 -4 6 -1 z" fill={'#FFC83A'} stroke={LINE} strokeWidth={1.2} />}
        </g>
      );
    case 'suit':
      return (
        <g>
          {base}
          <path d="M84 194 L100 230 L116 194 Z" fill="#F7F2E8" {...s} />
          <path d="M97 200 L103 200 L106 226 L100 232 L94 226 Z" fill={trim} stroke={LINE} strokeWidth={1.6} />
          <path d="M74 192 L84 194 L98 232 L84 240 L60 240 Z M126 192 L116 194 L102 232 L116 240 L140 240 Z" fill={shade(c, -0.2)} {...s} />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          {base}
          <path d="M62 198 C66 176 134 176 138 198 C128 190 72 190 62 198 Z" fill={shade(c, -0.18)} {...s} />
          <path d="M92 204 L90 228 M108 204 L110 228" stroke={trim} strokeWidth={2.6} strokeLinecap="round" />
        </g>
      );
    case 'haori':
      return (
        <g>
          {base}
          <path d="M80 192 L100 236 L120 192" fill="none" stroke={trim} strokeWidth={9} />
          <path d="M80 192 L100 236 L120 192" fill="none" stroke={LINE} strokeWidth={1.6} />
          <path d="M40 222 L56 206 M150 206 L166 222" stroke={shade(c, -0.25)} strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case 'robe':
      return (
        <g>
          {base}
          <path d="M84 192 L100 214 L116 192 Z" fill="#F7F2E8" {...s} />
          <path d="M95 210 L93 230 L100 226 L107 230 L105 210 Z" fill="#F7F2E8" stroke={LINE} strokeWidth={1.6} />
          <path d="M30 240 L44 214 M170 240 L156 214" stroke={trim} strokeWidth={3} />
        </g>
      );
    case 'armor':
      return (
        <g>
          {base}
          <ellipse cx={46} cy={214} rx={30} ry={18} fill={shade(c, 0.15)} {...s} />
          <ellipse cx={154} cy={214} rx={30} ry={18} fill={shade(c, 0.15)} {...s} />
          <path d="M84 196 L100 206 L116 196 L116 240 L84 240 Z" fill={trim} {...s} />
        </g>
      );
    case 'cloak':
      return (
        <g>
          {base}
          <path d="M66 204 C60 172 76 162 82 184 L100 198 L118 184 C124 162 140 172 134 204 C124 196 112 196 100 206 C88 196 76 196 66 204 Z" fill={shade(c, -0.25)} {...s} />
          <circle cx={100} cy={214} r={5} fill={trim} stroke={LINE} strokeWidth={1.6} />
        </g>
      );
    case 'dress':
      return (
        <g>
          {base}
          <path d="M70 194 Q78 206 86 196 Q93 210 100 198 Q107 210 114 196 Q122 206 130 194 L126 190 L100 200 L74 190 Z" fill={trim} {...s} />
          <path d="M96 204 L100 212 L104 204 Z" fill={'#FF2D55'} />
        </g>
      );
    case 'shrine':
      return (
        <g>
          <path d={SHOULDERS} fill="#F7F2E8" {...s} />
          <path d="M80 192 L100 232 L120 192" fill="none" stroke={c} strokeWidth={7} />
          <path d="M80 192 L100 232 L120 192" fill="none" stroke={LINE} strokeWidth={1.4} />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Marks and accessories
// ---------------------------------------------------------------------------

function FaceMarks({ look }: { look: Look }) {
  const m = new Set(look.marks ?? []);
  const dark = shade(look.skin, -0.4);
  return (
    <g>
      {/* A faint cheek tint on everyone; a strong blush with hatching when marked. */}
      {(
        <g opacity={m.has('blush') ? 0.55 : 0.22}>
          <ellipse cx={72} cy={135} rx={8} ry={4} fill="#FF6F91" />
          <ellipse cx={128} cy={135} rx={8} ry={4} fill="#FF6F91" />
          {m.has('blush') && (
            <path d="M68 137 L71 132 M72 137 L75 132 M76 137 L79 132 M124 137 L127 132 M128 137 L131 132 M132 137 L135 132" stroke="#E0466E" strokeWidth={1.1} />
          )}
        </g>
      )}
      {m.has('freckles') && (
        <g fill={shade(look.skin, -0.35)}>
          {[
            [70, 130],
            [75, 133],
            [68, 135],
            [130, 130],
            [125, 133],
            [132, 135],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={1.1} />
          ))}
        </g>
      )}
      {m.has('mole') && <circle cx={128} cy={140} r={1.4} fill={LINE} />}
      {m.has('eyebags') && (
        <g stroke="#7D5BA6" strokeWidth={1.4} fill="none" opacity={0.75}>
          <path d="M70 126 Q81 132 92 126" />
          <path d="M108 126 Q119 132 130 126" />
        </g>
      )}
      {m.has('cheekMarks') && (
        <g stroke="#E0002B" strokeWidth={2.4} strokeLinecap="round">
          <path d="M66 128 L76 131 M67 134 L77 136" />
          <path d="M134 128 L124 131 M133 134 L123 136" />
        </g>
      )}
      {m.has('scar') && <path d="M70 98 L90 134" stroke={shade(look.skin, -0.3)} strokeWidth={2.4} strokeLinecap="round" />}
      {m.has('stubble') && (
        <g fill={dark} opacity={0.5}>
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={78 + (i % 9) * 5.5} cy={152 + Math.floor(i / 9) * 6 + (i % 2) * 2} r={0.9} />
          ))}
        </g>
      )}
      {m.has('bandage') && (
        <g transform="rotate(-18 128 136)">
          <rect x={120} y={132} width={16} height={8} rx={2} fill="#F3D9B5" stroke={LINE} strokeWidth={1.2} />
          <path d="M126 132 L126 140 M130 132 L130 140" stroke={shade('#F3D9B5', -0.3)} strokeWidth={1} />
        </g>
      )}
      {m.has('tears') && <path d="M126 126 C124 132 124 136 126 138 C128 136 128 132 126 126 Z" fill="#7FD8FF" stroke={LINE} strokeWidth={1} />}
    </g>
  );
}

function LowerFace({ look }: { look: Look }) {
  const m = new Set(look.marks ?? []);
  return (
    <g>
      {m.has('beard') && (
        <path d="M63 122 C62 184 138 184 137 122 C132 140 120 146 112 143 C108 157 92 157 88 143 C80 146 68 140 63 122 Z" fill={look.hairColor} stroke={LINE} strokeWidth={2} />
      )}
      {m.has('mask') && (
        <g>
          <path d="M64 130 C80 137 120 137 136 130 C136 152 122 166 100 172 C78 166 64 152 64 130 Z" fill={look.trim ?? '#1E2236'} stroke={LINE} strokeWidth={2.2} />
          <path d="M76 142 Q100 148 124 142 M80 154 Q100 158 120 154" stroke={shade(look.trim ?? '#1E2236', 0.2)} strokeWidth={1.4} fill="none" />
        </g>
      )}
      {m.has('talisman') && (
        <g>
          <rect x={89} y={136} width={22} height={34} fill="#F3E7C4" stroke={LINE} strokeWidth={1.6} />
          <path d="M94 142 L106 142 M100 142 L100 164 M94 150 Q100 146 106 150 M95 158 L105 158" stroke="#C4001F" strokeWidth={1.8} fill="none" />
        </g>
      )}
    </g>
  );
}

function Headgear({ look }: { look: Look }) {
  const m = new Set(look.marks ?? []);
  const s = { stroke: LINE, strokeWidth: 2.4, strokeLinejoin: 'round' as const };
  const acc = look.accent;
  return (
    <g>
      {m.has('glasses') && (
        <g fill="rgba(255,255,255,0.12)" stroke={LINE} strokeWidth={2.2}>
          <circle cx={81} cy={116} r={14} />
          <circle cx={119} cy={116} r={14} />
          <path d="M95 115 L105 115" fill="none" />
        </g>
      )}
      {m.has('shades') && (
        <g {...s}>
          <path d="M64 108 L98 108 L96 122 C92 128 70 128 66 122 Z" fill="#14141F" />
          <path d="M102 108 L136 108 L134 122 C130 128 108 128 104 122 Z" fill="#14141F" />
          <path d="M70 112 L80 112" stroke="#FFFFFF" strokeWidth={1.5} opacity={0.6} />
        </g>
      )}
      {m.has('monocle') && (
        <g fill="rgba(255,255,255,0.12)" stroke="#E29A00" strokeWidth={2.2}>
          <circle cx={119} cy={116} r={15} />
          <path d="M132 124 C138 140 138 152 132 166" fill="none" strokeWidth={1.4} />
        </g>
      )}
      {m.has('eyepatch') && (
        <g {...s}>
          <path d="M58 100 L142 90" fill="none" strokeWidth={2} />
          <path d="M68 106 C72 98 92 98 94 108 C94 124 72 128 68 118 Z" fill="#14141F" />
        </g>
      )}
      {m.has('horns') && (
        <g {...s}>
          <path d="M76 58 C66 42 64 26 72 10 C74 26 82 40 90 50 Z" fill="#F1E6D0" />
          <path d="M124 58 C134 42 136 26 128 10 C126 26 118 40 110 50 Z" fill="#F1E6D0" />
          <path d="M72 10 C72 18 74 22 76 26 M128 10 C128 18 126 22 124 26" stroke="#C4001F" strokeWidth={3} />
        </g>
      )}
      {m.has('catEars') && (
        <g {...s}>
          <path d="M62 66 L66 30 L90 50 Z" fill={look.hairColor} />
          <path d="M138 66 L134 30 L110 50 Z" fill={look.hairColor} />
          <path d="M68 58 L69 40 L82 51 Z M132 58 L131 40 L118 51 Z" fill="#FF8FB1" strokeWidth={1} />
        </g>
      )}
      {m.has('foxEars') && (
        <g {...s}>
          <path d="M60 70 L58 20 L92 50 Z" fill={look.hairColor} />
          <path d="M140 70 L142 20 L108 50 Z" fill={look.hairColor} />
          <path d="M58 20 L60 34 L68 32 Z M142 20 L140 34 L132 32 Z" fill="#F7F2E8" strokeWidth={1} />
        </g>
      )}
      {m.has('tanukiEars') && (
        <g {...s}>
          <circle cx={68} cy={50} r={12} fill={shade(look.hairColor, -0.2)} />
          <circle cx={132} cy={50} r={12} fill={shade(look.hairColor, -0.2)} />
          <circle cx={68} cy={51} r={5} fill="#2A1F1A" strokeWidth={0} />
          <circle cx={132} cy={51} r={5} fill="#2A1F1A" strokeWidth={0} />
        </g>
      )}
      {m.has('cap') && (
        <g {...s}>
          <path d="M56 74 C56 46 144 46 144 74 Z" fill={look.trim ?? '#1D2A4A'} />
          <path d="M56 70 L144 70 L144 78 L56 78 Z" fill="#14141F" />
          <path d="M52 78 Q100 94 148 78 L148 82 Q100 100 52 82 Z" fill="#14141F" />
          <path d="M100 54 l3 6 6 1 -5 4 2 6 -6 -3 -6 3 2 -6 -5 -4 6 -1 z" fill="#FFC83A" strokeWidth={1.2} />
        </g>
      )}
      {m.has('tophat') && (
        <g {...s}>
          <ellipse cx={100} cy={54} rx={42} ry={8} fill="#14141F" />
          <rect x={74} y={14} width={52} height={40} rx={4} fill="#1C1C2C" />
          <rect x={74} y={42} width={52} height={7} fill={acc} />
        </g>
      )}
      {m.has('headband') && (
        <g {...s}>
          <path d="M58 86 Q100 74 142 86 L142 95 Q100 83 58 95 Z" fill={look.trim ?? acc} />
          <path d="M142 88 L158 80 L156 94 Z M142 92 L160 98 L150 104 Z" fill={look.trim ?? acc} />
        </g>
      )}
      {m.has('headphones') && (
        <g {...s}>
          <path d="M56 108 C52 44 148 44 144 108" fill="none" stroke="#14141F" strokeWidth={6} />
          <rect x={48} y={100} width={14} height={26} rx={6} fill={acc} />
          <rect x={138} y={100} width={14} height={26} rx={6} fill={acc} />
        </g>
      )}
      {m.has('tiara') && <path d="M82 52 L88 38 L94 48 L100 32 L106 48 L112 38 L118 52 Z" fill="#FFC83A" {...s} />}
      {m.has('halo') && <ellipse cx={100} cy={22} rx={30} ry={7} fill="none" stroke="#FFE08A" strokeWidth={4} />}
      {m.has('leaf') && <path d="M96 40 C88 22 104 8 118 14 C116 28 108 38 96 40 Z M96 40 L112 18" fill="#5CC46A" {...s} />}
      {m.has('flower') && (
        <g {...s} transform="translate(132 62)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={0} cy={-7} rx={4.5} ry={7} fill="#FF8FB1" transform={`rotate(${a})`} />
          ))}
          <circle r={3.5} fill="#FFC83A" />
        </g>
      )}
      {m.has('bell') && (
        <g {...s}>
          <path d="M132 64 L146 58" fill="none" stroke="#FF2D55" strokeWidth={3} />
          <circle cx={148} cy={64} r={6} fill="#FFC83A" />
        </g>
      )}
      {m.has('hairSticks') && (
        <g stroke={LINE} strokeWidth={1.6}>
          <path d="M80 18 L120 50" stroke="#B5002B" strokeWidth={3.2} />
          <path d="M120 18 L82 50" stroke="#B5002B" strokeWidth={3.2} />
        </g>
      )}
      {m.has('sideMask') && (
        <g {...s} transform="rotate(20 142 70)">
          <ellipse cx={142} cy={70} rx={14} ry={18} fill="#F7F2E8" />
          <path d="M134 66 L140 68 M150 66 L144 68 M136 80 Q142 84 148 80" stroke="#C4001F" strokeWidth={2} />
        </g>
      )}
      {m.has('earring') && <circle cx={60} cy={130} r={3} fill="#FFC83A" stroke={LINE} strokeWidth={1.2} />}
      {m.has('beads') && (
        <g fill="#7A4A2A" stroke={LINE} strokeWidth={1}>
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={70 + i * 7.5} cy={200 + Math.sin((i / 8) * Math.PI) * 12} r={3.6} />
          ))}
        </g>
      )}
      {m.has('sweat') && <path d="M148 92 C144 100 144 106 148 108 C152 106 152 100 148 92 Z" fill="#9BE6FF" stroke={LINE} strokeWidth={1.2} />}
    </g>
  );
}

// ---------------------------------------------------------------------------
// The face
// ---------------------------------------------------------------------------

export interface AnimeFaceProps {
  look: Look;
  /** Width in px. Height follows the crop's aspect ratio. */
  size?: number;
  crop?: Crop;
  gaze?: Gaze;
  expression?: Expression;
  /** Greyed out (a ghost). */
  ghost?: boolean;
  /** Villain glow in the irises. */
  glowEyes?: boolean;
  /** Blink now and then. */
  blink?: boolean;
  className?: string;
  title?: string;
}

const ASPECT: Record<Crop, number> = { bust: 240 / 200, face: 160 / 132, eyes: 54 / 112 };

function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!enabled || reduce) {
      // Never leave the eyes stuck shut if blinking stops mid-blink.
      setBlinking(false);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        () => {
          setBlinking(true);
          t = setTimeout(() => {
            setBlinking(false);
            loop();
          }, 120);
        },
        2200 + Math.random() * 3800,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, [enabled, reduce]);
  return blinking;
}

export const AnimeFace = memo(function AnimeFace({
  look,
  size = 120,
  crop = 'bust',
  gaze = 'you',
  expression = 'neutral',
  ghost = false,
  glowEyes = false,
  blink = false,
  className,
  title,
}: AnimeFaceProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const blinking = useBlink(blink && expression !== 'dead');
  const dead = expression === 'dead';
  const closedL = expression === 'wink' || expression === 'closed' || blinking;
  const closedR = expression === 'closed' || blinking;
  const happy = expression === 'happy';
  const shock = expression === 'shock';
  const raise = expression === 'raise' ? 8 : expression === 'shock' ? 5 : 0;
  const angry = expression === 'angry';
  const mouth: MouthStyle =
    expression === 'happy'
      ? 'open'
      : expression === 'shock'
        ? 'open'
        : expression === 'dead'
          ? 'frown'
          : expression === 'sly' || expression === 'wink'
            ? 'smirk'
            : expression === 'angry'
              ? 'flat'
              : (look.mouth ?? 'smile');
  const iris = `${uid}-iris`;
  const back = HAIR_BACK[look.hair];
  const front = HAIR_FRONT[look.hair];
  const hairStroke = { stroke: LINE, strokeWidth: 2.4, strokeLinejoin: 'round' as const };

  return (
    <svg
      width={size}
      height={Math.round(size * ASPECT[crop])}
      viewBox={VIEWBOX[crop]}
      className={className}
      role="img"
      aria-label={title ?? 'character'}
      style={ghost ? { filter: 'grayscale(1) brightness(0.75)', opacity: 0.6 } : undefined}
    >
      <defs>
        <linearGradient id={iris} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(look.eyeColor, -0.55)} />
          <stop offset="45%" stopColor={look.eyeColor} />
          <stop offset="100%" stopColor={shade(look.eyeColor, 0.45)} />
        </linearGradient>
      </defs>

      {back && <path d={back} fill={shade(look.hairColor, -0.12)} {...hairStroke} />}
      <HairExtras hair={look.hair} fill={look.hairColor} />

      {crop !== 'eyes' && (
        <>
          <path d="M88 158 L88 194 Q100 200 112 194 L112 158 Z" fill={shade(look.skin, -0.08)} stroke={LINE} strokeWidth={2} />
          <path d="M88 166 Q100 176 112 166 L112 158 L88 158 Z" fill={shade(look.skin, -0.22)} />
          <Outfit look={look} />
        </>
      )}

      <ellipse cx={60} cy={117} rx={6} ry={10} fill={look.skin} stroke={LINE} strokeWidth={2} />
      <ellipse cx={140} cy={117} rx={6} ry={10} fill={look.skin} stroke={LINE} strokeWidth={2} />
      <path
        d="M60 96 C60 62 80 46 100 46 C120 46 140 62 140 96 C140 108 139 118 136 128 C131 146 118 160 100 170 C82 160 69 146 64 128 C61 118 60 108 60 96 Z"
        fill={look.skin}
        stroke={LINE}
        strokeWidth={2.4}
      />
      <FaceMarks look={look} />

      <Eye side="l" look={look} gaze={gaze} closed={closedL} happy={happy} dead={dead} shock={shock} glow={glowEyes} uid={uid} />
      <Eye side="r" look={look} gaze={gaze} closed={closedR} happy={happy} dead={dead} shock={shock} glow={glowEyes} uid={uid} />

      <path d="M101 132 L98.5 138 L102 138.5" fill="none" stroke={shade(look.skin, -0.35)} strokeWidth={1.4} strokeLinecap="round" />
      {!(look.marks ?? []).includes('mask') && <Mouth style={mouth} />}
      <LowerFace look={look} />

      {front && <path d={front} fill={look.hairColor} {...hairStroke} />}
      {front && look.hair !== 'bald' && (
        <path d="M74 62 Q100 52 126 62" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.28} />
      )}

      {/* The classic anime eyebrow raise lifts one brow. */}
      <Brow side="l" look={look} raise={expression === 'raise' ? 1.5 : raise} angry={angry} />
      <Brow side="r" look={look} raise={raise} angry={angry} />

      <Headgear look={look} />
    </svg>
  );
});
