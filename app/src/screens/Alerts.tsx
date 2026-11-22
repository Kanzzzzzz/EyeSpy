import { character, getRole } from '@eyespy/engine';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { AnimeFace } from '../art/AnimeFace';
import { publicLook, roleLook } from '../art/characters';
import { FinisherScene } from '../art/Finishers';
import { RoleBadge } from '../art/RoleBadge';
import { play } from '../audio/sounds';
import { color, motion as m } from '../design/tokens';
import { fx } from '../fx/fx';
import { HAPTICS, vibrate } from '../platform/device';
import type { Alert } from '../state/alerts';
import { useGame } from '../state/store';
import { useCountdown } from '../ui/kit';

const TONE: Record<Alert['tone'], string> = {
  neutral: color.paper.DEFAULT,
  danger: color.crimson.DEFAULT,
  good: color.ok,
  spot: color.spot.DEFAULT,
};

/** Removes an alert after its time-to-live. */
function useAutoDismiss(alert: Alert, extraMs = 0, enabled = true) {
  const dismiss = useGame((s) => s.dismiss);
  useEffect(() => {
    if (!alert.ttl || !enabled) return;
    const t = setTimeout(() => dismiss(alert.id), alert.ttl + extraMs);
    return () => clearTimeout(t);
  }, [alert.id, alert.ttl, extraMs, dismiss, enabled]);
}

export function Alerts() {
  const alerts = useGame((s) => s.alerts);
  const toasts = alerts.filter((a) => a.style === 'toast').slice(-3);
  // Big moments show one at a time, oldest first.
  const big = alerts.find((a) => ['modal', 'spotlight', 'countdown', 'finisher'].includes(a.style));
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
        {big?.style === 'finisher' && <FinisherAlert key={big.id} alert={big} />}
      </AnimatePresence>
      <AnimatePresence>{pulse && <Pulse key={pulse.id} alert={pulse} />}</AnimatePresence>
    </>
  );
}

function Portrait({ alert, size, expression = 'neutral' }: { alert: Alert; size: number; expression?: 'neutral' | 'shock' | 'sly' | 'dead' | 'wink' | 'raise' }) {
  if (alert.character) return <AnimeFace look={roleLook(alert.character)} size={size} crop="face" expression={expression} />;
  if (alert.avatar !== undefined) return <AnimeFace look={publicLook(alert.avatar)} size={size} crop="face" expression={expression} />;
  return null;
}

function Toast({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  const dismiss = useGame((s) => s.dismiss);
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: 60, skewX: -8 }}
      animate={{ opacity: 1, x: 0, skewX: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={m.bouncy}
      onClick={() => dismiss(alert.id)}
      className="pointer-events-auto flex min-h-[58px] items-center gap-3 border-[3px] border-black bg-paper px-2 py-1.5 text-left"
      style={{ boxShadow: `5px 5px 0 0 ${TONE[alert.tone]}` }}
    >
      {alert.avatar !== undefined && (
        <span className="shrink-0 border-2 border-black bg-ink-800">
          <AnimeFace look={publicLook(alert.avatar)} size={44} crop="face" expression={alert.tone === 'danger' ? 'shock' : 'raise'} />
        </span>
      )}
      {alert.emoji && <span className="text-3xl">{alert.emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg uppercase leading-tight text-ink-950">{alert.title}</span>
        {alert.body && <span className="block text-sm font-semibold text-ink-600">{alert.body}</span>}
      </span>
    </motion.button>
  );
}

/** "Winked!" A heartbeat countdown that ends when the death or the "phew" arrives. */
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
      play('heartbeat');
      void vibrate(HAPTICS.countdown);
      fx.shake(4, 160);
    }
    last.current = secs;
  }, [secs]);

  useEffect(() => {
    const resolved = events.some((e) => e.seq > alert.id && ((e.event.type === 'PlayerDied' && e.event.playerId === me) || e.event.type === 'Phew'));
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ backgroundColor: color.ink[950], backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,45,85,0.45), transparent 70%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="speedlines-strong absolute inset-0 opacity-60" />
      {alert.avatar !== undefined && (
        <motion.div className="relative w-full max-w-[460px] border-y-[5px] border-black bg-ink-900" initial={{ x: '-100%' }} animate={{ x: 0 }} transition={{ duration: 0.25 }}>
          <AnimeFace look={publicLook(alert.avatar)} size={460} crop="eyes" expression="wink" className="h-auto w-full" />
        </motion.div>
      )}
      <motion.h2
        className="title-outline relative mt-4 font-display text-6xl uppercase leading-none text-crimson"
        style={{ textShadow: '5px 5px 0 #000' }}
        initial={reduce ? false : { scale: 2, rotate: -8 }}
        animate={{ scale: 1, rotate: -3 }}
        transition={m.bouncy}
      >
        {alert.title}
      </motion.h2>
      {alert.body && <p className="relative mt-2 font-display text-xl uppercase text-paper">{alert.body}</p>}
      <AnimatePresence mode="popLayout">
        <motion.span
          key={secs}
          className="title-outline relative mt-4 font-display text-[150px] leading-none tabular-nums text-paper"
          initial={reduce ? { opacity: 0 } : { scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.22 }}
        >
          {secs > 0 ? secs : '…'}
        </motion.span>
      </AnimatePresence>
      <p className="relative mt-4 font-display text-lg uppercase tracking-widest text-paper-faint">Stay still. Act natural.</p>
    </motion.div>
  );
}

/** Your death: the killer character's finisher, then the death card. */
function FinisherAlert({ alert }: { alert: Alert }) {
  const [done, setDone] = useState(false);
  const dismiss = useGame((s) => s.dismiss);
  useAutoDismiss(alert, 0, done);
  const killer = character(alert.character);
  return (
    <AnimatePresence mode="wait">
      {!done ? (
        <FinisherScene key="scene" kind={alert.finisher ?? 'slash'} characterId={alert.character ?? null} onDone={() => setDone(true)} />
      ) : (
        <motion.div
          key="card"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-950 px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => dismiss(alert.id)}
          role="alertdialog"
          aria-label={alert.title}
        >
          <div className="screentone absolute inset-0 opacity-60" />
          {alert.avatar !== undefined && (
            <div className="relative border-[4px] border-paper bg-ink-800 grayscale" style={{ boxShadow: `6px 6px 0 0 ${color.crimson.DEFAULT}` }}>
              <AnimeFace look={publicLook(alert.avatar)} size={170} crop="face" expression="dead" />
            </div>
          )}
          <h2 className="title-outline relative mt-5 font-display text-6xl uppercase leading-none text-paper" style={{ textShadow: `5px 5px 0 ${color.crimson.DEFAULT}` }}>
            {alert.title}
          </h2>
          {killer && (
            <p className="relative mt-2 font-display text-lg uppercase tracking-wider text-crimson">
              Taken by {killer.name}, {killer.title}
            </p>
          )}
          {alert.body && <p className="relative mt-2 font-semibold text-paper-dim">{alert.body}</p>}
          <p className="relative mt-6 text-xs font-semibold uppercase text-paper-faint">Tap to close</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Modal({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  const dismiss = useGame((s) => s.dismiss);
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/85 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => dismiss(alert.id)}
      role="alertdialog"
      aria-label={alert.title}
    >
      <div className="speedlines absolute inset-0" />
      <motion.div
        className="relative w-full max-w-sm border-[4px] border-paper bg-ink-850 p-6 text-center"
        style={{ boxShadow: `7px 7px 0 0 ${TONE[alert.tone]}` }}
        initial={reduce ? { opacity: 0 } : { scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={m.bouncy}
      >
        {alert.role && (
          <div className="mb-3 flex justify-center">
            <RoleBadge role={alert.role} team={getRole(alert.role).team} size={96} />
          </div>
        )}
        {!alert.role && (alert.character || alert.avatar !== undefined) && (
          <div className="mb-3 flex justify-center">
            <div className="border-[3px] border-black bg-ink-800">
              <Portrait alert={alert} size={120} expression={alert.tone === 'danger' ? 'shock' : 'sly'} />
            </div>
          </div>
        )}
        {alert.emoji && <div className="mb-2 text-6xl">{alert.emoji}</div>}
        <h2 className="title-outline font-display text-3xl uppercase leading-tight text-paper">{alert.title}</h2>
        {alert.body && <p className="mt-2 font-semibold text-paper-dim">{alert.body}</p>}
        <p className="mt-4 text-xs font-semibold uppercase text-paper-faint">Tap to close</p>
      </motion.div>
    </motion.div>
  );
}

/** Plays on every phone at once: the Snitch's tip, arrest and hearing verdicts. */
function Spotlight({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  const dismiss = useGame((s) => s.dismiss);
  const reduce = useReducedMotion();
  const verdict = alert.role !== undefined || alert.title === 'Hung jury';
  const stamp = alert.tone === 'good' ? 'Guilty' : alert.title === 'Hung jury' ? 'Tied' : alert.title.includes('voted out') ? 'Out' : 'Innocent';
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink-950/95 px-6 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => dismiss(alert.id)}
      role="alertdialog"
      aria-label={alert.title}
    >
      <motion.div
        className="pointer-events-none absolute left-[-10vw] top-0 h-[75vh] w-[120vw] origin-top"
        style={{ background: `conic-gradient(from 160deg at 50% 0%, transparent 0deg, ${color.spot.glow} 20deg, transparent 40deg)` }}
        initial={reduce ? { opacity: 1 } : { opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.5 }}
      />
      {alert.avatar !== undefined && (
        <motion.div className="relative border-[4px] border-paper bg-ink-800" style={{ boxShadow: `6px 6px 0 0 ${TONE[alert.tone]}` }} initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...m.soft, delay: 0.1 }}>
          <AnimeFace look={publicLook(alert.avatar)} size={170} crop="face" expression="shock" />
        </motion.div>
      )}
      <h2 className="title-outline relative mt-5 font-display text-4xl uppercase leading-tight text-paper" style={{ textShadow: `4px 4px 0 ${TONE[alert.tone]}` }}>
        {alert.title}
      </h2>
      {alert.body && <p className="relative mt-2 font-display text-lg uppercase tracking-wide text-paper-dim">{alert.body}</p>}
      {verdict && (
        <motion.div
          className="relative mt-6 border-[5px] px-5 py-1 font-display text-4xl uppercase tracking-widest"
          style={{ borderColor: TONE[alert.tone], color: TONE[alert.tone] }}
          initial={reduce ? { opacity: 0 } : { scale: 3, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -8, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 640, damping: 18, delay: 0.3 }}
        >
          {stamp}
        </motion.div>
      )}
    </motion.div>
  );
}

/** The Insomniac's nameless buzz: a glow at the screen edge. */
function Pulse({ alert }: { alert: Alert }) {
  useAutoDismiss(alert);
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
      style={{ boxShadow: `inset 0 0 70px 12px ${color.violet.glow}` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 0.9 }}
    />
  );
}
