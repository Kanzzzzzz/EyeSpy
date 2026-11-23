import { describe, expect, it } from 'vitest';
import { faceHeight, halfOffsets, sliceClips } from './SlashedFace';

describe('SlashedFace geometry', () => {
  it('cuts the portrait into two polygons that meet on a line through the centre', () => {
    const { a, b } = sliceClips(200, 240, -0.55);
    expect(a.startsWith('polygon(')).toBe(true);
    expect(b.startsWith('polygon(')).toBe(true);
    // Both halves share the two points on the blade, which are the polygons' first two vertices.
    const head = (p: string) => p.slice(8).split(', ').slice(0, 2).join(', ');
    expect(head(a)).toBe(head(b));
    expect(a).not.toBe(b);
  });

  it('keeps the halves together until the cut, then slides them apart along the blade', () => {
    const still = halfOffsets(250, -0.55, 0);
    expect(still.a).toEqual({ x: 0, y: 0, rot: 0 });
    const apart = halfOffsets(250, -0.55, 1);
    expect(apart.b.x).toBeCloseTo(-apart.a.x);
    expect(apart.b.y).toBeCloseTo(-apart.a.y);
    expect(Math.hypot(apart.a.x, apart.a.y)).toBeGreaterThan(50);
  });

  it('knows the height of a face crop', () => {
    expect(faceHeight(132)).toBe(160);
  });
});
