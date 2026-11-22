import type { RoleId } from './types';

/**
 * The secret characters players pick from for their role. Original
 * characters, written for EyeSpy. The app draws them (app/src/art); the host
 * only needs the ids to validate picks and the names for the timeline.
 *
 * A character is never shown to other players while the game is running,
 * since it would give the role away. It appears on the player's own card,
 * in their ability animations, on their victim's screen and at game over.
 */

export type Finisher = 'realm' | 'slash' | 'shadow';

export interface RosterEntry {
  id: string;
  name: string;
  title: string;
  /** Signature move, shown when the role's ability fires. */
  move: string;
  /** Killers only: which kill animation plays on the victim's screen. */
  finisher?: Finisher;
}

const r = (role: RoleId, key: string, name: string, title: string, move: string, finisher?: Finisher): RosterEntry => ({
  id: `${role}.${key}`,
  name,
  title,
  move,
  ...(finisher ? { finisher } : {}),
});

export const ROSTER: Record<RoleId, RosterEntry[]> = {
  killer: [
    r('killer', 'garaku', 'Garaku', 'The Cursed King', 'Realm Unfolded: Crimson Altar', 'realm'),
    r('killer', 'kagerou', 'Kagerou', 'The Silent Blade', 'Iai: One Breath', 'slash'),
    r('killer', 'vesper', 'Vesper', 'The Puppet Queen', 'Marionette Night', 'shadow'),
  ],
  sheriff: [
    r('sheriff', 'haruto', 'Haruto', 'Captain of the Night Watch', 'Iron Verdict Chains'),
    r('sheriff', 'ayame', 'Ayame', 'The Lantern Inspector', 'Lantern Seal'),
    r('sheriff', 'gin', 'Old Wolf Gin', 'The Retired Legend', "Wolf's Snare"),
  ],
  shush: [
    r('shush', 'shizuka', 'Shizuka', 'The Seal Maiden', 'Seal of Silence'),
    r('shush', 'kuu', 'Brother Kuu', 'The Mute Monk', 'Vow of Stillness'),
    r('shush', 'velvet', 'Velvet', 'Lady Hush', 'Velvet Curtain'),
  ],
  snitch: [
    r('snitch', 'yoru', 'Yoru', 'The Tattletale Fox', 'Fox Whisper'),
    r('snitch', 'byte', 'Byte', 'The Info Broker', 'Data Leak'),
    r('snitch', 'aiko', 'Aiko', 'The Paper Crane Courier', 'Thousand Cranes'),
  ],
  lover: [
    r('lover', 'momo', 'Momo', 'The Hopeless Romantic', 'Red String'),
    r('lover', 'kaito', 'Kaito', 'The Moonlit Poet', 'Moon Vow'),
    r('lover', 'suzu', 'Suzu', 'The Bell of Fate', 'Twin Bells'),
  ],
  citizen: [
    r('citizen', 'taro', 'Taro', 'The Ramen Runner', 'Extra Spicy'),
    r('citizen', 'mei', 'Mei', 'The Class President', 'Order in the Room!'),
    r('citizen', 'juubei', 'Gramps Juubei', 'The Old Fisherman', 'Tall Tales'),
  ],
  judge: [
    r('judge', 'tenbin', 'Tenbin', 'Lord of the Scales', 'Court of Scales'),
    r('judge', 'seraphine', 'Seraphine', 'The Arbiter', 'Heavenly Verdict'),
    r('judge', 'onibi', 'Onibi', 'The Demon Magistrate', 'Hall of Judgement'),
  ],
  dramaQueen: [
    r('dramaQueen', 'kirara', 'Kirara', 'The Stage Diva', 'Encore!'),
    r('dramaQueen', 'lucien', 'Prince Lucien', 'The Tragic Heartthrob', 'Rose Monologue'),
    r('dramaQueen', 'hime', 'Hime', 'The Princess of Tears', 'Waterworks'),
  ],
  bodyguard: [
    r('bodyguard', 'goro', 'Goro', 'The Iron Wall', 'Iron Wall'),
    r('bodyguard', 'freya', 'Freya', 'The Shield Maiden', 'Aegis'),
    r('bodyguard', 'daigo', 'Daigo', 'The Wandering Ronin', 'Last Stand'),
  ],
  paparazzi: [
    r('paparazzi', 'kenta', 'Kenta', 'The Flash', 'Scoop Shot'),
    r('paparazzi', 'rika', 'Rika', 'The Scoop Queen', 'Front Page'),
    r('paparazzi', 'lens', 'Lens', 'The Night Photographer', 'Long Exposure'),
  ],
  copycat: [
    r('copycat', 'mimi', 'Mimi', 'The Mimic Cat', 'Copy Paste'),
    r('copycat', 'doppel', 'Doppel', 'The Mirror Twin', 'Mirror Image'),
    r('copycat', 'nanashi', 'Nanashi', 'The Nameless', 'Borrowed Face'),
  ],
  medium: [
    r('medium', 'yuzuha', 'Yuzuha', 'The Shrine Maiden', 'Spirit Bell'),
    r('medium', 'kiri', 'Granny Kiri', 'The Fog Seer', 'Fog Reading'),
    r('medium', 'ren', 'Ren', 'The Ghost Listener', 'Echoes'),
  ],
  decoy: [
    r('decoy', 'pon', 'Pon', 'The Tanuki Trickster', 'Leaf Illusion'),
    r('decoy', 'twitch', 'Twitch', 'The Nervous Wreck', 'False Alarm'),
    r('decoy', 'mirage', 'Mirage', 'The Stage Illusionist', 'Smoke and Mirrors'),
  ],
  insomniac: [
    r('insomniac', 'fukurou', 'Fukurou', 'The Night Owl', 'Owl Eyes'),
    r('insomniac', 'shiro', 'Shiro', 'The Sleepless Gamer', 'All-Nighter'),
    r('insomniac', 'neru', 'Neru', 'The Midnight Idol', 'Midnight Live'),
  ],
};

const BY_ID = new Map(Object.values(ROSTER).flat().map((c) => [c.id, c]));

export function character(id: string | null | undefined): RosterEntry | null {
  return (id && BY_ID.get(id)) || null;
}

export function isCharacterFor(role: RoleId, id: string): boolean {
  return ROSTER[role].some((c) => c.id === id);
}
