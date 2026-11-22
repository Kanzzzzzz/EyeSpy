import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { getRole, type LoggedEvent, type PublicPlayer } from '@eyespy/engine';
import { Avatar } from '../art/Avatar';
import { RoleBadge, TeamIcon } from '../art/RoleBadge';
import { color, motion as m } from '../design/tokens';
import { useGame } from '../state/store';
import { Button, Card, Label, Screen } from '../ui/kit';

const REASON = {
  allKillersArrested: 'The Sheriff caught every Killer.',
  wrongArrest: 'The Sheriff arrested an innocent player.',
  killersOutnumber: 'Only the Sheriff, the Killers and one other were left.',
} as const;

export function GameOver() {
  const view = useGame((s) => s.snap!.view!);
  const me = useGame((s) => s.snap!.playerId);
  const send = useGame((s) => s.send);
  const leaveGame = useGame((s) => s.leaveGame);
  const reduce = useReducedMotion();
  const result = view.result!;
  const won = !!me && result.winners.includes(me);
  const isHost = view.hostId === me;
  const winColor = result.winner === 'town' ? color.team.town : color.team.killers;

  useEffect(() => {
    if (!won || reduce) return;
    void confetti({
      particleCount: 140,
      spread: 80,
      origin: { y: 0.25 },
      colors: [color.spot.DEFAULT, color.spot.soft, winColor, color.paper.DEFAULT],
      disableForReducedMotion: true,
    });
  }, [won, reduce, winColor]);

  const byId = useMemo(() => Object.fromEntries(view.players.map((p) => [p.id, p])), [view.players]);

  return (
    <Screen>
      <motion.div
        className="mt-4 text-center"
        initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={m.bouncy}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: winColor }}>
          {won ? 'You won' : 'You lost'}
        </p>
        <h1 className="mt-1 font-display text-5xl font-semibold" style={{ color: winColor }}>
          {result.winner === 'town' ? 'Town wins' : 'Killers win'}
        </h1>
        <p className="mt-2 text-paper-dim">{REASON[result.reason]}</p>
        {result.extraWinners.length > 0 && (
          <p className="mt-1 text-sm text-team-alone">Also won: {result.extraWinners.map((id) => byId[id]?.name).join(', ')}</p>
        )}
      </motion.div>

      <Card className="mt-6">
        <Label>Everyone's role</Label>
        <ul className="grid grid-cols-2 gap-2">
          {view.players.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.2 + i * 0.05 }}
              className={`flex items-center gap-2 rounded-md p-2 ${result.winners.includes(p.id) ? 'bg-ink-700' : 'bg-ink-800'}`}
            >
              <span className="relative">
                <Avatar id={p.avatar} size={44} expression={p.alive ? (result.winners.includes(p.id) ? 'happy' : 'neutral') : 'dead'} ghost={!p.alive} />
                {p.role && (
                  <span className="absolute -bottom-1 -right-1">
                    <RoleBadge role={p.role} team={p.team!} size={24} />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-paper">{p.name}</span>
                {p.role && (
                  <span className="flex items-center gap-1 text-xs text-paper-faint">
                    <TeamIcon team={p.team!} size={10} /> {getRole(p.role).name}
                  </span>
                )}
              </span>
            </motion.li>
          ))}
        </ul>
      </Card>

      {view.timeline && <Timeline events={view.timeline} players={byId} />}

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {isHost ? (
          <Button size="lg" onClick={() => void send({ type: 'playAgain' })}>
            Play again
          </Button>
        ) : (
          <p className="text-center text-paper-dim">Waiting for the host to start another round…</p>
        )}
        <Button variant="ghost" onClick={() => void leaveGame()}>
          Leave game
        </Button>
      </div>
    </Screen>
  );
}

function describe(e: LoggedEvent, p: Record<string, PublicPlayer>): string | null {
  const n = (id: string | null | undefined) => (id && p[id]?.name) || 'Someone';
  const ev = e.event;
  switch (ev.type) {
    case 'GameStarted':
      return 'The lights went down.';
    case 'WinkSent':
      return ev.fake ? `${n(ev.killerId)} fake-winked ${n(ev.targetId)}` : `${n(ev.killerId)} winked at ${n(ev.targetId)}`;
    case 'SheriffWinked':
      return `${n(ev.killerId)} winked the Sheriff, ${n(ev.sheriffId)}, by mistake`;
    case 'PlayerDied':
      return ev.cause === 'heartbreak' ? `${n(ev.playerId)} died of a broken heart` : `${n(ev.playerId)} died`;
    case 'EyebrowRaised':
      return `${n(ev.byId)} raised an eyebrow at ${n(ev.targetId)}`;
    case 'SheriffShushed':
      return 'The Shush silenced the Sheriff';
    case 'SnitchTip':
      return `The Snitch named ${n(ev.suspectId)}`;
    case 'ArrestStarted':
      return `${n(ev.targetId)} was arrested`;
    case 'ArrestResult':
      return ev.correct ? `${n(ev.targetId)} was a Killer` : `${n(ev.targetId)} was innocent (${getRole(ev.role).name})`;
    case 'Snapped':
      return `The Paparazzi snapped ${n(ev.targetId)}`;
    case 'Guarding':
      return `The Bodyguard guarded ${n(ev.targetId)}`;
    case 'RoleChanged':
      return `The Copycat, ${n(ev.playerId)}, became the ${getRole(ev.role).name}`;
    case 'MediumMessage':
      return `${n(ev.fromId)} sent the Medium ${ev.emoji}`;
    default:
      return null;
  }
}

/** Replays what really happened, including every secret, now that it's over. */
function Timeline({ events, players }: { events: LoggedEvent[]; players: Record<string, PublicPlayer> }) {
  const start = events.find((e) => e.event.type === 'GameStarted')?.at ?? events[0]?.at ?? 0;
  const rows = events.map((e) => ({ e, text: describe(e, players) })).filter((r) => r.text);
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  return (
    <Card className="mt-4">
      <Label>What really happened</Label>
      <ol className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {rows.map(({ e, text }) => (
          <li key={e.seq} className="flex gap-3 text-sm">
            <span className="w-10 shrink-0 font-mono text-xs leading-5 text-paper-faint">{fmt(e.at - start)}</span>
            <span className={e.event.type === 'PlayerDied' || e.event.type === 'ArrestResult' ? 'text-paper' : 'text-paper-dim'}>{text}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
