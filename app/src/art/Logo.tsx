import { motion, useReducedMotion } from 'motion/react';
import { color } from '../design/tokens';

/**
 * The EyeSpy eye: a sharp anime eye with a crimson iris. Blinks every few
 * seconds and glances around. Hand-written SVG, original to EyeSpy.
 */
export function LogoEye({ size = 120, wink = false }: { size?: number; wink?: boolean }) {
  const reduce = useReducedMotion();
  const blink = reduce
    ? undefined
    : {
        scaleY: [1, 1, 0.06, 1, 1, 1, 0.06, 1],
        transition: { duration: 5.4, times: [0, 0.6, 0.63, 0.66, 0.82, 0.9, 0.93, 0.96], repeat: Infinity },
      };
  const shape = 'M10 70 C 46 18, 150 6, 194 54 C 168 102, 72 122, 10 70 Z';
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 204 126" role="img" aria-label="EyeSpy logo">
      <defs>
        <radialGradient id="logo-iris" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#FF8AA0" />
          <stop offset="55%" stopColor={color.crimson.DEFAULT} />
          <stop offset="100%" stopColor={color.crimson.deep} />
        </radialGradient>
        <clipPath id="logo-eye">
          <path d={shape} />
        </clipPath>
      </defs>
      <motion.g style={{ originX: '102px', originY: '64px', transformBox: 'view-box' }} animate={wink ? { scaleY: [1, 0.06, 1] } : blink}>
        <path d={shape} fill={color.paper.DEFAULT} />
        <g clipPath="url(#logo-eye)">
          <motion.g
            animate={reduce ? undefined : { x: [0, 16, 16, -14, -14, 0], y: [0, -2, -2, 3, 3, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ellipse cx="102" cy="62" rx="34" ry="40" fill="url(#logo-iris)" stroke="#000" strokeWidth="3" />
            <ellipse cx="102" cy="64" rx="7" ry="22" fill="#05050B" />
            <ellipse cx="88" cy="46" rx="9" ry="7" fill="#FFFFFF" />
            <circle cx="116" cy="80" r="4" fill="#FFFFFF" opacity="0.85" />
          </motion.g>
          <path d="M10 70 C 46 18, 150 6, 194 54" fill="none" stroke="#000" strokeWidth="14" opacity="0.25" transform="translate(0 6)" />
        </g>
        {/* heavy upper lash line with a flick, thin lower line */}
        <path d="M4 72 C 42 14, 152 0, 200 52" fill="none" stroke="#000" strokeWidth="9" strokeLinecap="round" />
        <path d="M8 70 L -2 56 M 22 52 L 12 36" stroke="#000" strokeWidth="7" strokeLinecap="round" />
        <path d="M30 88 C 80 112, 150 100, 188 62" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </motion.g>
      <path d="M150 18 L172 6 M164 30 L190 22" stroke={color.crimson.DEFAULT} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`relative inline-block ${className}`}>
      <h1
        className="title-outline font-display uppercase leading-none tracking-wide text-paper"
        style={{ textShadow: `5px 5px 0 ${color.crimson.DEFAULT}`, fontSize: 'inherit' }}
      >
        Eye<span style={{ color: color.cyan.DEFAULT }}>Spy</span>
      </h1>
      <span aria-hidden="true" className="absolute -right-7 top-0 font-jp text-sm font-black tracking-[0.2em] text-crimson vertical-jp">
        アイスパイ
      </span>
    </div>
  );
}
