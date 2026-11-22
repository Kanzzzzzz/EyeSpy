import { ROSTER } from '@eyespy/engine';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { AnimeFace } from '../art/AnimeFace';
import { publicLook, roleLook } from '../art/characters';
import { LogoEye } from '../art/Logo';
import { RoleBadge, TeamIcon, TEAM_LABEL } from '../art/RoleBadge';
import { play } from '../audio/sounds';
import { color, motion as m } from '../design/tokens';
import { burstAt } from '../fx/fx';
import { HAPTICS, vibrate } from '../platform/device';
import { useGame } from '../state/store';
import { Button, Screen, useCountdown } from '../ui/kit';

function useHold() {
  const [held, setHeld] = useState(false);
  const bind = {
    onPointerDown: () => {
      setHeld(true);
      play('flip');
      void vibrate(HAPTICS.tick);
    },
    onPointerUp: () => setHeld(false),
    onPointerLeave: () => setHeld(false),
    onPointerCancel: () => setHeld(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { touchAction: 'none' as const },
  };
  return [held, bind] as const;
}

export function Reveal() {
  const view = useGame((s) => s.snap!.view!);
  const send = useGame((s) => s.send);
  const pickCharacter = useGame((s) => s.pickCharacter);
  const me = view.me!;
  const reduce = useReducedMotion();
  const [flipped, bind] = useHold();
  const [seen, setSeen] = useState(false);
  const left = useCountdown(view.revealDeadline);
  const myReady = view.players.find((p) => p.id === me.id)?.ready ?? false;
  const readyCount = view.players.filter((p) => p.ready).length;
  const knows = view.players.filter((p) => me.knows.includes(p.id));
  const team = me.team ?? 'town';
  const options = me.role ? ROSTER[me.role] : [];
  if (flipped && !seen) setSeen(true);

  return (
    <Screen className="items-center">
      <div className="mt-1 text-center">
        <p className="font-jp text-xs font-black tracking-[0.4em] text-paper-faint">あなたの役職</p>
        <h2 className="title-outline font-display text-4xl uppercase leading-none text-paper" style={{ textShadow: `4px 4px 0 ${color.crimson.DEFAULT}` }}>
          Hold to look
        </h2>
        <p className="text-sm font-semibold text-paper-faint">Let go to hide it. Don't let your neighbours see.</p>
      </div>

      <div className="relative my-4 flex items-center justify-center" style={{ perspective: 1200 }}>
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={flipped ? `${me.roleName}. ${me.summary}` : 'Hold to reveal your role'}
          className="relative h-[330px] w-[260px] cursor-pointer select-none"
          style={{ transformStyle: 'preserve-3d', ...bind.style }}
          animate={reduce ? { opacity: 1 } : { rotateY: flipped ? 180 : 0, scale: flipped ? 1.04 : 1 }}
          transition={m.spring}
          onPointerDown={bind.onPointerDown}
          onPointerUp={bind.onPointerUp}
          onPointerLeave={bind.onPointerLeave}
          onPointerCancel={bind.onPointerCancel}
          onContextMenu={bind.onContextMenu}
        >
          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-[4px] border-paper"
            style={{
              backfaceVisibility: 'hidden',
              opacity: reduce && flipped ? 0 : 1,
              background: `repeating-linear-gradient(45deg, ${color.ink[700]} 0 12px, ${color.ink[850]} 12px 24px)`,
              boxShadow: `6px 6px 0 0 ${color.crimson.DEFAULT}`,
            }}
          >
            <div className="speedlines absolute inset-0" />
            <LogoEye size={150} />
            <p className="title-outline font-display text-3xl uppercase text-paper">EyeSpy</p>
          </div>
          {/* Face */}
          <div
            className="absolute inset-0 flex flex-col items-center border-[4px] border-paper bg-ink-850 p-4 text-center"
            style={{
              backfaceVisibility: 'hidden',
              transform: reduce ? undefined : 'rotateY(180deg)',
              opacity: reduce ? (flipped ? 1 : 0) : 1,
              boxShadow: `6px 6px 0 0 ${color.team[team]}`,
            }}
          >
            <span className="flex items-center gap-1.5 font-display text-lg uppercase tracking-wider" style={{ color: color.team[team] }}>
              <TeamIcon team={team} /> {TEAM_LABEL[team]}
            </span>
            <div className="mt-2 flex items-end gap-2">
              {me.role && <RoleBadge role={me.role} team={team} size={86} />}
              <AnimeFace look={roleLook(me.character, me.role)} size={86} crop="face" />
            </div>
            <h3 className="title-outline mt-2 font-display text-5xl uppercase leading-none text-paper">{me.roleName}</h3>
            <p className="mt-2 text-sm font-semibold text-paper-dim">{me.summary}</p>
            <p className="mt-2 text-sm text-paper">
              <span className="font-display uppercase text-paper-faint">Goal: </span>
              {me.goal}
            </p>
            {knows.length > 0 && (
              <div className="mt-auto flex items-center gap-2">
                <span className="text-xs font-semibold text-paper-faint">Fellow Killers:</span>
                {knows.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 text-xs font-semibold text-paper">
                    <AnimeFace look={publicLook(p.avatar)} size={30} crop="face" expression="sly" />
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Secret character pick: hold a card to see it, tap Choose to take it. */}
      <div className="w-full">
        <p className="mb-2 font-display text-xl uppercase text-cyan">
          Pick your character <span className="font-jp text-xs font-black text-paper-faint">キャラ選択</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((c) => (
            <CharacterCard key={c.id} id={c.id} name={c.name} title={c.title} move={c.move} chosen={me.character === c.id} onChoose={() => void pickCharacter(c.id)} />
          ))}
        </div>
      </div>

      <div className="mt-4 w-full">
        <Button size="lg" className="w-full" disabled={!seen || myReady} onClick={() => void send({ type: 'ready' })} sfx="よし">
          {myReady ? 'Waiting for others…' : seen ? "I'm ready" : 'Look at your card first'}
        </Button>
        <p className="mt-2 text-center text-sm font-semibold text-paper-faint">
          {readyCount}/{view.players.length} ready · starts in {Math.ceil(left / 1000)}s
        </p>
      </div>
    </Screen>
  );
}

function CharacterCard({ id, name, title, move, chosen, onChoose }: { id: string; name: string; title: string; move: string; chosen: boolean; onChoose: () => void }) {
  const [held, bind] = useHold();
  return (
    <div className="flex flex-col gap-1.5">
      <div
        {...bind}
        className="relative aspect-[3/4] select-none overflow-hidden border-[3px]"
        style={{ ...bind.style, borderColor: chosen ? color.cyan.DEFAULT : color.paper.DEFAULT, boxShadow: chosen ? `0 0 16px ${color.cyan.glow}` : '4px 4px 0 0 #000' }}
        role="button"
        aria-label={held ? `${name}, ${title}. ${move}` : 'Hold to see this character'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {held ? (
            <motion.div key="face" className="absolute inset-0 flex flex-col items-center bg-ink-800" initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} exit={{ rotateY: -90 }} transition={{ duration: 0.12 }}>
              <div className="w-full" style={{ background: `${roleLook(id).accent}44` }}>
                <AnimeFace look={roleLook(id)} size={120} crop="face" className="h-auto w-full" />
              </div>
              <p className="px-1 font-display text-sm uppercase leading-tight text-paper">{name}</p>
              <p className="px-1 text-[10px] font-semibold leading-tight text-paper-faint">{move}</p>
            </motion.div>
          ) : (
            <motion.div key="back" className="absolute inset-0 flex items-center justify-center" style={{ background: `repeating-linear-gradient(-45deg, ${color.ink[700]} 0 8px, ${color.ink[850]} 8px 16px)` }} initial={{ rotateY: -90 }} animate={{ rotateY: 0 }} exit={{ rotateY: 90 }} transition={{ duration: 0.12 }}>
              <span className="font-display text-4xl text-paper-faint">?</span>
              {chosen && <span className="absolute bottom-1 border-2 border-black bg-cyan px-1 font-display text-xs uppercase text-ink-950">Chosen</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button
        type="button"
        onClick={(e) => {
          play('select');
          burstAt(e.currentTarget, 'sparkle', { size: 0.8, color: color.cyan.DEFAULT });
          onChoose();
        }}
        disabled={chosen}
        className="min-h-tap border-[3px] border-black font-display text-base uppercase disabled:opacity-70"
        style={{ background: chosen ? color.cyan.DEFAULT : color.ink[700], color: chosen ? '#000' : color.paper.DEFAULT, boxShadow: '3px 3px 0 0 #000' }}
      >
        {chosen ? 'Chosen' : 'Choose'}
      </button>
    </div>
  );
}
