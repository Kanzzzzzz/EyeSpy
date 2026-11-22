import { character, ROSTER, type RoleId, type RosterEntry } from '@eyespy/engine';
import type { Look } from './AnimeFace';

/**
 * Everyone's looks. Original characters drawn with the AnimeFace kit.
 *
 * - PUBLIC_LOOKS: the 12 faces players pick in the lobby. These are what
 *   everyone sees in the manga panels.
 * - ROLE_LOOKS: the secret role characters (3 or more per role), keyed by the
 *   engine's roster ids. Only shown on your own card, in ability and kill
 *   animations, and at game over.
 */

const SKIN = {
  porcelain: '#FFE7DA',
  fair: '#FCD9C4',
  warm: '#F0C09C',
  tan: '#D69A6E',
  brown: '#A86B45',
  deep: '#73492E',
} as const;

export const PUBLIC_LOOKS: (Look & { name: string })[] = [
  { name: 'Akira', skin: SKIN.fair, hair: 'spiky', hairColor: '#1E1B2E', eyes: 'sharp', eyeColor: '#FF3B5C', brows: 'sharp', outfit: 'gakuran', outfitColor: '#1B2240', trim: '#FFC83A', accent: '#FF3B5C' },
  { name: 'Yuki', skin: SKIN.porcelain, hair: 'hime', hairColor: '#E8ECF7', eyes: 'big', eyeColor: '#4FA8FF', outfit: 'dress', outfitColor: '#1D2A55', trim: '#F7F2E8', accent: '#4FA8FF' },
  { name: 'Ren', skin: SKIN.warm, hair: 'messy', hairColor: '#6B3F22', eyes: 'round', eyeColor: '#3BE38B', outfit: 'hoodie', outfitColor: '#FF7A1A', trim: '#F7F2E8', accent: '#FF7A1A' },
  { name: 'Hana', skin: SKIN.fair, hair: 'twintails', hairColor: '#FF8FB8', eyes: 'big', eyeColor: '#A66BFF', marks: ['blush'], outfit: 'dress', outfitColor: '#FF6F9E', trim: '#F7F2E8', accent: '#FF8FB8' },
  { name: 'Sora', skin: SKIN.fair, hair: 'slick', hairColor: '#2E5BD9', eyes: 'narrow', eyeColor: '#9FB2C8', mouth: 'flat', outfit: 'suit', outfitColor: '#15151F', trim: '#2EE6FF', accent: '#2E5BD9' },
  { name: 'Mika', skin: SKIN.tan, hair: 'bob', hairColor: '#FF8A3D', eyes: 'round', eyeColor: '#FFB347', marks: ['freckles'], outfit: 'coat', outfitColor: '#C9A877', trim: '#F7F2E8', accent: '#FF8A3D' },
  { name: 'Kenji', skin: SKIN.brown, hair: 'buzz', hairColor: '#141420', eyes: 'sharp', eyeColor: '#7A4A2A', brows: 'angry', marks: ['headband'], outfit: 'hoodie', outfitColor: '#4A4F66', trim: '#FF2D55', accent: '#FF2D55' },
  { name: 'Rin', skin: SKIN.fair, hair: 'ponytail', hairColor: '#6A3FBF', eyes: 'sharp', eyeColor: '#FFC83A', outfit: 'haori', outfitColor: '#1F6F6A', trim: '#F7F2E8', accent: '#6A3FBF' },
  { name: 'Tetsu', skin: SKIN.warm, hair: 'wild', hairColor: '#FFD24A', eyes: 'fierce', eyeColor: '#FF7A1A', brows: 'angry', mouth: 'grin', outfit: 'coat', outfitColor: '#1A1A24', trim: '#FF2D55', accent: '#FFD24A' },
  { name: 'Nana', skin: SKIN.deep, hair: 'bun', hairColor: '#1A1418', eyes: 'round', eyeColor: '#B47A4A', marks: ['flower'], outfit: 'haori', outfitColor: '#C4304A', trim: '#FFE08A', accent: '#C4304A' },
  { name: 'Kai', skin: SKIN.fair, hair: 'sidepart', hairColor: '#2E8F5E', eyes: 'round', eyeColor: '#2EC4B6', marks: ['glasses'], outfit: 'gakuran', outfitColor: '#1E2A3A', trim: '#C9C9E8', accent: '#2EC4B6' },
  { name: 'Luna', skin: SKIN.porcelain, hair: 'long', hairColor: '#B79CFF', eyes: 'big', eyeColor: '#FF6FB5', outfit: 'cloak', outfitColor: '#3A2466', trim: '#FFE08A', accent: '#B79CFF' },
];

export const ROLE_LOOKS: Record<string, Look> = {
  // Killers
  'killer.garaku': { skin: SKIN.porcelain, hair: 'wild', hairColor: '#F2F0F7', eyes: 'fierce', eyeColor: '#FF2D55', brows: 'angry', mouth: 'grin', marks: ['horns', 'cheekMarks'], outfit: 'haori', outfitColor: '#14101C', trim: '#FF2D55', accent: '#FF2D55' },
  'killer.kagerou': { skin: SKIN.fair, hair: 'ponytail', hairColor: '#191A2A', eyes: 'sharp', eyeColor: '#9FB2C8', brows: 'sharp', marks: ['mask', 'scar'], outfit: 'cloak', outfitColor: '#1E2236', trim: '#1E2236', accent: '#9FB8FF' },
  'killer.vesper': { skin: SKIN.porcelain, hair: 'hime', hairColor: '#DCCFF5', eyes: 'big', eyeColor: '#A66BFF', mouth: 'smirk', marks: ['mole'], outfit: 'dress', outfitColor: '#161220', trim: '#A66BFF', accent: '#A66BFF' },
  // Sheriffs
  'sheriff.haruto': { skin: SKIN.warm, hair: 'spiky', hairColor: '#202546', eyes: 'sharp', eyeColor: '#FFC83A', brows: 'sharp', marks: ['cap', 'bandage'], outfit: 'uniform', outfitColor: '#1D2A4A', trim: '#F7F2E8', accent: '#FFC83A' },
  'sheriff.ayame': { skin: SKIN.fair, hair: 'bun', hairColor: '#1F2D5C', eyes: 'sharp', eyeColor: '#FFB347', marks: ['hairSticks'], outfit: 'coat', outfitColor: '#6A1F2E', trim: '#F7F2E8', accent: '#FF8A3D' },
  'sheriff.gin': { skin: SKIN.tan, hair: 'slick', hairColor: '#B9B9C6', eyes: 'narrow', eyeColor: '#A0E1FF', mouth: 'flat', marks: ['eyepatch', 'stubble'], outfit: 'coat', outfitColor: '#5A4232', trim: '#F7F2E8', accent: '#C9C9E8' },
  // Shush
  'shush.shizuka': { skin: SKIN.porcelain, hair: 'bob', hairColor: '#15151F', eyes: 'narrow', eyeColor: '#C4001F', marks: ['talisman'], outfit: 'shrine', outfitColor: '#C4001F', accent: '#FF2D55' },
  'shush.kuu': { skin: SKIN.brown, hair: 'bald', hairColor: '#2A2018', eyes: 'narrow', eyeColor: '#6B4A2A', mouth: 'flat', marks: ['beads'], outfit: 'robe', outfitColor: '#E8902E', trim: '#B5002B', accent: '#E8902E' },
  'shush.velvet': { skin: SKIN.fair, hair: 'long', hairColor: '#5B2A86', eyes: 'sharp', eyeColor: '#FF4FB0', mouth: 'smirk', marks: ['mole'], outfit: 'cloak', outfitColor: '#3A1638', trim: '#FF4FB0', accent: '#FF4FB0' },
  // Snitch
  'snitch.yoru': { skin: SKIN.fair, hair: 'messy', hairColor: '#FF8A3D', eyes: 'sharp', eyeColor: '#FFC83A', mouth: 'smirk', marks: ['foxEars'], outfit: 'haori', outfitColor: '#F7F2E8', trim: '#FF8A3D', accent: '#FF8A3D' },
  'snitch.byte': { skin: SKIN.warm, hair: 'messy', hairColor: '#3BE38B', eyes: 'round', eyeColor: '#2EE6FF', marks: ['headphones', 'glasses'], outfit: 'hoodie', outfitColor: '#15151F', trim: '#3BE38B', accent: '#3BE38B' },
  'snitch.aiko': { skin: SKIN.porcelain, hair: 'twintails', hairColor: '#FF9CC2', eyes: 'big', eyeColor: '#5AB0FF', marks: ['flower', 'blush'], outfit: 'dress', outfitColor: '#F7F2E8', trim: '#5AB0FF', accent: '#FF9CC2' },
  // Judge
  'judge.tenbin': { skin: SKIN.fair, hair: 'slick', hairColor: '#F2F0F7', eyes: 'sharp', eyeColor: '#FFC83A', mouth: 'flat', brows: 'sharp', marks: ['monocle'], outfit: 'robe', outfitColor: '#14141F', trim: '#FFC83A', accent: '#FFC83A' },
  'judge.seraphine': { skin: SKIN.porcelain, hair: 'long', hairColor: '#FFE08A', eyes: 'big', eyeColor: '#7FD8FF', marks: ['halo'], outfit: 'robe', outfitColor: '#2A3366', trim: '#FFE08A', accent: '#FFE08A' },
  'judge.onibi': { skin: SKIN.tan, hair: 'messy', hairColor: '#141420', eyes: 'fierce', eyeColor: '#FF7A1A', brows: 'angry', mouth: 'grin', marks: ['horns', 'sideMask'], outfit: 'robe', outfitColor: '#8A1020', trim: '#FF7A1A', accent: '#FF7A1A' },
  // Lovers
  'lover.momo': { skin: SKIN.porcelain, hair: 'bob', hairColor: '#FFB4A2', eyes: 'big', eyeColor: '#FF6F91', marks: ['blush', 'flower'], outfit: 'dress', outfitColor: '#FFE7DA', trim: '#FF6F91', accent: '#FF6F91' },
  'lover.kaito': { skin: SKIN.fair, hair: 'sidepart', hairColor: '#3A6BD9', eyes: 'round', eyeColor: '#2EE6FF', marks: ['blush'], outfit: 'gakuran', outfitColor: '#1B2240', trim: '#C9C9E8', accent: '#7FA7FF' },
  'lover.suzu': { skin: SKIN.warm, hair: 'bun', hairColor: '#D9364A', eyes: 'round', eyeColor: '#FFB347', marks: ['bell', 'blush'], outfit: 'haori', outfitColor: '#FF8FB8', trim: '#F7F2E8', accent: '#D9364A' },
  // Citizens
  'citizen.taro': { skin: SKIN.tan, hair: 'spiky', hairColor: '#6B3F22', eyes: 'round', eyeColor: '#7A4A2A', mouth: 'grin', marks: ['headband', 'bandage'], outfit: 'hoodie', outfitColor: '#E0364A', trim: '#F7F2E8', accent: '#FF7A59' },
  'citizen.mei': { skin: SKIN.fair, hair: 'hime', hairColor: '#15151F', eyes: 'sharp', eyeColor: '#8E6BFF', mouth: 'flat', marks: ['glasses'], outfit: 'gakuran', outfitColor: '#1D2A55', trim: '#FFC83A', accent: '#8E6BFF' },
  'citizen.juubei': { skin: SKIN.brown, hair: 'bald', hairColor: '#ECECEC', eyes: 'narrow', eyeColor: '#7A4A2A', marks: ['beard'], outfit: 'haori', outfitColor: '#1F6F6A', trim: '#F7F2E8', accent: '#2EC4B6' },
  // Drama Queen
  'dramaQueen.kirara': { skin: SKIN.porcelain, hair: 'curly', hairColor: '#FFD24A', eyes: 'big', eyeColor: '#FF4FB0', mouth: 'open', marks: ['tiara', 'blush'], outfit: 'dress', outfitColor: '#FF4FB0', trim: '#FFE08A', accent: '#FF4FB0' },
  'dramaQueen.lucien': { skin: SKIN.fair, hair: 'sidepart', hairColor: '#7B3FBF', eyes: 'sharp', eyeColor: '#FF6F91', mouth: 'smirk', marks: ['flower'], outfit: 'suit', outfitColor: '#F2EEF7', trim: '#C4001F', accent: '#FF6F91' },
  'dramaQueen.hime': { skin: SKIN.porcelain, hair: 'long', hairColor: '#9FD3FF', eyes: 'big', eyeColor: '#2EE6FF', brows: 'worried', mouth: 'frown', marks: ['tears', 'tiara'], outfit: 'dress', outfitColor: '#F7F2E8', trim: '#9FD3FF', accent: '#2EE6FF' },
  // Bodyguard
  'bodyguard.goro': { skin: SKIN.deep, hair: 'buzz', hairColor: '#141420', eyes: 'sharp', eyeColor: '#4A4A66', brows: 'angry', mouth: 'flat', marks: ['scar'], outfit: 'armor', outfitColor: '#5C6680', trim: '#2A3040', accent: '#9BA7C2' },
  'bodyguard.freya': { skin: SKIN.fair, hair: 'ponytail', hairColor: '#FFD98A', eyes: 'sharp', eyeColor: '#7FD8FF', brows: 'sharp', marks: ['headband'], outfit: 'armor', outfitColor: '#AEB8CC', trim: '#2E5BD9', accent: '#7FD8FF' },
  'bodyguard.daigo': { skin: SKIN.tan, hair: 'messy', hairColor: '#1C1C28', eyes: 'narrow', eyeColor: '#6B4A2A', mouth: 'flat', marks: ['stubble', 'scar'], outfit: 'haori', outfitColor: '#22305A', trim: '#C9C9E8', accent: '#5A7BD9' },
  // Paparazzi
  'paparazzi.kenta': { skin: SKIN.warm, hair: 'spiky', hairColor: '#7A4A2A', eyes: 'round', eyeColor: '#6B4A2A', mouth: 'grin', marks: ['freckles'], outfit: 'hoodie', outfitColor: '#FFC83A', trim: '#15151F', accent: '#FFC83A' },
  'paparazzi.rika': { skin: SKIN.fair, hair: 'bob', hairColor: '#E0364A', eyes: 'sharp', eyeColor: '#3BE38B', mouth: 'smirk', marks: ['glasses'], outfit: 'coat', outfitColor: '#C9A877', trim: '#F7F2E8', accent: '#E0364A' },
  'paparazzi.lens': { skin: SKIN.porcelain, hair: 'messy', hairColor: '#8C8CA8', eyes: 'round', eyeColor: '#2EE6FF', mouth: 'flat', marks: ['monocle'], outfit: 'hoodie', outfitColor: '#15151F', trim: '#2EE6FF', accent: '#2EE6FF' },
  // Copycat
  'copycat.mimi': { skin: SKIN.fair, hair: 'bob', hairColor: '#C9A6FF', eyes: 'fierce', eyeColor: '#FFC83A', mouth: 'smirk', marks: ['catEars'], outfit: 'hoodie', outfitColor: '#5B3FA6', trim: '#F7F2E8', accent: '#C9A6FF' },
  'copycat.doppel': { skin: SKIN.porcelain, hair: 'sidepart', hairColor: '#CFCFE0', eyes: 'sharp', eyeColor: '#FF2D55', mouth: 'smirk', marks: ['mole'], outfit: 'suit', outfitColor: '#15151F', trim: '#F7F2E8', accent: '#C9C9E8' },
  'copycat.nanashi': { skin: SKIN.fair, hair: 'messy', hairColor: '#1F4D4D', eyes: 'narrow', eyeColor: '#BFEFFF', mouth: 'flat', marks: ['sideMask'], outfit: 'cloak', outfitColor: '#132A2A', trim: '#BFEFFF', accent: '#2EC4B6' },
  // Medium
  'medium.yuzuha': { skin: SKIN.porcelain, hair: 'hime', hairColor: '#15151F', eyes: 'round', eyeColor: '#FF4F6E', marks: ['bell'], outfit: 'shrine', outfitColor: '#C4001F', accent: '#FF4F6E' },
  'medium.kiri': { skin: SKIN.warm, hair: 'bun', hairColor: '#C9C9D6', eyes: 'narrow', eyeColor: '#B79CFF', marks: ['eyebags', 'beads'], outfit: 'robe', outfitColor: '#4A2A6A', trim: '#B79CFF', accent: '#B79CFF' },
  'medium.ren': { skin: SKIN.porcelain, hair: 'messy', hairColor: '#EDEDF7', eyes: 'sharp', eyeColor: '#A0F0FF', mouth: 'flat', marks: ['earring', 'eyebags'], outfit: 'cloak', outfitColor: '#15151F', trim: '#A0F0FF', accent: '#A0F0FF' },
  // Decoy
  'decoy.pon': { skin: SKIN.warm, hair: 'messy', hairColor: '#8A5A36', eyes: 'big', eyeColor: '#7A4A2A', mouth: 'grin', marks: ['tanukiEars', 'leaf'], outfit: 'haori', outfitColor: '#6B4A2A', trim: '#FFE08A', accent: '#C98C64' },
  'decoy.twitch': { skin: SKIN.fair, hair: 'messy', hairColor: '#2E5E3E', eyes: 'round', eyeColor: '#C6F24A', brows: 'worried', mouth: 'frown', marks: ['eyebags', 'sweat'], outfit: 'hoodie', outfitColor: '#4A5A2A', trim: '#C6F24A', accent: '#C6F24A' },
  'decoy.mirage': { skin: SKIN.fair, hair: 'slick', hairColor: '#15151F', eyes: 'sharp', eyeColor: '#A66BFF', mouth: 'smirk', marks: ['tophat'], outfit: 'suit', outfitColor: '#3A1F66', trim: '#FFC83A', accent: '#A66BFF' },
  // Insomniac
  'insomniac.fukurou': { skin: SKIN.tan, hair: 'curly', hairColor: '#7A6A5A', eyes: 'big', eyeColor: '#FFB347', marks: ['eyebags'], outfit: 'cloak', outfitColor: '#4A3A2A', trim: '#FFB347', accent: '#FFB347' },
  'insomniac.shiro': { skin: SKIN.porcelain, hair: 'messy', hairColor: '#F2F2F2', eyes: 'narrow', eyeColor: '#FF4F6E', mouth: 'flat', marks: ['eyebags', 'headphones'], outfit: 'hoodie', outfitColor: '#4A4F66', trim: '#FF4F6E', accent: '#FF4F6E' },
  'insomniac.neru': { skin: SKIN.porcelain, hair: 'twintails', hairColor: '#D6B8FF', eyes: 'big', eyeColor: '#FF6FB5', marks: ['eyebags', 'blush'], outfit: 'dress', outfitColor: '#B79CFF', trim: '#F7F2E8', accent: '#D6B8FF' },
};

export function publicLook(avatar: number): Look & { name: string } {
  return PUBLIC_LOOKS[((avatar % PUBLIC_LOOKS.length) + PUBLIC_LOOKS.length) % PUBLIC_LOOKS.length]!;
}

/** The look for a secret character, falling back to the role's first character. */
export function roleLook(characterId: string | null | undefined, role?: RoleId | null): Look {
  if (characterId && ROLE_LOOKS[characterId]) return ROLE_LOOKS[characterId]!;
  const fallback = role ? ROSTER[role][0]?.id : undefined;
  return (fallback && ROLE_LOOKS[fallback]) || PUBLIC_LOOKS[0]!;
}

export function rosterEntry(characterId: string | null | undefined): RosterEntry | null {
  return character(characterId);
}
