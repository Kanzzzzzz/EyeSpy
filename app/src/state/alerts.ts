import { character, getRole, type Finisher, type LoggedEvent, type RoleId } from '@eyespy/engine';
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
  /** The kill animation on the victim's phone, ending on the death card. */
  | 'finisher'
  /** No visual beyond a subtle pulse (the Insomniac's buzz). */
  | 'pulse'
  /** Sound and vibration only; the screen for this phase shows the rest. */
  | 'silent';

export interface Alert {
  id: number;
  at: number;
  style: AlertStyle;
  title: string;
  body?: string;
  /** Public character to show (a player's lobby face). */
  avatar?: number;
  /** Secret character to show (a role character id). */
  character?: string | null;
  finisher?: Finisher;
  role?: RoleId;
  emoji?: string;
  /** Countdown deadline (server time). */
  deadline?: number;
  tone: 'neutral' | 'danger' | 'good' | 'spot';
  sound?: SoundName;
  haptic?: HapticPattern;
  /** Manga lettering to pop on screen with the alert. */
  sfx?: string;
  /** Auto-dismiss after this many ms. */
  ttl?: number;
}

export interface AlertContext {
  me: string | null;
  players: Record<string, { name: string; avatar: number }>;
  /** The secret character of whoever last winked this phone (for the kill animation). */
  lastKillerCharacter?: string | null;
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
        sfx: 'ピクッ',
        ttl: 3200,
      };
    case 'SawWink':
      return {
        ...base,
        style: 'toast',
        title: `You saw ${name(ev.winkerId)} wink!`,
        body: 'At someone else. Watch who falls.',
        avatar: avatar(ev.winkerId),
        tone: 'danger',
        sound: 'witness',
        haptic: HAPTICS.witness,
        sfx: '!?',
        ttl: 4200,
      };
    case 'SawRaise':
      return {
        ...base,
        style: 'toast',
        title: `${name(ev.raiserId)} raised an eyebrow at someone`,
        avatar: avatar(ev.raiserId),
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
        sfx: 'キラッ',
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
        character: ev.killerCharacter,
        deadline: ev.deadline,
        tone: 'danger',
        sound: 'winked',
        haptic: HAPTICS.winked,
        sfx: 'ドクン',
      };
    case 'Phew':
      return { ...base, style: 'toast', title: 'Phew, just a twitch', body: 'That wink was a fake.', tone: 'good', sound: 'phew', haptic: HAPTICS.tap, sfx: 'ホッ', ttl: 3500 };
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
        sfx: 'ハッ',
        ttl: 8000,
      };
    case 'SheriffShushed': {
      const by = character(ev.shushCharacter);
      return {
        ...base,
        style: 'modal',
        title: "You've been shushed",
        body: `${by ? `${by.move}. ` : ''}No arrests until ${ev.kills} more ${ev.kills === 1 ? 'kill happens' : 'kills happen'}.`,
        character: ev.shushCharacter,
        tone: 'danger',
        sound: 'shush',
        haptic: HAPTICS.shushed,
        sfx: 'シーン',
        ttl: 6000,
      };
    }
    case 'ShushLifted':
      return { ...base, style: 'toast', title: 'You can arrest again', tone: 'good', sound: 'unlock', haptic: HAPTICS.tip, ttl: 3500 };
    case 'SnitchTip': {
      const by = character(ev.snitchCharacter);
      return {
        ...base,
        style: 'spotlight',
        title: `The Snitch thinks it's ${name(ev.suspectId)}`,
        body: by ? by.move : undefined,
        avatar: avatar(ev.suspectId),
        character: ev.snitchCharacter,
        tone: 'spot',
        sound: 'tip',
        haptic: HAPTICS.tip,
        sfx: 'ジッ',
        ttl: 5000,
      };
    }
    case 'PlayerDied': {
      const mine = ev.playerId === ctx.me;
      if (mine && ev.cause === 'wink') {
        const killer = character(ctx.lastKillerCharacter);
        return {
          ...base,
          style: 'finisher',
          title: "You're dead",
          body: 'Stay silent. Ghosts watch, but never tell.',
          avatar: avatar(ev.playerId),
          character: ctx.lastKillerCharacter ?? null,
          finisher: killer?.finisher ?? 'slash',
          tone: 'danger',
          // The finisher scene carries its own sound.
          sound: killer?.finisher === 'realm' ? undefined : 'death',
          haptic: HAPTICS.death,
          ttl: 9000,
        };
      }
      if (mine) {
        return {
          ...base,
          style: 'modal',
          title: ev.cause === 'heartbreak' ? 'You died of a broken heart' : 'The town voted you out',
          body: ev.cause === 'heartbreak' ? 'Your secret Lover was killed. Stay silent.' : 'Stay silent. Ghosts watch, but never tell.',
          avatar: avatar(ev.playerId),
          tone: 'danger',
          sound: ev.cause === 'heartbreak' ? 'heartbreak' : 'stamp',
          haptic: HAPTICS.death,
          ttl: 7000,
        };
      }
      return {
        ...base,
        style: 'toast',
        title:
          ev.cause === 'heartbreak'
            ? `${name(ev.playerId)} died of a broken heart`
            : ev.cause === 'vote'
              ? `${name(ev.playerId)} was voted out`
              : `${name(ev.playerId)} is dead`,
        avatar: avatar(ev.playerId),
        tone: 'danger',
        sound: ev.cause === 'heartbreak' ? 'heartbreak' : 'death',
        haptic: HAPTICS.countdown,
        ttl: 3500,
      };
    }
    case 'AbilityUnlocked':
      return { ...base, style: 'toast', title: 'Ability unlocked', body: 'Your third raise did it. Use it wisely.', tone: 'spot', sound: 'unlock', haptic: HAPTICS.tip, sfx: 'キュイン', ttl: 4000 };
    case 'RoleChanged':
      return {
        ...base,
        style: 'modal',
        title: `You're now the ${getRole(ev.role).name}`,
        body: getRole(ev.role).summary,
        role: ev.role,
        tone: 'spot',
        sound: 'charge',
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
        sfx: 'パシャ',
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
    case 'ArrestStarted':
      return { ...base, style: 'silent', title: 'Arrest', tone: 'danger', sound: 'chains', haptic: HAPTICS.arrest };
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
        sfx: ev.correct ? 'ドン' : 'ガーン',
        ttl: 3800,
      };
    case 'HearingStarted':
      // The court scene carries the sound.
      return { ...base, style: 'silent', title: 'Hearing', tone: 'spot', haptic: HAPTICS.hearing };
    case 'VoteCast':
      return ev.voterId === ctx.me ? null : { ...base, style: 'silent', title: 'Vote', tone: 'neutral', sound: 'vote' };
    case 'HearingResult':
      return {
        ...base,
        style: 'spotlight',
        title: ev.eliminatedId ? `${name(ev.eliminatedId)} is voted out` : 'Hung jury',
        body: ev.eliminatedId && ev.role ? `They were the ${getRole(ev.role).name}.` : 'The votes tied. Nobody leaves.',
        avatar: avatar(ev.eliminatedId),
        role: ev.role ?? undefined,
        tone: ev.eliminatedId ? 'danger' : 'neutral',
        sound: ev.eliminatedId ? 'stamp' : 'phew',
        haptic: HAPTICS.arrest,
        sfx: ev.eliminatedId ? 'ドン' : undefined,
        ttl: 4500,
      };
    default:
      return null;
  }
}
