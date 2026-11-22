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
}

/**
 * A simple automated player. Used by the simulated-game tests, the dev host's
 * --bots flag, and the in-app "add bots" button in development builds.
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
      raiseChance: 0.15,
      arrestChance: 0.01,
      ...opts,
    };
  }

  start(): void {
    this.unsubscribe = this.client.subscribe((_snap, fresh) => this.observe(fresh));
    this.client.start();
    this.timer = setInterval(() => void this.think(), this.opts.thinkMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.client.stop();
  }

  private observe(fresh: LoggedEvent[]): void {
    for (const e of fresh) {
      if (e.event.type === 'SheriffWinked') this.suspect = e.event.killerId;
      if (e.event.type === 'LobbyReset' || e.event.type === 'RolesAssigned') this.suspect = null;
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
      if (view.phase !== 'playing' || !me) return;

      if (!me.alive) {
        const ghost = me.abilities.find((a) => a.ghost && a.usesLeft !== 0);
        if (ghost?.payload && this.chance(0.2)) {
          await this.client.send({ type: 'useAbility', abilityId: ghost.id, payload: this.pick(ghost.payload.options)! });
        }
        return;
      }

      const others = view.players.filter((p) => p.alive && p.id !== playerId);
      const winkable = others.filter((p) => !me.knows.includes(p.id));

      if (me.canArrest && me.shushedKillsLeft === 0) {
        const suspect = this.suspect && others.find((p) => p.id === this.suspect);
        if (suspect) {
          await this.client.send({ type: 'arrest', targetId: suspect.id });
          return;
        }
        if (this.chance(this.opts.arrestChance)) {
          await this.client.send({ type: 'arrest', targetId: this.pick(others)!.id });
          return;
        }
      }
      if (me.canWink && (me.winkReadyAt === null || me.winkReadyAt <= now) && this.chance(this.opts.winkChance)) {
        const target = this.pick(winkable);
        if (target) {
          await this.client.send({ type: 'wink', targetId: target.id });
          return;
        }
      }
      for (const a of me.abilities) {
        if (!a.unlocked || a.usesLeft === 0 || (a.readyAt !== null && a.readyAt > now)) continue;
        if (!this.chance(0.3)) continue;
        const targetId = a.target === 'player' ? this.pick(others)?.id ?? null : null;
        await this.client.send({
          type: 'useAbility',
          abilityId: a.id,
          targetId,
          payload: a.payload ? this.pick(a.payload.options)! : null,
        });
        return;
      }
      if ((me.raiseReadyAt === null || me.raiseReadyAt <= now) && this.chance(this.opts.raiseChance)) {
        const target = this.pick(others);
        if (target) await this.client.send({ type: 'raiseEyebrow', targetId: target.id });
      }
    } finally {
      this.busy = false;
    }
  }
}
