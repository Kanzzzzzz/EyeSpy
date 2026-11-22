import type { LoggedEvent, PlayerAction, PlayerView } from '@eyespy/engine';
import {
  encode,
  HEARTBEAT_MS,
  HEARTBEAT_TIMEOUT_MS,
  parseServerMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type Presence,
  type ServerErrorCode,
  type ServerMessage,
} from '@eyespy/protocol';

/** One connection attempt to a host. A new one is made for every reconnect. */
export interface Transport {
  open(handlers: { onOpen(): void; onMessage(data: string): void; onClose(): void }): void;
  send(data: string): void;
  close(): void;
}

export type TransportFactory = () => Transport;

export type ClientStatus = 'connecting' | 'online' | 'reconnecting' | 'closed' | 'failed';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface ClientOptions {
  transport: TransportFactory;
  name: string;
  avatar: number;
  appVersion: string;
  token?: string | null;
  hostKey?: string | null;
  /** Override the protocol version (tests use this to check version errors). */
  protocol?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ClientSnapshot {
  status: ClientStatus;
  playerId: string | null;
  token: string | null;
  room: string | null;
  view: PlayerView | null;
  /** Events seen this round, oldest first. */
  events: LoggedEvent[];
  presence: Record<string, Presence>;
  error: { code: ServerErrorCode; message: string } | null;
}

type Listener = (snap: ClientSnapshot, fresh: LoggedEvent[]) => void;

const FATAL: ServerErrorCode[] = ['version', 'hostVersion', 'started', 'kicked', 'roomClosed', 'full'];

/**
 * A phone's connection to the host: joins, keeps a heartbeat, reconnects with
 * its token, and keeps the latest view plus every event it has seen.
 */
export class GameClient {
  private opts: ClientOptions;
  private transport: Transport | null = null;
  private snap: ClientSnapshot;
  private listeners = new Set<Listener>();
  private lastSeq = 0;
  private nextActionId = 1;
  private pending = new Map<number, (r: ActionResult) => void>();
  private stopped = false;
  private attempts = 0;
  private lastHeard = 0;
  private heartbeat: unknown = null;
  private retry: unknown = null;
  private offsets: number[] = [];
  /** Server clock minus local clock, in ms. */
  clockOffset = 0;

  constructor(opts: ClientOptions) {
    this.opts = opts;
    this.snap = {
      status: 'connecting',
      playerId: null,
      token: opts.token ?? null,
      room: null,
      view: null,
      events: [],
      presence: {},
      error: null,
    };
  }

  get snapshot(): ClientSnapshot {
    return this.snap;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** The host's clock, estimated. Use for every countdown. */
  serverNow(): number {
    return this.now() + this.clockOffset;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  /** Leave for good (sends bye in the lobby). */
  stop(sendBye = false): void {
    this.stopped = true;
    if (sendBye) this.raw({ t: 'bye' });
    this.clearTimers();
    this.transport?.close();
    this.transport = null;
    this.update({ status: 'closed' });
  }

  send(action: PlayerAction): Promise<ActionResult> {
    const id = this.nextActionId++;
    return new Promise((resolve) => {
      if (this.snap.status !== 'online') {
        resolve({ ok: false, error: 'offline', message: 'Reconnecting…' });
        return;
      }
      this.pending.set(id, resolve);
      this.raw({ t: 'action', id, action });
    });
  }

  /** Try a different name/avatar after a nameTaken error. */
  rejoin(name: string, avatar: number): void {
    this.opts = { ...this.opts, name, avatar };
    this.update({ error: null });
    this.raw(this.hello());
  }

  // -------------------------------------------------------------------------

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private timer(fn: () => void, ms: number): unknown {
    return (this.opts.setTimer ?? ((f, m) => setTimeout(f, m)))(fn, ms);
  }

  private clear(handle: unknown): void {
    if (handle !== null) (this.opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(handle);
  }

  private clearTimers(): void {
    this.clear(this.heartbeat);
    this.clear(this.retry);
    this.heartbeat = null;
    this.retry = null;
  }

  private hello(): ClientMessage {
    return {
      t: 'hello',
      protocol: this.opts.protocol ?? PROTOCOL_VERSION,
      app: this.opts.appVersion,
      name: this.opts.name,
      avatar: this.opts.avatar,
      token: this.snap.token,
      hostKey: this.opts.hostKey ?? null,
      lastSeq: this.lastSeq,
    };
  }

  private connect(): void {
    if (this.stopped) return;
    const t = this.opts.transport();
    this.transport = t;
    let closed = false;
    t.open({
      onOpen: () => {
        if (this.transport !== t) return;
        this.lastHeard = this.now();
        this.raw(this.hello());
        this.ping();
        this.scheduleHeartbeat();
      },
      onMessage: (data) => {
        if (this.transport !== t) return;
        this.lastHeard = this.now();
        const parsed = parseServerMessage(data);
        if (parsed.ok) this.handle(parsed.value);
      },
      onClose: () => {
        if (closed || this.transport !== t) return;
        closed = true;
        this.transport = null;
        this.lost();
      },
    });
  }

  private lost(): void {
    this.clearTimers();
    for (const resolve of this.pending.values()) resolve({ ok: false, error: 'offline', message: 'Connection lost.' });
    this.pending.clear();
    if (this.stopped) return;
    this.attempts += 1;
    this.update({ status: this.snap.playerId ? 'reconnecting' : 'connecting' });
    // Fast first retries, then back off to 2 s.
    const delay = Math.min(2000, 150 * 2 ** Math.min(this.attempts - 1, 4));
    this.retry = this.timer(() => this.connect(), delay);
  }

  private scheduleHeartbeat(): void {
    this.clear(this.heartbeat);
    this.heartbeat = this.timer(() => {
      if (this.stopped || !this.transport) return;
      if (this.now() - this.lastHeard > HEARTBEAT_TIMEOUT_MS) {
        const t = this.transport;
        this.transport = null;
        t.close();
        this.lost();
        return;
      }
      this.ping();
      this.scheduleHeartbeat();
    }, HEARTBEAT_MS);
  }

  private ping(): void {
    this.raw({ t: 'ping', at: this.now() });
  }

  private raw(msg: ClientMessage): void {
    try {
      this.transport?.send(encode(msg));
    } catch {
      /* the close handler will deal with it */
    }
  }

  private handle(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.attempts = 0;
        this.update({ status: 'online', playerId: msg.playerId, token: msg.token, room: msg.room, error: null });
        return;
      case 'pong': {
        const local = this.now();
        const rtt = local - msg.at;
        this.offsets.push(msg.serverTime - (msg.at + rtt / 2));
        if (this.offsets.length > 8) this.offsets.shift();
        const sorted = [...this.offsets].sort((a, b) => a - b);
        this.clockOffset = sorted[Math.floor(sorted.length / 2)]!;
        return;
      }
      case 'result': {
        const resolve = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve?.({ ok: msg.ok, ...(msg.error ? { error: msg.error } : {}), ...(msg.message ? { message: msg.message } : {}) });
        return;
      }
      case 'state': {
        const fresh = msg.events.filter((e) => e.seq > this.lastSeq);
        if (fresh.length) this.lastSeq = fresh[fresh.length - 1]!.seq;
        const newRound =
          !this.snap.view ||
          msg.view.round !== this.snap.view.round ||
          (msg.view.phase === 'lobby' && this.snap.view.phase !== 'lobby');
        const events = newRound ? fresh : [...this.snap.events, ...fresh];
        this.update({ view: msg.view, events, presence: msg.presence }, fresh);
        return;
      }
      case 'error': {
        const fatal = FATAL.includes(msg.code);
        if (fatal) {
          this.stopped = true;
          this.clearTimers();
          if (msg.code === 'kicked' || msg.code === 'started') this.snap = { ...this.snap, token: null };
        }
        this.update({ error: { code: msg.code, message: msg.message }, ...(fatal ? { status: 'failed' as const } : {}) });
        if (fatal) {
          this.transport?.close();
          this.transport = null;
        }
        return;
      }
    }
  }

  private update(patch: Partial<ClientSnapshot>, fresh: LoggedEvent[] = []): void {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn(this.snap, fresh);
  }
}
