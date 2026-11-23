import { character, type Finisher } from '@eyespy/engine';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { play } from '../audio/sounds';
import { color } from '../design/tokens';
import { fx } from '../fx/fx';
import { runScene, ease, lerp, seg } from '../motion/engine';
import { MAIN_CUT, RealmScene } from '../motion/RealmScene';
import { SlashedFace, type SlashedFaceHandle } from '../motion/SlashedFace';
import { Face } from './Face';

/**
 * Kill animations, played on the victim's phone. The star of every one is the
 * victim's own portrait, cut down in the middle of the screen. The realm is a
 * full motion-graphics piece (RealmScene); the slash and the shadow are
 * lighter versions of the same cut. Drawn in code with Motion, the effects
 * canvas and synthesised sound. With reduced motion they become a simple fade.
 */

function splitMove(move: string): [string, string] {
  const i = move.indexOf(':');
  return i > 0 ? [move.slice(0, i), move.slice(i + 1).trim()] : ['', move];
}

const W = () => window.innerWidth;
const H = () => window.innerHeight;

const DURATION = 2.8;
const CUT_AT = 1.1;

export function FinisherScene({ kind, characterId, avatar, onDone }: { kind: Finisher; characterId: string | null; avatar: number; onDone: () => void }) {
  const reduce = useReducedMotion();
  if (kind === 'realm' && !reduce) return <RealmScene avatar={avatar} onDone={onDone} />;
  return <CutFinisher kind={kind} characterId={characterId} avatar={avatar} onDone={onDone} reduce={!!reduce} />;
}

/** The slash and shadow finishers (and the reduced-motion fallback for every kind). */
function CutFinisher({ kind, characterId, avatar, onDone, reduce }: { kind: Finisher; characterId: string | null; avatar: number; onDone: () => void; reduce: boolean }) {
  const entry = character(characterId);
  const [prefix, moveName] = splitMove(entry?.move ?? 'One Breath');
  const face = useRef<SlashedFaceHandle>(null);
  const [cut, setCut] = useState(false);
  const [{ size, cy }] = useState(() => ({ size: Math.min(W() * 0.62, 250), cy: H() * 0.4 }));
  const tint = kind === 'shadow' ? color.violet.DEFAULT : color.crimson.DEFAULT;

  useEffect(() => {
    if (reduce) {
      play('death');
      const t = setTimeout(onDone, 1400);
      return () => clearTimeout(t);
    }
    const cx = W() / 2;
    const reach = Math.hypot(W(), H());
    let struck = false;
    play(kind === 'shadow' ? 'shadow' : 'whoosh');
    fx.speedLines(cx, cy, 1.1);
    face.current?.pose({ alpha: 0, split: 0, flash: 0 });
    return runScene(
      DURATION,
      (t) => {
        if (t >= CUT_AT && !struck) {
          struck = true;
          setCut(true);
          play(kind === 'shadow' ? 'impact' : 'slash');
          // The blade runs through the portrait's centre, at the angle the portrait splits.
          const dx = Math.cos(MAIN_CUT) * reach * 0.6;
          const dy = Math.sin(MAIN_CUT) * reach * 0.6;
          fx.slash(cx - dx, cy - dy, cx + dx, cy + dy, color.paper.DEFAULT);
          if (kind === 'shadow') for (let i = 1; i <= 2; i++) fx.slash(cx - dx, cy - dy + i * 36, cx + dx, cy + dy + i * 36, tint);
          fx.flash(color.paper.DEFAULT, 160);
          fx.shake(16, 380);
          fx.text(W() * 0.7, cy - size * 0.55, kind === 'shadow' ? 'プツン' : 'ズバッ', { color: tint, size: 62 });
          setTimeout(() => fx.burst(cx, cy, 'splash', { size: 1.5 }), 160);
        }
        const rise = ease.outCubic(seg(t, 0, 0.5));
        const hit = t >= CUT_AT ? Math.exp(-14 * (t - CUT_AT)) * 10 : 0;
        face.current?.pose({
          alpha: rise * (1 - seg(t, 2.3, 2.7)),
          x: (t < CUT_AT ? Math.sin(t * 80) * 2 * seg(t, 0.4, CUT_AT) : 0) + hit,
          y: lerp(40, 0, rise),
          scale: lerp(1.2, 1, rise) * (1 + 0.04 * seg(t, 0.5, CUT_AT)),
          split: ease.outExpo(seg(t, CUT_AT + 0.02, CUT_AT + 0.7)),
          flash: t >= CUT_AT ? 1 - seg(t, CUT_AT, CUT_AT + 0.25) : 0,
          glitch: t > CUT_AT && t < CUT_AT + 0.4 && Math.floor(t * 30) % 4 === 0,
        });
      },
      onDone,
    );
    // The timeline runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduce) {
    return (
      <motion.div className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-4 bg-ink-950" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Face avatar={avatar} size={150} crop="face" expression="dead" />
        <p className="font-display text-3xl uppercase text-crimson">{entry?.move ?? 'Taken'}</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="fixed inset-0 z-[55] overflow-hidden bg-ink-950" initial={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={entry?.move ?? 'You are cut down'} role="img">
      {kind === 'shadow' ? (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, transparent 0%, #000 72%)' }} />
      ) : (
        <div className="speedlines-strong absolute inset-0" />
      )}
      <SlashedFace ref={face} avatar={avatar} size={size} angle={MAIN_CUT} expression={cut ? 'dead' : 'shock'} className="pointer-events-none" style={{ top: cy, opacity: 0 }} />

      {/* The move name, title-card style. */}
      <motion.div
        className="absolute inset-x-4 bottom-[14%] text-center"
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: cut ? 1 : 0, x: cut ? 0 : -60 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      >
        {prefix && <p className="font-display text-2xl uppercase tracking-[0.2em] text-paper-dim">{prefix}</p>}
        <p className="title-outline font-display text-5xl uppercase leading-none text-paper" style={{ textShadow: `5px 5px 0 ${tint}` }}>
          {moveName}
        </p>
        {entry && (
          <p className="mt-2 font-display text-lg uppercase tracking-widest" style={{ color: tint }}>
            {entry.name} · {entry.title}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
