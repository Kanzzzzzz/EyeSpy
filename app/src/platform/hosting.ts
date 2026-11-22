import { ZeroConf } from 'capacitor-zeroconf';
import { LocalServer } from '@eyespy/local-server';
import { DEFAULT_PORT, SERVICE_DOMAIN, SERVICE_TYPE } from '@eyespy/protocol';
import { localTransport, randomId, Room, type RoomSnapshot, type TransportFactory } from '@eyespy/room';
import { isNative } from './device';
import { clearSnapshot, createSnapshotWriter } from './snapshots';
import { serveRoomToTabs } from './tabs';

export interface HostSession {
  room: Room;
  /** Where guests can reach this phone (empty on the web). */
  addresses: string[];
  port: number;
  /** The host's own phone connects through this, with no socket. */
  transport: TransportFactory;
  stop(): Promise<void>;
}

/**
 * Start hosting: create (or restore) the room, open the WebSocket server,
 * announce it over Bonjour, and tick the game clock.
 */
export async function startHosting(hostName: () => string, restore?: RoomSnapshot): Promise<HostSession> {
  const persist = createSnapshotWriter();
  const room = restore
    ? Room.restore(restore, { persist })
    : new Room({ hostKey: randomId(Math.random, 24), persist });
  const ticker = setInterval(() => room.tick(), 200);
  const cleanups: (() => Promise<void> | void)[] = [() => clearInterval(ticker)];

  let addresses: string[] = [];
  let port = DEFAULT_PORT;

  if (isNative) {
    // Try a few ports in case the last game's socket is still closing.
    let started = false;
    let lastError: unknown = null;
    for (const p of [DEFAULT_PORT, DEFAULT_PORT + 1, DEFAULT_PORT + 2, DEFAULT_PORT + 3]) {
      try {
        await LocalServer.start({ port: p });
        port = p;
        started = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!started) {
      clearInterval(ticker);
      throw new Error(`Couldn't start hosting: ${String(lastError)}`);
    }
    const handles = await Promise.all([
      LocalServer.addListener('connection', (e) => {
        // Batch per-connection sends into one bridge call per tick.
        room.connect(e.id, { send: (data) => queueSend(e.id, data), close: () => void LocalServer.close({ id: e.id }) });
      }),
      LocalServer.addListener('message', (e) => room.receive(e.id, e.data)),
      LocalServer.addListener('close', (e) => room.disconnect(e.id)),
    ]);
    cleanups.push(async () => {
      await Promise.all(handles.map((h) => h.remove()));
      await LocalServer.stop();
    });
    addresses = (await LocalServer.getAddresses()).addresses;

    const service = { type: SERVICE_TYPE, domain: SERVICE_DOMAIN, name: `EyeSpy ${room.code}` };
    try {
      await ZeroConf.register({ ...service, port, props: { room: room.code, host: hostName().slice(0, 32), v: '1' } });
      cleanups.push(() => ZeroConf.unregister(service).catch(() => {}));
    } catch (err) {
      // Discovery is a convenience; the QR code still works.
      console.warn('Bonjour announce failed', err);
    }
  } else {
    cleanups.push(serveRoomToTabs(room, hostName));
  }

  return {
    room,
    addresses,
    port,
    transport: localTransport(room, 'host'),
    async stop() {
      room.close();
      for (const c of cleanups.reverse()) await c();
      await clearSnapshot();
    },
  };
}

// Coalesce many small sends into one native call per macrotask.
let outbox: { id: string; data: string }[] = [];
let scheduled = false;
function queueSend(id: string, data: string) {
  outbox.push({ id, data });
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    const messages = outbox;
    outbox = [];
    scheduled = false;
    void LocalServer.sendMany({ messages });
  }, 0);
}
