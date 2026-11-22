import { expect } from 'vitest';
import {
  createGame,
  getRole,
  reduce,
  SYSTEM,
  type ActionBody,
  type GameEvent,
  type GameState,
  type LoggedEvent,
  type PlayerId,
  type ReduceResult,
  type RoleId,
  type SettingsPatch,
} from '../src';

export const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kit', 'Leo', 'Maya', 'Nia', 'Oz', 'Pia', 'Quin', 'Ray', 'Sol', 'Tess'];

/** A small driver around the pure reducer for readable tests. */
export class Game {
  state: GameState;
  t = 1_000;
  last: ReduceResult | null = null;

  constructor(seed = 42) {
    this.state = createGame(seed, this.t);
  }

  /** Apply an action; throws if it was rejected. */
  act(by: PlayerId, body: ActionBody): LoggedEvent[] {
    const r = this.try(by, body);
    if (r.error) throw new Error(`${body.type} by ${by} rejected: ${r.error} (${r.message})`);
    return r.events;
  }

  /** Apply an action and return the result, rejected or not. */
  try(by: PlayerId, body: ActionBody): ReduceResult {
    const r = reduce(this.state, { ...body, by, at: this.t } as never);
    this.last = r;
    this.state = r.state;
    return r;
  }

  sys(body: ActionBody): LoggedEvent[] {
    return this.act(SYSTEM, body);
  }

  /** Move the clock forward and tick. */
  advance(ms: number): LoggedEvent[] {
    this.t += ms;
    return this.sys({ type: 'tick' });
  }

  configure(settings: SettingsPatch): void {
    this.act(this.state.hostId!, { type: 'configure', settings });
  }

  role(id: PlayerId): RoleId {
    return this.state.roles[id]!.role;
  }

  player(id: PlayerId) {
    return this.state.players.find((p) => p.id === id)!;
  }

  events(): GameEvent[] {
    return this.state.log.map((e) => e.event);
  }
}

/** Join n players named p0..p(n-1); p0 hosts. */
export function lobby(n: number, seed = 42): Game {
  const g = new Game(seed);
  for (let i = 0; i < n; i++) {
    g.sys({ type: 'join', playerId: `p${i}`, name: NAMES[i]!, avatar: i % 12, asHost: i === 0 });
  }
  return g;
}

/**
 * Start a game and then force a specific role for each seat (p0 gets
 * roles[0] and so on). Lovers are paired in seat order. Leaves the game in
 * the playing phase.
 */
export function rigged(roles: RoleId[], settings: SettingsPatch = {}, seed = 42): Game {
  const g = lobby(roles.length, seed);
  const counts = {
    killer: roles.filter((r) => r === 'killer').length,
    sheriff: roles.filter((r) => r === 'sheriff').length,
    shush: roles.filter((r) => r === 'shush').length,
    snitch: roles.filter((r) => r === 'snitch').length,
    loverPairs: Math.floor(roles.filter((r) => r === 'lover').length / 2),
  };
  const special = Object.fromEntries(
    roles.filter((r) => getRole(r).special).map((r) => [r, true]),
  );
  g.configure({ ...settings, roles: counts, special });
  g.act('p0', { type: 'start' });
  const state = structuredClone(g.state);
  let pendingLover: string | null = null;
  roles.forEach((role, i) => {
    const id = `p${i}`;
    const rs = state.roles[id]!;
    rs.role = role;
    rs.team = getRole(role).team;
    rs.data = {};
    rs.knows = role === 'killer' ? roles.flatMap((r, j) => (r === 'killer' && j !== i ? [`p${j}`] : [])) : [];
    if (role === 'lover') {
      if (pendingLover) {
        rs.data.partnerId = pendingLover;
        state.roles[pendingLover]!.data.partnerId = id;
        pendingLover = null;
      } else pendingLover = id;
    }
  });
  g.state = state;
  for (const p of g.state.players) g.act(p.id, { type: 'ready' });
  expect(g.state.phase).toBe('playing');
  return g;
}

export function ofType<T extends GameEvent['type']>(events: LoggedEvent[], type: T) {
  return events.filter((e) => e.event.type === type) as (LoggedEvent & { event: Extract<GameEvent, { type: T }> })[];
}
