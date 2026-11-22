import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Bot, GameClient, webSocketTransport } from '@eyespy/room';
import { startDevHost, type DevHost } from '../src/server';

const NAMES = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun'];
let host: DevHost | null = null;
let bots: Bot[] = [];

afterEach(async () => {
  bots.forEach((b) => b.stop());
  bots = [];
  await host?.close();
  host = null;
});

async function waitFor(cond: () => boolean, ms: number) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe('over real sockets', () => {
  it('10 simulated players finish a game', async () => {
    host = await startDevHost({ port: 0, hostKey: 'k' });
    const url = `ws://127.0.0.1:${host.port}`;
    for (let i = 0; i < 10; i++) {
      const client = new GameClient({
        transport: webSocketTransport(url),
        name: NAMES[i]!,
        avatar: i,
        appVersion: 'test',
        hostKey: i === 0 ? 'k' : null,
      });
      const bot = new Bot(client, {
        thinkMs: 100,
        startAt: i === 0 ? 10 : Infinity,
        configure:
          i === 0
            ? { winkCooldownMs: 300, raiseCooldownMs: 200, deathDelayMs: 1000, revealTimeoutMs: 5000, arrestVerdictMs: 1500 }
            : undefined,
      });
      bots.push(bot);
      bot.start();
      if (i === 0) await waitFor(() => client.snapshot.status === 'online', 5000);
    }
    await waitFor(() => host!.room.state.phase === 'ended', 90_000);
    await waitFor(() => bots.every((b) => b.client.snapshot.view?.phase === 'ended'), 5000);
    const result = host.room.state.result!;
    expect(['town', 'killers']).toContain(result.winner);
    for (const b of bots) {
      // Every phone saw the same ending and the full timeline.
      expect(b.client.snapshot.view!.result).toEqual(result);
    }
  });

  it('a restarted host resumes the round from its snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eyespy-'));
    const snapshotPath = join(dir, 'snap.json');
    try {
      host = await startDevHost({ port: 0, hostKey: 'k', snapshotPath });
      const port = host.port;
      const clients = NAMES.slice(0, 5).map((name, i) => {
        const c = new GameClient({
          transport: webSocketTransport(`ws://127.0.0.1:${port}`),
          name,
          avatar: i,
          appVersion: 'test',
          hostKey: i === 0 ? 'k' : null,
        });
        c.start();
        return c;
      });
      await waitFor(() => clients.every((c) => c.snapshot.status === 'online'), 5000);
      await waitFor(() => clients.every((c) => c.snapshot.view?.players.length === 5), 5000);
      await clients[0]!.send({ type: 'start' });
      const roles = Object.fromEntries(Object.entries(host.room.state.roles).map(([id, r]) => [id, r.role]));

      // Kill the host process (here: the server) and start a new one on the same port.
      await host.close();
      host = null;
      await waitFor(() => clients.every((c) => c.snapshot.status === 'reconnecting'), 8000);
      host = await startDevHost({ port, hostKey: 'other', snapshotPath });
      await waitFor(() => clients.every((c) => c.snapshot.status === 'online'), 8000);

      expect(host.room.state.phase).toBe('reveal');
      for (const c of clients) expect(c.snapshot.view!.me!.role).toBe(roles[c.snapshot.playerId!]);
      clients.forEach((c) => c.stop());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
