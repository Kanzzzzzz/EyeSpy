import { describe, expect, it } from 'vitest';
import { fitGrid, type FitOptions } from './fitGrid';

const opts: FitOptions = { gap: 8, aspect: 160 / 132, bar: 22, minTile: 56, maxTile: 150 };
const height = (g: ReturnType<typeof fitGrid>) => g.rows * (g.tile * opts.aspect + opts.bar) + opts.gap * (g.rows - 1);

describe('fitGrid', () => {
  it('fits eleven other players on a phone without scrolling', () => {
    const g = fitGrid(358, 390, 11, opts);
    expect(g.fits).toBe(true);
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(11);
    expect(height(g)).toBeLessThanOrEqual(390);
    expect(g.cols * g.tile + opts.gap * (g.cols - 1)).toBeLessThanOrEqual(358);
  });

  it('shrinks the tiles as more players join', () => {
    const few = fitGrid(358, 390, 4, opts);
    const many = fitGrid(358, 390, 15, opts);
    expect(many.tile).toBeLessThan(few.tile);
    expect(many.fits).toBe(true);
  });

  it('keeps a small room big instead of stretching it', () => {
    const g = fitGrid(358, 600, 3, opts);
    expect(g.tile).toBeLessThanOrEqual(opts.maxTile);
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(3);
  });

  it('asks the caller to scroll only when even the smallest tiles do not fit', () => {
    const g = fitGrid(358, 120, 19, opts);
    expect(g.fits).toBe(false);
    expect(g.tile).toBeGreaterThanOrEqual(opts.minTile);
  });

  it('handles an empty room and an unmeasured box', () => {
    expect(fitGrid(358, 390, 0, opts).fits).toBe(true);
    expect(fitGrid(0, 0, 5, opts).rows).toBe(0);
  });

  it('prefers a balanced grid to one with a lonely last row', () => {
    const g = fitGrid(358, 600, 4, opts);
    expect(g.cols * g.rows).toBe(4);
  });
});
