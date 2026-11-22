import { motion, useReducedMotion } from 'motion/react';
import { color } from '../design/tokens';

/**
 * The blinking eye. Blinks every few seconds, and winks once in a while.
 * Hand-written SVG, original to EyeSpy.
 */
export function LogoEye({ size = 120, wink = false }: { size?: number; wink?: boolean }) {
  const reduce = useReducedMotion();
  const blink = reduce
    ? undefined
    : {
        scaleY: [1, 1, 0.05, 1, 1, 1, 0.05, 1],
        transition: { duration: 5.2, times: [0, 0.6, 0.63, 0.66, 0.8, 0.9, 0.93, 0.96], repeat: Infinity },
      };
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 200 124" role="img" aria-label="EyeSpy logo">
      <defs>
        <radialGradient id="iris" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={color.spot.soft} />
          <stop offset="70%" stopColor={color.spot.DEFAULT} />
          <stop offset="100%" stopColor={color.spot.deep} />
        </radialGradient>
        <clipPath id="eyeShape">
          <path d="M8 62 C 50 4, 150 4, 192 62 C 150 120, 50 120, 8 62 Z" />
        </clipPath>
      </defs>
      {/* glow */}
      <ellipse cx="100" cy="62" rx="96" ry="54" fill={color.spot.glow} opacity="0.35" />
      <motion.g style={{ originX: '100px', originY: '62px', transformBox: 'view-box' }} animate={wink ? { scaleY: [1, 0.05, 1] } : blink}>
        <path d="M8 62 C 50 4, 150 4, 192 62 C 150 120, 50 120, 8 62 Z" fill={color.paper.DEFAULT} />
        <g clipPath="url(#eyeShape)">
          <motion.g
            animate={reduce ? undefined : { x: [0, 14, 14, -12, -12, 0], y: [0, -2, -2, 3, 3, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle cx="100" cy="62" r="40" fill="url(#iris)" />
            <circle cx="100" cy="62" r="19" fill={color.ink[950]} />
            <circle cx="88" cy="50" r="8" fill={color.paper.DEFAULT} opacity="0.9" />
          </motion.g>
        </g>
        <path
          d="M8 62 C 50 4, 150 4, 192 62 C 150 120, 50 120, 8 62 Z"
          fill="none"
          stroke={color.ink[950]}
          strokeWidth="7"
          strokeLinejoin="round"
        />
      </motion.g>
      {/* lashes */}
      <g stroke={color.paper.DEFAULT} strokeWidth="6" strokeLinecap="round">
        <path d="M60 22 L52 6" />
        <path d="M100 14 L100 -2" />
        <path d="M140 22 L148 6" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <h1 className={`font-display font-semibold tracking-tight text-paper ${className}`} style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}>
      Eye<span className="italic text-spot">Spy</span>
    </h1>
  );
}
