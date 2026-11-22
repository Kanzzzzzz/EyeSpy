import type { RoleId } from '@eyespy/engine';
import { memo, useEffect, useState } from 'react';
import { AnimeFace, type Crop, type Expression, type Gaze } from './AnimeFace';
import { publicLook, roleLook } from './characters';

/**
 * Custom portrait slots. If the player has put their own image in
 * app/public/custom (for example avatar-3.png or char-killer.png), it is
 * shown instead of the drawn face. Nothing in that folder is committed.
 *
 * Slots: avatar-0 … avatar-11 (the lobby faces), char-killer, char-judge.
 * Formats tried: .png, .jpg, .webp. Without an image, the drawn face shows.
 */

const EXTS = ['png', 'jpg', 'webp'];
const found = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function findSlot(slot: string): Promise<string | null> {
  if (found.has(slot)) return Promise.resolve(found.get(slot)!);
  let p = pending.get(slot);
  if (!p) {
    p = (async () => {
      for (const ext of EXTS) {
        const url = `./custom/${slot}.${ext}`;
        if (await probe(url)) return url;
      }
      return null;
    })().then((url) => {
      found.set(slot, url);
      return url;
    });
    pending.set(slot, p);
  }
  return p;
}

export function useCustomImage(slot: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (slot ? (found.get(slot) ?? null) : null));
  useEffect(() => {
    if (!slot) return;
    let alive = true;
    void findSlot(slot).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [slot]);
  return url;
}

/** Where each crop looks inside a portrait photo (centre point and zoom). */
const CROP_STYLE: Record<Crop, { aspect: string; pos: string; zoom: number }> = {
  bust: { aspect: '200 / 240', pos: '50% 20%', zoom: 1 },
  face: { aspect: '132 / 160', pos: '50% 30%', zoom: 1.25 },
  eyes: { aspect: '112 / 54', pos: '50% 36%', zoom: 2.1 },
};

interface FaceProps {
  /** A lobby face (0..11). */
  avatar?: number;
  /** A secret role character id, with its role as a fallback. */
  character?: string | null;
  role?: RoleId | null;
  size?: number;
  crop?: Crop;
  gaze?: Gaze;
  expression?: Expression;
  ghost?: boolean;
  glowEyes?: boolean;
  blink?: boolean;
  className?: string;
  title?: string;
}

/** A face: the player's custom image if they added one, otherwise the drawn character. */
export const Face = memo(function Face({ avatar, character, role, size = 120, crop = 'bust', className, ghost, title, ...rest }: FaceProps) {
  const r = role ?? (character ? (character.split('.')[0] as RoleId) : null);
  const slot = avatar !== undefined ? `avatar-${avatar}` : r === 'killer' || r === 'judge' ? `char-${r}` : null;
  const url = useCustomImage(slot);
  if (url) {
    const c = CROP_STYLE[crop];
    const dead = rest.expression === 'dead';
    return (
      <div
        className={`relative overflow-hidden ${className ?? ''}`}
        style={{ width: className?.includes('w-full') ? undefined : size, aspectRatio: c.aspect, filter: ghost || dead ? 'grayscale(1) brightness(0.7)' : undefined, opacity: ghost ? 0.6 : 1 }}
        role="img"
        aria-label={title ?? 'portrait'}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: c.pos, transform: `scale(${c.zoom})`, transformOrigin: c.pos }}
        />
      </div>
    );
  }
  const look = avatar !== undefined ? publicLook(avatar) : roleLook(character, r);
  return <AnimeFace look={look} size={size} crop={crop} className={className} ghost={ghost} title={title} {...rest} />;
});
