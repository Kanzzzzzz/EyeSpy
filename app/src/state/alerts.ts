import { getRole, type LoggedEvent, type RoleId } from '@eyespy/engine';
import type { HapticPattern } from '../platform/device';
import { HAPTICS } from '../platform/device';
import type { SoundName } from '../audio/sounds';

/**
 * Turns game events into what a phone shows, plays and buzzes. Pure, so it is
 * unit tested. Each alert has its own vibration so it can be felt unseen.
 */

export type AlertStyle =
  /** Small banner at the top; disappears by itself. */
  | 'toast'
  /** Full-screen moment the player taps away (or that times out). */
  | 'modal'
  /** Plays on every phone at once. */
  | 'spotlight'
  /** The wink countdown. */
  | 'countdown'
  /** No visual beyond a subtle pulse (the Insomniac's buzz). */
  | 'pulse';

export interface Alert {
  id: number;
  at: number;
  style: AlertStyle;
  title: string;
  body?: string;
  /** Avatar to show, if any. */
  avatar?: number;
  role?: RoleId;
  emoji?: string;
  /** Countdown deadline (server time). */
  deadline?: number;
  tone: 'neutral' | 'danger' | 'good' | 'spot';
  sound?: SoundName;
  haptic?: HapticPattern;
  /** Auto-dismiss after this many ms (toasts and spotlights). */
  ttl?: number;
}

export interface AlertContext {
  me: string | null;
  players: Record<string, { name: string; avatar: number }>;
}

/** Events older than this when they arrive (say, after a reconnect) don't pop up. */
export const STALE_MS = 6000;

export function eventToAlert(e: LoggedEvent, ctx: AlertContext): Alert | null {
  const ev = e.event;
  const name = (id: string | null | undefined) => (id && ctx.players[id]?.name) || 'Someone';
  const avatar = (id: string | null | undefined) => (id ? ctx.players[id]?.avatar : undefined);
  const base = { id: e.seq, at: e.at };

  switch (ev.type) {
    case 'EyebrowRaised':
      if (ev.targetId !== ctx.me) return null;
      return {
        ...base,
        style: 'toast',
        title: `${name(ev.byId)} raised an eyebrow at you`,
        avatar: avatar(ev.byId),
        tone: 'spot',
        sound: 'raise',
        haptic: HAPTICS.raise,
        ttl: 3200,
      };
    case 'WinkSent':
      if (ev.killerId !== ctx.me) return null;
      return {
        ...base,
        style: 'toast',
        title: ev.fake ? `Fake wink sent to ${name(ev.targetId)}` : `Wink sent to ${name(ev.targetId)}`,
        avatar: avatar(ev.targetId),
        tone: 'neutral',
        sound: 'wink',
        ttl: 2200,
      };
    case 'Winked':
      if (ev.targetId !== ctx.me) return null;
      return {
        ...base,
        style: 'countdown',
        title: 'Winked!',
        body: ev.killerId ? `${name(ev.killerId)} winked at you` : undefined,
        avatar: avatar(ev.killerId),
        deadline: ev.deadline,
        tone: 'danger',
        sound: 'winked',
        haptic: HAPTICS.winked,
      };
    case 'Phew':
      return { ...base, style: 'toast', title: 'Phew, just a twitch', body: 'That wink was a fake.', tone: 'good', sound: 'phew', haptic: HAPTICS.tap, ttl: 3500 };
    case 'SheriffWinked':
      return {
        ...base,
        style: 'modal',
        title: `The Killer winked you: it's ${name(ev.killerId)}`,
        body: "You can't be killed. Now you know who to arrest.",
        avatar: avatar(ev.killerId),
        tone: 'spot',
        sound: 'sheriffWinked',
        haptic: HAPTICS.sheriffWinked,
        ttl: 8000,
      };
    case 'SheriffShushed':
      return {
        ...base,
        style: 'modal',
        title: "You've been shushed",
        body: `No arrests until ${ev.kills} more ${ev.kills === 1 ? 'kill happens' : 'kills happen'}.`,
        tone: 'danger',
        sound: 'shush',
        haptic: HAPTICS.shushed,
        ttl: 6000,
      };
    case 'ShushLifted':
      return { ...base, style: 'toast', title: 'You can arrest again', tone: 'good', sound: 'unlock', haptic: HAPTICS.tip, ttl: 3500 };
    case 'SnitchTip':
      return {
        ...base,
        style: 'spotlight',
        title: `The Snitch thinks it's ${name(ev.suspectId)}`,
        avatar: avatar(ev.suspectId),
        tone: 'spot',
        sound: 'tip',
        haptic: HAPTICS.tip,
        ttl: 5000,
      };
    case 'PlayerDied': {
      const mine = ev.playerId === ctx.me;
      if (mine) {
        return {
          ...base,
          style: 'modal',
          title: ev.cause === 'heartbreak' ? 'You died of a broken heart' : "You're dead",
          body: ev.cause === 'heartbreak' ? 'Your secret Lover was killed. Stay silent.' : 'Stay silent. Ghosts watch, but never tell.',
          avatar: avatar(ev.playerId),
          tone: 'danger',
          sound: ev.cause === 'heartbreak' ? 'heartbreak' : 'death',
          haptic: HAPTICS.death,
          ttl: 7000,
        };
      }
      return {
        ...base,
        style: 'toast',
        title: ev.cause === 'heartbreak' ? `${name(ev.playerId)} died of a broken heart` : `${name(ev.playerId)} is dead`,
        avatar: avatar(ev.playerId),
        tone: 'danger',
        sound: ev.cause === 'heartbreak' ? 'heartbreak' : 'death',
        haptic: HAPTICS.countdown,
        ttl: 3500,
      };
    }
    case 'AbilityUnlocked':
      return { ...base, style: 'toast', title: 'Ability unlocked', body: 'Your third raise did it. Use it wisely.', tone: 'spot', sound: 'unlock', haptic: HAPTICS.tip, ttl: 4000 };
    case 'RoleChanged':
      return {
        ...base,
        style: 'modal',
        title: `You're now the ${getRole(ev.role).name}`,
        body: getRole(ev.role).summary,
        role: ev.role,
        tone: 'spot',
        sound: 'flip',
        haptic: HAPTICS.tip,
        ttl: 8000,
      };
    case 'Snapped':
      return {
        ...base,
        style: 'modal',
        title: `${name(ev.targetId)} has sent ${ev.winksSent} ${ev.winksSent === 1 ? 'wink' : 'winks'}`,
        avatar: avatar(ev.targetId),
        tone: ev.winksSent > 0 ? 'danger' : 'neutral',
        sound: 'flip',
        ttl: 6000,
      };
    case 'Guarding':
      return { ...base, style: 'toast', title: `You're guarding ${name(ev.targetId)}`, avatar: avatar(ev.targetId), tone: 'good', sound: 'select', ttl: 3000 };
    case 'GuardTriggered':
      return { ...base, style: 'toast', title: `You took the wink for ${name(ev.savedId)}`, avatar: avatar(ev.savedId), tone: 'danger', ttl: 3000 };
    case 'MediumMessage':
      if (ev.fromId === ctx.me) return { ...base, style: 'toast', title: 'Sent to the Medium', emoji: ev.emoji, tone: 'neutral', ttl: 2500 };
      return {
        ...base,
        style: 'modal',
        title: `${name(ev.fromId)} speaks from beyond`,
        emoji: ev.emoji,
        avatar: avatar(ev.fromId),
        tone: 'spot',
        sound: 'tip',
        haptic: HAPTICS.tip,
        ttl: 6000,
      };
    case 'Buzz':
      return { ...base, style: 'pulse', title: 'Someone winked', tone: 'neutral', sound: 'buzz', haptic: HAPTICS.buzz, ttl: 900 };
    case 'SoloWin':
      return { ...base, style: 'toast', title: 'You got your wish', body: "Drama Queen: you've won.", tone: 'spot', sound: 'win', haptic: HAPTICS.win, ttl: 4000 };
    case 'ArrestResult':
      return {
        ...base,
        style: 'spotlight',
        title: ev.correct ? `${name(ev.targetId)} was a Killer!` : `${name(ev.targetId)} was innocent`,
        body: ev.correct ? 'Caught.' : `They were the ${getRole(ev.role).name}.`,
        avatar: avatar(ev.targetId),
        role: ev.role,
        tone: ev.correct ? 'good' : 'danger',
        sound: 'stamp',
        haptic: HAPTICS.arrest,
        ttl: 3800,
      };
    default:
      return null;
  }
}
