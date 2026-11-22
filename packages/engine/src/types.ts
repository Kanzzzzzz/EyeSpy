/**
 * Core types for the EyeSpy rules engine.
 *
 * Everything in GameState is plain JSON (no Maps, Sets, classes or Infinity),
 * so the host can snapshot it to disk after every action and restore it.
 */

export type PlayerId = string;

/** Actions sent by the host's room logic rather than by a player. */
export const SYSTEM = '__system__';

export type Team = 'killers' | 'town' | 'alone';

export const STANDARD_ROLE_IDS = ['killer', 'sheriff', 'shush', 'snitch', 'lover', 'citizen'] as const;
export const SPECIAL_ROLE_IDS = [
  'dramaQueen',
  'bodyguard',
  'paparazzi',
  'copycat',
  'medium',
  'decoy',
  'insomniac',
] as const;

export type StandardRoleId = (typeof STANDARD_ROLE_IDS)[number];
export type SpecialRoleId = (typeof SPECIAL_ROLE_IDS)[number];
export type RoleId = StandardRoleId | SpecialRoleId;

export type Phase = 'lobby' | 'reveal' | 'playing' | 'arrest' | 'ended';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 20;
export const AVATAR_COUNT = 12;

export interface Player {
  id: PlayerId;
  name: string;
  avatar: number;
  seat: number;
  alive: boolean;
  /** A real wink is counting down on this player. Secret: never sent to other phones. */
  dying: boolean;
  connected: boolean;
  ready: boolean;
  arrested: boolean;
}

export interface RoleState {
  role: RoleId;
  team: Team;
  /** Players this role was told about at the start (for example fellow Killers). */
  knows: PlayerId[];
  raisesSent: number;
  winksSent: number;
  lastWinkAt: number | null;
  lastRaiseAt: number | null;
  /** abilityId -> times used */
  abilityUses: Record<string, number>;
  /** abilityId -> last use time */
  abilityLastUsedAt: Record<string, number>;
  /** Free-form, JSON-safe data owned by the role definition. */
  data: Record<string, unknown>;
}

export interface RoleCounts {
  killer: number;
  sheriff: number;
  shush: number;
  snitch: number;
  loverPairs: number;
}

export interface Settings {
  roles: RoleCounts;
  /** When true, role counts follow the suggested mix as players join and leave. */
  autoRoles: boolean;
  special: Record<SpecialRoleId, boolean>;
  deathDelayMs: number;
  winkCooldownMs: number;
  raiseCooldownMs: number;
  victimsSeeKiller: boolean;
  revealTimeoutMs: number;
  arrestVerdictMs: number;
  raisesToUnlock: number;
  shushLockKills: number;
}

export interface PendingDeath {
  victimId: PlayerId;
  killerId: PlayerId;
  at: number;
}

export interface PendingArrest {
  sheriffId: PlayerId;
  targetId: PlayerId;
  startedAt: number;
  verdictAt: number;
}

export interface RoleTimer {
  id: number;
  at: number;
  ownerId: PlayerId;
  kind: string;
  data: Record<string, unknown>;
}

export type WinReason = 'allKillersArrested' | 'wrongArrest' | 'killersOutnumber';

export interface GameResult {
  winner: 'town' | 'killers';
  reason: WinReason;
  /** Everyone who won: the winning team (alive or dead) plus solo winners. */
  winners: PlayerId[];
  /** Players who won on their own terms (for example the Drama Queen). */
  extraWinners: PlayerId[];
  endedAt: number;
}

export type DeathCause = 'wink' | 'heartbreak';

export type GameEvent =
  | { type: 'PlayerJoined'; playerId: PlayerId }
  | { type: 'PlayerLeft'; playerId: PlayerId; kicked: boolean }
  | { type: 'PlayerConnection'; playerId: PlayerId; connected: boolean }
  | { type: 'SettingsChanged' }
  | { type: 'SeatsChanged' }
  | { type: 'RolesAssigned'; playerId: PlayerId; role: RoleId; team: Team; knows: PlayerId[] }
  | { type: 'PlayerReady'; playerId: PlayerId }
  | { type: 'GameStarted' }
  | { type: 'WinkSent'; killerId: PlayerId; targetId: PlayerId; fake: boolean }
  | { type: 'Winked'; targetId: PlayerId; killerId: PlayerId | null; deadline: number }
  | { type: 'SheriffWinked'; sheriffId: PlayerId; killerId: PlayerId }
  | { type: 'PlayerDied'; playerId: PlayerId; cause: DeathCause }
  | { type: 'EyebrowRaised'; byId: PlayerId; targetId: PlayerId }
  | { type: 'AbilityUnlocked'; playerId: PlayerId; abilityId: string }
  | { type: 'AbilityUsed'; playerId: PlayerId; abilityId: string; targetId: PlayerId | null }
  | { type: 'SheriffShushed'; kills: number }
  | { type: 'ShushLifted' }
  | { type: 'SnitchTip'; suspectId: PlayerId }
  | { type: 'ArrestStarted'; targetId: PlayerId; verdictAt: number }
  | { type: 'ArrestResult'; targetId: PlayerId; correct: boolean; role: RoleId }
  | { type: 'GameEnded'; result: GameResult }
  | { type: 'LobbyReset' }
  // Special roles
  | { type: 'RoleChanged'; playerId: PlayerId; role: RoleId; team: Team }
  | { type: 'Phew'; targetId: PlayerId }
  | { type: 'Snapped'; targetId: PlayerId; winksSent: number }
  | { type: 'Guarding'; targetId: PlayerId }
  | { type: 'GuardTriggered'; savedId: PlayerId }
  | { type: 'MediumMessage'; fromId: PlayerId; emoji: string }
  | { type: 'Buzz' }
  | { type: 'SoloWin'; playerId: PlayerId };

export type GameEventType = GameEvent['type'];

/** Who may see an event. */
export type Audience = 'all' | PlayerId[];

export interface LoggedEvent {
  seq: number;
  at: number;
  to: Audience;
  event: GameEvent;
}

export interface GameState {
  version: 1;
  phase: Phase;
  round: number;
  hostId: PlayerId | null;
  /** Ordered by seat. */
  players: Player[];
  roles: Record<PlayerId, RoleState>;
  settings: Settings;
  rng: number;
  pendingDeaths: PendingDeath[];
  pendingArrest: PendingArrest | null;
  revealDeadline: number | null;
  shushLockKillsRemaining: number;
  timers: RoleTimer[];
  nextTimerId: number;
  killCount: number;
  deathOrder: PlayerId[];
  extraWinners: PlayerId[];
  result: GameResult | null;
  log: LoggedEvent[];
  nextSeq: number;
  startedAt: number | null;
  now: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type SettingsPatch = Partial<Omit<Settings, 'roles' | 'special'>> & {
  roles?: Partial<RoleCounts>;
  special?: Partial<Record<SpecialRoleId, boolean>>;
};

/** Actions a player's phone may send. `by` and `at` are stamped by the host. */
export type PlayerAction =
  | { type: 'configure'; settings: SettingsPatch }
  | { type: 'start' }
  | { type: 'ready' }
  | { type: 'wink'; targetId: PlayerId }
  | { type: 'raiseEyebrow'; targetId: PlayerId }
  | { type: 'useAbility'; abilityId: string; targetId?: PlayerId | null; payload?: string | null }
  | { type: 'arrest'; targetId: PlayerId }
  | { type: 'playAgain' }
  | { type: 'kick'; playerId: PlayerId }
  | { type: 'reorder'; order: PlayerId[] }
  | { type: 'leave' };

/** Actions only the host's room logic may send. */
export type SystemAction =
  | { type: 'join'; playerId: PlayerId; name: string; avatar: number; asHost?: boolean }
  | { type: 'tick' }
  | { type: 'disconnect'; playerId: PlayerId }
  | { type: 'reconnect'; playerId: PlayerId }
  | { type: 'seed'; seed: number };

export type ActionBody = PlayerAction | SystemAction;

export type Action = ActionBody & { by: PlayerId; at: number };

export type ErrorCode =
  | 'wrongPhase'
  | 'notHost'
  | 'notAllowed'
  | 'unknownPlayer'
  | 'invalidTarget'
  | 'cooldown'
  | 'dead'
  | 'shushed'
  | 'locked'
  | 'usedUp'
  | 'badSettings'
  | 'tooFewPlayers'
  | 'tooManyPlayers'
  | 'nameTaken'
  | 'badName'
  | 'unknownAbility'
  | 'unknownAction';

export interface ReduceResult {
  state: GameState;
  events: LoggedEvent[];
  error?: ErrorCode;
  message?: string;
}
