import { describe, expect, it } from 'vitest';
import {
  checkWin,
  getRole,
  isKillerRole,
  isSheriffRole,
  nextRandom,
  ROSTER,
  SPECIAL_ROLE_IDS,
  viewFor,
  type ActionBody,
  type GameState,
} from '../src';
import { lobby } from './helpers';

function makeRng(seed: number) {
  let s = seed;
  return {
    next() {
      const [v, n] = nextRandom(s);
      s = n;
      return v;
    },
    int(n: number) {
      return Math.floor(this.next() * n);
    },
    pick<T>(xs: readonly T[]): T {
      return xs[this.int(xs.length)]!;
    },
  };
}

function checkInvariants(s: GameState, prevAlive: Set<string>, ctx: string) {
  const fail = (msg: string) => {
    throw new Error(`${ctx}: ${msg}`);
  };
  // Sequence numbers only go up.
  for (let i = 1; i < s.log.length; i++) if (s.log[i]!.seq <= s.log[i - 1]!.seq) fail('log seq not increasing');

  if (s.phase === 'lobby') return;
  if (Object.keys(s.roles).length !== s.players.length) fail('every player must have a role');

  for (const p of s.players) {
    if (p.dying && !p.alive) fail(`${p.id} dying but dead`);
    if (p.dying && !s.pendingDeaths.some((d) => d.victimId === p.id)) fail(`${p.id} dying with no pending death`);
    if (p.alive && !prevAlive.has(p.id)) fail(`${p.id} came back to life`);
    if (isSheriffRole(s, p.id) && !p.alive && s.roles[p.id]!.role === 'sheriff' && !p.arrested && !p.votedOut) fail('a Sheriff died');
    if (!p.alive && isKillerRole(s, p.id) && !p.arrested && !p.votedOut) fail('a Killer died without being caught');
    if (p.lookingAt === p.id) fail(`${p.id} is looking at themselves`);
    if (s.phase === 'ended' && p.lookingAt !== null) fail('gaze left over after the game ended');
    if (p.votedOut && p.alive) fail(`${p.id} voted out but alive`);
    const rs = s.roles[p.id]!;
    if (rs.role === 'lover' && rs.data.partnerId) {
      const partner = s.players.find((q) => q.id === rs.data.partnerId)!;
      if (!p.alive && !p.arrested && partner.alive && s.phase !== 'ended' && !p.dying) {
        // Lovers die together, unless the game ended at the same moment.
        fail(`Lover ${p.id} dead while partner alive`);
      }
    }
    if (rs.team !== getRole(rs.role).team && rs.role !== 'copycat') fail(`${p.id} team mismatch`);
    if (rs.character && !rs.character.startsWith(`${rs.role}.`)) fail(`${p.id} has another role's character`);
  }
  if (s.shushLockKillsRemaining < 0) fail('negative shush lock');

  if (s.phase === 'ended') {
    if (!s.result) fail('ended without a result');
    if (s.pendingDeaths.length || s.timers.length || s.pendingArrest || s.hearing) fail('work left after the game ended');
    for (const id of s.result!.winners) {
      const rs = s.roles[id]!;
      if (rs.team !== s.result!.winner && !s.result!.extraWinners.includes(id)) fail(`${id} wrongly won`);
    }
  } else if (s.result) fail('result before the end');

  if (s.phase === 'playing' && checkWin(s)) fail('a win condition is met but the game is still running');
  if (s.phase === 'arrest' && !s.pendingArrest) fail('arrest phase without an arrest');
  if (s.phase !== 'arrest' && s.pendingArrest) fail('stray pending arrest');
  if (s.phase === 'hearing' && !s.hearing) fail('hearing phase without a hearing');
  if (s.phase !== 'hearing' && s.hearing) fail('stray hearing');
  if (s.hearing) {
    for (const [voter, target] of Object.entries(s.hearing.votes)) {
      if (voter === target) fail('someone voted for themselves');
      if (!s.players.find((p) => p.id === voter)!.alive) fail('a dead player voted');
    }
  }
}

const ACTIONS = [
  'look',
  'look',
  'look',
  'wink',
  'raiseEyebrow',
  'useAbility',
  'arrest',
  'vote',
  'vote',
  'ready',
  'pickCharacter',
  'advance',
  'advance',
  'advance',
] as const;

function playRandomGame(seed: number): { ended: boolean; steps: number; state: GameState } {
  const rng = makeRng(seed);
  const n = 5 + rng.int(16);
  const g = lobby(n, seed);
  // Randomise settings a little, including special roles.
  const special = Object.fromEntries(SPECIAL_ROLE_IDS.map((id) => [id, rng.next() < 0.25]));
  g.configure({ special, victimsSeeKiller: rng.next() < 0.5, winkCooldownMs: rng.pick([0, 5000, 15000]) });
  if (g.try('p0', { type: 'start' }).error) {
    // Too many special roles for this player count: drop them.
    g.configure({ special: Object.fromEntries(SPECIAL_ROLE_IDS.map((id) => [id, false])) });
    g.act('p0', { type: 'start' });
  }
  let alive = new Set(g.state.players.map((p) => p.id));
  let steps = 0;
  for (; steps < 3000 && g.state.phase !== 'ended'; steps++) {
    const kind = rng.pick(ACTIONS);
    const ids = g.state.players.map((p) => p.id);
    const by = rng.pick(ids);
    const target = rng.pick(ids);
    let body: ActionBody;
    switch (kind) {
      case 'advance':
        g.t += rng.int(6000);
        body = { type: 'tick' };
        break;
      case 'useAbility': {
        const me = viewFor(g.state, by).me;
        const ability = me?.abilities.length ? rng.pick(me.abilities) : null;
        body = {
          type: 'useAbility',
          abilityId: ability?.id ?? 'nope',
          targetId: target,
          payload: ability?.payload ? rng.pick(ability.payload.options) : null,
        };
        break;
      }
      case 'ready':
        body = { type: 'ready' };
        break;
      case 'look':
        body = { type: 'look', targetId: rng.next() < 0.1 ? null : target };
        break;
      case 'pickCharacter': {
        const role = g.state.roles[by]?.role;
        body = { type: 'pickCharacter', characterId: role ? rng.pick(ROSTER[rng.next() < 0.8 ? role : 'killer']).id : 'x' };
        break;
      }
      default:
        body = { type: kind, targetId: target };
    }
    // Half the time, set up the gaze the action needs, as a real player would.
    if (['wink', 'raiseEyebrow', 'useAbility', 'arrest'].includes(body.type) && rng.next() < 0.5) {
      g.try(by, { type: 'look', targetId: target });
      if (body.type !== 'arrest') g.try(target, { type: 'look', targetId: by });
    }
    const actor = body.type === 'tick' ? '__system__' : by;
    g.try(actor, body);
    checkInvariants(g.state, alive, `seed ${seed} step ${steps} ${body.type}`);
    alive = new Set(g.state.players.filter((p) => p.alive).map((p) => p.id));
    // Occasionally restart the reveal phase timers via disconnect/reconnect.
    if (rng.next() < 0.01) g.sys({ type: rng.next() < 0.5 ? 'disconnect' : 'reconnect', playerId: by });
  }
  return { ended: g.state.phase === 'ended', steps, state: g.state };
}

describe('1,000 random games', () => {
  it('never reach an illegal state', { timeout: 180_000 }, () => {
    let ended = 0;
    const reasons: Record<string, number> = {};
    for (let seed = 1; seed <= 1000; seed++) {
      const r = playRandomGame(seed);
      if (r.ended) {
        ended++;
        reasons[r.state.result!.reason] = (reasons[r.state.result!.reason] ?? 0) + 1;
      }
    }
    // Random play almost always finishes, through every kind of ending.
    expect(ended).toBeGreaterThan(950);
    expect(reasons.wrongArrest).toBeGreaterThan(0);
    expect(reasons.killersOutnumber).toBeGreaterThan(0);
    expect(reasons.allKillersCaught).toBeGreaterThan(0);
    expect(reasons.sheriffVotedOut).toBeGreaterThan(0);
  });
});
