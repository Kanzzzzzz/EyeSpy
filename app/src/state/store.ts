import { create } from 'zustand';
import type { PlayerAction } from '@eyespy/engine';
import { wsUrl } from '@eyespy/protocol';
import {
  Bot,
  GameClient,
  localTransport,
  webSocketTransport,
  type ActionResult,
  type ClientSnapshot,
  type RoomSnapshot,
  type TransportFactory,
} from '@eyespy/room';
import { play, setSoundEnabled, unlockAudio, preloadSounds } from '../audio/sounds';
import { fx } from '../fx/fx';
import { color } from '../design/tokens';
import { APP_VERSION, HAPTICS, keepAwake, loadJson, saveJson, setHapticsEnabled, vibrate } from '../platform/device';
import { startHosting, type HostSession } from '../platform/hosting';
import { readSnapshot } from '../platform/snapshots';
import { tabTransport } from '../platform/tabs';
import { eventToAlert, STALE_MS, type Alert } from './alerts';

export type Screen = 'home' | 'how' | 'join' | 'settings' | 'game' | 'permissions';

export interface Prefs {
  name: string;
  avatar: number;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  /** 'system' follows the phone's setting. */
  reducedMotion: 'system' | 'on' | 'off';
  seenPermissions: boolean;
  /** Host-only test tools: play as any role, stage moments (Settings → Testing). */
  adminTools: boolean;
}

/** How to reach a game again: a LAN address or (in browsers) another tab. */
export type JoinTarget =
  | { kind: 'lan'; host: string; port: number; room?: string }
  | { kind: 'tab'; room: string };

interface LastGame {
  target: JoinTarget;
  room: string;
  token: string;
  savedAt: number;
}

const DEFAULT_PREFS: Prefs = {
  name: '',
  avatar: Math.floor(Math.random() * 12),
  sound: true,
  music: true,
  haptics: true,
  reducedMotion: 'system',
  seenPermissions: false,
  adminTools: false,
};

interface State {
  ready: boolean;
  screen: Screen;
  prefs: Prefs;
  client: GameClient | null;
  snap: ClientSnapshot | null;
  hosting: HostSession | null;
  alerts: Alert[];
  /** A saved host game that can be resumed after a crash. */
  resumable: RoomSnapshot | null;
  lastGame: LastGame | null;
  busy: boolean;
  problem: string | null;
  bots: Bot[];
  /** The panel you just opened, shown before the host confirms it. */
  pendingLook: string | null | undefined;
  /** Admin test tools: show every role on the panels (host only). */
  adminReveal: boolean;
  botsPaused: boolean;

  init(): Promise<void>;
  go(screen: Screen): void;
  setPrefs(p: Partial<Prefs>): void;
  hostGame(): Promise<void>;
  /** Admin test tools: host a practice game filled with bots. */
  practice(): Promise<void>;
  resumeHosting(): Promise<void>;
  joinGame(target: JoinTarget): void;
  rejoinLast(): void;
  leaveGame(): Promise<void>;
  send(action: PlayerAction): Promise<ActionResult>;
  /** Open someone's panel (look into their eyes), or null to look away. */
  look(targetId: string | null): void;
  vote(targetId: string): Promise<ActionResult>;
  pickCharacter(characterId: string): Promise<ActionResult>;
  dismiss(id: number): void;
  addBots(n: number): void;
  clearProblem(): void;
}

function serverNowFor(client: GameClient | null) {
  return client ? client.serverNow() : Date.now();
}

let lookTimer: ReturnType<typeof setTimeout> | null = null;
let lookWanted: string | null | undefined;
let lookSentAt = 0;

/** Send the newest panel choice, at most every 90 ms (the host caps looks per second). */
function queueLook(client: GameClient, targetId: string | null) {
  lookWanted = targetId;
  if (lookTimer) return;
  const wait = Math.max(0, 90 - (Date.now() - lookSentAt));
  lookTimer = setTimeout(() => {
    lookTimer = null;
    lookSentAt = Date.now();
    const t = lookWanted;
    lookWanted = undefined;
    if (t !== undefined) void client.send({ type: 'look', targetId: t });
  }, wait);
}

export const useGame = create<State>((set, get) => {
  /** Wire a client into the store: snapshots, alerts, sounds, haptics. */
  function attach(client: GameClient, target: JoinTarget | null) {
    let lastPhase: string | null = null;
    let hadEyeContact = false;
    let lastKillerCharacter: string | null = null;
    client.subscribe((snap, fresh) => {
      const { prefs } = get();
      const view = snap.view;
      // Remember the token so a restarted app can rejoin.
      if (target && snap.token && snap.room) {
        const lastGame: LastGame = { target, room: snap.room, token: snap.token, savedAt: Date.now() };
        if (get().lastGame?.token !== snap.token) {
          set({ lastGame });
          void saveJson('eyespy.lastGame', lastGame);
        }
      }
      const players = Object.fromEntries((view?.players ?? []).map((p) => [p.id, { name: p.name, avatar: p.avatar }]));
      const now = client.serverNow();
      const newAlerts: Alert[] = [];
      for (const e of fresh) {
        if (e.event.type === 'Winked' && e.event.targetId === snap.playerId) lastKillerCharacter = e.event.killerCharacter;
        if (now - e.at > STALE_MS) continue;
        if (e.event.type === 'PlayerJoined') play('join');
        const a = eventToAlert(e, { me: snap.playerId, players, lastKillerCharacter });
        if (!a) continue;
        if (a.sound) play(a.sound);
        if (a.haptic) void vibrate(a.haptic);
        if (a.sfx) {
          const tint = a.tone === 'danger' ? color.crimson.DEFAULT : a.tone === 'good' ? color.ok : a.tone === 'spot' ? color.spot.DEFAULT : color.paper.DEFAULT;
          const y = a.style === 'toast' ? window.innerHeight * 0.2 : window.innerHeight * 0.32;
          fx.text(window.innerWidth * (0.62 + Math.random() * 0.12), y, a.sfx, { color: tint, size: a.style === 'toast' ? 34 : 54 });
        }
        if (a.style !== 'silent') newAlerts.push(a);
      }
      // A soft "ting" the moment eyes meet.
      const contact = !!view?.me?.eyeContact;
      if (contact && !hadEyeContact && view?.phase === 'playing') {
        play('eyeContact');
        void vibrate(HAPTICS.eyeContact);
      }
      hadEyeContact = contact;
      // The host has caught up with the panel we opened.
      if (get().pendingLook !== undefined && view?.me && view.me.lookingAt === get().pendingLook) set({ pendingLook: undefined });
      if (view && view.phase !== lastPhase) {
        if (view.phase === 'reveal') preloadSounds();
        if (view.phase === 'ended' && view.result) {
          const won = !!snap.playerId && view.result.winners.includes(snap.playerId);
          play(won ? 'win' : 'lose');
          void vibrate(won ? HAPTICS.win : HAPTICS.death);
        }
        if (view.phase === 'arrest' && lastPhase === 'playing') play('drumroll');
        if (view.phase !== 'playing') set({ pendingLook: undefined });
        void keepAwake(view.phase !== 'lobby');
        lastPhase = view.phase;
        void prefs;
      }
      set((s) => ({
        snap,
        alerts: newAlerts.length ? [...s.alerts, ...newAlerts].slice(-12) : s.alerts,
      }));
    });
    client.start();
    set({ client, snap: client.snapshot, screen: 'game', alerts: [], problem: null, pendingLook: undefined });
  }

  function makeClient(transport: TransportFactory, token: string | null, hostKey: string | null) {
    const { prefs } = get();
    return new GameClient({
      transport,
      name: prefs.name.trim() || 'Player',
      avatar: prefs.avatar,
      appVersion: APP_VERSION,
      token,
      hostKey,
    });
  }

  function transportFor(target: JoinTarget): TransportFactory {
    return target.kind === 'lan' ? webSocketTransport(wsUrl(target.host, target.port)) : tabTransport(target.room);
  }

  return {
    ready: false,
    screen: 'home',
    prefs: DEFAULT_PREFS,
    client: null,
    snap: null,
    hosting: null,
    alerts: [],
    resumable: null,
    lastGame: null,
    busy: false,
    problem: null,
    bots: [],
    pendingLook: undefined,
    adminReveal: false,
    botsPaused: false,

    async init() {
      const prefs = await loadJson('eyespy.prefs', DEFAULT_PREFS);
      const lastGame = await loadJson<LastGame | null>('eyespy.lastGame', null);
      const resumable = await readSnapshot();
      setSoundEnabled(prefs.sound);
      setHapticsEnabled(prefs.haptics);
      set({
        prefs,
        resumable,
        lastGame: lastGame && Date.now() - lastGame.savedAt < 30 * 60_000 ? lastGame : null,
        ready: true,
      });
    },

    go(screen) {
      unlockAudio();
      set({ screen });
    },

    setPrefs(p) {
      const prefs = { ...get().prefs, ...p };
      setSoundEnabled(prefs.sound);
      setHapticsEnabled(prefs.haptics);
      set({ prefs });
      void saveJson('eyespy.prefs', prefs);
    },

    async hostGame() {
      unlockAudio();
      set({ busy: true, problem: null });
      try {
        const hosting = await startHosting(() => get().prefs.name || 'Host');
        set({ hosting, resumable: null });
        attach(makeClient(hosting.transport, null, hosting.room.hostKey), null);
      } catch (err) {
        set({ problem: err instanceof Error ? err.message : String(err) });
      } finally {
        set({ busy: false });
      }
    },

    async practice() {
      await get().hostGame();
      if (!get().hosting) return;
      get().addBots(7);
      // Faster cooldowns make testing quicker.
      setTimeout(() => void get().send({ type: 'configure', settings: { winkCooldownMs: 5000, raiseCooldownMs: 3000, revealTimeoutMs: 15000 } }), 300);
    },

    async resumeHosting() {
      const snapshot = get().resumable;
      if (!snapshot) return;
      unlockAudio();
      set({ busy: true, problem: null });
      try {
        const hosting = await startHosting(() => get().prefs.name || 'Host', snapshot);
        // The host's own seat: whoever held the host role.
        const hostId = snapshot.state.hostId;
        const token = Object.entries(snapshot.tokens).find(([, id]) => id === hostId)?.[0] ?? null;
        set({ hosting, resumable: null });
        attach(makeClient(hosting.transport, token, hosting.room.hostKey), null);
      } catch (err) {
        set({ problem: err instanceof Error ? err.message : String(err) });
      } finally {
        set({ busy: false });
      }
    },

    joinGame(target) {
      unlockAudio();
      const last = get().lastGame;
      const token = last && target.room && last.room === target.room ? last.token : null;
      attach(makeClient(transportFor(target), token, null), target);
    },

    rejoinLast() {
      const last = get().lastGame;
      if (!last) return;
      unlockAudio();
      attach(makeClient(transportFor(last.target), last.token, null), last.target);
    },

    async leaveGame() {
      const { client, hosting, bots } = get();
      bots.forEach((b) => b.stop());
      client?.stop(client.snapshot.view?.phase === 'lobby');
      await hosting?.stop();
      void keepAwake(false);
      void saveJson('eyespy.lastGame', null);
      set({ client: null, snap: null, hosting: null, alerts: [], screen: 'home', bots: [], lastGame: null, adminReveal: false, botsPaused: false });
    },

    async send(action) {
      const client = get().client;
      if (!client) return { ok: false, error: 'offline' };
      const r = await client.send(action);
      if (!r.ok) {
        play('error');
        void vibrate(HAPTICS.error);
        const now = serverNowFor(client);
        set((s) => ({
          alerts: [
            ...s.alerts,
            { id: -now, at: now, style: 'toast', title: r.message ?? "Can't do that right now", tone: 'neutral', ttl: 2500 },
          ],
        }));
      }
      return r;
    },

    look(targetId) {
      const client = get().client;
      if (!client) return;
      const me = get().snap?.view?.me;
      const current = get().pendingLook !== undefined ? get().pendingLook : me?.lookingAt;
      if (targetId === current) return;
      // Gaze lock: you must hold the panel you just opened for a moment.
      if (me?.alive && me.lookLockedUntil && me.lookLockedUntil > client.serverNow()) {
        play('error');
        void vibrate(HAPTICS.error);
        const at = Date.now();
        set((s) => ({ alerts: [...s.alerts.filter((a) => a.title !== 'Hold their gaze…'), { id: -at, at, style: 'toast', title: 'Hold their gaze…', tone: 'neutral', ttl: 1200 }] }));
        return;
      }
      set({ pendingLook: targetId });
      play('whoosh');
      queueLook(client, targetId);
    },

    vote(targetId) {
      return get().send({ type: 'vote', targetId });
    },

    pickCharacter(characterId) {
      return get().send({ type: 'pickCharacter', characterId });
    },

    dismiss(id) {
      set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
    },

    addBots(n) {
      const hosting = get().hosting;
      if (!hosting) return;
      const taken = new Set(hosting.room.state.players.map((p) => p.name.toLowerCase()));
      // Give bots characters nobody is using yet, so faces stay tellable apart.
      const usedAvatars = new Set(hosting.room.state.players.map((p) => p.avatar));
      const freeAvatars = Array.from({ length: 12 }, (_, i) => i).filter((i) => !usedAvatars.has(i));
      const names = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kit', 'Leo', 'Nia', 'Oz', 'Pia', 'Quin', 'Ray', 'Sol', 'Tess'];
      const bots: Bot[] = [];
      for (const name of names) {
        if (bots.length >= n) break;
        if (taken.has(name.toLowerCase())) continue;
        const client = new GameClient({
          transport: localTransport(hosting.room, 'bot'),
          name,
          avatar: freeAvatars.shift() ?? Math.floor(Math.random() * 12),
          appVersion: APP_VERSION,
        });
        const bot = new Bot(client, { thinkMs: 1200, winkChance: 0.06, raiseChance: 0.08, arrestChance: 0.0015 });
        bot.start();
        bots.push(bot);
      }
      set((s) => ({ bots: [...s.bots, ...bots] }));
    },

    clearProblem() {
      set({ problem: null });
    },
  };
});

/** Shorthand selectors. */
export const useView = () => useGame((s) => s.snap?.view ?? null);
export const useMe = () => useGame((s) => s.snap?.view?.me ?? null);
