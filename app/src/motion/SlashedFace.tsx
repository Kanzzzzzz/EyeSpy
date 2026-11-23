import { type CSSProperties, forwardRef, memo, useImperativeHandle, useRef } from 'react';
import { Face } from '../art/Face';
import type { Expression } from '../art/faceTypes';
import { color } from '../design/tokens';

/**
 * A player's own portrait that can be cut in two: one slash through the middle
 * and the halves slide apart along the blade. Used by the kill scenes, played
 * on the victim's phone, so the face being slashed is yours.
 *
 * Driven imperatively (`pose`) from the scene's frame loop, so a scene never
 * re-renders React per frame. The cut line passes through the centre at
 * `angle` radians (screen space, y down), the same angle the blade is drawn at.
 */

export interface SlashPose {
  /** 0 intact .. 1 fully slid apart. */
  split: number;
  /** The bright cut line: 0 hidden .. 1 white-hot. */
  flash: number;
  /** Whole-portrait opacity. */
  alpha: number;
  /** Whole-portrait offset in px and scale (camera shake, push in). */
  x: number;
  y: number;
  scale: number;
  /** Negative-image glitch frame. */
  glitch: boolean;
}

export interface SlashedFaceHandle {
  pose: (p: Partial<SlashPose>) => void;
}

/** A lobby face's 'face' crop is 132:160. */
export const faceHeight = (size: number) => Math.round((size * 160) / 132);

const r = (n: number) => Math.round(n * 10) / 10;

/**
 * Clip polygons for the two sides of a cut through the middle of a w x h box.
 * `a` is the side the blade's normal points to, `b` the other side.
 */
export function sliceClips(w: number, h: number, angle: number): { a: string; b: string } {
  const cx = w / 2;
  const cy = h / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const L = Math.hypot(w, h);
  const pt = (along: number, across: number) => `${r(cx + dx * along + nx * across)}px ${r(cy + dy * along + ny * across)}px`;
  return {
    a: `polygon(${pt(-L, 0)}, ${pt(L, 0)}, ${pt(L, L)}, ${pt(-L, L)})`,
    b: `polygon(${pt(-L, 0)}, ${pt(L, 0)}, ${pt(L, -L)}, ${pt(-L, -L)})`,
  };
}

/** Where each half sits for a given split: slide along the blade, and a small gap across it. */
export function halfOffsets(size: number, angle: number, split: number) {
  const slide = size * 0.34 * split;
  const gap = size * 0.035 * split;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const a = { x: dx * slide - dy * gap, y: dy * slide + dx * gap, rot: 3.5 * split };
  const b = { x: -a.x, y: -a.y, rot: -3.5 * split };
  return { a, b };
}

export const SlashedFace = memo(
  forwardRef<SlashedFaceHandle, { avatar: number; size: number; angle: number; expression?: Expression; glowEyes?: boolean; className?: string; style?: CSSProperties }>(function SlashedFace(
    { avatar, size, angle, expression = 'shock', glowEyes, className, style },
    ref,
  ) {
    const root = useRef<HTMLDivElement>(null);
    const a = useRef<HTMLDivElement>(null);
    const b = useRef<HTMLDivElement>(null);
    const edge = useRef<HTMLDivElement>(null);
    const h = faceHeight(size);
    const clips = sliceClips(size, h, angle);

    useImperativeHandle(
      ref,
      () => ({
        pose(p) {
          const el = root.current;
          if (!el) return;
          if (p.alpha !== undefined) el.style.opacity = String(p.alpha);
          if (p.glitch !== undefined) el.style.filter = p.glitch ? 'invert(1) hue-rotate(180deg)' : 'none';
          if (p.x !== undefined || p.y !== undefined || p.scale !== undefined) {
            el.style.transform = `translate(${r(p.x ?? 0)}px, ${r(p.y ?? 0)}px) scale(${p.scale ?? 1})`;
          }
          if (p.split !== undefined) {
            const o = halfOffsets(size, angle, p.split);
            if (a.current) a.current.style.transform = `translate(${r(o.a.x)}px, ${r(o.a.y)}px) rotate(${r(o.a.rot)}deg)`;
            if (b.current) b.current.style.transform = `translate(${r(o.b.x)}px, ${r(o.b.y)}px) rotate(${r(o.b.rot)}deg)`;
          }
          if (p.flash !== undefined && edge.current) edge.current.style.opacity = String(p.flash);
        },
      }),
      [size, angle],
    );

    return (
      <div ref={root} className={className} style={{ position: 'absolute', left: '50%', width: size, height: h, marginLeft: -size / 2, marginTop: -h / 2, willChange: 'transform, opacity', ...style }}>
        <div ref={a} style={{ position: 'absolute', inset: 0, clipPath: clips.a }}>
          <Face avatar={avatar} size={size} crop="face" expression={expression} glowEyes={glowEyes} />
        </div>
        <div ref={b} style={{ position: 'absolute', inset: 0, clipPath: clips.b }}>
          <Face avatar={avatar} size={size} crop="face" expression={expression} glowEyes={glowEyes} />
        </div>
        {/* The cut itself: a hairline of white-hot light along the blade. */}
        <div
          ref={edge}
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: size * 1.9,
            height: 3,
            marginLeft: -size * 0.95,
            marginTop: -1.5,
            transform: `rotate(${angle}rad)`,
            background: color.paper.DEFAULT,
            boxShadow: `0 0 14px 4px ${color.crimson.DEFAULT}`,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }),
);
