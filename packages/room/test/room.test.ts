import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bot, GameClient, localTransport, Room, type RoomSnapshot, type TransportFactory } from '../src';

const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun'];

let room: Room;
let ticker: ReturnType<typeof setInterval>;
let saved: RoomSnapshot | null;
/** While true, the host is "down": every connection attempt fails. */
let hostDown = false;

/** Like a phone dialling a fixed address: whichever room is up right now answers. */
const viaCurrentRoom: TransportFactory = () => {
  if (!hostDown) return localTransport(room)();
  return {
    open: (h) => queueMicrotask(() => h.onClose()),
    send: () => {},
    close: () => {},
  };
};

function makeRoom(restore?: RoomSnapshot) {
  const opts = { persist: (s: RoomSnapshot) => (saved = s) };
  room = restore ? Room.restore(restore, opts) : new Room({ ...opts, hostKey: 'secret', seed: 7 });
  clearInterval(ticker);
  ticker = setInterval(() => room.tick(), 250);
  return room;
}

function client(name: string, extra: Partial<ConstructorParameters<typeof GameClient>[0]> = {}) {
  const c = new GameClient({ transport: viaCurrentRoom, name, avatar: 0, appVersion: 'test', ...extra });
  c.start();
  return c;
}

const flush = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers({ now: 1_700_000_000_000 });
  saved = null;
  hostDown = false;
  makeRoom();
});

afterEach(() => {
  clearInterval(ticker);
  vi.useRealTimers();
});

describe('joining', () => {
  it('the phone with the host key hosts; others join as guests', async () => {
    const host = client('Ava', { hostKey: 'secret' });
    await flush(10);
    const guest = client('Ben', { hostKey: 'wrong' });
    await flush(10);
    expect(host.snapshot.status).toBe('online');
    expect(host.snapshot.view!.hostId).toBe(host.snapshot.playerId);
    expect(guest.snapshot.view!.players.map((p) => p.name)).toEqual(['Ava', 'Ben']);
    expect(guest.snapshot.room).toBe(room.code);
  });

  it('a taken name gets an error the phone can recover from', async () => {
    client('Ava');
    await flush(10);
    const dup = client('ava');
    await flush(10);
    expect(dup.snapshot.error?.code).toBe('nameTaken');
    expect(dup.snapshot.status).not.toBe('failed');
    dup.rejoin('Ava2', 1);
    await flush(10);
    expect(dup.snapshot.status).toBe('online');
  });

  it('an outdated app is told to update', async () => {
    const old = client('Old', { protocol: 0 });
    await flush(10);
    expect(old.snapshot.status).toBe('failed');
    expect(old.snapshot.error).toEqual({ code: 'version', message: 'Update EyeSpy to join this game.' });
    const newer = client('New', { protocol: 99 });
    await flush(10);
    expect(newer.snapshot.error?.code).toBe('hostVersion');
  });

  it('new phones cannot join a game in progress', async () => {
    const clients = NAMES.slice(0, 5).map((n, i) => client(n, i === 0 ? { hostKey: 'secret' } : {}));
    await flush(10);
    await clients[0]!.send({ type: 'start' });
    await flush(10);
    const late = client('Late');
    await flush(10);
    expect(late.snapshot.error?.code).toBe('started');
  });

  it('a kicked phone is told and disconnected', async () => {
    const host = client('Ava', { hostKey: 'secret' });
    const guest = client('Ben');
    await flush(10);
    const r = await host.send({ type: 'kick', playerId: guest.snapshot.playerId! });
    await flush(10);
    expect(r.ok).toBe(true);
    expect(guest.snapshot.error?.code).toBe('kicked');
    expect(guest.snapshot.status).toBe('failed');
    expect(host.snapshot.view!.players).toHaveLength(1);
  });

  it('rejects actions that break the rules with a reason', async () => {
    const host = client('Ava', { hostKey: 'secret' });
    const guest = client('Ben');
    await flush(10);
    const r = await guest.send({ type: 'start' });
    expect(r).toEqual({ ok: false, error: 'notHost', message: 'Only the host can do that.' });
    void host;
  });
});

describe('secrets', () => {
  it('each phone only ever receives its own role', async () => {
    const clients = NAMES.slice(0, 8).map((n, i) => client(n, i === 0 ? { hostKey: 'secret' } : {}));
    const received: string[][] = clients.map(() => []);
    clients.forEach((c, i) => c.subscribe((s) => received[i]!.push(JSON.stringify(s.view))));
    await flush(10);
    await clients[0]!.send({ type: 'start' });
    await flush(10);
    clients.forEach((c, i) => {
      const me = c.snapshot.view!.me!;
      expect(me.role).toBe(room.state.roles[c.snapshot.playerId!]!.role);
      // No other player's role appears in any view this phone received.
      for (const other of c.snapshot.view!.players) expect(other.role).toBeUndefined();
      const assigned = c.snapshot.events.filter((e) => e.event.type === 'RolesAssigned');
      expect(assigned).toHaveLength(1);
      expect(received[i]!.length).toBeGreaterThan(0);
    });
  });
});

describe('reconnects', () => {
  it('a dropped phone gets its seat, role and missed events back', async () => {
    const clients = NAMES.slice(0, 5).map((n, i) => client(n, i === 0 ? { hostKey: 'secret' } : {}));
    await flush(10);
    await clients[0]!.send({ type: 'configure', settings: { winkCooldownMs: 0 } });
    await clients[0]!.send({ type: 'start' });
    await flush(10);
    for (const c of clients) await c.send({ type: 'ready' });
    await flush(10);
    expect(room.state.phase).toBe('playing');

    const roles = room.state.roles;
    const killerId = Object.keys(roles).find((id) => roles[id]!.role === 'killer')!;
    const killer = clients.find((c) => c.snapshot.playerId === killerId)!;
    const victim = clients.find((c) => {
      const r = roles[c.snapshot.playerId!]!.role;
      return r !== 'killer' && r !== 'sheriff';
    })!;
    const watcher = clients.find((c) => c !== killer && c !== victim)!;
    const watcherId = watcher.snapshot.playerId;
    const roleBefore = watcher.snapshot.view!.me!.role;

    // Drop the watcher's socket without telling the client.
    for (const [, info] of (room as unknown as { conns: Map<string, { playerId: string; conn: { close(): void } }> }).conns) {
      if (info.playerId === watcherId) info.conn.close();
    }
    await flush(0);
    expect(watcher.snapshot.status).toBe('reconnecting');
    expect(room.presence()[watcherId!]).toBe('reconnecting');

    const wr = await killer.send({ type: 'wink', targetId: victim.snapshot.playerId! });
    expect(wr).toEqual({ ok: true });
    await flush(3_300);
    expect(room.state.players.find((p) => p.id === victim.snapshot.playerId)!.alive).toBe(false);

    await flush(2_000);
    expect(watcher.snapshot.status).toBe('online');
    expect(watcher.snapshot.playerId).toBe(watcherId);
    expect(watcher.snapshot.view!.me!.role).toBe(roleBefore);
    const died = watcher.snapshot.events.filter((e) => e.event.type === 'PlayerDied');
    expect(died).toHaveLength(1);
    expect(room.presence()[watcherId!]).toBe('online');
  });

  it('silent phones are dropped after the heartbeat timeout and marked away after 30 s', async () => {
    const host = client('Ava', { hostKey: 'secret' });
    const guest = client('Ben');
    await flush(10);
    const guestId = guest.snapshot.playerId!;
    guest.stop(); // vanishes without a bye
    await flush(1_000);
    expect(room.presence()[guestId]).toBe('reconnecting');
    await flush(30_000);
    expect(room.presence()[guestId]).toBe('away');
    expect(host.snapshot.view!.players.find((p) => p.id === guestId)!.connected).toBe(false);
  });

  it('a connection that stops sending is closed by the host', async () => {
    client('Ava', { hostKey: 'secret' });
    await flush(10);
    // A raw connection that says hello and then goes silent.
    const sent: string[] = [];
    let closed = false;
    room.connect('raw', { send: (d) => sent.push(d), close: () => (closed = true) });
    room.receive('raw', JSON.stringify({ t: 'hello', protocol: 1, app: 'x', name: 'Silent', avatar: 0 }));
    await flush(6_000);
    expect(closed).toBe(true);
    expect(room.connectionCount).toBe(1);
  });
});

describe('host crash recovery', () => {
  it('a restarted host restores the round and phones reconnect into it', async () => {
    const clients = NAMES.slice(0, 6).map((n, i) => client(n, i === 0 ? { hostKey: 'secret' } : {}));
    await flush(10);
    await clients[0]!.send({ type: 'start' });
    await flush(10);
    for (const c of clients) await c.send({ type: 'ready' });
    await flush(10);
    const roles = room.state.roles;
    const killerId = Object.keys(roles).find((id) => roles[id]!.role === 'killer')!;
    const victimId = Object.keys(roles).find((id) => roles[id]!.role === 'citizen')!;
    await clients.find((c) => c.snapshot.playerId === killerId)!.send({ type: 'wink', targetId: victimId });
    await flush(1_000);

    // The host app crashes: every socket dies and nothing answers for 20 s.
    const snapshot = JSON.parse(JSON.stringify(saved)) as RoomSnapshot;
    hostDown = true;
    clearInterval(ticker);
    for (const [, info] of (room as unknown as { conns: Map<string, { conn: { close(): void } }> }).conns) {
      info.conn.close();
    }
    await flush(20_000);
    for (const c of clients) expect(c.snapshot.status).toBe('reconnecting');

    // The host reopens EyeSpy: it restores the snapshot from disk.
    makeRoom(snapshot);
    hostDown = false;
    await flush(2_500);
    expect(room.state.phase).toBe('playing');
    expect(room.code).toBe(snapshot.code);
    for (const c of clients) expect(c.snapshot.status).toBe('online');
    // Deadlines are pushed back by the downtime since the last save, so the
    // countdown did not run out while the host was down.
    expect(room.state.players.find((p) => p.id === victimId)!.alive).toBe(true);
    await flush(2_100);
    expect(room.state.players.find((p) => p.id === victimId)!.alive).toBe(false);
    // Roles survived.
    for (const c of clients) expect(c.snapshot.view!.me!.role).toBe(snapshot.state.roles[c.snapshot.playerId!]!.role);
  });
});

describe('simulated game', () => {
  it('10 bots play a full game to the end', async () => {
    const bots: Bot[] = [];
    for (let i = 0; i < 10; i++) {
      const c = new GameClient({
        transport: localTransport(room),
        name: NAMES[i]!,
        avatar: i,
        appVersion: 'test',
        hostKey: i === 0 ? 'secret' : null,
      });
      const bot = new Bot(c, {
        startAt: i === 0 ? 10 : Infinity,
        configure: i === 0 ? { winkCooldownMs: 2000, raiseCooldownMs: 1000, deathDelayMs: 1000, revealTimeoutMs: 5000 } : undefined,
        random: mulberry(i + 1),
      });
      bots.push(bot);
      bot.start();
    }
    for (let i = 0; i < 600 && room.state.phase !== 'ended'; i++) await flush(500);
    expect(room.state.phase).toBe('ended');
    expect(room.state.result).not.toBeNull();
    for (const b of bots) {
      expect(b.client.snapshot.view!.phase).toBe('ended');
      expect(b.client.snapshot.view!.timeline!.length).toBeGreaterThan(0);
    }
    bots.forEach((b) => b.stop());
  });
});

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
