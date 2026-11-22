import { z } from 'zod';
import {
  AVATAR_COUNT,
  MAX_PLAYERS,
  SPECIAL_ROLE_IDS,
  type LoggedEvent,
  type PlayerAction,
  type PlayerView,
} from '@eyespy/engine';

/**
 * Bump when a message shape changes in a way old apps can't handle.
 * Phones send theirs in `hello`; a mismatch gets a clear "update" message.
 */
export const PROTOCOL_VERSION = 2;

/** Bonjour / mDNS service type every host announces. */
export const SERVICE_TYPE = '_eyespy._tcp.';
export const SERVICE_DOMAIN = 'local.';
export const DEFAULT_PORT = 8787;

/** Client heartbeat interval, and how long silence means a dropped phone. */
export const HEARTBEAT_MS = 2000;
export const HEARTBEAT_TIMEOUT_MS = 5000;
/** How long the game waits for a missing phone before marking it away. */
export const AWAY_AFTER_MS = 30000;

// ---------------------------------------------------------------------------
// Client -> host (validated strictly: never trust a phone)
// ---------------------------------------------------------------------------

const id = z.string().min(1).max(64);
const ms = z.number().finite().min(0).max(600_000);

const settingsPatch = z
  .object({
    roles: z
      .object({
        killer: z.number().int().min(0).max(MAX_PLAYERS),
        sheriff: z.number().int().min(0).max(MAX_PLAYERS),
        shush: z.number().int().min(0).max(3),
        snitch: z.number().int().min(0).max(3),
        judge: z.number().int().min(0).max(2),
        loverPairs: z.number().int().min(0).max(5),
      })
      .partial()
      .strict(),
    autoRoles: z.boolean(),
    special: z.object(Object.fromEntries(SPECIAL_ROLE_IDS.map((r) => [r, z.boolean()]))).partial().strict(),
    deathDelayMs: ms,
    winkCooldownMs: ms,
    raiseCooldownMs: ms,
    victimsSeeKiller: z.boolean(),
    revealTimeoutMs: ms,
    arrestVerdictMs: ms,
    hearingMs: ms,
    raisesToUnlock: z.number().int().min(0).max(20),
    shushLockKills: z.number().int().min(0).max(20),
  })
  .partial()
  .strict();

export const playerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('configure'), settings: settingsPatch }).strict(),
  z.object({ type: z.literal('start') }).strict(),
  z.object({ type: z.literal('ready') }).strict(),
  z.object({ type: z.literal('pickCharacter'), characterId: z.string().min(1).max(48) }).strict(),
  z.object({ type: z.literal('look'), targetId: id.nullable() }).strict(),
  z.object({ type: z.literal('wink'), targetId: id }).strict(),
  z.object({ type: z.literal('raiseEyebrow'), targetId: id }).strict(),
  z
    .object({
      type: z.literal('useAbility'),
      abilityId: id,
      targetId: id.nullable().optional(),
      payload: z.string().max(16).nullable().optional(),
    })
    .strict(),
  z.object({ type: z.literal('arrest'), targetId: id }).strict(),
  z.object({ type: z.literal('vote'), targetId: id }).strict(),
  z.object({ type: z.literal('playAgain') }).strict(),
  z.object({ type: z.literal('kick'), playerId: id }).strict(),
  z.object({ type: z.literal('reorder'), order: z.array(id).max(MAX_PLAYERS) }).strict(),
  z.object({ type: z.literal('leave') }).strict(),
]);

export const helloSchema = z
  .object({
    t: z.literal('hello'),
    protocol: z.number().int(),
    app: z.string().max(32),
    name: z.string().max(64),
    avatar: z.number().int().min(0).max(AVATAR_COUNT - 1),
    token: z.string().max(128).nullable().optional(),
    hostKey: z.string().max(128).nullable().optional(),
    /** Highest event seq this phone has seen, so the host resends only what it missed. */
    lastSeq: z.number().int().min(0).optional(),
  })
  .strict();

export const clientMessageSchema = z.discriminatedUnion('t', [
  helloSchema,
  z.object({ t: z.literal('action'), id: z.number().int(), action: playerActionSchema }).strict(),
  z.object({ t: z.literal('ping'), at: z.number() }).strict(),
  z.object({ t: z.literal('bye') }).strict(),
]);

export type HelloMessage = z.infer<typeof helloSchema>;
export type ClientMessage =
  | HelloMessage
  | { t: 'action'; id: number; action: PlayerAction }
  | { t: 'ping'; at: number }
  | { t: 'bye' };

// Compile-time check that the schema and the engine's action type agree.
type SchemaAction = z.infer<typeof playerActionSchema>;
const _actionsAgree: (a: SchemaAction) => PlayerAction = (a) => a as PlayerAction;
void _actionsAgree;

// ---------------------------------------------------------------------------
// Host -> client
// ---------------------------------------------------------------------------

export type Presence = 'online' | 'reconnecting' | 'away';

export type ServerErrorCode =
  | 'version'
  | 'hostVersion'
  | 'started'
  | 'full'
  | 'nameTaken'
  | 'badName'
  | 'kicked'
  | 'badMessage'
  | 'notJoined'
  | 'roomClosed';

export type ServerMessage =
  | { t: 'welcome'; playerId: string; token: string; room: string; protocol: number; serverTime: number }
  | {
      t: 'state';
      view: PlayerView;
      /** Events this phone may see, after the last one it was sent. */
      events: LoggedEvent[];
      presence: Record<string, Presence>;
      serverTime: number;
    }
  | { t: 'result'; id: number; ok: boolean; error?: string; message?: string }
  | { t: 'pong'; at: number; serverTime: number }
  | { t: 'error'; code: ServerErrorCode; message: string };

const serverMessageEnvelope = z.object({ t: z.enum(['welcome', 'state', 'result', 'pong', 'error']) }).passthrough();

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseClientMessage(raw: unknown): Parsed<ClientMessage> {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 64_000) return { ok: false, error: 'Message too large' };
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Not JSON' };
    }
  }
  const r = clientMessageSchema.safeParse(data);
  return r.success ? { ok: true, value: r.data as ClientMessage } : { ok: false, error: r.error.issues[0]?.message ?? 'Invalid' };
}

/** Phones trust the host for content, but still check the envelope. */
export function parseServerMessage(raw: unknown): Parsed<ServerMessage> {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Not JSON' };
    }
  }
  const r = serverMessageEnvelope.safeParse(data);
  return r.success ? { ok: true, value: r.data as unknown as ServerMessage } : { ok: false, error: 'Invalid message' };
}

// ---------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------

export interface JoinInfo {
  host: string;
  port: number;
  room: string;
}

/** The game QR code: everything a phone needs to connect without discovery. */
export function joinUrl(info: JoinInfo): string {
  const q = new URLSearchParams({ h: info.host, p: String(info.port), r: info.room });
  return `eyespy://join?${q.toString()}`;
}

export function parseJoinUrl(text: string): JoinInfo | null {
  try {
    const url = new URL(text.trim());
    if (url.protocol !== 'eyespy:') return null;
    const host = url.searchParams.get('h');
    const port = Number(url.searchParams.get('p'));
    const room = url.searchParams.get('r') ?? '';
    if (!host || !/^[\w.:-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { host, port, room };
  } catch {
    return null;
  }
}

/** The Wi-Fi QR code format phone cameras understand. */
export function wifiQr(ssid: string, password: string): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
  return password ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;` : `WIFI:T:nopass;S:${esc(ssid)};;`;
}

export function wsUrl(host: string, port: number): string {
  const h = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `ws://${h}:${port}`;
}
