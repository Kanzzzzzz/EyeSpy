import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { character, getRole, type LoggedEvent, type PublicPlayer, type WinReason } from '@eyespy/engine';
import { AnimeFace } from '../art/AnimeFace';
import { publicLook, roleLook } from '../art/characters';
import { RoleBadge, TeamIcon } from '../art/RoleBadge';
import { color, motion as m } from '../design/tokens';
import { fx } from '../fx/fx';
import { useGame } from '../state/store';
import { Button, Card, Label, Screen } from '../ui/kit';

const REASON: Record<WinReason, string> = {
  allKillersCaught: 'Every Killer was caught.',
  wrongArrest: 'The Sheriff arrested an innocent player.',
  killersOutnumber: 'Only the Sheriff, the Killers and one other were left.',
  sheriffVotedOut: 'The town voted out the Sheriff.',
};

export function GameOver() {
  const view = useGame((s) => s.snap!.view!);
  const me = useGame((s) => s.snap!.playerId);
  const send = useGame((s) => s.send);
  const leaveGame = useGame((s) => s.leaveGame);
  const reduce = useReducedMotion();
  // After "Play again" the view moves on while this screen animates out:
  // keep showing the round that just ended.
  const lastResult = useRef(view.result);
  if (view.result) lastResult.current = view.result;
  const lastPlayers = useRef(view.players);
  if (view.phase === 'ended') lastPlayers.current = view.players;
  const result = lastResult.current;
  const won = !!me && !!result && result.winners.includes(me);
  const isHost = view.hostId === me;
  const winColor = result?.winner === 'town' ? color.team.town : color.team.killers;

  useEffect(() => {
    fx.flash('#FFFFFF', 220);
    fx.shake(10, 350);
    if (!won || reduce) return;
    void confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.25 },
      colors: [color.spot.DEFAULT, color.cyan.DEFAULT, winColor, color.paper.DEFAULT],
      disableForReducedMotion: true,
    });
  }, [won, reduce, winColor]);

  const players = lastPlayers.current;
  const byId = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  if (!result) return null;
  return (
    <Screen lines>
      <motion.div className="mt-6 text-center" initial={reduce ? { opacity: 0 } : { scale: 2.2, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: -2 }} transition={m.bouncy}>
        <p className="font-display text-3xl uppercase tracking-[0.12em]" style={{ color: winColor }}>
          {won ? 'You won' : 'You lost'}
        </p>
        <h1 className="title-outline font-display text-6xl uppercase leading-none text-paper" style={{ textShadow: `6px 6px 0 ${winColor}` }}>
          {result.winner === 'town' ? 'Town wins' : 'Killers win'}
        </h1>
        <p className="mt-1 font-jp text-sm font-black tracking-[0.4em] text-paper-faint">{result.winner === 'town' ? '町の勝利' : '殺し屋の勝利'}</p>
        <p className="mt-3 font-semibold text-paper-dim">{REASON[result.reason]}</p>
        {result.extraWinners.length > 0 && (
          <p className="mt-1 text-sm font-semibold text-team-alone">Also won: {result.extraWinners.map((id) => byId[id]?.name).join(', ')}</p>
        )}
      </motion.div>

      <Card className="mt-7" tone={winColor}>
        <Label jp="キャスト">The cast</Label>
        <ul className="flex flex-col gap-2.5">
          {players.map((p, i) => {
            const entry = character(p.character);
            const winner = result.winners.includes(p.id);
            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 0.25 + i * 0.06 }}
                className="flex items-center gap-2 border-[3px] border-black p-1.5"
                style={{ background: winner ? color.ink[700] : color.ink[800] }}
              >
                <span className="shrink-0 border-2 border-black bg-ink-900">
                  <AnimeFace look={publicLook(p.avatar)} size={46} crop="face" expression={p.alive ? (winner ? 'happy' : 'neutral') : 'dead'} ghost={!p.alive} />
                </span>
                <span className="font-display text-xl text-paper-faint">→</span>
                <span className="shrink-0 border-2 border-black" style={{ background: `${roleLook(p.character, p.role).accent}44` }}>
                  <AnimeFace look={roleLook(p.character, p.role)} size={46} crop="face" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg uppercase leading-tight text-paper">{p.name}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-paper-faint">
                    {p.team && <TeamIcon team={p.team} size={10} />} {p.role ? getRole(p.role).name : ''} {entry ? `· ${entry.name}` : ''}
                  </span>
                </span>
                {p.role && <RoleBadge role={p.role} team={p.team!} size={34} />}
              </motion.li>
            );
          })}
        </ul>
      </Card>

      {view.timeline && <Timeline events={view.timeline} players={byId} />}

      <div className="mt-auto flex flex-col gap-2 pt-6">
        {isHost ? (
          <Button size="lg" onClick={() => void send({ type: 'playAgain' })} sfx="もう一回">
            Play again
          </Button>
        ) : (
          <p className="text-center font-display text-lg uppercase text-paper-dim">Waiting for the host to start another round…</p>
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
    case 'SawWink':
      return `${e.to === 'all' ? 'Someone' : (e.to as string[]).map(n).join(', ')} saw ${n(ev.winkerId)} wink`;
    case 'SheriffWinked':
      return `${n(ev.killerId)} winked the Sheriff, ${n(ev.sheriffId)}, by mistake`;
    case 'PlayerDied':
      return ev.cause === 'heartbreak' ? `${n(ev.playerId)} died of a broken heart` : ev.cause === 'vote' ? `${n(ev.playerId)} was voted out` : `${n(ev.playerId)} died`;
    case 'EyebrowRaised':
      return `${n(ev.byId)} raised an eyebrow at ${n(ev.targetId)}`;
    case 'SheriffShushed':
      return `The Shush silenced the Sheriff${character(ev.shushCharacter) ? ` (${character(ev.shushCharacter)!.move})` : ''}`;
    case 'SnitchTip':
      return `The Snitch named ${n(ev.suspectId)}`;
    case 'ArrestStarted':
      return `${n(ev.targetId)} was arrested`;
    case 'ArrestResult':
      return ev.correct ? `${n(ev.targetId)} was a Killer` : `${n(ev.targetId)} was innocent (${getRole(ev.role).name})`;
    case 'HearingStarted':
      return `The Judge called a hearing${character(ev.judgeCharacter) ? ` (${character(ev.judgeCharacter)!.move})` : ''}`;
    case 'HearingResult':
      return ev.eliminatedId ? `The hearing voted out ${n(ev.eliminatedId)} (${getRole(ev.role!).name})` : 'The hearing tied: nobody left';
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
  const strong = new Set(['PlayerDied', 'ArrestResult', 'HearingResult', 'SawWink']);
  return (
    <Card className="mt-5">
      <Label jp="真相">What really happened</Label>
      <ol className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {rows.map(({ e, text }) => (
          <li key={e.seq} className="flex gap-3 text-sm">
            <span className="w-10 shrink-0 font-display leading-5 text-paper-faint">{fmt(e.at - start)}</span>
            <span className={strong.has(e.event.type) ? 'font-semibold text-paper' : 'text-paper-dim'}>{text}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
