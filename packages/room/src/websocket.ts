import type { Transport, TransportFactory } from './client';

type WsLike = {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(): void;
  readyState: number;
};

/**
 * WebSocket transport. Works in browsers, Capacitor web views and Node 22+
 * (all have a global WebSocket). `connectTimeoutMs` stops a phone hanging on
 * a host that has gone away.
 */
export function webSocketTransport(url: string, connectTimeoutMs = 4000): TransportFactory {
  return (): Transport => {
    let ws: WsLike | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    return {
      open(h) {
        const Ctor = (globalThis as unknown as { WebSocket: new (url: string) => WsLike }).WebSocket;
        const finish = () => {
          if (timer) clearTimeout(timer);
          if (closed) return;
          closed = true;
          h.onClose();
        };
        try {
          ws = new Ctor(url);
        } catch {
          setTimeout(finish, 0);
          return;
        }
        timer = setTimeout(() => {
          try {
            ws?.close();
          } catch {
            /* ignore */
          }
          finish();
        }, connectTimeoutMs);
        ws.onopen = () => {
          if (timer) clearTimeout(timer);
          h.onOpen();
        };
        ws.onmessage = (ev) => h.onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
        ws.onclose = finish;
        ws.onerror = finish;
      },
      send(data) {
        if (ws && ws.readyState === 1) ws.send(data);
      },
      close() {
        closed = true;
        if (timer) clearTimeout(timer);
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      },
    };
  };
}
