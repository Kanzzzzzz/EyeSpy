import { describe, expect, it } from 'vitest';
import { PORTRAITS, portrait, portraitAsset } from './portraits';

describe('lobby portraits', () => {
  it('has the 12 lobby faces with unique ids and names', () => {
    expect(PORTRAITS).toHaveLength(12);
    expect(new Set(PORTRAITS.map((p) => p.id)).size).toBe(12);
    expect(new Set(PORTRAITS.map((p) => p.name)).size).toBe(12);
  });

  it('ships every rig layer for every face', () => {
    for (const p of PORTRAITS) {
      for (const f of ['base.webp', 'eyes.webp', 'lid.png', 'brows.png'] as const) expect(portraitAsset(p.id, f), `${p.id}/${f}`).not.toBe('');
      p.eyes.forEach((_, i) => expect(portraitAsset(p.id, `iris${i}.png`), `${p.id}/iris${i}`).not.toBe(''));
    }
  });

  it('keeps eyes, brows and crops inside the picture', () => {
    for (const p of PORTRAITS) {
      const [W, H] = p.size;
      expect(p.eyes.length).toBeGreaterThan(0);
      expect(p.eyes[p.wink], `${p.id} wink eye`).toBeDefined();
      expect(p.brows).toHaveLength(2);
      for (const e of p.eyes) {
        expect(e.top).toBeLessThan(e.bot);
        expect(e.cover).toBeLessThanOrEqual(e.top);
        expect(e.open.startsWith('M')).toBe(true);
        expect(e.iris[2]).toBeGreaterThan(0);
        for (const [x, y] of [e.I, e.O]) {
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(W);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(H);
        }
      }
      for (const [x, y, w, h] of Object.values(p.crops)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(W + 0.5);
        expect(y + h).toBeLessThanOrEqual(H + 0.5);
      }
    }
  });

  it('wraps any avatar number onto a face, like the old lobby looks', () => {
    expect(portrait(0).id).toBe(PORTRAITS[0]!.id);
    expect(portrait(12).id).toBe(PORTRAITS[0]!.id);
    expect(portrait(-1).id).toBe(PORTRAITS[11]!.id);
  });
});
