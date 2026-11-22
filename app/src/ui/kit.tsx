import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { play, type SoundName } from '../audio/sounds';
import { burstAt, type BurstKind } from '../fx/fx';
import { HAPTICS, vibrate } from '../platform/device';
import { color, motion as m } from '../design/tokens';
import { useGame } from '../state/store';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cyan';

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; shadow: string }> = {
  primary: { bg: color.spot.DEFAULT, fg: color.ink[950], border: '#000', shadow: '#000' },
  danger: { bg: color.crimson.DEFAULT, fg: '#FFFFFF', border: '#000', shadow: '#000' },
  cyan: { bg: color.cyan.DEFAULT, fg: color.ink[950], border: '#000', shadow: '#000' },
  secondary: { bg: color.ink[800], fg: color.paper.DEFAULT, border: color.paper.DEFAULT, shadow: '#000' },
  ghost: { bg: 'transparent', fg: color.paper.dim, border: 'transparent', shadow: 'transparent' },
};

/**
 * The sakuga button: a chunky slanted panel with a hard manga shadow. It
 * squashes when pressed, overshoots on release, and fires an impact burst
 * (with optional sound-effect lettering) when tapped.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  sfx,
  burst = 'impact',
  sound = 'tap',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
  /** Manga lettering to pop on tap, for example "ドン". */
  sfx?: string;
  burst?: BurstKind | null;
  sound?: SoundName;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const v = VARIANTS[variant];
  const sizes = { sm: 'min-h-tap px-4 text-base', md: 'min-h-[52px] px-5 text-lg', lg: 'min-h-[64px] px-6 text-2xl' };
  const ghost = variant === 'ghost';
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scaleX: 1.06, scaleY: 0.86 }}
      transition={m.bouncy}
      className={`relative inline-flex select-none items-center justify-center gap-2 font-display uppercase tracking-wide disabled:opacity-40 ${sizes[size]} ${className}`}
      style={{
        background: v.bg,
        color: v.fg,
        border: ghost ? 'none' : `3px solid ${v.border}`,
        boxShadow: ghost || disabled ? 'none' : `4px 4px 0 0 ${v.shadow}`,
        clipPath: ghost ? undefined : 'polygon(3% 0, 100% 0, 97% 100%, 0 100%)',
        borderRadius: 4,
      }}
      onClick={(e) => {
        play(sound);
        void vibrate(HAPTICS.tap);
        if (burst && !ghost) burstAt(ref.current, burst, { size: 0.8, color: variant === 'secondary' ? color.paper.DEFAULT : v.bg, text: sfx });
        onClick?.(e);
      }}
      {...(rest as object)}
    >
      {children}
    </motion.button>
  );
}

/**
 * Press and hold to confirm. Used for arrests, where a mistap ends the game.
 */
export function HoldButton({
  label,
  holdingLabel = 'Keep holding…',
  ms = 1200,
  onConfirm,
  className = '',
  tone = 'danger',
  disabled,
}: {
  label: string;
  holdingLabel?: string;
  ms?: number;
  onConfirm: () => void;
  className?: string;
  tone?: 'danger' | 'spot';
  disabled?: boolean;
}) {
  const [holding, setHolding] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bg = tone === 'danger' ? color.crimson.DEFAULT : color.spot.DEFAULT;
  const start = () => {
    if (disabled) return;
    setHolding(true);
    void vibrate(HAPTICS.tick);
    play('charge');
    timer.current = setTimeout(() => {
      setHolding(false);
      void vibrate(HAPTICS.arrest);
      burstAt(ref.current, 'impact', { size: 1.4, color: bg, text: 'ドン' });
      onConfirm();
    }, ms);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => cancel, []);
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={`relative min-h-[64px] w-full select-none overflow-hidden font-display text-2xl uppercase tracking-wide disabled:opacity-40 ${className}`}
      style={{
        border: `3px solid ${bg}`,
        color: color.paper.DEFAULT,
        touchAction: 'none',
        background: color.ink[850],
        boxShadow: '4px 4px 0 0 #000',
        clipPath: 'polygon(3% 0, 100% 0, 97% 100%, 0 100%)',
      }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.span
        className="absolute inset-y-0 left-0"
        style={{ background: bg }}
        initial={false}
        animate={{ width: holding ? '100%' : '0%' }}
        transition={{ duration: holding ? ms / 1000 : 0.15, ease: 'linear' }}
      />
      <span className="relative" style={{ color: holding ? '#000' : undefined }}>
        {holding ? holdingLabel : label}
      </span>
    </button>
  );
}

export function Screen({ children, className = '', lines = false }: { children: ReactNode; className?: string; lines?: boolean }) {
  return (
    <motion.main
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: m.base, ease: m.ease }}
      className={`relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] ${className}`}
    >
      {lines && <div aria-hidden="true" className="speedlines pointer-events-none absolute inset-0 -z-10" />}
      {children}
    </motion.main>
  );
}

/** Big outlined anime title with a coloured offset, plus optional Japanese subtitle. */
export function AnimeTitle({ children, jp, size = 'text-4xl', tint = color.crimson.DEFAULT, className = '' }: { children: ReactNode; jp?: string; size?: string; tint?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <h1 className={`title-outline font-display uppercase leading-none tracking-wide text-paper ${size}`} style={{ textShadow: `4px 4px 0 ${tint}` }}>
        {children}
      </h1>
      {jp && <p className="mt-1 font-jp text-sm font-black tracking-[0.3em] text-paper-dim">{jp}</p>}
    </div>
  );
}

export function TopBar({ title, jp, onBack, right }: { title?: string; jp?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-tap items-center gap-3">
      {onBack && (
        <motion.button
          type="button"
          onClick={() => {
            play('tap');
            onBack();
          }}
          whileTap={{ scale: 0.85 }}
          className="flex h-tap w-tap shrink-0 items-center justify-center border-[3px] border-paper bg-ink-800 text-paper"
          style={{ boxShadow: '3px 3px 0 0 #000', clipPath: 'polygon(8% 0, 100% 0, 92% 100%, 0 100%)' }}
          aria-label="Back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </motion.button>
      )}
      {title && (
        <div className="min-w-0">
          <h2 className="title-outline truncate font-display text-3xl uppercase leading-none text-paper" style={{ textShadow: `3px 3px 0 ${color.crimson.DEFAULT}` }}>
            {title}
          </h2>
          {jp && <p className="font-jp text-xs font-black tracking-[0.3em] text-paper-faint">{jp}</p>}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}

/** A manga panel: paper-white border, ink fill, hard shadow. */
export function Card({ children, className = '', tone, tilt = 0 }: { children: ReactNode; className?: string; tone?: string; tilt?: number }) {
  return (
    <section
      className={`relative border-[3px] border-paper bg-ink-850 p-4 ${className}`}
      style={{ boxShadow: `5px 5px 0 0 ${tone ?? '#000'}`, transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      {children}
    </section>
  );
}

export function Label({ children, jp }: { children: ReactNode; jp?: string }) {
  return (
    <p className="mb-2 flex items-baseline gap-2 font-display text-lg uppercase tracking-wide text-cyan">
      {children}
      {jp && <span className="font-jp text-xs font-black text-paper-faint">{jp}</span>}
    </p>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex min-h-tap cursor-pointer items-center gap-3 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex-1">
        <span className="block text-base font-semibold text-paper">{label}</span>
        {hint && <span className="block text-sm text-paper-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          play('select');
          onChange(!checked);
        }}
        className="relative h-9 w-16 shrink-0 border-[3px] border-black transition-colors"
        style={{ background: checked ? color.cyan.DEFAULT : color.ink[600], boxShadow: '3px 3px 0 0 #000' }}
      >
        <motion.span
          className="absolute top-[3px] h-6 w-6 border-[3px] border-black bg-paper"
          initial={false}
          animate={{ left: checked ? 30 : 3 }}
          transition={m.bouncy}
        />
      </button>
    </label>
  );
}

export function Stepper({ label, value, min, max, onChange, format = String, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean }) {
  const btn = 'flex h-tap w-tap items-center justify-center border-[3px] border-black bg-ink-700 font-display text-2xl text-paper disabled:opacity-30';
  return (
    <div className={`flex min-h-tap items-center gap-3 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex-1 text-base font-semibold text-paper">{label}</span>
      <motion.button whileTap={{ scale: 0.85 }} type="button" className={btn} style={{ boxShadow: '3px 3px 0 0 #000' }} disabled={disabled || value <= min} onClick={() => { play('select'); onChange(value - 1); }} aria-label={`Fewer ${label}`}>
        −
      </motion.button>
      <span className="w-14 text-center font-display text-2xl tabular-nums text-paper">{format(value)}</span>
      <motion.button whileTap={{ scale: 0.85 }} type="button" className={btn} style={{ boxShadow: '3px 3px 0 0 #000' }} disabled={disabled || value >= max} onClick={() => { play('select'); onChange(value + 1); }} aria-label={`More ${label}`}>
        +
      </motion.button>
    </div>
  );
}

/** Bottom sheet. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-950/75" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[520px] border-t-[3px] border-paper bg-ink-850 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={m.soft}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 bg-paper-faint" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function QrCode({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const [svg, setSvg] = useState<string>('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: color.paper.DEFAULT } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [text]);
  return (
    <div
      role="img"
      aria-label={label}
      className="overflow-hidden border-[3px] border-black bg-paper p-2"
      style={{ width: size, height: size, boxShadow: '5px 5px 0 0 #000' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function PresenceDot({ state }: { state: 'online' | 'reconnecting' | 'away' | undefined }) {
  const fill = state === 'online' ? color.ok : state === 'reconnecting' ? color.warn : color.ink[400];
  const label = state === 'online' ? 'Connected' : state === 'reconnecting' ? 'Reconnecting' : 'Away';
  return (
    <span title={label} aria-label={label} className="inline-flex h-3.5 w-3.5 items-center justify-center">
      {state === 'reconnecting' ? (
        <motion.span className="h-3.5 w-3.5 border-2 border-black" style={{ background: fill }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      ) : state === 'away' ? (
        <span className="h-3.5 w-3.5 border-2" style={{ borderColor: fill }} />
      ) : (
        <span className="h-3.5 w-3.5 border-2 border-black" style={{ background: fill }} />
      )}
    </span>
  );
}

export function Spinner() {
  return (
    <motion.span
      className="inline-block h-5 w-5 shrink-0 border-[3px] border-paper-faint border-t-cyan"
      style={{ borderRadius: '50%' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/** An eye icon (used for "N eyes on you"). */
export function EyeIcon({ size = 20, open = true }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1 12 C5 4 19 4 23 12 C19 20 5 20 1 12 Z" fill={open ? color.paper.DEFAULT : 'none'} stroke="#000" strokeWidth="2" />
      {open ? <circle cx="12" cy="12" r="4.5" fill={color.cyan.DEFAULT} stroke="#000" strokeWidth="1.5" /> : <path d="M3 12 Q12 18 21 12" stroke={color.paper.DEFAULT} strokeWidth="2" fill="none" />}
    </svg>
  );
}

/** Milliseconds left until a deadline on the host's clock, updated 10x a second. */
export function useCountdown(deadline: number | null | undefined): number {
  const serverNow = () => useGame.getState().client?.serverNow() ?? Date.now();
  const [left, setLeft] = useState(() => (deadline ? Math.max(0, deadline - serverNow()) : 0));
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setLeft(Math.max(0, deadline - (useGame.getState().client?.serverNow() ?? Date.now())));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}
