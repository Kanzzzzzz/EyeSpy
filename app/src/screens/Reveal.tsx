import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Avatar } from '../art/Avatar';
import { LogoEye } from '../art/Logo';
import { RoleBadge, TeamIcon, TEAM_LABEL } from '../art/RoleBadge';
import { play } from '../audio/sounds';
import { color, motion as m } from '../design/tokens';
import { HAPTICS, vibrate } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Screen, useCountdown } from '../ui/kit';

export function Reveal() {
  const view = useGame((s) => s.snap!.view!);
  const send = useGame((s) => s.send);
  const me = view.me!;
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(false);
  const left = useCountdown(view.revealDeadline);
  const myReady = view.players.find((p) => p.id === me.id)?.ready ?? false;
  const readyCount = view.players.filter((p) => p.ready).length;
  const knows = view.players.filter((p) => me.knows.includes(p.id));
  const team = me.team ?? 'town';

  const show = () => {
    setFlipped(true);
    setSeen(true);
    play('flip');
    void vibrate(HAPTICS.tick);
  };
  const hide = () => setFlipped(false);

  return (
    <Screen className="items-center">
      <div className="mt-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">Your secret role</p>
        <h2 className="mt-1 font-display text-2xl text-paper">Hold the card to look</h2>
        <p className="text-sm text-paper-faint">Let go to hide it. Don't let your neighbours see.</p>
      </div>

      <div className="relative my-6 flex flex-1 items-center justify-center" style={{ perspective: 1200 }}>
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={flipped ? `${me.roleName}. ${me.summary}` : 'Hold to reveal your role'}
          className="relative h-[420px] w-[290px] cursor-pointer select-none"
          style={{ transformStyle: 'preserve-3d', touchAction: 'none' }}
          animate={reduce ? { opacity: 1 } : { rotateY: flipped ? 180 : 0, scale: flipped ? 1.03 : 1 }}
          transition={m.spring}
          onPointerDown={show}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && show()}
          onKeyUp={hide}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Back of the card */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl border-4 border-ink-950 shadow-lift"
            style={{
              backfaceVisibility: 'hidden',
              opacity: reduce && flipped ? 0 : 1,
              background: `repeating-linear-gradient(45deg, ${color.ink[700]} 0 14px, ${color.ink[800]} 14px 28px)`,
            }}
          >
            <div className="rounded-full bg-ink-900 p-4 shadow-card">
              <LogoEye size={140} />
            </div>
            <p className="font-display text-xl italic text-spot">EyeSpy</p>
          </div>
          {/* Face of the card */}
          <div
            className="absolute inset-0 flex flex-col items-center rounded-xl border-4 border-ink-950 bg-ink-850 p-5 text-center shadow-lift"
            style={{
              backfaceVisibility: 'hidden',
              transform: reduce ? undefined : 'rotateY(180deg)',
              opacity: reduce ? (flipped ? 1 : 0) : 1,
              boxShadow: `inset 0 0 0 3px ${color.team[team]}`,
            }}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: color.team[team] }}>
              <TeamIcon team={team} /> {TEAM_LABEL[team]}
            </span>
            <div className="mt-4">{me.role && <RoleBadge role={me.role} team={team} size={130} />}</div>
            <h3 className="mt-3 font-display text-4xl font-semibold text-paper">{me.roleName}</h3>
            <p className="mt-2 text-sm text-paper-dim">{me.summary}</p>
            <p className="mt-3 text-sm text-paper">
              <span className="text-paper-faint">Goal: </span>
              {me.goal}
            </p>
            {knows.length > 0 && (
              <div className="mt-auto w-full rounded-md bg-ink-800 p-2">
                <p className="text-xs text-paper-faint">Your fellow Killers</p>
                <div className="mt-1 flex justify-center gap-2">
                  {knows.map((p) => (
                    <span key={p.id} className="flex flex-col items-center text-xs text-paper">
                      <Avatar id={p.avatar} size={36} expression="sly" />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="w-full">
        <Button size="lg" className="w-full" disabled={!seen || myReady} onClick={() => void send({ type: 'ready' })}>
          {myReady ? 'Waiting for others…' : seen ? "I'm ready" : 'Look at your card first'}
        </Button>
        <p className="mt-2 text-center text-sm text-paper-faint">
          {readyCount}/{view.players.length} ready · starts in {Math.ceil(left / 1000)}s
        </p>
      </div>
    </Screen>
  );
}
