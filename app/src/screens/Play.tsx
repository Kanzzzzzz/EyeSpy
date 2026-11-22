import { character, type AbilityView } from '@eyespy/engine';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimeFace, type Expression, type Gaze } from '../art/AnimeFace';
import { publicLook, roleLook } from '../art/characters';
import { RoleBadge, TeamIcon, TEAM_LABEL } from '../art/RoleBadge';
import { color, motion as m } from '../design/tokens';
import { burstAt, fx } from '../fx/fx';
import { useGame } from '../state/store';
import { admin } from '../state/admin';
import { getRole } from '@eyespy/engine';
import { Button, EyeIcon, HoldButton, Screen, Sheet, useCountdown } from '../ui/kit';

/** A stable "looking away" direction per player (purely cosmetic). */
function awayGaze(id: string): Gaze {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h % 2 ? 'left' : 'right';
}

/** Slightly uneven manga panel corners, stable per index. */
function panelClip(i: number): string {
  const j = (n: number) => ((i * 37 + n * 17) % 5) - 2; // -2..2
  return `polygon(${2 + j(1)}% ${j(2) + 2}%, ${98 + j(3)}% ${j(4) + 2}%, ${98 + j(5)}% ${98 + j(6)}%, ${2 + j(7)}% ${98 + j(8)}%)`;
}

function ActionButton({
  label,
  hint,
  readyAt,
  onClick,
  variant = 'secondary',
  disabled,
  sfx,
}: {
  label: string;
  hint?: string;
  readyAt?: number | null;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'cyan';
  disabled?: boolean;
  sfx?: string;
}) {
  const left = useCountdown(readyAt ?? null);
  const cooling = !!readyAt && left > 0;
  return (
    <div>
      <Button size="lg" variant={variant} className="w-full" disabled={disabled || cooling} onClick={onClick} sfx={sfx}>
        {cooling ? `${label} · ${Math.ceil(left / 1000)}s` : label}
      </Button>
      {hint && <p className="mt-1 text-center text-xs font-semibold text-paper-faint">{hint}</p>}
    </div>
  );
}

export function Play() {
  const view = useGame((s) => s.snap!.view!);
  const events = useGame((s) => s.snap!.events);
  const presence = useGame((s) => s.snap!.presence);
  const pendingLook = useGame((s) => s.pendingLook);
  const send = useGame((s) => s.send);
  const look = useGame((s) => s.look);
  const adminReveal = useGame((s) => s.adminReveal);
  const reduce = useReducedMotion();
  const me = view.me!;
  const [peek, setPeek] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);

  const lookingAt = pendingLook !== undefined ? pendingLook : me.lookingAt;
  const target = view.players.find((p) => p.id === lookingAt) ?? null;
  // Eye contact is only known once the host confirms the gaze.
  const contact = me.eyeContact && pendingLook === undefined && !!target;
  const others = view.players.filter((p) => p.id !== me.id);
  const aliveCount = view.players.filter((p) => p.alive).length;

  // Brief expressions in the open panel, from gestures this phone witnessed.
  const [gesture, setGesture] = useState<{ id: string; expr: Expression } | null>(null);
  const lastEvent = events[events.length - 1];
  useEffect(() => {
    if (!lastEvent) return;
    const ev = lastEvent.event;
    let g: { id: string; expr: Expression } | null = null;
    if (ev.type === 'SawWink') g = { id: ev.winkerId, expr: 'wink' };
    if (ev.type === 'SawRaise') g = { id: ev.raiserId, expr: 'raise' };
    if (ev.type === 'EyebrowRaised' && ev.targetId === me.id) g = { id: ev.byId, expr: 'raise' };
    if (ev.type === 'Winked' && ev.targetId === me.id && ev.killerId) g = { id: ev.killerId, expr: 'wink' };
    if (!g) return;
    setGesture(g);
    const t = setTimeout(() => setGesture(null), g.expr === 'wink' ? 700 : 1300);
    return () => clearTimeout(t);
  }, [lastEvent, me.id]);

  // The moment eyes meet: a sparkle on the panel.
  const hadContact = useRef(false);
  useEffect(() => {
    if (contact && !hadContact.current && focusRef.current) {
      burstAt(focusRef.current, 'sparkle', { size: 1.4, color: color.cyan.DEFAULT });
      const r = focusRef.current.getBoundingClientRect();
      fx.text(r.right - 70, r.top + 34, '目が合った', { color: color.cyan.DEFAULT, size: 24, angle: -0.08 });
    }
    hadContact.current = contact;
  }, [contact]);

  const killerOfMe = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]!.event;
      if (ev.type === 'Winked' && ev.targetId === me.id && ev.killerId) return view.players.find((p) => p.id === ev.killerId) ?? null;
    }
    return null;
  }, [events, me.id, view.players]);

  const targetAbilities = me.abilities.filter((a) => a.target === 'player' && !a.ghost);
  const selfAbilities = me.abilities.filter((a) => a.target === 'none' && !a.ghost);
  const ghostAbilities = me.abilities.filter((a) => a.ghost);
  const runAbility = (a: AbilityView, targetId: string | null, payload: string | null = null) =>
    void send({ type: 'useAbility', abilityId: a.id, targetId, payload });

  const expr: Expression = !target
    ? 'closed'
    : !target.alive
      ? 'dead'
      : gesture && gesture.id === target.id
        ? gesture.expr
        : contact
          ? 'neutral'
          : 'neutral';
  const gaze: Gaze = !target ? 'down' : contact || (gesture && gesture.id === target.id) ? 'you' : awayGaze(target.id);
  const canAct = me.alive && !!target && target.alive && view.phase === 'playing';
  const lockLeft = useCountdown(me.alive ? me.lookLockedUntil : null);
  const lockMs = view.settings.lookLockMs;
  const locked = lockLeft > 0 && pendingLook === undefined;
  const noContactHint = target ? `${target.name} isn't looking at you` : 'Open a panel first';

  return (
    <Screen className={me.alive ? '' : 'saturate-50'}>
      {/* Header */}
      <header className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl uppercase leading-none text-paper">
            {aliveCount} alive <span className="font-jp text-xs font-black text-paper-faint">生存</span>
          </p>
          {me.alive && me.canRaise && <RaiseMeter sent={me.raisesSent} goal={me.raisesToUnlock} />}
          {!me.alive && <p className="font-display text-lg uppercase text-violet">Ghost: watch in silence</p>}
        </div>
        {me.alive && (
          <motion.div
            key={me.watchers}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={m.bouncy}
            className="flex items-center gap-1.5 border-[3px] border-black px-2 py-1"
            style={{ background: me.watchers > 0 ? color.crimson.DEFAULT : color.ink[700], boxShadow: '3px 3px 0 0 #000' }}
            aria-label={`${me.watchers} ${me.watchers === 1 ? 'person is' : 'people are'} looking at you`}
          >
            <EyeIcon size={22} />
            <span className="font-display text-xl leading-none text-paper">×{me.watchers}</span>
          </motion.div>
        )}
        <button
          type="button"
          className="min-h-tap select-none border-[3px] border-paper bg-ink-800 px-3 font-display text-base uppercase text-paper"
          style={{ boxShadow: '3px 3px 0 0 #000', touchAction: 'none' }}
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          Hold: role
        </button>
      </header>

      {!me.alive && killerOfMe && (
        <div className="mb-3 flex items-center gap-3 border-[3px] border-crimson bg-ink-850 p-2">
          <AnimeFace look={publicLook(killerOfMe.avatar)} size={44} crop="face" expression="sly" />
          <p className="text-sm font-semibold text-paper-dim">
            <b className="text-paper">{killerOfMe.name}</b> winked you. Keep it to yourself.
          </p>
        </div>
      )}
      {me.canArrest && me.shushedKillsLeft > 0 && (
        <p className="mb-3 border-[3px] border-crimson bg-ink-850 p-2 text-center text-sm font-semibold text-paper">
          Shushed: no arrests for {me.shushedKillsLeft} more {me.shushedKillsLeft === 1 ? 'kill' : 'kills'}.
        </p>
      )}

      {/* The open panel: their eyes, up close. */}
      <div
        ref={focusRef}
        className="relative overflow-hidden border-[4px] bg-ink-900"
        style={{
          borderColor: contact ? color.cyan.DEFAULT : color.paper.DEFAULT,
          boxShadow: contact ? `0 0 0 3px #000, 0 0 34px ${color.cyan.glow}` : `6px 6px 0 0 ${color.crimson.DEFAULT}`,
          aspectRatio: '112 / 62',
        }}
        aria-live="polite"
        aria-label={target ? `${target.name}: ${!target.alive ? 'out of the game' : contact ? 'looking at you' : 'looking away'}` : 'No panel open'}
      >
        <div className={`absolute inset-0 ${contact ? 'speedlines-strong' : 'speedlines'} opacity-70`} />
        <AnimatePresence mode="popLayout">
          {target ? (
            <motion.div
              key={target.id}
              className="absolute inset-0 flex items-center justify-center"
              initial={reduce ? { opacity: 0 } : { scale: 1.25, opacity: 0, x: 30 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={m.snap}
            >
              <AnimeFace look={publicLook(target.avatar)} size={520} crop="eyes" expression={expr} gaze={gaze} blink={target.alive && !gesture} className="h-full w-full" />
            </motion.div>
          ) : (
            <motion.div key="none" className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="title-outline font-display text-3xl uppercase text-paper" style={{ textShadow: `3px 3px 0 ${color.crimson.DEFAULT}` }}>
                Pick a panel
              </p>
              <p className="mt-1 text-sm font-semibold text-paper-dim">Tap someone below to look them in the eye.</p>
            </motion.div>
          )}
        </AnimatePresence>
        {target && (
          <>
            <div className="absolute left-0 top-0 border-b-[3px] border-r-[3px] border-black bg-paper px-2 py-0.5 font-display text-lg uppercase text-ink-950">
              {target.name}
            </div>
            <div
              className="absolute bottom-0 right-0 border-l-[3px] border-t-[3px] border-black px-2 py-0.5 font-display text-base uppercase"
              style={{ background: !target.alive ? color.ink[600] : contact ? color.cyan.DEFAULT : color.ink[700], color: contact ? '#000' : color.paper.DEFAULT }}
            >
              {!target.alive ? 'Out' : contact ? 'Eye contact!' : 'Looking away'}
            </div>
            {locked && lockMs > 0 && (
              <div className="absolute inset-x-0 bottom-0 h-2 bg-black/60" aria-label={`Gaze locked for ${Math.ceil(lockLeft / 100) / 10}s`}>
                <div className="h-full bg-spot" style={{ width: `${Math.min(100, (lockLeft / lockMs) * 100)}%`, transition: 'width 100ms linear' }} />
              </div>
            )}
            {lookingAt && !locked && (
              <button
                type="button"
                className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center border-[3px] border-black bg-ink-800 font-display text-lg text-paper"
                onClick={() => look(null)}
                aria-label="Look away"
              >
                ✕
              </button>
            )}
          </>
        )}
      </div>

      {/* Actions on the open panel. */}
      <div className="mt-3 flex flex-col gap-2">
        {me.alive && view.phase === 'playing' && (
          <>
            {me.canWink && (
              <ActionButton
                label={contact ? 'Wink' : 'Wink (need eye contact)'}
                variant="danger"
                readyAt={me.winkReadyAt}
                disabled={!canAct || !contact}
                hint={canAct && !contact ? noContactHint : me.watchers > 1 ? `${me.watchers - 1} other ${me.watchers - 1 === 1 ? 'person is' : 'people are'} watching you` : undefined}
                onClick={() => void send({ type: 'wink', targetId: target!.id })}
                sfx="キラッ"
              />
            )}
            {me.canRaise && (
              <ActionButton
                label={contact ? 'Raise an eyebrow' : 'Raise (need eye contact)'}
                variant="cyan"
                readyAt={me.raiseReadyAt}
                disabled={!canAct || !contact}
                hint={canAct && !contact ? noContactHint : undefined}
                onClick={() => void send({ type: 'raiseEyebrow', targetId: target!.id })}
                sfx="ピクッ"
              />
            )}
            {me.canArrest && (
              <HoldButton
                label={me.shushedKillsLeft > 0 ? "Shushed: can't arrest" : target ? `Hold to arrest ${target.name}` : 'Open a panel to arrest'}
                holdingLabel="Arresting…"
                disabled={!canAct || me.shushedKillsLeft > 0}
                onConfirm={() => void send({ type: 'arrest', targetId: target!.id })}
              />
            )}
            {targetAbilities.map((a) => (
              <ActionButton
                key={a.id}
                label={a.unlocked ? a.label : `${a.label} (locked)`}
                hint={!a.unlocked ? `Unlocks after ${me.raisesToUnlock} eyebrow raises` : a.gesture && !contact ? noContactHint : a.hint}
                readyAt={a.readyAt}
                variant="primary"
                disabled={!a.unlocked || a.usesLeft === 0 || !canAct || (!!a.gesture && !contact)}
                onClick={() => runAbility(a, target!.id)}
              />
            ))}
            {selfAbilities.map((a) => (
              <ActionButton
                key={a.id}
                label={a.unlocked ? a.label : `${a.label} (locked)`}
                hint={a.unlocked ? a.hint : `Unlocks after ${me.raisesToUnlock} eyebrow raises`}
                readyAt={a.readyAt}
                variant="primary"
                disabled={!a.unlocked || a.usesLeft === 0}
                onClick={() => runAbility(a, null)}
                sfx="ドン"
              />
            ))}
            {!me.canWink && !me.canRaise && !me.canArrest && targetAbilities.length === 0 && selfAbilities.length === 0 && (
              <p className="border-[3px] border-dashed border-paper-faint p-3 text-center text-sm font-semibold text-paper-dim">
                No moves for you. Your eyes are your weapon: watch who winks.
              </p>
            )}
          </>
        )}
        {!me.alive &&
          ghostAbilities.map((a) => (
            <Button key={a.id} variant="secondary" size="lg" disabled={a.usesLeft === 0} onClick={() => setEmojiOpen(true)}>
              {a.usesLeft === 0 ? 'Message sent' : a.label}
            </Button>
          ))}
      </div>

      {/* Everyone else, eyes lowered. Tap to look. */}
      <ul className="mt-4 grid grid-cols-3 gap-2.5 pb-4">
        {others.map((p, i) => {
          const open = p.id === lookingAt;
          return (
            <li key={p.id}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                transition={m.bouncy}
                onClick={() => look(open ? null : p.id)}
                className="relative block w-full overflow-hidden border-[3px] bg-ink-800 text-left"
                style={{
                  borderColor: open ? color.cyan.DEFAULT : p.alive ? color.paper.DEFAULT : color.ink[500],
                  clipPath: panelClip(i),
                  opacity: locked && !open ? 0.55 : 1,
                  boxShadow: open ? `0 0 18px ${color.cyan.glow}` : undefined,
                }}
                aria-label={`${p.name}${p.alive ? '' : ' (out)'}: ${open ? 'close panel' : 'look at them'}`}
                aria-pressed={open}
              >
                <div className="screentone absolute inset-0 opacity-40" />
                <AnimeFace look={publicLook(p.avatar)} size={140} crop="face" expression={p.alive ? 'neutral' : 'dead'} gaze={open && contact ? 'you' : 'down'} ghost={!p.alive} blink={p.alive} className="relative h-auto w-full" />
                <span className="absolute inset-x-0 bottom-0 truncate border-t-[3px] border-black bg-paper px-1.5 py-0.5 font-display text-sm uppercase text-ink-950">
                  {p.name}
                </span>
                {!p.alive && (
                  <span className="absolute left-1 top-1 -rotate-12 border-2 border-crimson px-1 font-display text-xs uppercase text-crimson">
                    {p.votedOut ? 'Voted out' : 'Out'}
                  </span>
                )}
                {p.alive && presence[p.id] !== 'online' && (
                  <span className="absolute right-1 top-1 h-3.5 w-3.5 border-2 border-black bg-warn" aria-label="Reconnecting" />
                )}
                {p.role && <span className="absolute right-1 top-1"><TeamIcon team={p.team!} size={14} /></span>}
                {adminReveal && !p.role && admin.roleOf(p.id) && (
                  <span className="absolute right-0.5 top-0.5">
                    <RoleBadge role={admin.roleOf(p.id)!} team={getRole(admin.roleOf(p.id)!).team} size={30} />
                  </span>
                )}
              </motion.button>
            </li>
          );
        })}
      </ul>

      <Sheet open={emojiOpen} onClose={() => setEmojiOpen(false)}>
        {ghostAbilities[0]?.payload && (
          <div>
            <p className="mb-3 font-display text-2xl uppercase text-paper">One emoji for the Medium</p>
            <div className="grid grid-cols-5 gap-2">
              {ghostAbilities[0].payload.options.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex h-16 items-center justify-center border-[3px] border-black bg-ink-800 text-3xl"
                  onClick={() => {
                    setEmojiOpen(false);
                    runAbility(ghostAbilities[0]!, null, e);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* Peek at your own role and character while holding. */}
      <AnimatePresence>
        {peek && me.role && (
          <motion.div
            className="pointer-events-none fixed inset-x-4 top-24 z-30 mx-auto flex max-w-[480px] items-center gap-3 border-[3px] border-paper bg-ink-850 p-3"
            style={{ boxShadow: `5px 5px 0 0 ${color.team[me.team!]}` }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <AnimeFace look={me.character ? roleLook(me.character, me.role) : publicLook(view.players.find((p) => p.id === me.id)?.avatar ?? 0)} size={86} crop="face" />
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display text-2xl uppercase leading-none text-paper">
                {me.roleName} <RoleBadge role={me.role} team={me.team!} size={26} />
              </p>
              <p className="flex items-center gap-1 text-xs font-semibold text-paper-faint">
                <TeamIcon team={me.team!} size={11} /> {TEAM_LABEL[me.team!]} · {character(me.character)?.name}
              </p>
              <p className="text-sm text-paper-dim">{me.summary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ArrestSpotlight />
    </Screen>
  );
}

function RaiseMeter({ sent, goal }: { sent: number; goal: number }) {
  const dots = Array.from({ length: goal }, (_, i) => i < sent);
  return (
    <div className="mt-1 flex items-center gap-2" aria-label={`Eyebrows raised: ${sent} of ${goal}`}>
      <div className="flex gap-1">
        {dots.map((on, i) => (
          <motion.span
            key={i}
            className="h-3 w-6 border-2 border-black"
            initial={false}
            animate={{ backgroundColor: on ? color.cyan.DEFAULT : color.ink[600], scale: on ? [1.4, 1] : 1 }}
            style={{ transform: 'skewX(-12deg)' }}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-paper-faint">{sent >= goal ? 'Unlocked!' : `${sent}/${goal} raised`}</span>
    </div>
  );
}

/** Every phone plays the arrest at once: chains, a drumroll, then the verdict stamp. */
function ArrestSpotlight() {
  const view = useGame((s) => s.snap!.view!);
  const events = useGame((s) => s.snap!.events);
  const arrest = view.arrest;
  const target = arrest ? view.players.find((p) => p.id === arrest.targetId) : null;
  const left = useCountdown(arrest?.verdictAt ?? null);
  const started = [...events].reverse().find((e) => e.event.type === 'ArrestStarted')?.event;
  const sheriff = started?.type === 'ArrestStarted' ? character(started.sheriffCharacter) : null;
  return (
    <AnimatePresence>
      {arrest && target && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-ink-950/95 px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-label={`${target.name} is being arrested`}
        >
          <div className="speedlines-strong absolute inset-0" />
          <p className="font-jp text-sm font-black tracking-[0.4em] text-spot">逮捕</p>
          <p className="title-outline font-display text-5xl uppercase leading-none text-paper" style={{ textShadow: `4px 4px 0 ${color.spot.DEFAULT}` }}>
            Arrest!
          </p>
          <motion.div className="relative my-5" animate={{ rotate: [-1.5, 1.5, -1.5] }} transition={{ duration: 0.16, repeat: Infinity }}>
            <div className="border-[4px] border-paper bg-ink-800" style={{ boxShadow: `6px 6px 0 0 ${color.spot.DEFAULT}` }}>
              <AnimeFace look={publicLook(target.avatar)} size={190} crop="face" expression="shock" />
            </div>
            {/* Chains wrap the suspect. */}
            <svg className="pointer-events-none absolute -inset-6 h-[calc(100%+48px)] w-[calc(100%+48px)]" viewBox="0 0 100 100" preserveAspectRatio="none">
              {[18, 52, 82].map((y, i) => (
                <motion.g key={y} initial={{ x: i % 2 ? 120 : -120 }} animate={{ x: 0 }} transition={{ delay: 0.15 * i, type: 'spring', stiffness: 300, damping: 18 }}>
                  {Array.from({ length: 9 }, (_, k) => (
                    <ellipse key={k} cx={6 + k * 11} cy={y + (k % 2) * 1.2} rx={5.5} ry={3} fill="none" stroke="#C9C9E8" strokeWidth={1.6} transform={`rotate(${i % 2 ? 8 : -8} 50 ${y})`} />
                  ))}
                </motion.g>
              ))}
            </svg>
          </motion.div>
          <h2 className="font-display text-4xl uppercase text-paper">{target.name}</h2>
          {sheriff && <p className="mt-1 font-display text-lg uppercase tracking-wider text-spot">{sheriff.move}</p>}
          <p className="mt-1 text-sm font-semibold text-paper-dim">The Sheriff has made an arrest. The verdict is in…</p>
          <p className="mt-4 font-display text-6xl tabular-nums text-spot">{Math.ceil(left / 1000)}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
