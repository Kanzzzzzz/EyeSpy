import { character } from '@eyespy/engine';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { CourtScene } from '../motion/CourtScene';
import { Face } from '../art/Face';
import { color, motion as m } from '../design/tokens';
import { burstAt } from '../fx/fx';
import { play } from '../audio/sounds';
import { useGame } from '../state/store';
import { useCountdown } from '../ui/kit';

/**
 * The Judge's hearing: play stops, the Judge's character presides, and every
 * living player votes someone out. Ballots are secret: everyone sees who has
 * voted, never for whom.
 */
export function Hearing() {
  const view = useGame((s) => s.snap!.view!);
  const events = useGame((s) => s.snap!.events);
  const vote = useGame((s) => s.vote);
  const hearing = view.hearing;
  const left = useCountdown(hearing?.endsAt ?? null);
  const me = view.me;
  const started = [...events].reverse().find((e) => e.event.type === 'HearingStarted')?.event;
  const judgeCharacter = started?.type === 'HearingStarted' ? started.judgeCharacter : null;
  const judge = character(judgeCharacter);
  const gavel = useRef<HTMLDivElement>(null);
  const candidates = view.players.filter((p) => p.alive && p.id !== me?.id);
  const canVote = !!me?.alive;
  const reduce = useReducedMotion();
  // The court opens with its motion-graphics intro, once per hearing.
  const [introFor, setIntroFor] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState<number | null>(null);
  if (hearing && introFor !== hearing.endsAt) setIntroFor(hearing.endsAt);
  const showIntro = !!hearing && !reduce && introDone !== hearing.endsAt;

  useEffect(() => {
    if (!hearing || !reduce) return;
    play('court');
    burstAt(gavel.current, 'impact', { size: 1.6, color: color.spot.DEFAULT, text: 'カンッ' });
  }, [hearing?.endsAt, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (showIntro) return <CourtScene characterId={judgeCharacter} onDone={() => setIntroDone(hearing!.endsAt)} />;

  return (
    <AnimatePresence>
      {hearing && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-ink-950/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-label="Hearing: vote someone out"
        >
          <div className="speedlines absolute inset-0 -z-10" />
          <div className="mx-auto w-full max-w-[520px]">
            <div className="flex items-start gap-3">
              <motion.div
                ref={gavel}
                initial={{ x: -80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={m.bouncy}
                className="shrink-0 border-[4px] border-paper bg-ink-800"
                style={{ boxShadow: `5px 5px 0 0 ${color.spot.DEFAULT}` }}
              >
                <Face character={judgeCharacter} role={'judge'} size={110} crop="face" expression="angry" glowEyes />
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="font-jp text-sm font-black tracking-[0.4em] text-spot">審判</p>
                <h2 className="title-outline font-display text-5xl uppercase leading-none text-paper" style={{ textShadow: `4px 4px 0 ${color.spot.DEFAULT}` }}>
                  Hearing
                </h2>
                <p className="mt-1 font-display text-base uppercase tracking-wide text-spot">{judge ? judge.move : 'Court is in session'}</p>
              </div>
              <div className="text-center">
                <p className="font-display text-5xl tabular-nums leading-none text-paper">{Math.ceil(left / 1000)}</p>
                <p className="text-xs font-semibold uppercase text-paper-faint">sec</p>
              </div>
            </div>

            <p className="mt-4 border-[3px] border-paper bg-ink-850 p-3 text-sm font-semibold text-paper-dim">
              {canVote
                ? 'Vote someone out. The most votes is eliminated; a tie frees everyone. Vote out a Sheriff and the town loses.'
                : 'Ghosts watch the hearing in silence.'}
            </p>

            <ul className="mt-4 grid grid-cols-2 gap-3">
              {candidates.map((p) => {
                const mine = hearing.myVote === p.id;
                const voted = hearing.voted.includes(p.id);
                return (
                  <li key={p.id}>
                    <motion.button
                      type="button"
                      whileTap={{ scaleX: 1.06, scaleY: 0.9 }}
                      transition={m.bouncy}
                      disabled={!canVote}
                      onClick={(e) => {
                        play('vote');
                        burstAt(e.currentTarget, 'impact', { size: 0.9, color: color.crimson.DEFAULT, text: mine ? undefined : '票' });
                        void vote(p.id);
                      }}
                      className="relative flex w-full items-center gap-2 border-[3px] p-1.5 text-left disabled:opacity-60"
                      style={{
                        borderColor: mine ? color.crimson.DEFAULT : color.paper.DEFAULT,
                        background: mine ? color.crimson.deep : color.ink[800],
                        boxShadow: mine ? `0 0 20px ${color.crimson.glow}` : '4px 4px 0 0 #000',
                      }}
                      aria-pressed={mine}
                      aria-label={`Vote out ${p.name}${voted ? ' (has voted)' : ''}`}
                    >
                      <Face avatar={p.avatar} size={52} crop="face" expression={mine ? 'shock' : 'neutral'} />
                      <span className="min-w-0 flex-1 truncate font-display text-xl uppercase text-paper">{p.name}</span>
                      {voted && (
                        <span className="absolute -right-2 -top-2 rotate-12 border-2 border-black bg-spot px-1 font-display text-xs uppercase text-ink-950">
                          Voted
                        </span>
                      )}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            {me && me.alive && hearing.voted.includes(me.id) && (
              <p className="mt-4 text-center font-display text-lg uppercase text-paper-dim">Your vote is in. Tap another name to change it.</p>
            )}
            <p className="mt-2 text-center text-xs font-semibold text-paper-faint">
              {hearing.voted.length}/{view.players.filter((p) => p.alive).length} voted
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
