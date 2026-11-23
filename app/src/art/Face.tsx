import { memo, useEffect, useState } from 'react';
import type { Crop, Expression, Gaze } from './faceTypes';
import { Portrait } from './Portrait';

/**
 * Custom portrait slots. If the player has put their own image in
 * app/public/custom (for example avatar-3.png or char-killer.png), it is
 * shown instead of the drawn face. Nothing in that folder is committed.
 *
 * Slots: avatar-0 … avatar-11 (the lobby faces).
 * Formats tried: .png, .jpg, .webp. Without an image, the painted portrait shows.
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
  /** A lobby face (0..11). Every face in the game is a player's lobby face. */
  avatar: number;
  size?: number;
  crop?: Crop;
  gaze?: Gaze;
  expression?: Expression;
  ghost?: boolean;
  glowEyes?: boolean;
  blink?: boolean;
  /** Lobby faces: show the full head-and-shoulders portrait (home screen, character picker). */
  full?: boolean;
  className?: string;
  title?: string;
}

/** A face: the player's custom image if they added one, otherwise their painted portrait. */
export const Face = memo(function Face({ avatar, size = 120, crop = 'bust', className, ghost, title, ...rest }: FaceProps) {
  const url = useCustomImage(`avatar-${avatar}`);
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
  return <Portrait id={avatar} size={size} crop={crop} className={className} ghost={ghost} title={title} {...rest} />;
});
