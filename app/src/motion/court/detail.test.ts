import { describe, expect, it } from 'vitest';
import { DETAIL_SIZE, detailTexture } from './detail';

describe('court detail texture', () => {
  const tex = detailTexture();
  const at = (x: number, y: number, c: number) => tex[(y * DETAIL_SIZE + x) * 4 + c]!;

  it('is deterministic and cached', () => {
    expect(detailTexture()).toBe(tex);
    expect(tex.length).toBe(DETAIL_SIZE * DETAIL_SIZE * 4);
  });

  it('wraps seamlessly, so floor tiles and planks show no edges', () => {
    // Across the wrap, neighbours differ no more than neighbours inside the texture do.
    for (const c of [1, 2, 3]) {
      let inside = 0;
      let wrap = 0;
      for (let y = 0; y < DETAIL_SIZE; y++) {
        inside += Math.abs(at(DETAIL_SIZE / 2, y, c) - at(DETAIL_SIZE / 2 - 1, y, c));
        wrap += Math.abs(at(0, y, c) - at(DETAIL_SIZE - 1, y, c));
      }
      expect(wrap).toBeLessThan(inside * 2 + DETAIL_SIZE);
    }
  });

  it('has marble veins as thin lines, not a wash', () => {
    let lit = 0;
    for (let i = 0; i < DETAIL_SIZE * DETAIL_SIZE; i++) if (tex[i * 4]! > 64) lit++;
    const share = lit / (DETAIL_SIZE * DETAIL_SIZE);
    expect(share).toBeGreaterThan(0.01);
    expect(share).toBeLessThan(0.25);
  });
});
