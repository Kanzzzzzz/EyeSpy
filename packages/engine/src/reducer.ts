import { getRole, ROLES } from './roles';
import type { AbilityDefinition, RoleContext, WinkOutcome } from './roles/types';
import { isCharacterFor, ROSTER } from './roster';
import {
  AVATAR_COUNT,
  MAX_PLAYERS,
  SPECIAL_ROLE_IDS,
  SYSTEM,
  type Action,
  type Audience,
  type DeathCause,
  type ErrorCode,
  type GameEvent,
  type GameState,
  type Phase,
  type Player,
  type PlayerId,
  type ReduceResult,
  type RoleId,
  type RoleState,
  type SettingsPatch,
  type Team,
  type WinReason,
} from './types';
import { checkRoleMix, enabledSpecialRoles, nextRandom, SETTING_LIMITS, suggestRoles } from './state';
import { checkWin } from './win';

class Rejection extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function reject(code: ErrorCode, message?: string): never {
  throw new Rejection(code, message);
}

const MAX_NAME = 16;

/** Phases in which players can open each other's panels. */
const LOOK_PHASES: Phase[] = ['playing', 'arrest', 'hearing'];

function newRoleState(role: RoleId, character: string | null): RoleState {
  return {
    role,
    team: getRole(role).team,
    character,
    knows: [],
    raisesSent: 0,
    winksSent: 0,
    lastWinkAt: null,
    lastRaiseAt: null,
    abilityUses: {},
    abilityLastUsedAt: {},
    data: {},
  };
}

function clamp(n: unknown, [lo, hi]: readonly [number, number], fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** True when a tick at `at` would change anything. Lets the host skip cloning on idle ticks. */
export function hasDueWork(state: GameState, at: number): boolean {
  if (state.phase === 'reveal') return state.revealDeadline !== null && at >= state.revealDeadline;
  if (state.phase === 'arrest') return !!state.pendingArrest && at >= state.pendingArrest.verdictAt;
  if (state.phase === 'hearing') return !!state.hearing && at >= state.hearing.endsAt;
  if (state.phase === 'playing') {
    return state.pendingDeaths.some((d) => d.at <= at) || state.timers.some((t) => t.at <= at);
  }
  return false;
}

/** Both alive and each looking into the other's eyes. */
export function hasEyeContact(state: GameState, a: PlayerId, b: PlayerId): boolean {
  const pa = state.players.find((p) => p.id === a);
  const pb = state.players.find((p) => p.id === b);
  return !!pa && !!pb && pa.alive && pb.alive && pa.lookingAt === b && pb.lookingAt === a;
}

/**
 * The one way game state changes: `(state, action) -> { state, events }`.
 * Pure: the same state and action always give the same result.
 * Invalid actions return the previous state unchanged, with an error code.
 */
export function reduce(prev: GameState, action: Action): ReduceResult {
  const at = Math.max(action.at, prev.now);
  if (action.type === 'tick' && action.by === SYSTEM && !hasDueWork(prev, at)) {
    return { state: prev, events: [] };
  }
  // Looking at the panel you already have open changes nothing.
  if (action.type === 'look' && LOOK_PHASES.includes(prev.phase)) {
    const p = prev.players.find((x) => x.id === action.by);
    if (p && p.lookingAt === (action.targetId ?? null)) return { state: prev, events: [] };
  }
  // Logged events are never mutated, so the log can be shared rather than deep-copied.
  const state = structuredClone({ ...prev, log: [] }) as GameState;
  state.log = prev.log.slice();
  state.now = at;
  const firstSeq = state.nextSeq;
  const engine = new Engine(state, at);
  try {
    engine.handle(action);
    engine.settle();
  } catch (err) {
    if (err instanceof Rejection) return { state: prev, events: [], error: err.code, message: err.message };
    throw err;
  }
  return { state, events: state.log.filter((e) => e.seq >= firstSeq) };
}

class Engine implements RoleContext {
  private queue: GameEvent[] = [];

  constructor(
    readonly state: GameState,
    readonly now: number,
  ) {}

  // -------------------------------------------------------------------------
  // RoleContext
  // -------------------------------------------------------------------------

  emit(event: GameEvent, to: Audience): void {
    const audience = to === 'all' ? 'all' : [...new Set(to)];
    if (audience !== 'all' && audience.length === 0) return;
    this.state.log.push({ seq: this.state.nextSeq++, at: this.now, to: audience, event });
    this.queue.push(event);
  }

  kill(victimId: PlayerId, cause: DeathCause, _killerId: PlayerId | null = null): void {
    const p = this.player(victimId);
    if (!p.alive) return;
    p.alive = false;
    p.dying = false;
    this.state.pendingDeaths = this.state.pendingDeaths.filter((d) => d.victimId !== victimId);
    this.state.deathOrder.push(victimId);
    if (cause === 'wink') {
      this.state.killCount += 1;
      if (this.state.shushLockKillsRemaining > 0) {
        this.state.shushLockKillsRemaining -= 1;
        if (this.state.shushLockKillsRemaining === 0) {
          this.emit({ type: 'ShushLifted' }, this.sheriffIds());
        }
      }
    }
    this.emit({ type: 'PlayerDied', playerId: victimId, cause }, 'all');
  }

  schedule(ownerId: PlayerId, at: number, kind: string, data: Record<string, unknown> = {}): void {
    this.state.timers.push({ id: this.state.nextTimerId++, at, ownerId, kind, data });
  }

  player(id: PlayerId): Player {
    const p = this.state.players.find((x) => x.id === id);
    if (!p) reject('unknownPlayer');
    return p;
  }

  roleOf(id: PlayerId): RoleState {
    const rs = this.state.roles[id];
    if (!rs) reject('unknownPlayer', 'That player has no role yet.');
    return rs;
  }

  alive(): Player[] {
    return this.state.players.filter((p) => p.alive);
  }

  withRole(role: RoleId): Player[] {
    return this.state.players.filter((p) => this.state.roles[p.id]?.role === role);
  }

  addSoloWinner(id: PlayerId): void {
    if (this.state.extraWinners.includes(id)) return;
    this.state.extraWinners.push(id);
    this.emit({ type: 'SoloWin', playerId: id }, [id]);
  }

  changeRole(id: PlayerId, role: RoleId): void {
    const prev = this.roleOf(id);
    const next = newRoleState(role, ROSTER[role][0]?.id ?? null);
    next.raisesSent = prev.raisesSent;
    next.winksSent = prev.winksSent;
    next.lastRaiseAt = prev.lastRaiseAt;
    this.state.roles[id] = next;
    getRole(role).onAssigned?.(this, id);
    this.emit({ type: 'RoleChanged', playerId: id, role, team: next.team }, [id]);
  }

  startHearing(judgeId: PlayerId): void {
    const s = this.state;
    if (s.phase !== 'playing') reject('wrongPhase', 'A hearing can only be called during play.');
    s.phase = 'hearing';
    s.hearing = { judgeId, startedAt: this.now, endsAt: this.now + s.settings.hearingMs, votes: {} };
    this.emit({ type: 'HearingStarted', endsAt: s.hearing.endsAt, judgeCharacter: this.roleOf(judgeId).character }, 'all');
  }

  random(): number {
    const [value, next] = nextRandom(this.state.rng);
    this.state.rng = next;
    return value;
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  handle(action: Action): void {
    const isSystem = action.by === SYSTEM;
    switch (action.type) {
      case 'join':
      case 'tick':
      case 'disconnect':
      case 'reconnect':
      case 'seed':
        if (!isSystem) reject('notAllowed', 'Only the host can do that.');
        break;
      default:
        if (isSystem) break;
        this.player(action.by);
    }

    switch (action.type) {
      case 'join':
        return this.join(action.playerId, action.name, action.avatar, !!action.asHost);
      case 'leave':
        return this.leave(action.by, false);
      case 'kick':
        this.requireHost(action.by);
        if (action.playerId === action.by) reject('invalidTarget', "You can't kick yourself.");
        return this.leave(action.playerId, true);
      case 'reorder':
        return this.reorder(action.by, action.order);
      case 'configure':
        return this.configure(action.by, action.settings);
      case 'start':
        return this.start(action.by);
      case 'ready':
        return this.ready(action.by);
      case 'pickCharacter':
        return this.pickCharacter(action.by, action.characterId);
      case 'look':
        return this.look(action.by, action.targetId ?? null);
      case 'wink':
        return this.wink(action.by, action.targetId);
      case 'raiseEyebrow':
        return this.raise(action.by, action.targetId);
      case 'useAbility':
        return this.useAbility(action.by, action.abilityId, action.targetId ?? null, action.payload ?? null);
      case 'arrest':
        return this.arrest(action.by, action.targetId);
      case 'vote':
        return this.vote(action.by, action.targetId);
      case 'playAgain':
        return this.playAgain(action.by);
      case 'tick':
        return this.tick();
      case 'disconnect':
        return this.setConnected(action.playerId, false);
      case 'reconnect':
        return this.setConnected(action.playerId, true);
      case 'seed':
        this.state.rng = action.seed >>> 0 || 1;
        return;
      default:
        reject('unknownAction');
    }
  }

  /** Run role reactions to queued events, then check for a winner. */
  settle(): void {
    this.drain();
    if (this.state.phase === 'playing') {
      const win = checkWin(this.state);
      if (win) this.endGame(win.winner, win.reason);
      this.drain();
    }
  }

  private drain(): void {
    let guard = 0;
    while (this.queue.length > 0) {
      if (++guard > 10000) throw new Error('Role event loop did not settle');
      const event = this.queue.shift()!;
      for (const p of [...this.state.players]) {
        const rs = this.state.roles[p.id];
        if (!rs) continue;
        getRole(rs.role).onEvent?.(this, event, p.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------

  private requireHost(by: PlayerId): void {
    if (by !== this.state.hostId) reject('notHost', 'Only the host can do that.');
  }

  private requirePhase(...phases: Phase[]): void {
    if (!phases.includes(this.state.phase)) reject('wrongPhase', `Not allowed during ${this.state.phase}.`);
  }

  /** The acting player must be alive and not counting down from a wink. */
  private requireActive(by: PlayerId): Player {
    const p = this.player(by);
    if (!p.alive || p.dying) reject('dead', "You're out of the game.");
    return p;
  }

  /** A living player other than the actor. */
  private requireTarget(by: PlayerId, targetId: PlayerId | null | undefined): Player {
    if (!targetId) reject('invalidTarget', 'Pick a player first.');
    const t = this.state.players.find((p) => p.id === targetId);
    if (!t || !t.alive) reject('invalidTarget', 'That player is out of the game.');
    if (t.id === by) reject('invalidTarget', "You can't target yourself.");
    return t;
  }

  /** The actor must have the target's panel open. */
  private requireLooking(actor: Player, target: Player): void {
    if (actor.lookingAt !== target.id) reject('notLooking', `Open ${target.name}'s panel first.`);
  }

  /** Eye gestures need both players looking into each other's eyes. */
  private requireEyeContact(actor: Player, target: Player): void {
    this.requireLooking(actor, target);
    if (!hasEyeContact(this.state, actor.id, target.id)) {
      reject('noEyeContact', `No eye contact: ${target.name} isn't looking at you.`);
    }
  }

  /** Everyone (but `except`) whose panel is on the actor right now. */
  private watchersOf(actorId: PlayerId, except: PlayerId): PlayerId[] {
    return this.state.players.filter((p) => p.id !== actorId && p.id !== except && p.lookingAt === actorId).map((p) => p.id);
  }

  private sheriffIds(): PlayerId[] {
    return this.alive()
      .filter((p) => {
        const rs = this.state.roles[p.id];
        return !!rs && !!getRole(rs.role).isSheriff;
      })
      .map((p) => p.id);
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  private join(playerId: PlayerId, rawName: string, avatar: number, asHost: boolean): void {
    this.requirePhase('lobby');
    const s = this.state;
    if (s.players.some((p) => p.id === playerId)) reject('notAllowed', 'Already in the game.');
    const name = (rawName ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > MAX_NAME) reject('badName', `Names are 1 to ${MAX_NAME} characters.`);
    if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      reject('nameTaken', 'Someone already has that name.');
    }
    if (s.players.length >= MAX_PLAYERS) reject('tooManyPlayers', 'The game is full.');
    s.players.push({
      id: playerId,
      name,
      avatar: clamp(avatar, [0, AVATAR_COUNT - 1], 0),
      seat: s.players.length,
      alive: true,
      dying: false,
      connected: true,
      ready: false,
      arrested: false,
      votedOut: false,
      lookingAt: null,
    });
    if (asHost || !s.hostId) s.hostId = playerId;
    this.emit({ type: 'PlayerJoined', playerId }, 'all');
    this.applyAutoRoles();
  }

  private leave(playerId: PlayerId, kicked: boolean): void {
    this.requirePhase('lobby');
    const s = this.state;
    this.player(playerId);
    s.players = s.players.filter((p) => p.id !== playerId);
    s.players.forEach((p, i) => (p.seat = i));
    if (s.hostId === playerId) s.hostId = s.players[0]?.id ?? null;
    this.emit({ type: 'PlayerLeft', playerId, kicked }, 'all');
    this.applyAutoRoles();
  }

  private reorder(by: PlayerId, order: PlayerId[]): void {
    this.requireHost(by);
    this.requirePhase('lobby');
    const s = this.state;
    const ids = new Set(s.players.map((p) => p.id));
    if (order.length !== ids.size || new Set(order).size !== ids.size || order.some((id) => !ids.has(id))) {
      reject('invalidTarget', 'The new order must list every player once.');
    }
    s.players = order.map((id, seat) => ({ ...s.players.find((p) => p.id === id)!, seat }));
    this.emit({ type: 'SeatsChanged' }, 'all');
  }

  private applyAutoRoles(): void {
    if (this.state.settings.autoRoles) {
      this.state.settings.roles = suggestRoles(this.state.players.length);
    }
  }

  private configure(by: PlayerId, patch: SettingsPatch): void {
    this.requireHost(by);
    this.requirePhase('lobby', 'ended');
    if (!patch || typeof patch !== 'object') reject('badSettings');
    const s = this.state.settings;
    for (const key of Object.keys(SETTING_LIMITS) as (keyof typeof SETTING_LIMITS)[]) {
      if (patch[key] !== undefined) s[key] = clamp(patch[key], SETTING_LIMITS[key], s[key]);
    }
    if (typeof patch.victimsSeeKiller === 'boolean') s.victimsSeeKiller = patch.victimsSeeKiller;
    if (patch.special) {
      for (const id of SPECIAL_ROLE_IDS) {
        const v = patch.special[id];
        if (typeof v === 'boolean') s.special[id] = v;
      }
    }
    if (patch.roles) {
      const r = patch.roles;
      const lim = [0, MAX_PLAYERS] as const;
      s.roles = {
        killer: clamp(r.killer, lim, s.roles.killer),
        sheriff: clamp(r.sheriff, lim, s.roles.sheriff),
        shush: clamp(r.shush, [0, 3], s.roles.shush),
        snitch: clamp(r.snitch, [0, 3], s.roles.snitch),
        judge: clamp(r.judge, [0, 2], s.roles.judge),
        loverPairs: clamp(r.loverPairs, [0, 5], s.roles.loverPairs),
      };
      s.autoRoles = false;
    }
    if (typeof patch.autoRoles === 'boolean') s.autoRoles = patch.autoRoles;
    this.applyAutoRoles();
    this.emit({ type: 'SettingsChanged' }, 'all');
  }

  private resetPlayers(): void {
    for (const p of this.state.players) {
      p.alive = true;
      p.dying = false;
      p.ready = false;
      p.arrested = false;
      p.votedOut = false;
      p.lookingAt = null;
    }
  }

  private start(by: PlayerId): void {
    this.requireHost(by);
    this.requirePhase('lobby');
    const s = this.state;
    const n = s.players.length;
    const mix = checkRoleMix(s.settings, n);
    if (!mix.ok) {
      const code = n < 5 ? 'tooFewPlayers' : n > MAX_PLAYERS ? 'tooManyPlayers' : 'badSettings';
      reject(code, mix.problem);
    }

    // Deal: shuffle seats, then hand out roles in a fixed order.
    const r = s.settings.roles;
    const deck: RoleId[] = [
      ...Array<RoleId>(r.killer).fill('killer'),
      ...Array<RoleId>(r.sheriff).fill('sheriff'),
      ...Array<RoleId>(r.shush).fill('shush'),
      ...Array<RoleId>(r.snitch).fill('snitch'),
      ...Array<RoleId>(r.judge).fill('judge'),
      ...Array<RoleId>(r.loverPairs * 2).fill('lover'),
      ...enabledSpecialRoles(s.settings),
    ];
    while (deck.length < n) deck.push('citizen');
    const order = s.players.map((p) => p.id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }

    s.roles = {};
    const used = new Set<string>();
    order.forEach((id, i) => {
      const role = deck[i]!;
      // A random character to start with, avoiding repeats within a role while
      // there are spares. The player can pick another on the reveal screen.
      const fresh = ROSTER[role].filter((c) => !used.has(c.id));
      const options = fresh.length ? fresh : ROSTER[role];
      const character = options[Math.floor(this.random() * options.length)]?.id ?? null;
      if (character) used.add(character);
      s.roles[id] = newRoleState(role, character);
    });
    this.resetPlayers();
    s.pendingDeaths = [];
    s.pendingArrest = null;
    s.hearing = null;
    s.shushLockKillsRemaining = 0;
    s.timers = [];
    s.killCount = 0;
    s.deathOrder = [];
    s.extraWinners = [];
    s.result = null;
    s.round += 1;
    s.startedAt = this.now;
    s.log = [];

    for (const p of s.players) getRole(s.roles[p.id]!.role).onAssigned?.(this, p.id);
    for (const p of s.players) {
      const rs = s.roles[p.id]!;
      const knows = getRole(rs.role).knowsAtStart?.(this, p.id) ?? [];
      rs.knows = knows;
      this.emit({ type: 'RolesAssigned', playerId: p.id, role: rs.role, team: rs.team, knows }, [p.id]);
    }
    s.phase = 'reveal';
    s.revealDeadline = this.now + s.settings.revealTimeoutMs;
  }

  private ready(by: PlayerId): void {
    this.requirePhase('reveal');
    const p = this.player(by);
    if (p.ready) return;
    p.ready = true;
    this.emit({ type: 'PlayerReady', playerId: by }, 'all');
    this.maybeEndReveal();
  }

  private pickCharacter(by: PlayerId, characterId: string): void {
    this.requirePhase('reveal');
    const rs = this.roleOf(by);
    if (typeof characterId !== 'string' || !isCharacterFor(rs.role, characterId)) {
      reject('unknownCharacter', "That character isn't available for your role.");
    }
    rs.character = characterId;
  }

  private maybeEndReveal(): void {
    if (this.state.phase !== 'reveal') return;
    const waiting = this.state.players.filter((p) => p.connected && !p.ready);
    if (waiting.length === 0) this.beginPlaying();
  }

  private beginPlaying(): void {
    this.state.phase = 'playing';
    this.state.revealDeadline = null;
    this.emit({ type: 'GameStarted' }, 'all');
  }

  private playAgain(by: PlayerId): void {
    this.requireHost(by);
    this.requirePhase('ended');
    const s = this.state;
    s.phase = 'lobby';
    s.roles = {};
    s.pendingDeaths = [];
    s.pendingArrest = null;
    s.hearing = null;
    s.revealDeadline = null;
    s.shushLockKillsRemaining = 0;
    s.timers = [];
    s.result = null;
    s.extraWinners = [];
    s.deathOrder = [];
    s.killCount = 0;
    s.log = [];
    this.resetPlayers();
    this.applyAutoRoles();
    this.emit({ type: 'LobbyReset' }, 'all');
  }

  private setConnected(playerId: PlayerId, connected: boolean): void {
    const p = this.player(playerId);
    if (p.connected === connected) return;
    p.connected = connected;
    this.emit({ type: 'PlayerConnection', playerId, connected }, 'all');
    if (!connected) this.maybeEndReveal();
  }

  // -------------------------------------------------------------------------
  // Play
  // -------------------------------------------------------------------------

  /** Open someone's panel (or close yours with null). Ghosts may look too, but nobody sees them. */
  private look(by: PlayerId, targetId: PlayerId | null): void {
    this.requirePhase(...LOOK_PHASES);
    const p = this.player(by);
    if (targetId !== null) {
      if (targetId === by) reject('invalidTarget', "You can't look at yourself.");
      this.player(targetId);
    }
    p.lookingAt = targetId;
  }

  private wink(by: PlayerId, targetId: PlayerId): void {
    this.requirePhase('playing');
    const killer = this.requireActive(by);
    const rs = this.roleOf(by);
    const def = getRole(rs.role);
    if (!def.canWink) reject('notAllowed', 'Only the Killer can wink.');
    const target = this.requireTarget(by, targetId);
    if (getRole(this.roleOf(target.id).role).isKiller) reject('invalidTarget', "That's a fellow Killer.");
    if (target.dying) reject('invalidTarget', 'That player is already winked.');
    this.requireEyeContact(killer, target);
    const cd = this.state.settings.winkCooldownMs;
    if (rs.lastWinkAt !== null && this.now - rs.lastWinkAt < cd) {
      reject('cooldown', 'Your eye needs a rest.');
    }
    rs.lastWinkAt = this.now;
    rs.winksSent += 1;
    this.emit({ type: 'WinkSent', killerId: by, targetId: target.id, fake: false }, [by]);
    // Anyone looking at the Killer right now sees the wink (but not who it hit).
    this.emit({ type: 'SawWink', winkerId: by }, this.watchersOf(by, target.id));

    const outcome = this.resolveWinkAttempt(by, target.id);
    if (outcome?.kind === 'immune') return;
    const victimId = outcome?.kind === 'redirect' ? outcome.victimId : target.id;
    const victim = this.player(victimId);
    if (!victim.alive) return;
    victim.dying = true;
    const deadline = this.now + this.state.settings.deathDelayMs;
    this.state.pendingDeaths.push({ victimId, killerId: by, at: deadline });
    this.emit(
      {
        type: 'Winked',
        targetId: victimId,
        killerId: this.state.settings.victimsSeeKiller ? by : null,
        deadline,
        killerCharacter: rs.character,
      },
      [victimId],
    );
  }

  private resolveWinkAttempt(killerId: PlayerId, targetId: PlayerId): WinkOutcome | undefined {
    const order = [this.player(targetId), ...this.alive().filter((p) => p.id !== targetId)];
    for (const p of order) {
      if (!p.alive) continue;
      const def = getRole(this.roleOf(p.id).role);
      const outcome = def.onWinkAttempt?.(this, { killerId, targetId, selfId: p.id });
      if (outcome) return outcome;
    }
    return undefined;
  }

  private raise(by: PlayerId, targetId: PlayerId): void {
    this.requirePhase('playing');
    const raiser = this.requireActive(by);
    const rs = this.roleOf(by);
    if (!getRole(rs.role).canRaise) reject('notAllowed', 'Only the Shush, the Snitch and the Judge can raise an eyebrow.');
    const target = this.requireTarget(by, targetId);
    this.requireEyeContact(raiser, target);
    const cd = this.state.settings.raiseCooldownMs;
    if (rs.lastRaiseAt !== null && this.now - rs.lastRaiseAt < cd) {
      reject('cooldown', 'Give your eyebrows a moment.');
    }
    rs.lastRaiseAt = this.now;
    rs.raisesSent += 1;
    this.emit({ type: 'EyebrowRaised', byId: by, targetId: target.id }, [target.id, by]);
    this.emit({ type: 'SawRaise', raiserId: by }, this.watchersOf(by, target.id));
    if (rs.raisesSent === this.state.settings.raisesToUnlock) {
      for (const ability of getRole(rs.role).abilities ?? []) {
        if (ability.unlock === 'raises') {
          this.emit({ type: 'AbilityUnlocked', playerId: by, abilityId: ability.id }, [by]);
        }
      }
    }
  }

  private useAbility(by: PlayerId, abilityId: string, targetId: PlayerId | null, payload: string | null): void {
    this.requirePhase('playing');
    const actor = this.player(by);
    const rs = this.roleOf(by);
    let ability: AbilityDefinition | undefined;
    if (actor.alive) {
      if (actor.dying) reject('dead', "You're out of the game.");
      ability = getRole(rs.role).abilities?.find((a) => a.id === abilityId);
    } else if (!actor.arrested && !actor.votedOut) {
      ability = ghostAbilitiesFor(this.state).find((a) => a.id === abilityId);
    }
    if (!ability) reject('unknownAbility', "You can't do that.");

    if (ability.unlock === 'raises' && rs.raisesSent < this.state.settings.raisesToUnlock) {
      reject('locked', `Raise ${this.state.settings.raisesToUnlock} eyebrows first.`);
    }
    const used = rs.abilityUses[ability.id] ?? 0;
    if (ability.uses !== null && used >= ability.uses) reject('usedUp', 'Already used.');
    const cd = resolveCooldown(this.state, ability);
    const last = rs.abilityLastUsedAt[ability.id];
    if (cd > 0 && last !== undefined && this.now - last < cd) reject('cooldown', 'Not ready yet.');

    let target: PlayerId | null = null;
    if (ability.target === 'player') {
      const t = this.requireTarget(by, targetId);
      if (ability.gesture) this.requireEyeContact(actor, t);
      else this.requireLooking(actor, t);
      target = t.id;
    }
    const problem = ability.validate?.(this, by, target, payload);
    if (problem) reject('notAllowed', problem);

    rs.abilityUses[ability.id] = used + 1;
    rs.abilityLastUsedAt[ability.id] = this.now;
    this.emit({ type: 'AbilityUsed', playerId: by, abilityId: ability.id, targetId: target }, [by]);
    ability.apply(this, by, target, payload);
    if (ability.gesture === 'wink' && target) {
      this.emit({ type: 'SawWink', winkerId: by }, this.watchersOf(by, target));
    }
  }

  private arrest(by: PlayerId, targetId: PlayerId): void {
    this.requirePhase('playing');
    const sheriff = this.requireActive(by);
    const def = getRole(this.roleOf(by).role);
    if (!def.canArrest) reject('notAllowed', 'Only the Sheriff can arrest.');
    if (this.state.shushLockKillsRemaining > 0) reject('shushed', "You've been shushed. No arrests yet.");
    const target = this.requireTarget(by, targetId);
    this.requireLooking(sheriff, target);
    const verdictAt = this.now + this.state.settings.arrestVerdictMs;
    this.state.phase = 'arrest';
    this.state.pendingArrest = { sheriffId: by, targetId: target.id, startedAt: this.now, verdictAt };
    this.emit({ type: 'ArrestStarted', targetId: target.id, verdictAt, sheriffCharacter: this.roleOf(by).character }, 'all');
  }

  /** Play was paused (arrest or hearing): push pending timers back by the pause. */
  private resumeAfterPause(startedAt: number): void {
    const paused = this.now - startedAt;
    for (const d of this.state.pendingDeaths) d.at += paused;
    for (const t of this.state.timers) t.at += paused;
  }

  private resolveArrest(): void {
    const s = this.state;
    const pa = s.pendingArrest!;
    this.resumeAfterPause(pa.startedAt);
    s.pendingArrest = null;

    const target = this.player(pa.targetId);
    const role = this.roleOf(target.id).role;
    const correct = !!getRole(role).isKiller;
    target.arrested = true;
    if (correct) target.alive = false;
    this.emit({ type: 'ArrestResult', targetId: target.id, correct, role }, 'all');
    this.drain();
    if (correct) {
      s.phase = 'playing';
    } else {
      this.endGame('killers', 'wrongArrest');
    }
  }

  private vote(by: PlayerId, targetId: PlayerId): void {
    this.requirePhase('hearing');
    this.requireActive(by);
    const target = this.requireTarget(by, targetId);
    const h = this.state.hearing!;
    const first = h.votes[by] === undefined;
    h.votes[by] = target.id;
    if (first) this.emit({ type: 'VoteCast', voterId: by }, 'all');
    const voters = this.state.players.filter((p) => p.alive && !p.dying);
    if (voters.every((p) => h.votes[p.id] !== undefined)) this.resolveHearing();
  }

  private resolveHearing(): void {
    const s = this.state;
    const h = s.hearing!;
    this.resumeAfterPause(h.startedAt);
    s.hearing = null;
    s.phase = 'playing';

    const tally: Record<PlayerId, number> = {};
    for (const target of Object.values(h.votes)) tally[target] = (tally[target] ?? 0) + 1;
    const top = Math.max(0, ...Object.values(tally));
    const leaders = Object.keys(tally).filter((id) => tally[id] === top);
    const eliminated = top > 0 && leaders.length === 1 ? this.player(leaders[0]!) : null;
    const role = eliminated ? this.roleOf(eliminated.id).role : null;
    this.emit({ type: 'HearingResult', tally, eliminatedId: eliminated?.id ?? null, role }, 'all');
    if (!eliminated || !role) return;

    eliminated.votedOut = true;
    const def = getRole(role);
    if (def.isSheriff) {
      // Voting out the law: the town loses.
      eliminated.alive = false;
      eliminated.dying = false;
      this.drain();
      this.endGame('killers', 'sheriffVotedOut');
    } else if (def.isKiller) {
      // Like a correct arrest: removed from play (the win check runs after).
      eliminated.alive = false;
      eliminated.dying = false;
    } else {
      this.kill(eliminated.id, 'vote');
    }
  }

  private tick(): void {
    const s = this.state;
    if (s.phase === 'reveal' && s.revealDeadline !== null && this.now >= s.revealDeadline) {
      this.beginPlaying();
      return;
    }
    if (s.phase === 'arrest' && s.pendingArrest && this.now >= s.pendingArrest.verdictAt) {
      this.resolveArrest();
      return;
    }
    if (s.phase === 'hearing' && s.hearing && this.now >= s.hearing.endsAt) {
      this.resolveHearing();
      return;
    }
    if (s.phase !== 'playing') return;

    // Resolve due deaths and role timers in time order, checking for a
    // winner after each so nothing happens after the game ends.
    for (;;) {
      if (s.phase !== 'playing') return;
      const death = s.pendingDeaths.filter((d) => d.at <= this.now).sort((a, b) => a.at - b.at)[0];
      const timer = s.timers.filter((t) => t.at <= this.now).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!death && !timer) return;
      if (death && (!timer || death.at <= timer.at)) {
        s.pendingDeaths = s.pendingDeaths.filter((d) => d !== death);
        this.kill(death.victimId, 'wink', death.killerId);
      } else if (timer) {
        s.timers = s.timers.filter((t) => t !== timer);
        const owner = s.roles[timer.ownerId];
        if (owner) getRole(owner.role).onTimer?.(this, timer, timer.ownerId);
      }
      this.settle();
    }
  }

  private endGame(winner: 'town' | 'killers', reason: WinReason): void {
    const s = this.state;
    const winners = new Set<PlayerId>();
    for (const p of s.players) {
      const team: Team | undefined = s.roles[p.id]?.team;
      if (team === winner) winners.add(p.id);
    }
    for (const id of s.extraWinners) winners.add(id);
    s.phase = 'ended';
    s.pendingDeaths = [];
    s.pendingArrest = null;
    s.hearing = null;
    s.timers = [];
    for (const p of s.players) {
      p.dying = false;
      p.lookingAt = null;
    }
    s.result = { winner, reason, winners: [...winners], extraWinners: [...s.extraWinners], endedAt: this.now };
    this.emit({ type: 'GameEnded', result: s.result }, 'all');
  }
}

export function resolveCooldown(state: GameState, ability: AbilityDefinition): number {
  if (ability.cooldownMs === 'wink') return state.settings.winkCooldownMs;
  if (ability.cooldownMs === 'raise') return state.settings.raiseCooldownMs;
  return ability.cooldownMs ?? 0;
}

/** Ghost abilities available given the current state (exported for views). */
export function ghostAbilitiesFor(state: GameState): AbilityDefinition[] {
  const seen = new Map<string, AbilityDefinition>();
  for (const p of state.players) {
    if (!p.alive) continue;
    const rs = state.roles[p.id];
    for (const a of (rs && ROLES[rs.role].ghostAbilities) || []) seen.set(a.id, a);
  }
  return [...seen.values()];
}
