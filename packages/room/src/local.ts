import type { Room } from './room';
import type { Transport, TransportFactory } from './client';

/**
 * Connects a client to a Room in the same JavaScript process. The host's own
 * phone uses this, so the host plays through exactly the same code path as
 * every guest, just without a socket.
 */
let nextConn = 0;

export function localTransport(room: Room, prefix = 'local'): TransportFactory {
  return (): Transport => {
    const connId = `${prefix}-${++nextConn}`;
    let open = false;
    let handlers: Parameters<Transport['open']>[0] | null = null;
    const later = (fn: () => void) => queueMicrotask(fn);
    return {
      open(h) {
        handlers = h;
        open = true;
        room.connect(connId, {
          send: (data) => later(() => open && h.onMessage(data)),
          close: () => {
            // Deliver anything already sent (for example a "kicked" message) first.
            later(() => {
              if (!open) return;
              open = false;
              room.disconnect(connId);
              h.onClose();
            });
          },
        });
        later(() => open && h.onOpen());
      },
      send(data) {
        if (open) later(() => room.receive(connId, data));
      },
      close() {
        if (!open) return;
        open = false;
        room.disconnect(connId);
        later(() => handlers?.onClose());
      },
    };
  };
}
