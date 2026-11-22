/**
 * Browser-only stand-ins for the hotspot, used in development: a host tab
 * serves its room to other tabs of the same browser over BroadcastChannel,
 * and announces itself so they appear under "Nearby games".
 */
import type { Room } from '@eyespy/room';
import type { Transport, TransportFactory } from '@eyespy/room';

type Packet =
  | { kind: 'open'; from: string }
  | { kind: 'msg'; from: string; to: string; data: string }
  | { kind: 'close'; from: string; to: string };

const DISCOVERY = 'eyespy-discovery';
const roomChannel = (code: string) => `eyespy-room-${code}`;

export interface TabGame {
  code: string;
  hostName: string;
  players: number;
  seenAt: number;
}

export function serveRoomToTabs(room: Room, hostName: () => string): () => void {
  const ch = new BroadcastChannel(roomChannel(room.code));
  const discovery = new BroadcastChannel(DISCOVERY);
  ch.onmessage = (ev: MessageEvent<Packet>) => {
    const p = ev.data;
    if (p.kind === 'open') {
      room.connect(p.from, {
        send: (data) => ch.postMessage({ kind: 'msg', from: 'host', to: p.from, data } satisfies Packet),
        close: () => ch.postMessage({ kind: 'close', from: 'host', to: p.from } satisfies Packet),
      });
    } else if (p.to === 'host') {
      if (p.kind === 'msg') room.receive(p.from, p.data);
      else room.disconnect(p.from);
    }
  };
  const announce = () =>
    discovery.postMessage({
      code: room.code,
      hostName: hostName(),
      players: room.state.players.length,
      seenAt: Date.now(),
    } satisfies TabGame);
  announce();
  const timer = setInterval(announce, 1000);
  return () => {
    clearInterval(timer);
    ch.close();
    discovery.close();
  };
}

export function tabTransport(code: string): TransportFactory {
  return (): Transport => {
    const id = `tab-${Math.random().toString(36).slice(2, 10)}`;
    let ch: BroadcastChannel | null = null;
    let open = false;
    return {
      open(h) {
        ch = new BroadcastChannel(roomChannel(code));
        open = true;
        ch.onmessage = (ev: MessageEvent<Packet>) => {
          const p = ev.data;
          if (p.kind === 'open' || p.to !== id) return;
          if (p.kind === 'msg') h.onMessage(p.data);
          else if (open) {
            open = false;
            ch?.close();
            h.onClose();
          }
        };
        ch.postMessage({ kind: 'open', from: id } satisfies Packet);
        setTimeout(() => open && h.onOpen(), 0);
      },
      send(data) {
        if (open) ch?.postMessage({ kind: 'msg', from: id, to: 'host', data } satisfies Packet);
      },
      close() {
        if (!open) return;
        open = false;
        ch?.postMessage({ kind: 'close', from: id, to: 'host' } satisfies Packet);
        ch?.close();
      },
    };
  };
}

export function watchTabGames(onChange: (games: TabGame[]) => void): () => void {
  const games = new Map<string, TabGame>();
  const ch = new BroadcastChannel(DISCOVERY);
  const emit = () => {
    const now = Date.now();
    for (const [k, g] of games) if (now - g.seenAt > 3000) games.delete(k);
    onChange([...games.values()]);
  };
  ch.onmessage = (ev: MessageEvent<TabGame>) => {
    games.set(ev.data.code, ev.data);
    emit();
  };
  const timer = setInterval(emit, 1500);
  return () => {
    clearInterval(timer);
    ch.close();
  };
}
