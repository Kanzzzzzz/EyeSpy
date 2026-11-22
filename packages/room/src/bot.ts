import type { LoggedEvent, SettingsPatch } from '@eyespy/engine';
import type { GameClient } from './client';

export interface BotOptions {
  random?: () => number;
  /** How often the bot thinks, in ms. */
  thinkMs?: number;
  /** Host bots only: start once this many players are in the lobby. */
  startAt?: number;
  /** Host bots only: settings to apply before starting. */
  configure?: SettingsPatch;
  /** Host bots only: start another round after the game ends. */
  playAgain?: boolean;
  /** Chance per think of each optional move. */
  winkChance?: number;
  raiseChance?: number;
  arrestChance?: number;
  /** Chance per think of looking at someone else. */
  glanceChance?: number;
}

/**
 * A simple automated player. Used by the simulated-game tests, the dev host's
 * --bots flag, and the in-app "practice bots" button.
 *
 * It plays by the eye rules: it glances between panels, only winks or raises
 * with eye contact, prefers to wink when nobody else is watching, and
 * suspects anyone it saw wink.
 */
export class Bot {
  readonly client: GameClient;
  private opts: Required<Omit<BotOptions, 'configure'>> & { configure?: SettingsPatch };
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private suspect: string | null = null;
  private startedRound = -1;
  private configured = false;
  private replayedRound = -1;
  private unsubscribe: (() => void) | null = null;

  constructor(client: GameClient, opts: BotOptions = {}) {
    this.client = client;
    this.opts = {
      random: Math.random,
      thinkMs: 400,
      startAt: Infinity,
      playAgain: false,
      winkChance: 0.35,
      raiseChance: 0.3,
      arrestChance: 0.01,
      glanceChance: 0.3,
      ...opts,
    };
  }

  start(): void {
    this.unsubscribe = this.client.subscribe((_snap, fresh) => this.observe(fresh));
    this.client.start();
    this.timer = setInterval(() => void this.think(), this.opts.thinkMs);
  }

  /** Stop making moves but stay connected (used to stage screenshots). */
  pause(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  resume(): void {
    if (!this.timer) this.timer = setInterval(() => void this.think(), this.opts.thinkMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.client.stop();
  }

  private observe(fresh: LoggedEvent[]): void {
    for (const e of fresh) {
      const ev = e.event;
      if (ev.type === 'SheriffWinked') this.suspect = ev.killerId;
      // A wink seen with your own eyes is the strongest clue there is.
      if (ev.type === 'SawWink') this.suspect = ev.winkerId;
      if (ev.type === 'SnitchTip' && !this.suspect) this.suspect = ev.suspectId;
      if (ev.type === 'LobbyReset' || ev.type === 'RolesAssigned') this.suspect = null;
    }
  }

  private chance(p: number): boolean {
    return this.opts.random() < p;
  }

  private pick<T>(xs: T[]): T | undefined {
    return xs.length ? xs[Math.floor(this.opts.random() * xs.length)] : undefined;
  }

  private async think(): Promise<void> {
    if (this.busy) return;
    const { view, playerId, status } = this.client.snapshot;
    if (status !== 'online' || !view || !playerId) return;
    this.busy = true;
    try {
      const me = view.me;
      const now = this.client.serverNow();
      const isHost = view.hostId === playerId;

      if (view.phase === 'lobby' && isHost) {
        if (this.opts.configure && !this.configured) {
          this.configured = true;
          await this.client.send({ type: 'configure', settings: this.opts.configure });
          return;
        }
        if (view.players.length >= this.opts.startAt && view.mix.ok && this.startedRound !== view.round) {
          this.startedRound = view.round;
          await this.client.send({ type: 'start' });
        }
        return;
      }
      if (view.phase === 'ended' && isHost && this.opts.playAgain && this.replayedRound !== view.round) {
        this.replayedRound = view.round;
        await this.client.send({ type: 'playAgain' });
        return;
      }
      if (view.phase === 'reveal' && me && !view.players.find((p) => p.id === playerId)?.ready) {
        await this.client.send({ type: 'ready' });
        return;
      }
      if (!me || !me.alive) {
        // Ghosts may message the Medium.
        const ghost = me?.abilities.find((a) => a.ghost && a.usesLeft !== 0);
        if (view.phase === 'playing' && ghost?.payload && this.chance(0.2)) {
          await this.client.send({ type: 'useAbility', abilityId: ghost.id, payload: this.pick(ghost.payload.options)! });
        }
        return;
      }

      const others = view.players.filter((p) => p.alive && p.id !== playerId);

      if (view.phase === 'hearing' && view.hearing && !view.hearing.myVote) {
        const target = (this.suspect && others.find((p) => p.id === this.suspect)) || this.pick(others);
        if (target && this.chance(0.5)) await this.client.send({ type: 'vote', targetId: target.id });
        return;
      }
      if (view.phase !== 'playing') return;

      const looking = me.lookingAt ? others.find((p) => p.id === me.lookingAt) : undefined;

      // The Sheriff goes after a suspect: look at them, then arrest.
      if (me.canArrest && me.shushedKillsLeft === 0) {
        const suspect = this.suspect ? others.find((p) => p.id === this.suspect) : undefined;
        if (suspect) {
          if (me.lookingAt !== suspect.id) await this.client.send({ type: 'look', targetId: suspect.id });
          else await this.client.send({ type: 'arrest', targetId: suspect.id });
          return;
        }
        if (looking && this.chance(this.opts.arrestChance)) {
          await this.client.send({ type: 'arrest', targetId: looking.id });
          return;
        }
      }

      if (looking && me.eyeContact) {
        // Fewer watchers means a safer wink: the target is always one of them.
        const safe = me.watchers <= 1;
        if (
          me.canWink &&
          !me.knows.includes(looking.id) &&
          (me.winkReadyAt === null || me.winkReadyAt <= now) &&
          this.chance(this.opts.winkChance * (safe ? 1 : 0.25))
        ) {
          await this.client.send({ type: 'wink', targetId: looking.id });
          return;
        }
        if (me.canRaise && (me.raiseReadyAt === null || me.raiseReadyAt <= now) && this.chance(this.opts.raiseChance)) {
          await this.client.send({ type: 'raiseEyebrow', targetId: looking.id });
          return;
        }
      }

      for (const a of me.abilities) {
        if (!a.unlocked || a.usesLeft === 0 || (a.readyAt !== null && a.readyAt > now)) continue;
        if (a.target === 'player' && (!looking || (a.gesture && !me.eyeContact))) continue;
        if (!this.chance(0.3)) continue;
        await this.client.send({
          type: 'useAbility',
          abilityId: a.id,
          targetId: a.target === 'player' ? looking!.id : null,
          payload: a.payload ? this.pick(a.payload.options)! : null,
        });
        return;
      }

      // Glance around. Holding a gaze a while gives eye contact a chance to happen.
      if (!looking || this.chance(this.opts.glanceChance)) {
        const next = this.pick(others.filter((p) => p.id !== me.lookingAt)) ?? this.pick(others);
        if (next) await this.client.send({ type: 'look', targetId: next.id });
      }
    } finally {
      this.busy = false;
    }
  }
}
