import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, type WebSocket } from 'ws';
import { DEFAULT_PORT } from '@eyespy/protocol';
import { Room, type RoomSnapshot } from '@eyespy/room';

export interface DevHostOptions {
  port?: number;
  host?: string;
  hostKey?: string;
  /** Write a snapshot here after every change; restore from it on start. */
  snapshotPath?: string | null;
  log?: (msg: string) => void;
}

export interface DevHost {
  room: Room;
  port: number;
  close(): Promise<void>;
}

/** Same job as the native plugin on a phone: accept sockets, feed the Room. */
export async function startDevHost(opts: DevHostOptions = {}): Promise<DevHost> {
  const log = opts.log ?? (() => {});
  const snapshotPath = opts.snapshotPath ?? null;
  const persist = snapshotPath
    ? (s: RoomSnapshot) => {
        mkdirSync(dirname(snapshotPath), { recursive: true });
        const tmp = `${snapshotPath}.tmp`;
        writeFileSync(tmp, JSON.stringify(s));
        renameSync(tmp, snapshotPath); // atomic: a crash never leaves half a file
      }
    : undefined;

  let room: Room;
  const saved = snapshotPath ? readSnapshot(snapshotPath) : null;
  if (saved) {
    room = Room.restore(saved, { persist, log });
    log(`restored room ${room.code} (${room.state.phase}, ${room.state.players.length} players)`);
  } else {
    room = new Room({ hostKey: opts.hostKey ?? 'dev-host-key', persist, log });
  }

  const wss = new WebSocketServer({ port: opts.port ?? DEFAULT_PORT, host: opts.host ?? '0.0.0.0' });
  await new Promise<void>((resolve, reject) => {
    wss.once('listening', () => resolve());
    wss.once('error', reject);
  });
  const port = (wss.address() as { port: number }).port;

  let nextId = 0;
  wss.on('connection', (ws: WebSocket, req) => {
    const connId = `ws-${++nextId}`;
    log(`connect ${connId} from ${req.socket.remoteAddress}`);
    room.connect(connId, { send: (d) => ws.readyState === ws.OPEN && ws.send(d), close: () => ws.close() });
    ws.on('message', (data) => room.receive(connId, data.toString()));
    ws.on('close', () => room.disconnect(connId));
    ws.on('error', () => room.disconnect(connId));
  });

  const ticker = setInterval(() => room.tick(), 250);

  return {
    room,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(ticker);
        for (const c of wss.clients) c.terminate();
        wss.close(() => resolve());
      }),
  };
}

function readSnapshot(path: string): RoomSnapshot | null {
  try {
    const s = JSON.parse(readFileSync(path, 'utf8')) as RoomSnapshot;
    return s.version === 1 && s.state.phase !== 'lobby' && s.state.phase !== 'ended' ? s : null;
  } catch {
    return null;
  }
}

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}
