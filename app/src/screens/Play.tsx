import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { AbilityView, PublicPlayer } from '@eyespy/engine';
import { Avatar, type Expression } from '../art/Avatar';
import { RoleBadge, TeamIcon, TEAM_LABEL } from '../art/RoleBadge';
import { color, motion as m } from '../design/tokens';
import { useGame } from '../state/store';
import { Button, HoldButton, Screen, Sheet, useCountdown } from '../ui/kit';

/** Ring that empties as a cooldown runs out. */
function CooldownRing({ readyAt, total }: { readyAt: number | null; total: number }) {
  const left = useCountdown(readyAt);
  if (!readyAt || left <= 0 || total <= 0) return null;
  const frac = Math.min(1, left / total);
  return (
    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="none" stroke={color.ink[950]} strokeOpacity="0.55" strokeWidth="32" strokeDasharray={`${frac * 100.5} 100.5`} />
    </svg>
  );
}

function ActionButton({
  label,
  hint,
  readyAt,
  total,
  onClick,
  tone = 'secondary',
  disabled,
}: {
  label: string;
  hint?: string;
  readyAt?: number | null;
  total?: number;
  onClick: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const left = useCountdown(readyAt ?? null);
  const cooling = !!readyAt && left > 0;
  return (
    <div className="relative">
      <Button size="lg" variant={tone} className="relative w-full overflow-hidden" disabled={disabled || cooling} onClick={onClick}>
        {cooling && total ? <CooldownRing readyAt={readyAt ?? null} total={total} /> : null}
        <span className="relative">{cooling ? `${label} · ${Math.ceil(left / 1000)}s` : label}</span>
      </Button>
      {hint && <p className="mt-1 text-center text-xs text-paper-faint">{hint}</p>}
    </div>
  );
}

export function Play() {
  const view = useGame((s) => s.snap!.view!);
  const events = useGame((s) => s.snap!.events);
  const presence = useGame((s) => s.snap!.presence);
  const send = useGame((s) => s.send);
  const me = view.me!;
  const [target, setTarget] = useState<PublicPlayer | null>(null);
  const [peek, setPeek] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const s = view.settings;

  const living = view.players.filter((p) => p.alive && p.id !== me.id);
  const fallen = view.players.filter((p) => !p.alive);

  // Brief expressions on faces from events this phone saw (never leaks: only private info already shown).
  const [faces, setFaces] = useState<Record<string, Expression>>({});
  const lastEvent = events[events.length - 1];
  useEffect(() => {
    if (!lastEvent) return;
    const ev = lastEvent.event;
    let id: string | null = null;
    let expr: Expression = 'neutral';
    if (ev.type === 'EyebrowRaised' && ev.targetId === me.id) [id, expr] = [ev.byId, 'raise'];
    if (ev.type === 'SnitchTip') [id, expr] = [ev.suspectId, 'shock'];
    if (!id) return;
    const pid = id;
    setFaces((f) => ({ ...f, [pid]: expr }));
    const t = setTimeout(() => setFaces((f) => ({ ...f, [pid]: 'neutral' })), 2500);
    return () => clearTimeout(t);
  }, [lastEvent, me.id]);

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

  const act = async (fn: () => Promise<unknown>) => {
    setTarget(null);
    await fn();
  };

  const runAbility = (a: AbilityView, targetId: string | null, payload: string | null = null) =>
    act(() => send({ type: 'useAbility', abilityId: a.id, targetId, payload }));

  const cols = living.length <= 4 ? 'grid-cols-2' : living.length <= 9 ? 'grid-cols-3' : 'grid-cols-4';
  const faceSize = living.length <= 4 ? 112 : living.length <= 9 ? 84 : 64;

  return (
    <Screen className={me.alive ? '' : 'bg-ink-950/40'}>
      <header className="mb-3 flex items-center gap-2">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{living.length + (me.alive ? 1 : 0)} alive</p>
          {me.alive ? (
            <RaiseMeter sent={me.raisesSent} goal={me.raisesToUnlock} />
          ) : (
            <p className="font-display text-lg italic text-paper-dim">You're a ghost. Watch in silence.</p>
          )}
        </div>
        <button
          type="button"
          className="min-h-tap select-none rounded-md border border-ink-500 px-3 text-sm font-semibold text-paper-dim"
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: 'none' }}
        >
          Hold: my role
        </button>
      </header>

      {!me.alive && killerOfMe && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-danger/50 bg-ink-850 p-2">
          <Avatar id={killerOfMe.avatar} size={40} expression="sly" />
          <p className="text-sm text-paper-dim">
            <b className="text-paper">{killerOfMe.name}</b> winked you. Keep it to yourself.
          </p>
        </div>
      )}
      {me.canArrest && me.shushedKillsLeft > 0 && (
        <p className="mb-3 rounded-md bg-danger/15 p-2 text-center text-sm text-paper">Shushed: no arrests for {me.shushedKillsLeft} more {me.shushedKillsLeft === 1 ? 'kill' : 'kills'}.</p>
      )}

      <motion.ul layout className={`grid ${cols} gap-3`}>
        <AnimatePresence>
          {living.map((p) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4, rotate: -12 }} transition={m.spring}>
              <button
                type="button"
                disabled={!me.alive}
                onClick={() => setTarget(p)}
                className="flex w-full flex-col items-center gap-1 rounded-lg p-1 active:bg-ink-800 disabled:opacity-60"
                aria-label={`${p.name}: choose an action`}
              >
                <span className="relative">
                  <Avatar id={p.avatar} size={faceSize} expression={faces[p.id] ?? 'neutral'} />
                  {presence[p.id] !== 'online' && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-900 bg-warn" aria-label="Reconnecting" />
                  )}
                </span>
                <span className="max-w-full truncate text-sm text-paper">{p.name}</span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {fallen.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">Out</p>
          <div className="flex flex-wrap gap-2">
            {fallen.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-ink-850 py-1 pl-1 pr-3 text-xs text-paper-faint">
                <Avatar id={p.avatar} size={26} expression="dead" ghost />
                {p.name}
                {p.role && <TeamIcon team={p.team!} size={11} />}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        {me.alive &&
          selfAbilities.map((a) => (
            <ActionButton
              key={a.id}
              label={a.unlocked ? a.label : `${a.label} (locked)`}
              hint={a.unlocked ? a.hint : `Unlocks after ${me.raisesToUnlock} eyebrow raises`}
              readyAt={a.readyAt}
              tone="primary"
              disabled={!a.unlocked || a.usesLeft === 0}
              onClick={() => void runAbility(a, null)}
            />
          ))}
        {!me.alive &&
          ghostAbilities.map((a) => (
            <Button key={a.id} variant="secondary" size="lg" disabled={a.usesLeft === 0} onClick={() => setEmojiOpen(true)}>
              {a.usesLeft === 0 ? 'Message sent' : a.label}
            </Button>
          ))}
        {me.alive && <p className="text-center text-xs text-paper-faint">Tap a face to act. Keep EyeSpy open.</p>}
      </div>

      {/* Target sheet: the same two-row layout for every role. */}
      <Sheet open={!!target} onClose={() => setTarget(null)}>
        {target && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar id={target.avatar} size={56} expression="neutral" />
              <p className="font-display text-2xl text-paper">{target.name}</p>
            </div>
            <ActionButton
              label="Raise an eyebrow"
              readyAt={me.raiseReadyAt}
              total={s.raiseCooldownMs}
              onClick={() => void act(() => send({ type: 'raiseEyebrow', targetId: target.id }))}
            />
            {me.canWink ? (
              <ActionButton
                label="Wink"
                tone="danger"
                readyAt={me.winkReadyAt}
                total={s.winkCooldownMs}
                onClick={() => void act(() => send({ type: 'wink', targetId: target.id }))}
              />
            ) : me.canArrest ? (
              <HoldButton
                label={me.shushedKillsLeft > 0 ? "Shushed: can't arrest" : 'Hold to arrest'}
                holdingLabel="Arresting…"
                disabled={me.shushedKillsLeft > 0}
                onConfirm={() => void act(() => send({ type: 'arrest', targetId: target.id }))}
              />
            ) : (
              <div className="flex min-h-[60px] items-center justify-center rounded-lg border border-ink-600 text-sm text-paper-faint">Watch them closely…</div>
            )}
            {targetAbilities.map((a) => (
              <ActionButton
                key={a.id}
                label={a.unlocked ? a.label : `${a.label} (locked)`}
                hint={a.unlocked ? a.hint : `Unlocks after ${me.raisesToUnlock} eyebrow raises`}
                readyAt={a.readyAt}
                tone="primary"
                disabled={!a.unlocked || a.usesLeft === 0}
                onClick={() => void runAbility(a, target.id)}
              />
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={emojiOpen} onClose={() => setEmojiOpen(false)}>
        {ghostAbilities[0]?.payload && (
          <div>
            <p className="mb-3 font-display text-xl text-paper">One emoji for the Medium</p>
            <div className="grid grid-cols-5 gap-2">
              {ghostAbilities[0].payload.options.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex h-16 items-center justify-center rounded-md bg-ink-800 text-3xl"
                  onClick={() => {
                    setEmojiOpen(false);
                    void runAbility(ghostAbilities[0]!, null, e);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* Peek at your own role while holding. */}
      <AnimatePresence>
        {peek && me.role && (
          <motion.div
            className="pointer-events-none fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-[480px] items-center gap-3 rounded-lg border border-ink-500 bg-ink-850 p-3 shadow-lift"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <RoleBadge role={me.role} team={me.team!} size={56} />
            <div>
              <p className="font-display text-xl text-paper">{me.roleName}</p>
              <p className="flex items-center gap-1 text-xs text-paper-faint">
                <TeamIcon team={me.team!} size={11} /> {TEAM_LABEL[me.team!]}
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
    <div className="mt-1 flex items-center gap-2" aria-label={`Eyebrows raised: ${sent}`}>
      <div className="flex gap-1">
        {dots.map((on, i) => (
          <motion.span
            key={i}
            className="h-2.5 w-6 rounded-full"
            initial={false}
            animate={{ backgroundColor: on ? color.spot.DEFAULT : color.ink[600], scale: on ? [1.3, 1] : 1 }}
          />
        ))}
      </div>
      <span className="text-xs text-paper-faint">{sent} raised</span>
    </div>
  );
}

/** Every phone plays the arrest at once: spotlight, drumroll, then the verdict stamp. */
function ArrestSpotlight() {
  const view = useGame((s) => s.snap!.view!);
  const arrest = view.arrest;
  const target = arrest ? view.players.find((p) => p.id === arrest.targetId) : null;
  const left = useCountdown(arrest?.verdictAt ?? null);
  return (
    <AnimatePresence>
      {arrest && target && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-ink-950/90 px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-label={`${target.name} is being arrested`}
        >
          <motion.div
            className="pointer-events-none absolute left-1/2 top-0 h-[70vh] w-[90vw] -translate-x-1/2"
            style={{ background: `conic-gradient(from 160deg at 50% 0%, transparent 0deg, ${color.spot.glow} 20deg, transparent 40deg)` }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-spot">Arrest!</p>
          <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 0.18, repeat: Infinity }} className="my-4">
            <Avatar id={target.avatar} size={170} expression="shock" />
          </motion.div>
          <h2 className="font-display text-4xl text-paper">{target.name}</h2>
          <p className="mt-2 text-paper-dim">The Sheriff has made an arrest. The verdict is in…</p>
          <p className="mt-6 font-display text-5xl tabular-nums text-spot">{Math.ceil(left / 1000)}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
