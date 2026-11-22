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
  // Shuten, the Cursed Sovereign: an original demon-king design.
  'killer.shuten': {
    skin: SKIN.porcelain,
    hair: 'wild',
    hairColor: '#F4F1F8',
    hairTip: '#C4001F',
    eyes: 'fierce',
    eyeColor: '#FF5A2E',
    brows: 'angry',
    mouth: 'grin',
    marks: ['horns', 'thornHalo', 'eyeliner'],
    hornColor: '#5A0A18',
    outfit: 'haori',
    outfitColor: '#100A12',
    trim: '#E0102E',
    accent: '#FF2D55',
  },
  // Rei Tenbin, the Unblinking Magistrate: an original judge design.
  'judge.tenbin': {
    skin: SKIN.fair,
    hair: 'bob',
    hairColor: '#C9C3E6',
    hairTip: '#7D74B8',
    eyes: 'sharp',
    eyeColor: '#9B7CFF',
    brows: 'sharp',
    mouth: 'flat',
    marks: ['glasses', 'mole', 'scalesPin', 'earring'],
    outfit: 'robe',
    outfitColor: '#121222',
    trim: '#FFC83A',
    accent: '#FFC83A',
  },
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
