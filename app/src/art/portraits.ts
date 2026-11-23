import data from './portraits/portraits.json';

/**
 * The 12 lobby portraits: painted anime art (from the EyeSpy character sheet,
 * upscaled 4x) with separate rig layers so the game can drive the eyes and brows.
 *
 * Per character, in `portraits/<id>/`:
 * - base.webp  the portrait with eyes open
 * - lid.png    eyelid skin, clipped live to the lid position (blinks, winks, squints)
 * - brows.png  brow warp map: R = left brow, G = right brow (viewer's side)
 * - eyes.webp  the eye area at 2x resolution with the irises painted out (the eye whites)
 * - iris<i>.png the painted iris of each eye, which slides inside the eye opening to look around
 *
 * Geometry is in base-image pixels. See Portrait.tsx for how it is animated.
 */

export interface PortraitEye {
  /** Inner and outer corner. */
  I: [number, number];
  O: [number, number];
  /** Top edge of the upper lash and the lower lid line, at the chord midpoint. */
  top: number;
  bot: number;
  /** Lash thickness. */
  t: number;
  /** Top of the eyelid skin. */
  cover: number;
  lash: string;
  /** Largest iris shift for a full look left/right (x) and up/down (y). */
  gaze: { x: number; y: number };
  /** The eye opening (white of the eye) as an SVG path: the iris is clipped to it. */
  open: string;
  /** Where iris<i>.png sits when looking straight ahead [x, y, w, h]. */
  iris: [number, number, number, number];
  /** Where white<i>.png sits: the eye-white mask the iris shows through (hair over the eye stays in front). */
  mask?: [number, number, number, number];
  /** The eye's real outline, column by column: [x, top of the eye white, bottom of the eye white]. */
  prof?: [number, number, number][];
  /** Per outline column, how much the lids move there (tapers to 0 at the corners). */
  tw?: number[];
  /** Painted lash thickness above the eye white. */
  lashW?: number;
  /** Lid warp map lidmap<i>.png [x, y, w, h]: R moves the upper lid down, G the lower lid up (Live2D-style). */
  lidmap?: [number, number, number, number];
  /** Tallest eye-white height, and how far above / below the eye white the lid warp reaches. */
  lidH?: number;
  lidPad?: number;
  lowPad?: number;
  /** Where away<i>.webp sits: the painted look-away eye, shown when looking away. */
  away?: [number, number, number, number];
  /** Where closed<i>.webp sits: the painted closed eye, shown when the eye is shut. */
  closed?: [number, number, number, number];
}

export interface PortraitBrow {
  x0: number;
  x1: number;
  y: number;
  /** Largest lift in px. */
  max: number;
}

export type PortraitCrop = 'bust' | 'face' | 'eyes';

export interface PortraitData {
  id: string;
  name: string;
  /** Signature frame colour. */
  frame: string;
  eyeColor: string;
  size: [number, number];
  lidLayer: { x: number; y: number; w: number; h: number };
  eyes: PortraitEye[];
  /** Index of the eye that winks (Rook's other eye is under her patch). */
  wink: number;
  /** [left, right] brows. */
  brows: [PortraitBrow, PortraitBrow];
  /** Crop windows [x, y, w, h], matching the aspect ratios in Portrait.tsx. */
  crops: Record<PortraitCrop, [number, number, number, number]>;
  /** Line art that sits in front of the eyes (e.g. a hair strand crossing an eye), so lids never cover it. */
  overlay?: { d: string; w: number; c: string }[];
  /** The character's other eye is painted in a permanent wink (Sakura). */
  winked?: boolean;
  /** The full head-and-shoulders portrait (home screen and character picker), with its own blink rig. */
  full?: Pick<PortraitData, 'size' | 'lidLayer' | 'eyes' | 'crops' | 'brows' | 'wink'>;
  /** Where eyes.webp sits [x, y, w, h]. */
  hiEyes: [number, number, number, number];
}

export const PORTRAITS = data as unknown as PortraitData[];

const urls = import.meta.glob('./portraits/*/*.{webp,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function portraitAsset(id: string, file: 'base.webp' | 'eyes.webp' | 'lid.png' | 'brows.png' | `iris${number}.png` | `white${number}.png` | `closed${number}.webp` | `lidmap${number}.png` | `away${number}.webp` | 'full.webp' | 'fulllid.png' | 'fullbrows.png'): string {
  return urls[`./portraits/${id}/${file}`] ?? '';
}

export function portrait(avatar: number): PortraitData {
  const n = PORTRAITS.length;
  return PORTRAITS[((avatar % n) + n) % n]!;
}
