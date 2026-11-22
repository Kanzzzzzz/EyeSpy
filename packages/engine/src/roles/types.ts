import type {
  Audience,
  DeathCause,
  GameEvent,
  GameState,
  Player,
  PlayerId,
  RoleId,
  RoleState,
  RoleTimer,
  Team,
} from '../types';

/**
 * What a role hook may do to the game. Hooks get a mutable draft of the
 * state, but should prefer these helpers so deaths, events and timers stay
 * consistent.
 */
export interface RoleContext {
  readonly state: GameState;
  readonly now: number;
  emit(event: GameEvent, to: Audience): void;
  /** Kill a player immediately (cascades to Lovers and other hooks). */
  kill(victimId: PlayerId, cause: DeathCause, killerId?: PlayerId | null): void;
  /** Run `onTimer` on the owner's role at time `at`. */
  schedule(ownerId: PlayerId, at: number, kind: string, data?: Record<string, unknown>): void;
  player(id: PlayerId): Player;
  roleOf(id: PlayerId): RoleState;
  /** Living players, in seat order. */
  alive(): Player[];
  /** Players currently holding a role, in seat order. */
  withRole(role: RoleId): Player[];
  /** Mark a player as a solo winner (shown at game over). */
  addSoloWinner(id: PlayerId): void;
  /** Switch a player to a different role (used by the Copycat). */
  changeRole(id: PlayerId, role: RoleId): void;
  /** Pause play and open a hearing: every living player votes someone out (used by the Judge). */
  startHearing(judgeId: PlayerId): void;
  random(): number;
}

export type AbilityTarget = 'none' | 'player';

export interface AbilityDefinition {
  id: string;
  label: string;
  /** One line shown on the button's confirm sheet. */
  hint: string;
  /**
   * 'player' abilities act on whoever's panel the user has open, so the user
   * must be looking at the target.
   */
  target: AbilityTarget;
  /**
   * A gesture made with the eyes. It needs eye contact with the target, and
   * everyone looking at the user at that moment sees it happen.
   */
  gesture?: 'wink';
  /** 'raises': unlocked once the player has sent `settings.raisesToUnlock` eyebrow raises. */
  unlock?: 'raises';
  /** Maximum uses per game; null means unlimited. */
  uses: number | null;
  /** A fixed cooldown, or the game's wink/raise cooldown setting. */
  cooldownMs?: number | 'wink' | 'raise';
  /** Optional free text the client must send (for example an emoji). */
  payload?: { kind: 'emoji'; options: string[] };
  /** Return an error message to reject the use, or null to allow it. */
  validate?(ctx: RoleContext, userId: PlayerId, targetId: PlayerId | null, payload: string | null): string | null;
  apply(ctx: RoleContext, userId: PlayerId, targetId: PlayerId | null, payload: string | null): void;
}

export interface WinkAttempt {
  killerId: PlayerId;
  targetId: PlayerId;
  selfId: PlayerId;
}

export type WinkOutcome =
  /** Nobody dies; the hook has already emitted whatever it needed to. */
  | { kind: 'immune' }
  /** Someone else dies in the target's place. */
  | { kind: 'redirect'; victimId: PlayerId };

/**
 * A role is one self-contained definition. The core reducer never checks a
 * role id directly except through these fields and hooks.
 */
export interface RoleDefinition {
  id: RoleId;
  name: string;
  team: Team;
  special: boolean;
  /** One sentence for the role card. */
  summary: string;
  /** What this role is trying to do. */
  goal: string;
  /** Players this role learns at the start (for example fellow Killers). */
  knowsAtStart?(ctx: RoleContext, selfId: PlayerId): PlayerId[];
  /** Initialise role data after every role has been dealt. */
  onAssigned?(ctx: RoleContext, selfId: PlayerId): void;
  /** May send winks that kill. */
  canWink?: boolean;
  /** May arrest. */
  canArrest?: boolean;
  /** May raise an eyebrow (the roles whose abilities unlock by raising). */
  canRaise?: boolean;
  /** Counts as a Killer for win checks: arresting one is a correct arrest. */
  isKiller?: boolean;
  /** Counts as a Sheriff for the "only Sheriff, Killers and one other" rule. */
  isSheriff?: boolean;
  abilities?: AbilityDefinition[];
  /** Abilities every dead player gets while someone alive holds this role. */
  ghostAbilities?: AbilityDefinition[];
  /** Called on the target first, then every other living player in seat order. First outcome wins. */
  onWinkAttempt?(ctx: RoleContext, attempt: WinkAttempt): WinkOutcome | void;
  /** Called for every event, on every player holding this role (alive or dead). */
  onEvent?(ctx: RoleContext, event: GameEvent, selfId: PlayerId): void;
  onTimer?(ctx: RoleContext, timer: RoleTimer, selfId: PlayerId): void;
}
