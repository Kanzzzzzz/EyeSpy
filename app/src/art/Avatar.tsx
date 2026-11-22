import { motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { color } from '../design/tokens';

/**
 * The avatar kit: 12 characters built from shared parts (head, hair or hat,
 * outfit, extras), with eyes and brows as separate layers so a wink or an
 * eyebrow raise is just an animation of those layers. Original art.
 */

export type Expression = 'neutral' | 'wink' | 'raise' | 'shock' | 'dead' | 'sly' | 'happy';

type Hair = 'fedora' | 'bob' | 'beret' | 'curls' | 'cap' | 'bun' | 'bald' | 'beanie' | 'swoop' | 'long' | 'cloche' | 'tophat';
type Outfit = 'trench' | 'turtleneck' | 'bowtie' | 'scarf' | 'hoodie' | 'pearls' | 'tie' | 'stripes';
type Extra = 'glasses' | 'mustache' | 'freckles' | 'monocle' | 'earring' | 'beard';

interface Spec {
  name: string;
  skin: number;
  hairColor: string;
  accent: number;
  hair: Hair;
  outfit: Outfit;
  extras: Extra[];
  head: 'round' | 'oval' | 'square';
}

const H = { black: '#1C1A24', brown: '#5B3A29', auburn: '#9A4A2A', blond: '#E2B85C', grey: '#B9B5C4', pink: '#FF8FB8' };

export const AVATARS: Spec[] = [
  { name: 'Detective', skin: 1, hairColor: H.black, accent: 0, hair: 'fedora', outfit: 'trench', extras: [], head: 'oval' },
  { name: 'Starlet', skin: 0, hairColor: H.blond, accent: 5, hair: 'bob', outfit: 'pearls', extras: [], head: 'round' },
  { name: 'Painter', skin: 3, hairColor: H.black, accent: 2, hair: 'beret', outfit: 'stripes', extras: ['mustache'], head: 'round' },
  { name: 'Curly', skin: 4, hairColor: H.black, accent: 1, hair: 'curls', outfit: 'turtleneck', extras: ['earring'], head: 'round' },
  { name: 'Newsie', skin: 2, hairColor: H.auburn, accent: 3, hair: 'cap', outfit: 'scarf', extras: ['freckles'], head: 'square' },
  { name: 'Librarian', skin: 1, hairColor: H.grey, accent: 4, hair: 'bun', outfit: 'bowtie', extras: ['glasses'], head: 'oval' },
  { name: 'Boss', skin: 5, hairColor: H.black, accent: 7, hair: 'bald', outfit: 'tie', extras: ['beard'], head: 'square' },
  { name: 'Skater', skin: 2, hairColor: H.brown, accent: 6, hair: 'beanie', outfit: 'hoodie', extras: [], head: 'round' },
  { name: 'Crooner', skin: 0, hairColor: H.brown, accent: 4, hair: 'swoop', outfit: 'bowtie', extras: [], head: 'oval' },
  { name: 'Poet', skin: 3, hairColor: H.pink, accent: 5, hair: 'long', outfit: 'scarf', extras: ['glasses'], head: 'oval' },
  { name: 'Heiress', skin: 4, hairColor: H.black, accent: 1, hair: 'cloche', outfit: 'pearls', extras: [], head: 'round' },
  { name: 'Magician', skin: 1, hairColor: H.black, accent: 0, hair: 'tophat', outfit: 'trench', extras: ['monocle', 'mustache'], head: 'square' },
];

const INK = color.ink[950];
const STROKE = 3;

function Head({ shape, fill }: { shape: Spec['head']; fill: string }) {
  if (shape === 'square') return <rect x="27" y="26" width="46" height="50" rx="18" fill={fill} stroke={INK} strokeWidth={STROKE} />;
  if (shape === 'oval') return <ellipse cx="50" cy="51" rx="22" ry="26" fill={fill} stroke={INK} strokeWidth={STROKE} />;
  return <circle cx="50" cy="51" r="24" fill={fill} stroke={INK} strokeWidth={STROKE} />;
}

function Body({ outfit, accent }: { outfit: Outfit; accent: string }) {
  const base = <path d="M14 104 C 16 82, 32 74, 50 74 C 68 74, 84 82, 86 104 Z" fill={accent} stroke={INK} strokeWidth={STROKE} />;
  switch (outfit) {
    case 'trench':
      return (
        <g>
          <path d="M14 104 C 16 82, 32 74, 50 74 C 68 74, 84 82, 86 104 Z" fill="#B38B5D" stroke={INK} strokeWidth={STROKE} />
          <path d="M36 76 L50 96 L64 76" fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
          <path d="M33 77 L42 92 L36 96 Z M67 77 L58 92 L64 96 Z" fill="#9A7448" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M44 80 L50 92 L56 80 Z" fill={accent} />
        </g>
      );
    case 'turtleneck':
      return (
        <g>
          {base}
          <rect x="38" y="70" width="24" height="10" rx="5" fill={accent} stroke={INK} strokeWidth={STROKE} />
        </g>
      );
    case 'bowtie':
      return (
        <g>
          <path d="M14 104 C 16 82, 32 74, 50 74 C 68 74, 84 82, 86 104 Z" fill={color.ink[700]} stroke={INK} strokeWidth={STROKE} />
          <path d="M42 76 L50 86 L58 76 Z" fill={color.paper.DEFAULT} />
          <path d="M40 79 L50 83 L40 87 Z M60 79 L50 83 L60 87 Z" fill={accent} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </g>
      );
    case 'scarf':
      return (
        <g>
          {base}
          <path d="M34 76 C 42 82, 58 82, 66 76 L64 84 C 56 88, 44 88, 36 84 Z" fill={color.spot.DEFAULT} stroke={INK} strokeWidth="2.5" />
          <path d="M58 84 L62 100 L54 100 Z" fill={color.spot.DEFAULT} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          {base}
          <path d="M30 80 C 36 72, 64 72, 70 80" fill="none" stroke={INK} strokeWidth={STROKE} />
          <path d="M45 82 L44 94 M55 82 L56 94" stroke={color.paper.DEFAULT} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case 'pearls':
      return (
        <g>
          {base}
          {[36, 41, 46, 51, 56, 61, 66].map((x, i) => (
            <circle key={x} cx={x - 1} cy={80 + Math.sin((i / 6) * Math.PI) * 5} r="2.6" fill={color.paper.DEFAULT} stroke={INK} strokeWidth="1.2" />
          ))}
        </g>
      );
    case 'tie':
      return (
        <g>
          <path d="M14 104 C 16 82, 32 74, 50 74 C 68 74, 84 82, 86 104 Z" fill={color.ink[600]} stroke={INK} strokeWidth={STROKE} />
          <path d="M42 75 L50 82 L58 75 Z" fill={color.paper.DEFAULT} />
          <path d="M47 81 L53 81 L56 100 L50 104 L44 100 Z" fill={accent} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </g>
      );
    case 'stripes':
      return (
        <g>
          {base}
          <clipPath id="stripesClip">
            <path d="M14 104 C 16 82, 32 74, 50 74 C 68 74, 84 82, 86 104 Z" />
          </clipPath>
          <g clipPath="url(#stripesClip)" stroke={color.paper.DEFAULT} strokeWidth="4">
            <path d="M10 84 H90 M10 93 H90 M10 102 H90" />
          </g>
        </g>
      );
  }
}

/** Hair drawn behind the head (long hair, bobs). */
function HairBack({ hair, fill }: { hair: Hair; fill: string }) {
  if (hair === 'long') return <path d="M24 46 C 22 20, 78 20, 76 46 L80 86 C 66 92, 34 92, 20 86 Z" fill={fill} stroke={INK} strokeWidth={STROKE} />;
  if (hair === 'bob') return <path d="M24 50 C 20 18, 80 18, 76 50 L78 72 C 70 76, 30 76, 22 72 Z" fill={fill} stroke={INK} strokeWidth={STROKE} />;
  if (hair === 'bun') return <circle cx="50" cy="20" r="10" fill={fill} stroke={INK} strokeWidth={STROKE} />;
  return null;
}

function HairFront({ hair, fill, accent }: { hair: Hair; fill: string; accent: string }) {
  switch (hair) {
    case 'fedora':
      return (
        <g stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
          <ellipse cx="50" cy="34" rx="34" ry="8" fill={color.ink[700]} />
          <path d="M30 34 C 30 12, 70 12, 70 34 Z" fill={color.ink[700]} />
          <path d="M31 28 H69" stroke={accent} strokeWidth="5" />
          <path d="M44 15 C 48 19, 52 19, 56 15" fill="none" />
        </g>
      );
    case 'bob':
      return <path d="M27 44 C 30 26, 50 22, 74 40 C 66 34, 44 32, 27 44 Z" fill={fill} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />;
    case 'beret':
      return (
        <g stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
          <path d="M24 36 C 22 18, 74 14, 78 32 C 70 38, 32 40, 24 36 Z" fill={accent} />
          <path d="M52 16 L54 10" strokeLinecap="round" />
        </g>
      );
    case 'curls':
      return (
        <g fill={fill} stroke={INK} strokeWidth="2.5">
          {[
            [32, 34],
            [40, 27],
            [50, 24],
            [60, 27],
            [68, 34],
            [27, 44],
            [73, 44],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="8" />
          ))}
        </g>
      );
    case 'cap':
      return (
        <g stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
          <path d="M26 38 C 26 18, 74 18, 74 38 Z" fill={accent} />
          <path d="M26 38 C 40 34, 60 34, 82 40 C 72 44, 50 42, 26 40 Z" fill={accent} />
          <circle cx="50" cy="22" r="2.5" fill={INK} stroke="none" />
        </g>
      );
    case 'bun':
      return <path d="M27 46 C 26 24, 74 24, 73 46 C 66 34, 34 34, 27 46 Z" fill={fill} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />;
    case 'bald':
      return <path d="M28 52 C 26 46, 27 42, 30 40 M72 52 C 74 46, 73 42, 70 40" fill="none" stroke={fill} strokeWidth="5" strokeLinecap="round" />;
    case 'beanie':
      return (
        <g stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
          <path d="M26 40 C 24 14, 76 14, 74 40 Z" fill={accent} />
          <rect x="24" y="35" width="52" height="9" rx="4" fill={accent} />
          <circle cx="50" cy="14" r="5" fill={color.paper.DEFAULT} />
        </g>
      );
    case 'swoop':
      return <path d="M26 46 C 22 22, 62 14, 76 38 C 64 30, 46 30, 38 40 C 34 36, 30 40, 26 46 Z" fill={fill} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />;
    case 'long':
      return <path d="M27 46 C 30 26, 70 26, 73 46 C 62 34, 50 32, 27 46 Z" fill={fill} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />;
    case 'cloche':
      return (
        <g stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
          <path d="M24 44 C 20 16, 80 16, 76 44 C 66 38, 34 38, 24 44 Z" fill={accent} />
          <path d="M28 36 C 40 32, 60 32, 72 36" fill="none" stroke={color.paper.DEFAULT} strokeWidth="3" />
          <circle cx="68" cy="32" r="4" fill={color.paper.DEFAULT} />
        </g>
      );
    case 'tophat':
      return (
        <g stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
          <ellipse cx="50" cy="32" rx="30" ry="6" fill={INK} />
          <rect x="34" y="4" width="32" height="28" rx="3" fill={color.ink[800]} />
          <rect x="34" y="22" width="32" height="6" fill={accent} />
        </g>
      );
  }
}

function Extras({ extras, hairColor }: { extras: Extra[]; hairColor: string }) {
  return (
    <g>
      {extras.includes('freckles') && (
        <g fill="#B5643C" opacity="0.7">
          {[
            [38, 62],
            [42, 64],
            [36, 66],
            [62, 62],
            [58, 64],
            [64, 66],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />
          ))}
        </g>
      )}
      {extras.includes('beard') && (
        <path d="M30 60 C 32 82, 68 82, 70 60 C 64 72, 36 72, 30 60 Z" fill={hairColor} stroke={INK} strokeWidth="2.5" />
      )}
      {extras.includes('mustache') && (
        <path d="M40 66 C 44 62, 48 63, 50 65 C 52 63, 56 62, 60 66 C 56 68, 52 67, 50 66 C 48 67, 44 68, 40 66 Z" fill={hairColor} stroke={INK} strokeWidth="1.5" />
      )}
      {extras.includes('earring') && <circle cx="26" cy="60" r="2.5" fill={color.spot.DEFAULT} stroke={INK} strokeWidth="1.2" />}
    </g>
  );
}

function Glasses({ extras }: { extras: Extra[] }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2.5">
      {extras.includes('glasses') && (
        <>
          <circle cx="41" cy="52" r="7.5" fill="rgba(255,255,255,0.12)" />
          <circle cx="59" cy="52" r="7.5" fill="rgba(255,255,255,0.12)" />
          <path d="M48.5 52 H51.5" />
        </>
      )}
      {extras.includes('monocle') && (
        <>
          <circle cx="59" cy="52" r="8" fill="rgba(255,255,255,0.12)" stroke={color.spot.deep} />
          <path d="M66 56 C 70 64, 70 70, 66 76" stroke={color.spot.deep} strokeWidth="1.5" />
        </>
      )}
    </g>
  );
}

/** One eye. `closed` draws a lid line (a wink); `dead` draws an X. */
function Eye({ cx, closed, dead, narrow, wide }: { cx: number; closed: boolean; dead: boolean; narrow: boolean; wide: boolean }) {
  const cy = 52;
  if (dead) {
    return (
      <g stroke={INK} strokeWidth="2.8" strokeLinecap="round">
        <path d={`M${cx - 4} ${cy - 4} L${cx + 4} ${cy + 4} M${cx + 4} ${cy - 4} L${cx - 4} ${cy + 4}`} />
      </g>
    );
  }
  return (
    <g>
      <motion.ellipse
        cx={cx}
        cy={cy}
        rx={5.2}
        initial={false}
        animate={{ ry: closed ? 0.6 : narrow ? 2.6 : wide ? 6.4 : 5.4 }}
        transition={{ duration: 0.12 }}
        fill={color.paper.DEFAULT}
        stroke={INK}
        strokeWidth="2"
      />
      <motion.circle
        cx={cx + 0.6}
        cy={cy + 0.6}
        initial={false}
        animate={{ r: closed ? 0 : wide ? 2.2 : 2.8, opacity: closed ? 0 : 1 }}
        transition={{ duration: 0.12 }}
        fill={INK}
      />
      {closed && <path d={`M${cx - 6} ${cy} C ${cx - 2} ${cy + 4}, ${cx + 2} ${cy + 4}, ${cx + 6} ${cy}`} stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />}
    </g>
  );
}

function Mouth({ expression }: { expression: Expression }) {
  if (expression === 'shock') return <ellipse cx="50" cy="67" rx="3.5" ry="4.5" fill={INK} />;
  if (expression === 'dead') return <path d="M43 68 C 47 65, 53 65, 57 68" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  if (expression === 'sly' || expression === 'wink') return <path d="M43 66 C 48 69, 54 68, 58 63" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  if (expression === 'happy') return <path d="M42 64 C 46 72, 54 72, 58 64 Z" fill={INK} />;
  return <path d="M44 66 C 47 68.5, 53 68.5, 56 66" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
}

interface AvatarProps {
  id: number;
  size?: number;
  expression?: Expression;
  /** Grey it out (ghosts). */
  ghost?: boolean;
  className?: string;
  title?: string;
}

export const Avatar = memo(function Avatar({ id, size = 64, expression = 'neutral', ghost = false, className, title }: AvatarProps) {
  const spec = AVATARS[((id % AVATARS.length) + AVATARS.length) % AVATARS.length]!;
  const reduce = useReducedMotion();
  const skin = color.skin[spec.skin]!;
  const accent = color.accent[spec.accent]!;
  const raise = expression === 'raise' || expression === 'shock';
  const dead = expression === 'dead';
  const brow = (side: -1 | 1) => (
    <motion.path
      d={side < 0 ? 'M34 42 C 38 39, 44 39, 47 41' : 'M53 41 C 56 39, 62 39, 66 42'}
      stroke={spec.hair === 'bald' || spec.hair === 'tophat' || spec.hair === 'fedora' ? INK : spec.hairColor}
      strokeWidth="3.2"
      strokeLinecap="round"
      fill="none"
      initial={false}
      animate={{
        y: dead ? 1 : raise ? (side > 0 && expression === 'raise' ? -7 : -4) : expression === 'sly' ? 1.5 : 0,
        rotate: expression === 'raise' && side > 0 ? -10 : expression === 'sly' ? side * 6 : 0,
      }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 14 }}
      style={{ transformBox: 'fill-box', originX: '50%', originY: '50%' }}
    />
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={title ?? spec.name}
      style={ghost ? { filter: 'grayscale(1) brightness(0.7)', opacity: 0.55 } : undefined}
    >
      <defs>
        <clipPath id={`av-clip-${id}`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={color.ink[700]} />
      <g clipPath={`url(#av-clip-${id})`}>
        <circle cx="50" cy="40" r="40" fill={accent} opacity="0.18" />
        <HairBack hair={spec.hair} fill={spec.hairColor} />
        <Body outfit={spec.outfit} accent={accent} />
        <Head shape={spec.head} fill={skin} />
        <Extras extras={spec.extras} hairColor={spec.hairColor} />
        <Eye cx={41} closed={expression === 'wink' || expression === 'happy'} dead={dead} narrow={expression === 'sly'} wide={expression === 'shock'} />
        <Eye cx={59} closed={expression === 'happy'} dead={dead} narrow={expression === 'sly'} wide={raise} />
        {brow(-1)}
        {brow(1)}
        <Glasses extras={spec.extras} />
        <Mouth expression={expression} />
        <circle cx="35" cy="62" r="3.5" fill={color.team.killers} opacity="0.18" />
        <circle cx="65" cy="62" r="3.5" fill={color.team.killers} opacity="0.18" />
        <HairFront hair={spec.hair} fill={spec.hairColor} accent={accent} />
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke={INK} strokeWidth="2" />
    </svg>
  );
});
