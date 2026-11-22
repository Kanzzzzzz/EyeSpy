import { getRole } from './roles';
import type { AbilityDefinition } from './roles/types';
import { ghostAbilitiesFor, resolveCooldown } from './reducer';
import { checkRoleMix, type MixCheck } from './state';
import type {
  GameResult,
  GameState,
  LoggedEvent,
  Phase,
  PlayerId,
  RoleId,
  RoleState,
  Settings,
  Team,
} from './types';

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  avatar: number;
  seat: number;
  alive: boolean;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  arrested: boolean;
  /** Only shown once it is public: at game over, or after a correct arrest. */
  role?: RoleId;
  team?: Team;
}

export interface AbilityView {
  id: string;
  label: string;
  hint: string;
  target: AbilityDefinition['target'];
  payload?: AbilityDefinition['payload'];
  unlocked: boolean;
  usesLeft: number | null;
  /** Server time when the cooldown ends, or null when ready. */
  readyAt: number | null;
  ghost: boolean;
}

export interface MyView {
  id: PlayerId;
  alive: boolean;
  arrested: boolean;
  role: RoleId | null;
  team: Team | null;
  roleName: string | null;
  summary: string | null;
  goal: string | null;
  knows: PlayerId[];
  raisesSent: number;
  raisesToUnlock: number;
  canWink: boolean;
  canArrest: boolean;
  winkReadyAt: number | null;
  raiseReadyAt: number | null;
  /** Sheriffs only: kills left before arrests unlock again. */
  shushedKillsLeft: number;
  abilities: AbilityView[];
  soloWinner: boolean;
}

export interface PlayerView {
  phase: Phase;
  round: number;
  now: number;
  hostId: PlayerId | null;
  players: PublicPlayer[];
  settings: Settings;
  mix: MixCheck;
  me: MyView | null;
  revealDeadline: number | null;
  arrest: { targetId: PlayerId; verdictAt: number } | null;
  result: GameResult | null;
  /** The full, unfiltered event log. Only sent once the game is over. */
  timeline: LoggedEvent[] | null;
}

export function canSee(entry: LoggedEvent, playerId: PlayerId | null): boolean {
  return entry.to === 'all' || (playerId !== null && entry.to.includes(playerId));
}

/** Events one phone may see, after a sequence number. */
export function visibleEvents(state: GameState, playerId: PlayerId | null, afterSeq = 0): LoggedEvent[] {
  return state.log.filter((e) => e.seq > afterSeq && canSee(e, playerId));
}

function abilityView(state: GameState, rs: RoleState, a: AbilityDefinition, ghost: boolean): AbilityView {
  const used = rs.abilityUses[a.id] ?? 0;
  const cd = resolveCooldown(state, a);
  const last = rs.abilityLastUsedAt[a.id];
  const readyAt = cd > 0 && last !== undefined && last + cd > state.now ? last + cd : null;
  return {
    id: a.id,
    label: a.label,
    hint: a.hint,
    target: a.target,
    ...(a.payload ? { payload: a.payload } : {}),
    unlocked: a.unlock !== 'raises' || rs.raisesSent >= state.settings.raisesToUnlock,
    usesLeft: a.uses === null ? null : Math.max(0, a.uses - used),
    readyAt,
    ghost,
  };
}

/**
 * The filtered view one phone may see. Never includes anyone else's role
 * (until the game is over) or anything that would leak a secret, such as
 * whether a countdown is a real wink.
 */
export function viewFor(state: GameState, playerId: PlayerId | null): PlayerView {
  const ended = state.phase === 'ended';
  const players: PublicPlayer[] = state.players.map((p) => {
    const rs = state.roles[p.id];
    const reveal = rs && (ended || (p.arrested && !p.alive));
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      seat: p.seat,
      alive: p.alive,
      connected: p.connected,
      ready: p.ready,
      isHost: p.id === state.hostId,
      arrested: p.arrested,
      ...(reveal ? { role: rs.role, team: rs.team } : {}),
    };
  });

  let me: MyView | null = null;
  const self = playerId ? state.players.find((p) => p.id === playerId) : undefined;
  if (self) {
    const rs = state.roles[self.id];
    const def = rs ? getRole(rs.role) : null;
    const abilities: AbilityView[] = [];
    if (rs && def) {
      if (self.alive) {
        for (const a of def.abilities ?? []) abilities.push(abilityView(state, rs, a, false));
      } else if (!self.arrested) {
        for (const a of ghostAbilitiesFor(state)) abilities.push(abilityView(state, rs, a, true));
      }
    }
    const winkCd = state.settings.winkCooldownMs;
    const raiseCd = state.settings.raiseCooldownMs;
    me = {
      id: self.id,
      alive: self.alive,
      arrested: self.arrested,
      role: rs?.role ?? null,
      team: rs?.team ?? null,
      roleName: def?.name ?? null,
      summary: def?.summary ?? null,
      goal: def?.goal ?? null,
      knows: rs?.knows ?? [],
      raisesSent: rs?.raisesSent ?? 0,
      raisesToUnlock: state.settings.raisesToUnlock,
      canWink: !!def?.canWink,
      canArrest: !!def?.canArrest,
      winkReadyAt:
        rs?.lastWinkAt != null && rs.lastWinkAt + winkCd > state.now ? rs.lastWinkAt + winkCd : null,
      raiseReadyAt:
        rs?.lastRaiseAt != null && rs.lastRaiseAt + raiseCd > state.now ? rs.lastRaiseAt + raiseCd : null,
      shushedKillsLeft: def?.isSheriff ? state.shushLockKillsRemaining : 0,
      abilities,
      soloWinner: state.extraWinners.includes(self.id),
    };
  }

  return {
    phase: state.phase,
    round: state.round,
    now: state.now,
    hostId: state.hostId,
    players,
    settings: state.settings,
    mix: checkRoleMix(state.settings, state.players.length),
    me,
    revealDeadline: state.revealDeadline,
    arrest: state.pendingArrest
      ? { targetId: state.pendingArrest.targetId, verdictAt: state.pendingArrest.verdictAt }
      : null,
    result: state.result,
    timeline: ended ? state.log : null,
  };
}
