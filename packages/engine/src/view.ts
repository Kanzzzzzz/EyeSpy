import { getRole } from './roles';
import type { AbilityDefinition } from './roles/types';
import { ghostAbilitiesFor, hasEyeContact, resolveCooldown } from './reducer';
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
  votedOut: boolean;
  /** Only shown once it is public: at game over, or after an arrest or hearing caught them. */
  role?: RoleId;
  team?: Team;
  character?: string | null;
}

export interface AbilityView {
  id: string;
  label: string;
  hint: string;
  target: AbilityDefinition['target'];
  gesture?: AbilityDefinition['gesture'];
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
  votedOut: boolean;
  role: RoleId | null;
  team: Team | null;
  roleName: string | null;
  summary: string | null;
  goal: string | null;
  /** Your secret character for this role. */
  character: string | null;
  knows: PlayerId[];
  raisesSent: number;
  raisesToUnlock: number;
  canWink: boolean;
  canArrest: boolean;
  canRaise: boolean;
  winkReadyAt: number | null;
  raiseReadyAt: number | null;
  /** Sheriffs only: kills left before arrests unlock again. */
  shushedKillsLeft: number;
  abilities: AbilityView[];
  soloWinner: boolean;
  /** Whose panel you have open. */
  lookingAt: PlayerId | null;
  /** The player whose panel you have open is looking back at you. */
  eyeContact: boolean;
  /** How many living players are looking at you right now (not who). */
  watchers: number;
  /** Server time when you may look at someone else, or null if you're free now. */
  lookLockedUntil: number | null;
}

export interface HearingView {
  endsAt: number;
  /** Who has voted so far (not for whom). */
  voted: PlayerId[];
  myVote: PlayerId | null;
}

export interface PlayerView {
  phase: Phase;
  round: number;
  hostId: PlayerId | null;
  players: PublicPlayer[];
  settings: Settings;
  mix: MixCheck;
  me: MyView | null;
  revealDeadline: number | null;
  arrest: { targetId: PlayerId; verdictAt: number } | null;
  hearing: HearingView | null;
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
    ...(a.gesture ? { gesture: a.gesture } : {}),
    ...(a.payload ? { payload: a.payload } : {}),
    unlocked: a.unlock !== 'raises' || rs.raisesSent >= state.settings.raisesToUnlock,
    usesLeft: a.uses === null ? null : Math.max(0, a.uses - used),
    readyAt,
    ghost,
  };
}

/**
 * The filtered view one phone may see. Never includes anyone else's role or
 * character (until it's public), where anyone else is looking (only whether
 * they're looking at *you*, and only for the panel you have open), or
 * anything else that would leak a secret, such as whether a countdown is a
 * real wink.
 */
export function viewFor(state: GameState, playerId: PlayerId | null): PlayerView {
  const ended = state.phase === 'ended';
  const players: PublicPlayer[] = state.players.map((p) => {
    const rs = state.roles[p.id];
    const reveal = rs && (ended || ((p.arrested || p.votedOut) && !p.alive));
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
      votedOut: p.votedOut,
      ...(reveal ? { role: rs.role, team: rs.team, character: rs.character } : {}),
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
      } else if (!self.arrested && !self.votedOut) {
        for (const a of ghostAbilitiesFor(state)) abilities.push(abilityView(state, rs, a, true));
      }
    }
    const winkCd = state.settings.winkCooldownMs;
    const raiseCd = state.settings.raiseCooldownMs;
    const watchers = self.alive ? state.players.filter((p) => p.alive && p.id !== self.id && p.lookingAt === self.id).length : 0;
    me = {
      id: self.id,
      alive: self.alive,
      arrested: self.arrested,
      votedOut: self.votedOut,
      role: rs?.role ?? null,
      team: rs?.team ?? null,
      roleName: def?.name ?? null,
      summary: def?.summary ?? null,
      goal: def?.goal ?? null,
      character: rs?.character ?? null,
      knows: rs?.knows ?? [],
      raisesSent: rs?.raisesSent ?? 0,
      raisesToUnlock: state.settings.raisesToUnlock,
      canWink: !!def?.canWink,
      canArrest: !!def?.canArrest,
      canRaise: !!def?.canRaise,
      winkReadyAt:
        rs?.lastWinkAt != null && rs.lastWinkAt + winkCd > state.now ? rs.lastWinkAt + winkCd : null,
      raiseReadyAt:
        rs?.lastRaiseAt != null && rs.lastRaiseAt + raiseCd > state.now ? rs.lastRaiseAt + raiseCd : null,
      shushedKillsLeft: def?.isSheriff ? state.shushLockKillsRemaining : 0,
      abilities,
      soloWinner: state.extraWinners.includes(self.id),
      lookingAt: self.lookingAt,
      eyeContact: self.lookingAt !== null && hasEyeContact(state, self.id, self.lookingAt),
      watchers,
      lookLockedUntil:
        self.alive && self.lookingAt !== null && self.lookedAt !== null && self.lookedAt + state.settings.lookLockMs > state.now
          ? self.lookedAt + state.settings.lookLockMs
          : null,
    };
  }

  const h = state.hearing;
  return {
    phase: state.phase,
    round: state.round,
    hostId: state.hostId,
    players,
    settings: state.settings,
    mix: checkRoleMix(state.settings, state.players.length),
    me,
    revealDeadline: state.revealDeadline,
    arrest: state.pendingArrest
      ? { targetId: state.pendingArrest.targetId, verdictAt: state.pendingArrest.verdictAt }
      : null,
    hearing: h
      ? { endsAt: h.endsAt, voted: Object.keys(h.votes), myVote: (playerId && h.votes[playerId]) || null }
      : null,
    result: state.result,
    timeline: ended ? state.log : null,
  };
}
