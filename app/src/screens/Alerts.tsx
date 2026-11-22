import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Avatar } from '../art/Avatar';
import { RoleBadge } from '../art/RoleBadge';
import { getRole } from '@eyespy/engine';
import { play } from '../audio/sounds';
import { color, motion as m } from '../design/tokens';
import { HAPTICS, vibrate } from '../platform/device';
import type { Alert } from '../state/alerts';
import { useGame } from '../state/store';
import { useCountdown } from '../ui/kit';

const TONE: Record<Alert['tone'], string> = {
  neutral: color.ink[300],
  danger: color.team.killers,
  good: color.ok,
  spot: color.spot.DEFAULT,
};

/** Removes an alert after its time-to-live. */
function useAutoDismiss(alert: Alert, extraMs = 0) {
  const dismiss = useGame((s) => s.dismiss);
  useEffect(() => {
    if (!alert.ttl) return;
    const t = setTimeout(() => dismiss(alert.id), alert.ttl + extraMs);
    return () => clearTimeout(t);
  }, [alert.id, alert.ttl, extraMs, dismiss]);
}

export function Alerts() {
  const alerts = useGame((s) => s.alerts);
  const toasts = alerts.filter((a) => a.style === 'toast').slice(-3);
  // Big moments show one at a time, oldest first.
  const big = alerts.find((a) => a.style === 'modal' || a.style === 'spotlight' || a.style === 'countdown');
  const pulse = alerts.find((a) => a.style === 'pulse');

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto flex max-w-[520px] flex-col gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((a) => (
            <Toast key={a.id} alert={a} />
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {big?.style === 'countdown' && <Countdown key={big.id} alert={big} />}
        {big?.style === 'modal' && <Modal key={big.id} alert={big} />}
        {big?.style === 'spotlight' && <Spotlight key={big.id} alert={big} />}
      </AnimatePresence>
      <AnimatePresence>{pulse && <Pulse key={pulse.id} alert={pulse} />}</AnimatePresence>
    </>
  );
}

function Toast({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  const dismiss = useGame((s) => s.dismiss);
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={m.spring}
      onClick={() => dismiss(alert.id)}
      className="pointer-events-auto flex min-h-[56px] items-center gap-3 rounded-lg border bg-ink-850/95 px-3 py-2 text-left shadow-lift backdrop-blur"
      style={{ borderColor: TONE[alert.tone] }}
    >
      {alert.avatar !== undefined && <Avatar id={alert.avatar} size={40} expression={alert.tone === 'danger' ? 'dead' : 'raise'} />}
      {alert.emoji && <span className="text-3xl">{alert.emoji}</span>}
      <span className="flex-1">
        <span className="block text-base font-semibold text-paper">{alert.title}</span>
        {alert.body && <span className="block text-sm text-paper-dim">{alert.body}</span>}
      </span>
    </motion.button>
  );
}

/** "Winked! 3, 2, 1". Ends when the death or the "phew" arrives. */
function Countdown({ alert }: { alert: Alert }) {
  const dismiss = useGame((s) => s.dismiss);
  const events = useGame((s) => s.snap?.events ?? []);
  const me = useGame((s) => s.snap?.playerId);
  const left = useCountdown(alert.deadline);
  const secs = Math.ceil(left / 1000);
  const reduce = useReducedMotion();
  const last = useRef(secs);

  useEffect(() => {
    if (secs !== last.current && secs > 0) {
      play('countdown');
      void vibrate(HAPTICS.countdown);
    }
    last.current = secs;
  }, [secs]);

  // Resolve on the outcome, with a safety timeout.
  useEffect(() => {
    const resolved = events.some(
      (e) => e.seq > alert.id && ((e.event.type === 'PlayerDied' && e.event.playerId === me) || e.event.type === 'Phew'),
    );
    if (resolved) dismiss(alert.id);
  }, [events, alert.id, me, dismiss]);
  useEffect(() => {
    if (left > 0) return;
    const t = setTimeout(() => dismiss(alert.id), 2500);
    return () => clearTimeout(t);
  }, [left, alert.id, dismiss]);

  return (
    <motion.div
      role="alertdialog"
      aria-label={`${alert.title} ${secs}`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: `radial-gradient(circle at 50% 45%, rgba(255,90,110,0.35), ${color.ink[950]} 70%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.h2
        className="font-display text-5xl font-semibold text-danger"
        initial={reduce ? false : { scale: 1.6, rotate: -6 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={m.bouncy}
      >
        {alert.title}
      </motion.h2>
      {alert.body && <p className="mt-3 text-lg text-paper">{alert.body}</p>}
      {alert.avatar !== undefined && (
        <div className="mt-4">
          <Avatar id={alert.avatar} size={96} expression="wink" />
        </div>
      )}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={secs}
          className="mt-6 font-display text-[120px] leading-none tabular-nums text-paper"
          initial={reduce ? { opacity: 0 } : { scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {secs > 0 ? secs : '…'}
        </motion.span>
      </AnimatePresence>
      <p className="mt-6 text-sm text-paper-faint">Stay still. Act natural.</p>
    </motion.div>
  );
}

function Modal({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  const dismiss = useGame((s) => s.dismiss);
  const reduce = useReducedMotion();
  const isDeath = alert.title.startsWith("You're dead") || alert.title.startsWith('You died');
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => dismiss(alert.id)}
      role="alertdialog"
      aria-label={alert.title}
    >
      {isDeath && !reduce && <Poof />}
      <motion.div
        className="relative w-full max-w-sm rounded-xl border-2 bg-ink-850 p-6 text-center shadow-lift"
        style={{ borderColor: TONE[alert.tone] }}
        initial={reduce ? { opacity: 0 } : { scale: 0.7, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={m.bouncy}
      >
        {alert.role && (
          <div className="mb-3 flex justify-center">
            <RoleBadge role={alert.role} team={getRole(alert.role).team} size={96} />
          </div>
        )}
        {!alert.role && alert.avatar !== undefined && (
          <div className="mb-3 flex justify-center">
            <Avatar id={alert.avatar} size={110} expression={isDeath ? 'dead' : alert.tone === 'danger' ? 'shock' : 'sly'} />
          </div>
        )}
        {alert.emoji && <div className="mb-2 text-6xl">{alert.emoji}</div>}
        <h2 className="font-display text-2xl font-semibold text-paper">{alert.title}</h2>
        {alert.body && <p className="mt-2 text-paper-dim">{alert.body}</p>}
        <p className="mt-4 text-xs text-paper-faint">Tap to close</p>
      </motion.div>
    </motion.div>
  );
}

/** Plays on every phone at once: the Snitch's tip and arrest verdicts. */
function Spotlight({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  const dismiss = useGame((s) => s.dismiss);
  const reduce = useReducedMotion();
  const verdict = alert.role !== undefined;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink-950/90 px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => dismiss(alert.id)}
      role="alertdialog"
      aria-label={alert.title}
    >
      <motion.div
        className="pointer-events-none absolute left-1/2 top-0 h-[75vh] w-[120vw] -translate-x-1/2"
        style={{ background: `conic-gradient(from 160deg at 50% 0%, transparent 0deg, ${color.spot.glow} 20deg, transparent 40deg)` }}
        initial={reduce ? { opacity: 1 } : { opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.6 }}
      />
      {alert.avatar !== undefined && (
        <motion.div initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...m.soft, delay: 0.15 }}>
          <Avatar id={alert.avatar} size={160} expression={verdict ? (alert.tone === 'good' ? 'sly' : 'shock') : 'shock'} />
        </motion.div>
      )}
      <h2 className="mt-5 font-display text-3xl font-semibold text-paper">{alert.title}</h2>
      {alert.body && <p className="mt-2 text-paper-dim">{alert.body}</p>}
      {verdict && (
        <motion.div
          className="mt-6 rounded-md border-4 px-5 py-2 font-display text-3xl font-bold uppercase tracking-widest"
          style={{ borderColor: TONE[alert.tone], color: TONE[alert.tone] }}
          initial={reduce ? { opacity: 0 } : { scale: 3, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: -8, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 20, delay: 0.35 }}
        >
          {alert.tone === 'good' ? 'Guilty' : 'Innocent'}
        </motion.div>
      )}
    </motion.div>
  );
}

/** The Insomniac's nameless buzz: just a glow at the screen edge. */
function Pulse({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
      style={{ boxShadow: `inset 0 0 60px 10px ${color.spot.glow}` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.9 }}
    />
  );
}

/** A canvas "poof" of smoke when you die. */
function Poof() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2 - 60;
    const puffs = Array.from({ length: 28 }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 3.5;
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, r: 10 + Math.random() * 18, life: 1 };
    });
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of puffs) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 - 0.03;
        p.r += 0.6;
        p.life -= 0.016;
        if (p.life <= 0) continue;
        alive = true;
        ctx.globalAlpha = p.life * 0.5;
        ctx.fillStyle = color.ink[300];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 h-full w-full" aria-hidden="true" />;
}
