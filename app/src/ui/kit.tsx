import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { play } from '../audio/sounds';
import { HAPTICS, vibrate } from '../platform/device';
import { color, motion as m } from '../design/tokens';
import { useGame } from '../state/store';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-spot text-ink-950 shadow-spot',
  secondary: 'bg-ink-700 text-paper border border-ink-500',
  ghost: 'bg-transparent text-paper-dim',
  danger: 'bg-danger text-ink-950',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm' }) {
  const sizes = { sm: 'min-h-tap px-4 text-sm', md: 'min-h-tap px-5 text-base', lg: 'min-h-[60px] px-6 text-lg' };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={m.spring}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-body font-semibold tracking-wide transition-opacity disabled:opacity-40 ${VARIANTS[variant]} ${sizes[size]} ${className}`}
      onClick={(e) => {
        play('tap');
        void vibrate(HAPTICS.tap);
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    if (disabled) return;
    setHolding(true);
    void vibrate(HAPTICS.tick);
    timer.current = setTimeout(() => {
      setHolding(false);
      void vibrate(HAPTICS.arrest);
      onConfirm();
    }, ms);
  };
  const cancel = () => {
    setHolding(false);
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => cancel, []);
  const bg = tone === 'danger' ? color.team.killers : color.spot.DEFAULT;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative min-h-[60px] w-full select-none overflow-hidden rounded-lg border-2 font-body text-lg font-semibold disabled:opacity-40 ${className}`}
      style={{ borderColor: bg, color: color.paper.DEFAULT, touchAction: 'none' }}
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
      <span className="relative" style={{ color: holding ? color.ink[950] : undefined }}>
        {holding ? holdingLabel : label}
      </span>
    </button>
  );
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: m.base, ease: m.ease }}
      className={`relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="mb-4 flex min-h-tap items-center gap-2">
      {onBack && (
        <button type="button" onClick={onBack} className="-ml-2 flex h-tap w-tap items-center justify-center rounded-full text-paper-dim" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {title && <h2 className="font-display text-xl font-semibold text-paper">{title}</h2>}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-ink-600/70 bg-ink-850 p-4 shadow-card ${className}`}>{children}</section>;
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-300">{children}</p>;
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex min-h-tap cursor-pointer items-center gap-3 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex-1">
        <span className="block text-base text-paper">{label}</span>
        {hint && <span className="block text-sm text-paper-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          play('select');
          onChange(!checked);
        }}
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors ${checked ? 'border-spot bg-spot' : 'border-ink-500 bg-ink-700'}`}
      >
        <motion.span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-paper shadow"
          initial={false}
          animate={{ left: checked ? 26 : 2 }}
          transition={m.spring}
        />
      </button>
    </label>
  );
}

export function Stepper({ label, value, min, max, onChange, format = String, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean }) {
  const btn = 'flex h-tap w-tap items-center justify-center rounded-full bg-ink-700 text-xl text-paper disabled:opacity-30';
  return (
    <div className={`flex min-h-tap items-center gap-3 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <span className="flex-1 text-base text-paper">{label}</span>
      <button type="button" className={btn} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label}`}>
        −
      </button>
      <span className="w-14 text-center font-display text-xl tabular-nums text-paper">{format(value)}</span>
      <button type="button" className={btn} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  );
}

/** Bottom sheet for picking an action on a player. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-950/70" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[520px] rounded-t-xl border-t border-ink-600 bg-ink-850 px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-lift"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={m.soft}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink-600" />
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
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: color.ink[950], light: color.paper.DEFAULT } })
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
      className="overflow-hidden rounded-md bg-paper p-2"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function PresenceDot({ state }: { state: 'online' | 'reconnecting' | 'away' | undefined }) {
  const fill = state === 'online' ? color.ok : state === 'reconnecting' ? color.warn : color.ink[400];
  const label = state === 'online' ? 'Connected' : state === 'reconnecting' ? 'Reconnecting' : 'Away';
  return (
    <span title={label} aria-label={label} className="inline-flex h-3 w-3 items-center justify-center">
      {state === 'reconnecting' ? (
        <motion.span className="h-3 w-3 rounded-full" style={{ background: fill }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      ) : state === 'away' ? (
        <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: fill }} />
      ) : (
        <span className="h-3 w-3 rounded-full" style={{ background: fill }} />
      )}
    </span>
  );
}

export function Spinner() {
  return (
    <motion.span
      className="inline-block h-5 w-5 rounded-full border-2 border-paper-faint border-t-spot"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    />
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
