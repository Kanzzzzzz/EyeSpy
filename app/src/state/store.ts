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

  init(): Promise<void>;
  go(screen: Screen): void;
  setPrefs(p: Partial<Prefs>): void;
  hostGame(): Promise<void>;
  resumeHosting(): Promise<void>;
  joinGame(target: JoinTarget): void;
  rejoinLast(): void;
  leaveGame(): Promise<void>;
  send(action: PlayerAction): Promise<ActionResult>;
  dismiss(id: number): void;
  addBots(n: number): void;
  clearProblem(): void;
}

function serverNowFor(client: GameClient | null) {
  return client ? client.serverNow() : Date.now();
}

export const useGame = create<State>((set, get) => {
  /** Wire a client into the store: snapshots, alerts, sounds, haptics. */
  function attach(client: GameClient, target: JoinTarget | null) {
    let lastPhase: string | null = null;
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
        if (now - e.at > STALE_MS) continue;
        const a = eventToAlert(e, { me: snap.playerId, players });
        if (!a) continue;
        newAlerts.push(a);
        if (a.sound) play(a.sound);
        if (a.haptic) void vibrate(a.haptic);
        if (e.event.type === 'PlayerJoined') play('join');
      }
      if (view && view.phase !== lastPhase) {
        if (view.phase === 'reveal') preloadSounds();
        if (view.phase === 'ended' && view.result) {
          const won = !!snap.playerId && view.result.winners.includes(snap.playerId);
          play(won ? 'win' : 'lose');
          void vibrate(won ? HAPTICS.win : HAPTICS.death);
        }
        if (view.phase === 'arrest' && lastPhase === 'playing') {
          play('drumroll');
          void vibrate(HAPTICS.arrest);
        }
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
    set({ client, snap: client.snapshot, screen: 'game', alerts: [], problem: null });
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
      set({ client: null, snap: null, hosting: null, alerts: [], screen: 'home', bots: [], lastGame: null });
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

    dismiss(id) {
      set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
    },

    addBots(n) {
      const hosting = get().hosting;
      if (!hosting) return;
      const taken = new Set(hosting.room.state.players.map((p) => p.name.toLowerCase()));
      const names = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kit', 'Leo', 'Nia', 'Oz', 'Pia', 'Quin', 'Ray', 'Sol', 'Tess'];
      const bots: Bot[] = [];
      for (const name of names) {
        if (bots.length >= n) break;
        if (taken.has(name.toLowerCase())) continue;
        const client = new GameClient({
          transport: localTransport(hosting.room, 'bot'),
          name,
          avatar: Math.floor(Math.random() * 12),
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
