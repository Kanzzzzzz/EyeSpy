import {
  createGame,
  reduce,
  shiftTime,
  SYSTEM,
  viewFor,
  visibleEvents,
  type ActionBody,
  type GameState,
  type PlayerId,
  type ReduceResult,
} from '@eyespy/engine';
import {
  AWAY_AFTER_MS,
  encode,
  HEARTBEAT_TIMEOUT_MS,
  parseClientMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type HelloMessage,
  type Presence,
  type ServerErrorCode,
  type ServerMessage,
} from '@eyespy/protocol';
import { randomId, roomCode } from './ids';

/** Anything that can carry text to one phone: a WebSocket, a native socket, a tab. */
export interface Connection {
  send(data: string): void;
  close(): void;
}

export interface RoomSnapshot {
  version: 1;
  code: string;
  hostKey: string;
  /** token -> playerId */
  tokens: Record<string, PlayerId>;
  state: GameState;
  savedAt: number;
}

export interface RoomOptions {
  code?: string;
  /** Secret the host's own phone presents to become host. */
  hostKey: string;
  seed?: number;
  now?: () => number;
  random?: () => number;
  /** Called after every change; the host writes it to disk. */
  persist?: (snapshot: RoomSnapshot) => void;
  heartbeatTimeoutMs?: number;
  awayAfterMs?: number;
  log?: (msg: string) => void;
}

interface ConnInfo {
  conn: Connection;
  playerId: PlayerId | null;
  lastSeen: number;
  /** Highest event seq sent to this connection. */
  sentSeq: number;
  /** The last view + presence sent, to skip sending an identical one. */
  lastSent: string | null;
}

/** Opening panels is frequent; cap it per phone so one client can't flood the host. */
const LOOKS_PER_SECOND = 12;

/**
 * One game room, running on the host phone (or in Node for tests).
 * Transport-agnostic: adapters call connect/receive/disconnect and tick().
 */
export class Room {
  readonly code: string;
  readonly hostKey: string;
  state: GameState;
  private tokens: Record<string, PlayerId> = {};
  private conns = new Map<string, ConnInfo>();
  /** When each player's last connection dropped. */
  private droppedAt = new Map<PlayerId, number>();
  private lookBudget = new Map<PlayerId, { tokens: number; at: number }>();
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly opts: RoomOptions;

  constructor(opts: RoomOptions, restored?: RoomSnapshot) {
    this.opts = opts;
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? Math.random;
    if (restored) {
      this.code = restored.code;
      this.hostKey = restored.hostKey;
      this.tokens = { ...restored.tokens };
      const downtime = Math.max(0, this.now() - restored.savedAt);
      this.state = shiftTime(restored.state, downtime, this.now());
      // Everyone has to reconnect; give them the usual grace period.
      for (const p of this.state.players) this.droppedAt.set(p.id, this.now());
    } else {
      this.code = opts.code ?? roomCode(this.random);
      this.hostKey = opts.hostKey;
      const seed = opts.seed ?? Math.floor(this.random() * 2 ** 32);
      this.state = createGame(seed, this.now());
    }
  }

  static restore(snapshot: RoomSnapshot, opts: Omit<RoomOptions, 'hostKey' | 'code'>): Room {
    return new Room({ ...opts, hostKey: snapshot.hostKey, code: snapshot.code }, snapshot);
  }

  snapshot(): RoomSnapshot {
    return {
      version: 1,
      code: this.code,
      hostKey: this.hostKey,
      tokens: { ...this.tokens },
      state: this.state,
      savedAt: this.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Transport hooks
  // -------------------------------------------------------------------------

  connect(connId: string, conn: Connection): void {
    this.conns.set(connId, { conn, playerId: null, lastSeen: this.now(), sentSeq: 0, lastSent: null });
  }

  receive(connId: string, raw: string): void {
    const info = this.conns.get(connId);
    if (!info) return;
    info.lastSeen = this.now();
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.sendTo(info, { t: 'error', code: 'badMessage', message: parsed.error });
      return;
    }
    const msg: ClientMessage = parsed.value;
    switch (msg.t) {
      case 'hello':
        return this.hello(connId, info, msg);
      case 'ping':
        return this.sendTo(info, { t: 'pong', at: msg.at, serverTime: this.now() });
      case 'action': {
        if (!info.playerId) return this.sendError(info, 'notJoined', 'Say hello first.');
        const isLook = msg.action.type === 'look';
        if (isLook && !this.takeLookToken(info.playerId)) {
          return this.sendTo(info, { t: 'result', id: msg.id, ok: false, error: 'cooldown', message: 'Slow down.' });
        }
        // Gaze is fleeting: it isn't worth a disk write on every glance.
        const r = this.dispatch(info.playerId, msg.action, { persist: !isLook });
        this.sendTo(info, {
          t: 'result',
          id: msg.id,
          ok: !r.error,
          ...(r.error ? { error: r.error, message: r.message ?? r.error } : {}),
        });
        if (!r.error && msg.action.type === 'kick') this.dropPlayer(msg.action.playerId, 'kicked');
        if (!r.error && msg.action.type === 'leave') this.dropPlayer(info.playerId, null);
        return;
      }
      case 'bye':
        if (info.playerId && this.state.phase === 'lobby') {
          const pid = info.playerId;
          this.dispatch(pid, { type: 'leave' });
          this.dropPlayer(pid, null);
        }
        return;
    }
  }

  disconnect(connId: string): void {
    const info = this.conns.get(connId);
    if (!info) return;
    this.conns.delete(connId);
    const pid = info.playerId;
    if (pid && !this.connectionFor(pid)) {
      this.droppedAt.set(pid, this.now());
      this.broadcast();
    }
  }

  /** Call a few times a second: runs game timers, heartbeats and away checks. */
  tick(): void {
    const now = this.now();
    this.dispatch(SYSTEM, { type: 'tick' });

    const timeout = this.opts.heartbeatTimeoutMs ?? HEARTBEAT_TIMEOUT_MS;
    for (const [connId, info] of this.conns) {
      if (now - info.lastSeen > timeout) {
        this.opts.log?.(`heartbeat lost: ${info.playerId ?? connId}`);
        try {
          info.conn.close();
        } catch {
          /* already closed */
        }
        this.disconnect(connId);
      }
    }

    const away = this.opts.awayAfterMs ?? AWAY_AFTER_MS;
    for (const [pid, at] of this.droppedAt) {
      if (now - at >= away && this.state.players.some((p) => p.id === pid && p.connected)) {
        this.dispatch(SYSTEM, { type: 'disconnect', playerId: pid });
      }
    }
  }

  /** Close every connection (host is ending the game). */
  close(): void {
    for (const info of this.conns.values()) {
      this.sendError(info, 'roomClosed', 'The host ended the game.');
      info.conn.close();
    }
    this.conns.clear();
  }

  presence(): Record<PlayerId, Presence> {
    const out: Record<PlayerId, Presence> = {};
    for (const p of this.state.players) {
      if (this.connectionFor(p.id)) out[p.id] = 'online';
      else out[p.id] = p.connected ? 'reconnecting' : 'away';
    }
    return out;
  }

  get connectionCount(): number {
    return this.conns.size;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private hello(connId: string, info: ConnInfo, msg: HelloMessage): void {
    if (msg.protocol < PROTOCOL_VERSION) {
      return this.sendError(info, 'version', 'Update EyeSpy to join this game.');
    }
    if (msg.protocol > PROTOCOL_VERSION) {
      return this.sendError(info, 'hostVersion', "The host's EyeSpy is out of date. Ask them to update.");
    }

    const known = msg.token ? this.tokens[msg.token] : undefined;
    if (known && this.state.players.some((p) => p.id === known)) {
      // Reconnect: take over the seat, closing any stale socket for it.
      for (const [otherId, other] of this.conns) {
        if (otherId !== connId && other.playerId === known) {
          other.playerId = null;
          other.conn.close();
          this.conns.delete(otherId);
        }
      }
      info.playerId = known;
      info.sentSeq = msg.lastSeq ?? 0;
      this.droppedAt.delete(known);
      this.sendTo(info, this.welcome(known, msg.token!));
      const p = this.state.players.find((x) => x.id === known)!;
      if (!p.connected) this.dispatch(SYSTEM, { type: 'reconnect', playerId: known });
      this.broadcast();
      return;
    }

    if (this.state.phase !== 'lobby') {
      return this.sendError(info, 'started', 'This game has already started. Wait for the next round.');
    }
    const playerId = randomId(this.random, 10);
    const asHost = !!msg.hostKey && msg.hostKey === this.hostKey;
    const r = this.dispatch(SYSTEM, { type: 'join', playerId, name: msg.name, avatar: msg.avatar, asHost });
    if (r.error) {
      const code: ServerErrorCode =
        r.error === 'nameTaken' ? 'nameTaken' : r.error === 'tooManyPlayers' ? 'full' : 'badName';
      return this.sendError(info, code, r.message ?? r.error);
    }
    const token = randomId(this.random, 24);
    this.tokens[token] = playerId;
    info.playerId = playerId;
    info.sentSeq = 0;
    this.persist();
    this.sendTo(info, this.welcome(playerId, token));
    this.broadcast();
  }

  private welcome(playerId: PlayerId, token: string): ServerMessage {
    return { t: 'welcome', playerId, token, room: this.code, protocol: PROTOCOL_VERSION, serverTime: this.now() };
  }

  /** Run an action through the engine; broadcast and persist on change. */
  dispatch(by: PlayerId, body: ActionBody, opts: { persist?: boolean } = {}): ReduceResult {
    const r = reduce(this.state, { ...body, by, at: this.now() } as never);
    if (r.state !== this.state) {
      this.state = r.state;
      this.forgetRemovedPlayers();
      if (opts.persist !== false) this.persist();
      this.broadcast();
    }
    return r;
  }

  private takeLookToken(playerId: PlayerId): boolean {
    const now = this.now();
    const b = this.lookBudget.get(playerId) ?? { tokens: LOOKS_PER_SECOND, at: now };
    b.tokens = Math.min(LOOKS_PER_SECOND, b.tokens + ((now - b.at) / 1000) * LOOKS_PER_SECOND);
    b.at = now;
    if (b.tokens < 1) {
      this.lookBudget.set(playerId, b);
      return false;
    }
    b.tokens -= 1;
    this.lookBudget.set(playerId, b);
    return true;
  }

  private forgetRemovedPlayers(): void {
    const ids = new Set(this.state.players.map((p) => p.id));
    for (const [token, pid] of Object.entries(this.tokens)) {
      if (!ids.has(pid)) delete this.tokens[token];
    }
    for (const pid of this.droppedAt.keys()) if (!ids.has(pid)) this.droppedAt.delete(pid);
  }

  private dropPlayer(playerId: PlayerId, reason: 'kicked' | null): void {
    for (const [connId, info] of this.conns) {
      if (info.playerId !== playerId) continue;
      if (reason === 'kicked') this.sendError(info, 'kicked', 'The host removed you from the game.');
      info.playerId = null;
      info.conn.close();
      this.conns.delete(connId);
    }
    this.forgetRemovedPlayers();
  }

  private connectionFor(playerId: PlayerId): ConnInfo | undefined {
    for (const info of this.conns.values()) if (info.playerId === playerId) return info;
    return undefined;
  }

  /**
   * Send each joined phone its own view and the events it hasn't seen yet.
   * Phones whose view didn't change (most of them, when someone opens a
   * panel) get nothing.
   */
  broadcast(): void {
    const presence = this.presence();
    const serverTime = this.now();
    for (const info of this.conns.values()) {
      if (!info.playerId) continue;
      const events = visibleEvents(this.state, info.playerId, info.sentSeq);
      info.sentSeq = Math.max(info.sentSeq, this.state.nextSeq - 1);
      const view = viewFor(this.state, info.playerId);
      const key = JSON.stringify([view, presence]);
      if (events.length === 0 && key === info.lastSent) continue;
      info.lastSent = key;
      this.sendTo(info, { t: 'state', view, events, presence, serverTime });
    }
  }

  private persist(): void {
    this.opts.persist?.(this.snapshot());
  }

  private sendTo(info: ConnInfo, msg: ServerMessage): void {
    try {
      info.conn.send(encode(msg));
    } catch (err) {
      this.opts.log?.(`send failed: ${String(err)}`);
    }
  }

  private sendError(info: ConnInfo, code: ServerErrorCode, message: string): void {
    this.sendTo(info, { t: 'error', code, message });
  }
}
