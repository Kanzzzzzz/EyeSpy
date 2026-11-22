import { character, type Finisher } from '@eyespy/engine';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { play } from '../audio/sounds';
import { color } from '../design/tokens';
import { fx } from '../fx/fx';
import { AnimeFace } from './AnimeFace';
import { roleLook } from './characters';

/**
 * Kill animations, played on the victim's phone. Each Killer character has
 * one: a realm that swallows the screen, a single blade flash, or shadow
 * puppetry. Drawn in code with Motion, the effects canvas and synthesised
 * sound. With reduced motion they become a simple fade.
 */

function splitMove(move: string): [string, string] {
  const i = move.indexOf(':');
  return i > 0 ? [move.slice(0, i), move.slice(i + 1).trim()] : ['', move];
}

function useTimeline(steps: [number, () => void][], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const timers = steps.map(([ms, fn]) => setTimeout(fn, ms));
    return () => timers.forEach(clearTimeout);
    // The timeline runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

const W = () => window.innerWidth;
const H = () => window.innerHeight;

export function FinisherScene({ kind, characterId, onDone }: { kind: Finisher; characterId: string | null; onDone: () => void }) {
  const reduce = useReducedMotion();
  const entry = character(characterId);
  const look = roleLook(characterId, 'killer');
  const [prefix, moveName] = splitMove(entry?.move ?? 'One Breath');
  const [stage, setStage] = useState(0);

  const realm: [number, () => void][] = [
    [0, () => play('realm')],
    [1200, () => {
      setStage(1);
      fx.flash('#FFFFFF', 220);
      fx.shake(14, 500);
      fx.text(W() * 0.7, H() * 0.24, 'ゴゴゴ', { color: color.crimson.DEFAULT, size: 64 });
    }],
    [2200, () => {
      setStage(2);
      for (let i = 0; i < 7; i++) {
        setTimeout(() => {
          const y = H() * (0.2 + Math.random() * 0.6);
          fx.slash(-20, y - 60 + Math.random() * 120, W() + 20, y + Math.random() * 80 - 40, i % 2 ? color.crimson.DEFAULT : '#FFFFFF');
          if (i % 2 === 0) play('slash');
        }, i * 90);
      }
      setTimeout(() => {
        fx.flash(color.crimson.DEFAULT, 260);
        fx.shake(18, 400);
        fx.text(W() / 2, H() / 2, 'ズバババッ', { color: '#FFFFFF', size: 58 });
      }, 650);
    }],
    [3400, onDone],
  ];
  const slash: [number, () => void][] = [
    [0, () => {
      play('whoosh');
      fx.speedLines(W() / 2, H() / 2, 1.1);
    }],
    [700, () => setStage(1)],
    [1250, () => {
      setStage(2);
      fx.slash(-30, H() * 0.55, W() + 30, H() * 0.45, '#FFFFFF');
      fx.flash('#FFFFFF', 160);
      fx.shake(16, 380);
      play('slash');
      fx.text(W() * 0.66, H() * 0.36, 'ズバッ', { color: color.crimson.DEFAULT, size: 64 });
    }],
    [1700, () => fx.burst(W() / 2, H() / 2, 'splash', { size: 1.6 })],
    [2700, onDone],
  ];
  const shadow: [number, () => void][] = [
    [0, () => play('shadow')],
    [800, () => setStage(1)],
    [1900, () => {
      setStage(2);
      for (let i = 0; i < 5; i++) fx.slash(W() * (0.2 + i * 0.15), 0, W() * (0.18 + i * 0.15), H() * 0.5, color.violet.DEFAULT);
      fx.flash(color.violet.DEFAULT, 200);
      fx.shake(10, 300);
      play('impact');
      fx.text(W() / 2, H() * 0.3, 'プツン', { color: color.violet.DEFAULT, size: 58 });
    }],
    [2900, onDone],
  ];
  useTimeline(kind === 'realm' ? realm : kind === 'slash' ? slash : shadow, !reduce);
  useEffect(() => {
    if (!reduce) return;
    play('death');
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [reduce, onDone]);

  if (reduce) {
    return (
      <motion.div className="fixed inset-0 z-[55] flex items-center justify-center bg-ink-950" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <p className="font-display text-3xl uppercase text-crimson">{entry?.move ?? 'Taken'}</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="fixed inset-0 z-[55] overflow-hidden bg-ink-950" initial={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={entry?.move ?? 'Finisher'} role="img">
      {kind === 'realm' && (
        <>
          {/* Ink floods the screen from the centre: the realm closes in. */}
          <motion.div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 50%, #3A0010 0%, ${color.crimson.deep} 30%, #120006 70%)` }}
            initial={{ clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)' }}
            transition={{ duration: 1.1, ease: [0.7, 0, 0.3, 1] }}
          />
          <motion.svg className="absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-60" viewBox="-100 -100 200 200" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
            {Array.from({ length: 48 }, (_, i) => (
              <rect key={i} x={-1} y={-96} width={2} height={i % 4 === 0 ? 14 : 6} fill={i % 4 === 0 ? color.crimson.DEFAULT : '#FFFFFF'} transform={`rotate(${i * 7.5})`} />
            ))}
            <circle r={70} fill="none" stroke={color.crimson.DEFAULT} strokeWidth={1.2} />
            <circle r={52} fill="none" stroke="#FFFFFF" strokeWidth={0.6} strokeDasharray="2 4" />
          </motion.svg>
          <motion.div
            className="absolute inset-x-0 top-[16%] flex justify-center"
            initial={{ opacity: 0, scale: 1.5, y: 40 }}
            animate={{ opacity: stage >= 1 ? 1 : 0.25, scale: stage >= 1 ? 1 : 1.3, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnimeFace look={look} size={Math.min(W() * 0.86, 380)} crop="face" expression="sly" glowEyes />
          </motion.div>
        </>
      )}

      {kind === 'slash' && (
        <>
          <div className="speedlines-strong absolute inset-0" />
          <motion.div
            className="absolute inset-x-0 top-[34%] border-y-[6px] border-black"
            style={{ background: color.ink[900] }}
            initial={{ x: '-100%' }}
            animate={stage >= 2 ? { x: 0, y: [0, -30], rotate: [0, -2] } : { x: 0 }}
            transition={{ duration: stage >= 2 ? 0.5 : 0.35, ease: 'easeOut' }}
          >
            <div className="flex justify-center py-2">
              <AnimeFace look={look} size={Math.min(W(), 520)} crop="eyes" expression={stage >= 1 ? 'angry' : 'neutral'} glowEyes={stage >= 1} />
            </div>
          </motion.div>
          {stage >= 2 && <motion.div className="absolute inset-x-0 top-1/2 h-1 bg-paper" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.12 }} />}
        </>
      )}

      {kind === 'shadow' && (
        <>
          <motion.div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 50%, transparent 0%, #000 70%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
          />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {Array.from({ length: 12 }, (_, i) => {
              const x = (i / 11) * 100;
              return (
                <motion.path
                  key={i}
                  d={`M ${x} ${i % 2 ? 0 : 100} C ${x + 10} 40, ${x - 14} 60, 50 50`}
                  fill="none"
                  stroke={i % 3 === 0 ? color.violet.DEFAULT : '#120A22'}
                  strokeWidth={i % 3 === 0 ? 0.8 : 2.2}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.4, delay: i * 0.05, ease: 'easeInOut' }}
                />
              );
            })}
            {stage >= 1 &&
              Array.from({ length: 5 }, (_, i) => (
                <motion.line key={`s${i}`} x1={20 + i * 15} y1={0} x2={20 + i * 15} y2={stage >= 2 ? 20 : 48} stroke="#FFFFFF" strokeWidth={0.3} initial={{ y2: 0 }} animate={{ y2: stage >= 2 ? 20 : 48 }} transition={{ duration: 0.5 }} />
              ))}
          </svg>
          <motion.div className="absolute inset-x-0 top-[20%] flex justify-center" initial={{ opacity: 0, y: -30 }} animate={{ opacity: stage >= 1 ? 1 : 0, y: 0 }} transition={{ duration: 0.8 }}>
            <AnimeFace look={look} size={Math.min(W() * 0.8, 360)} crop="face" expression="sly" glowEyes />
          </motion.div>
        </>
      )}

      {/* The move name, title-card style. */}
      <motion.div
        className="absolute inset-x-4 bottom-[14%] text-center"
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: stage >= 1 ? 1 : 0, x: stage >= 1 ? 0 : -60 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      >
        {prefix && <p className="font-display text-2xl uppercase tracking-[0.2em] text-paper-dim">{prefix}</p>}
        <p className="title-outline font-display text-5xl uppercase leading-none text-paper" style={{ textShadow: `5px 5px 0 ${color.crimson.DEFAULT}` }}>
          {moveName}
        </p>
        {entry && <p className="mt-2 font-display text-lg uppercase tracking-widest text-crimson">{entry.name} · {entry.title}</p>}
      </motion.div>
    </motion.div>
  );
}
