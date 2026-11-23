import type { PlayerView } from '@eyespy/engine';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { CourtScene } from '../motion/CourtScene';
import { Face } from '../art/Face';
import { alpha, color, motion as m, shadow } from '../design/tokens';
import { burstAt } from '../fx/fx';
import { play } from '../audio/sounds';
import { useGame } from '../state/store';
import { useCountdown } from '../ui/kit';

type PublicPlayer = PlayerView['players'][number];

/** The host's clock, as this phone estimates it. */
const serverNow = () => useGame.getState().client?.serverNow() ?? Date.now();

/**
 * The Judge's hearing, after the "Domain Expansion: Deadly Sentencing"
 * cutscene: the same dark courtroom under a spotlight, where every living
 * player has 30 seconds to vote someone out. Tap a name to pick them, then
 * confirm; you can change your vote (pick again, confirm again) until time
 * runs out. Everyone sees how many votes each player has, live, and who has
 * voted; never who voted for whom.
 */
export function Hearing({ intro = true }: { intro?: boolean }) {
  const view = useGame((s) => s.snap!.view!);
  const vote = useGame((s) => s.vote);
  const hearing = view.hearing;
  const left = useCountdown(hearing?.endsAt ?? null);
  const reduce = useReducedMotion();
  // The court opens with its cutscene, once per hearing.
  const [introDone, setIntroDone] = useState<number | null>(null);
  const showIntro = intro && !!hearing && !reduce && introDone !== hearing.endsAt;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // A pick waiting for confirmation (nothing is sent until then).
  const [picked, setPicked] = useState<string | null>(null);
  const pickedPlayer = hearing && picked ? view.players.find((p) => p.id === picked && p.alive) : undefined;
  if (picked && !pickedPlayer) setPicked(null);
  const confirm = () => {
    if (!pickedPlayer) return;
    play('vote');
    burstAt(confirmRef.current, 'impact', { size: 1.1, color: color.crimson.DEFAULT, text: 'カンッ' });
    void vote(pickedPlayer.id);
    setPicked(null);
  };

  useEffect(() => {
    if (!hearing || !reduce) return;
    play('courtLite');
    burstAt(titleRef.current, 'impact', { size: 1.6, color: color.crimson.DEFAULT, text: 'カンッ' });
  }, [hearing?.endsAt, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  if (showIntro) return <CourtScene opensAt={hearing!.opensAt} now={serverNow} onDone={() => setIntroDone(hearing!.endsAt)} />;

  return (
    <AnimatePresence>
      {hearing && (
        <motion.div
          className="fixed inset-0 z-40 overflow-y-auto bg-ink-950"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="dialog"
          aria-label="Hearing: vote someone out"
        >
          <CourtBackdrop still={!!reduce} />
          <div className="relative mx-auto w-full max-w-[520px] px-4 pb-32 pt-[max(18px,env(safe-area-inset-top))]">
            <TitleCard titleRef={titleRef} />
            <Bench view={view} left={left} />
            <Docket view={view} picked={picked} onPick={(id) => setPicked((cur) => (cur === id || id === view.hearing?.myVote ? null : id))} />
            <Footer view={view} />
          </div>
          {view.me?.alive && <ConfirmBar view={view} picked={pickedPlayer ?? null} confirmRef={confirmRef} onConfirm={confirm} onCancel={() => setPicked(null)} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The cutscene's last frame, carried on: darkness, a hanging spotlight, drifting dust. */
function CourtBackdrop({ still }: { still: boolean }) {
  const motes = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 100, d: 6 + (i % 5) * 1.7, s: 1 + (i % 3) })), []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 85% 45% at 50% -6%, ${alpha(color.crimson.deep, 0.22)}, transparent 70%), radial-gradient(ellipse 120% 60% at 50% 115%, ${alpha(color.violet.deep, 0.14)}, transparent 70%)`,
        }}
      />
      {/* The spotlight: a soft beam from above, swaying a little. */}
      <motion.div
        className="absolute left-1/2 top-0 h-[78%] w-[150%] -translate-x-1/2"
        style={{
          clipPath: 'polygon(42% 0, 58% 0, 80% 100%, 20% 100%)',
          background: `linear-gradient(180deg, ${alpha(color.paper.DEFAULT, 0.16)}, ${alpha(color.spot.soft, 0.05)} 55%, transparent)`,
          transformOrigin: '50% 0',
        }}
        animate={still ? undefined : { rotate: [-1.5, 1.5, -1.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      {!still &&
        motes.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ left: `${30 + p.x * 0.4}%`, top: `${p.y * 0.7}%`, width: p.s * 2, height: p.s * 2, background: alpha(color.spot.soft, 0.55) }}
            animate={{ y: [0, -24, 0], opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: p.d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          />
        ))}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 75% 65% at 50% 40%, transparent 55%, ${alpha(color.ink[950], 0.85)})` }} />
    </div>
  );
}

function TitleCard({ titleRef }: { titleRef: RefObject<HTMLHeadingElement> }) {
  return (
    <motion.header className="text-center" initial={{ opacity: 0, scale: 1.3 }} animate={{ opacity: 1, scale: 1 }} transition={m.snap}>
      <p className="font-jp text-xs font-black tracking-[0.6em] text-crimson">領 域 展 開</p>
      <h2
        ref={titleRef}
        className="title-outline mt-1 font-display text-[clamp(34px,11vw,52px)] uppercase leading-[0.95] text-paper"
        style={{ textShadow: `4px 4px 0 ${color.crimson.DEFAULT}` }}
      >
        Deadly Sentencing
      </h2>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-paper-dim">Court is in session</p>
    </motion.header>
  );
}

/** The timer and the scales: who would go if the gavel fell now. */
function Bench({ view, left }: { view: PlayerView; left: number }) {
  const h = view.hearing!;
  const total = Math.max(1, h.endsAt - h.opensAt);
  const alive = view.players.filter((p) => p.alive);
  const top = Math.max(0, ...alive.map((p) => h.tally[p.id] ?? 0));
  const leaders = top > 0 ? alive.filter((p) => (h.tally[p.id] ?? 0) === top) : [];
  const verdict =
    leaders.length === 1
      ? { lead: 'Leading', text: leaders[0]!.id === view.me?.id ? 'You' : leaders[0]!.name, tone: color.spot.DEFAULT }
      : leaders.length > 1
        ? { lead: `Tied at ${top}`, text: 'Nobody goes', tone: color.paper.dim }
        : { lead: 'The scales are level', text: 'No votes yet', tone: color.paper.faint };
  return (
    <motion.div className="mt-4 flex items-center gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...m.soft, delay: 0.1 }}>
      <CourtTimer left={left} total={total} />
      <div
        className="relative min-w-0 flex-1 overflow-hidden rounded-md border-2 px-3 py-2"
        style={{ borderColor: alpha(color.spot.deep, 0.55), background: `linear-gradient(180deg, ${alpha(color.ink[800], 0.9)}, ${alpha(color.ink[950], 0.9)})`, boxShadow: shadow.card }}
        aria-live="polite"
      >
        <ScalesIcon tilt={leaders.length === 1 ? 1 : 0} />
        <p className="pl-9 text-[10px] font-bold uppercase tracking-[0.25em] text-paper-faint">{verdict.lead}</p>
        <p className="truncate pl-9 font-display text-2xl uppercase leading-tight" style={{ color: verdict.tone }}>
          {verdict.text}
        </p>
      </div>
    </motion.div>
  );
}

/** A gold ring that drains over the 30 seconds and turns crimson for the last ten. */
function CourtTimer({ left, total }: { left: number; total: number }) {
  const secs = Math.ceil(Math.min(left, total) / 1000);
  const k = Math.max(0, Math.min(1, left / total));
  const urgent = secs <= 10;
  const r = 29;
  const c = 2 * Math.PI * r;
  const tone = urgent ? color.crimson.DEFAULT : color.spot.DEFAULT;
  return (
    <div className="relative h-[72px] w-[72px] shrink-0" role="timer" aria-label={`${secs} seconds left to vote`}>
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
        <circle cx="36" cy="36" r={r} fill={alpha(color.ink[950], 0.85)} stroke={color.ink[700]} strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={(1 - k) * c} style={{ filter: `drop-shadow(0 0 6px ${alpha(tone, 0.7)})`, transition: 'stroke-dashoffset 0.1s linear' }} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="36" y1="3" x2="36" y2="7" stroke={alpha(color.paper.DEFAULT, 0.25)} strokeWidth="1.5" transform={`rotate(${i * 30} 36 36)`} />
        ))}
      </svg>
      <motion.span
        key={urgent ? secs : 'calm'}
        className="absolute inset-0 flex items-center justify-center font-display text-3xl tabular-nums"
        style={{ color: urgent ? color.crimson.DEFAULT : color.paper.DEFAULT }}
        initial={urgent ? { scale: 1.45 } : false}
        animate={{ scale: 1 }}
        transition={m.bouncy}
      >
        {secs}
      </motion.span>
    </div>
  );
}

function ScalesIcon({ tilt }: { tilt: number }) {
  return (
    <svg viewBox="0 0 32 32" className="absolute left-2 top-1/2 h-7 w-7 -translate-y-1/2" aria-hidden>
      <path d="M16 5v21M10 27h12" stroke={color.spot.DEFAULT} strokeWidth="2" strokeLinecap="round" fill="none" />
      <motion.g animate={{ rotate: tilt ? -12 : 0 }} transition={m.soft} style={{ originX: '16px', originY: '8px' }}>
        <path d="M5 8h22M7 8l-3 8h6zM25 8l-3 8h6z" stroke={color.spot.DEFAULT} strokeWidth="1.6" strokeLinejoin="round" fill={alpha(color.spot.DEFAULT, 0.25)} />
      </motion.g>
    </svg>
  );
}

/** Everyone alive, as a docket: tap a name to vote them out. Counts update live. */
function Docket({ view, picked, onPick }: { view: PlayerView; picked: string | null; onPick: (id: string) => void }) {
  const h = view.hearing!;
  const me = view.me;
  const canVote = !!me?.alive;
  const alive = view.players.filter((p) => p.alive);
  const top = Math.max(0, ...alive.map((p) => h.tally[p.id] ?? 0));
  const unique = alive.filter((p) => (h.tally[p.id] ?? 0) === top).length === 1;
  // Bars are measured against the votes anyone could get (every voter but themselves).
  const scale = Math.max(1, alive.length - 1);
  // A big room goes into two columns of slimmer rows so everyone fits on one screen.
  const compact = alive.length > 6;
  return (
    <ul className={compact ? 'mt-3 grid grid-cols-2 gap-2' : 'mt-4 flex flex-col gap-2.5'}>
      {alive.map((p, i) => (
        <DocketRow
          compact={compact}
          key={p.id}
          player={p}
          index={i}
          votes={h.tally[p.id] ?? 0}
          scale={scale}
          isMe={p.id === me?.id}
          mine={h.myVote === p.id}
          selected={picked === p.id}
          voted={h.voted.includes(p.id)}
          leading={top > 0 && unique && (h.tally[p.id] ?? 0) === top}
          tied={top > 0 && !unique && (h.tally[p.id] ?? 0) === top}
          disabled={!canVote || p.id === me?.id}
          onPick={onPick}
        />
      ))}
    </ul>
  );
}

function DocketRow({
  compact,
  player: p,
  index,
  votes,
  scale,
  isMe,
  mine,
  selected,
  voted,
  leading,
  tied,
  disabled,
  onPick,
}: {
  compact: boolean;
  player: PublicPlayer;
  index: number;
  votes: number;
  scale: number;
  isMe: boolean;
  mine: boolean;
  selected: boolean;
  voted: boolean;
  leading: boolean;
  tied: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  const border = selected ? color.paper.DEFAULT : mine ? color.crimson.DEFAULT : leading ? color.spot.DEFAULT : alpha(color.spot.deep, 0.3);
  const glow = selected ? `0 0 0 2px ${color.crimson.DEFAULT}, 0 0 24px ${color.crimson.glow}` : mine ? `0 0 22px ${color.crimson.glow}` : leading ? `0 0 26px ${color.spot.glow}` : shadow.card;
  return (
    <motion.li initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...m.soft, delay: 0.18 + index * 0.04 }}>
      <motion.button
        type="button"
        disabled={disabled}
        whileTap={disabled ? undefined : { scaleX: 1.03, scaleY: 0.94 }}
        transition={m.bouncy}
        onClick={() => {
          play('tap');
          onPick(p.id);
        }}
        className={`relative flex w-full items-center overflow-hidden rounded-md border-2 text-left disabled:cursor-default ${compact ? 'gap-1.5 py-1.5 pl-1.5 pr-1.5' : 'gap-3 py-2 pl-2.5 pr-3'}`}
        style={{ borderColor: border, boxShadow: glow, background: `linear-gradient(180deg, ${alpha(color.crimson.deep, mine ? 0.42 : 0.16)}, ${alpha(color.ink[900], 0.94)} 70%)` }}
        aria-pressed={selected}
        aria-label={`${isMe ? 'You' : `Pick ${p.name}`}: ${votes} ${votes === 1 ? 'vote' : 'votes'}${mine ? ', your vote' : ''}${voted ? ', has voted' : ''}`}
      >
        {/* Gold rail, like the dock's. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${leading ? color.spot.soft : alpha(color.spot.DEFAULT, 0.6)}, transparent)` }} />
        {leading && <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 140% at 50% -30%, ${alpha(color.paper.DEFAULT, 0.16)}, transparent 70%)` }} />}

        <span className="relative shrink-0 rounded-full p-[2px]" style={{ background: leading ? color.spot.DEFAULT : mine ? color.crimson.DEFAULT : alpha(color.spot.deep, 0.45) }}>
          <span className="block overflow-hidden rounded-full bg-ink-900">
            <Face avatar={p.avatar} size={compact ? 34 : 46} crop="face" expression={leading || mine ? 'shock' : 'neutral'} />
          </span>
        </span>

        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate font-display uppercase leading-none text-paper ${compact ? 'text-base' : 'text-xl'}`}>{p.name}</span>
            {isMe && <span className={`shrink-0 rounded-sm bg-paper px-1 font-display uppercase text-ink-950 ${compact ? 'text-[9px] leading-3' : 'text-[11px] leading-4'}`}>You</span>}
            {leading && !compact && <span className="shrink-0 font-display text-[11px] uppercase tracking-wider text-spot">Leading</span>}
            {tied && !compact && <span className="shrink-0 font-display text-[11px] uppercase tracking-wider text-paper-dim">Tied</span>}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full" style={{ background: alpha(color.ink[600], 0.7) }}>
            <motion.span
              className="block h-full rounded-full"
              initial={false}
              animate={{ width: `${Math.min(100, (votes / scale) * 100)}%` }}
              transition={m.soft}
              style={{ background: `linear-gradient(90deg, ${color.spot.deep}, ${mine ? color.crimson.DEFAULT : color.spot.soft})` }}
            />
          </span>
          {!compact && (
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: voted ? color.paper.dim : color.paper.faint }}>
              {voted ? '✓ Has voted' : 'Deciding…'}
            </span>
          )}
        </span>

        <span className={`relative flex shrink-0 flex-col items-center ${compact ? 'w-7' : 'w-12'}`}>
          <motion.span
            key={votes}
            className={`font-display tabular-nums leading-none ${compact ? 'text-2xl' : 'text-4xl'}`}
            initial={{ scale: votes ? 1.6 : 1 }}
            animate={{ scale: 1 }}
            transition={m.bouncy}
            style={{ color: votes ? (leading ? color.spot.soft : color.spot.DEFAULT) : color.paper.faint }}
          >
            {votes}
          </motion.span>
          {!compact && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-paper-faint">{votes === 1 ? 'vote' : 'votes'}</span>}
        </span>

        {selected && (
          <span
            className={`absolute top-1 rotate-3 rounded-sm px-1 font-display uppercase tracking-wider text-ink-950 ${compact ? 'right-9 text-[9px] leading-3' : 'right-16 top-1.5 text-[11px]'}`}
            style={{ background: color.paper.DEFAULT }}
          >
            Picked
          </span>
        )}
        {mine && !selected && (
          <span
            className={`absolute top-1 -rotate-6 rounded-sm border-2 px-1 font-display uppercase tracking-wider ${compact ? 'right-9 text-[9px] leading-3' : 'right-16 top-1.5 text-[11px]'}`}
            style={{ borderColor: color.crimson.DEFAULT, color: color.crimson.DEFAULT, background: alpha(color.ink[950], 0.6) }}
          >
            {compact ? 'Mine' : 'Your vote'}
          </span>
        )}
      </motion.button>
    </motion.li>
  );
}

function Footer({ view }: { view: PlayerView }) {
  const h = view.hearing!;
  const me = view.me;
  const alive = view.players.filter((p) => p.alive);
  const status = !me?.alive ? 'Ghosts watch the hearing in silence.' : h.myVote ? 'Your vote is in. Pick another name to change it.' : 'Pick a name, then confirm your vote.';
  return (
    <div className="mt-5 text-center">
      <p className="font-display text-lg uppercase leading-tight text-paper-dim">{status}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label={`${h.voted.length} of ${alive.length} have voted`}>
        {alive.map((p) => (
          <span
            key={p.id}
            className="h-2 w-2 rounded-full"
            style={{ background: h.voted.includes(p.id) ? color.spot.DEFAULT : alpha(color.paper.DEFAULT, 0.18), boxShadow: h.voted.includes(p.id) ? `0 0 6px ${color.spot.glow}` : undefined }}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs font-semibold text-paper-faint">
        {h.voted.length} of {alive.length} have voted
      </p>
      <p className="mx-auto mt-3 max-w-[340px] text-[11px] leading-relaxed text-paper-faint">
        The most votes is out. A tie frees everyone. Vote out a Sheriff and the town loses.
      </p>
    </div>
  );
}

/** Pinned to the bottom: confirm the pick, or see where your vote stands. */
function ConfirmBar({
  view,
  picked,
  confirmRef,
  onConfirm,
  onCancel,
}: {
  view: PlayerView;
  picked: PublicPlayer | null;
  confirmRef: RefObject<HTMLButtonElement>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const h = view.hearing!;
  const current = h.myVote ? view.players.find((p) => p.id === h.myVote) : undefined;
  const label = picked ? (current ? `Change vote to ${picked.name}` : `Confirm vote: ${picked.name}`) : current ? `Vote cast: ${current.name}` : 'Pick someone to vote out';
  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-6"
      style={{ background: `linear-gradient(180deg, transparent, ${alpha(color.ink[950], 0.92)} 38%)` }}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...m.soft, delay: 0.3 }}
    >
      <div className="mx-auto flex w-full max-w-[520px] items-center gap-2">
        <motion.button
          ref={confirmRef}
          type="button"
          disabled={!picked}
          onClick={onConfirm}
          whileTap={picked ? { scaleX: 1.04, scaleY: 0.92 } : undefined}
          transition={m.bouncy}
          className="relative flex h-14 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-md border-2 px-4 font-display text-xl uppercase text-paper disabled:cursor-default"
          style={
            picked
              ? { borderColor: color.paper.DEFAULT, background: `linear-gradient(180deg, ${color.crimson.DEFAULT}, ${color.crimson.deep})`, boxShadow: `0 0 26px ${color.crimson.glow}` }
              : { borderColor: alpha(color.spot.deep, current ? 0.6 : 0.3), background: alpha(color.ink[850], 0.95), color: current ? color.spot.DEFAULT : color.paper.faint }
          }
          aria-label={label}
        >
          <GavelIcon tone={picked ? color.paper.DEFAULT : current ? color.spot.DEFAULT : color.paper.faint} />
          <span className="truncate">{label}</span>
        </motion.button>
        {picked && (
          <button
            type="button"
            onClick={onCancel}
            className="h-14 shrink-0 rounded-md border-2 px-3 font-display text-base uppercase text-paper-dim"
            style={{ borderColor: alpha(color.paper.DEFAULT, 0.3), background: alpha(color.ink[850], 0.95) }}
          >
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  );
}

function GavelIcon({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden>
      <g fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="11" y="2.5" width="9" height="5" rx="1" transform="rotate(45 15.5 5)" />
        <path d="M13 9.5L4.5 18M12 21h9" />
      </g>
    </svg>
  );
}
