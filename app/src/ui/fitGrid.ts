import { useEffect, useRef, useState } from 'react';

/**
 * Lays n equal tiles out in the biggest grid that fits a w x h box, so a full
 * room of players is visible without scrolling. Pure, so it is unit tested.
 *
 * A tile is `tile` wide and `tile * aspect + bar` tall (a portrait with a name
 * strip under it). Tiles never grow past `maxTile`; when even `minTile` can't fit
 * everyone, `fits` is false and the caller scrolls.
 */
export interface FitOptions {
  gap: number;
  /** Portrait height / width. */
  aspect: number;
  /** Extra height under the portrait, in px. */
  bar: number;
  minTile: number;
  maxTile: number;
}

export interface GridFit {
  cols: number;
  rows: number;
  tile: number;
  fits: boolean;
}

export function fitGrid(w: number, h: number, n: number, o: FitOptions): GridFit {
  if (n <= 0 || w <= 0 || h <= 0) return { cols: 1, rows: 0, tile: o.minTile, fits: true };
  let best: (GridFit & { waste: number }) | null = null;
  let tightest: GridFit | null = null;
  for (let cols = 1; cols <= n; cols++) {
    const width = Math.floor((w - o.gap * (cols - 1)) / cols);
    if (width < o.minTile && cols > 1) break;
    const tile = Math.max(o.minTile, Math.min(o.maxTile, width));
    const rows = Math.ceil(n / cols);
    const total = rows * (tile * o.aspect + o.bar) + o.gap * (rows - 1);
    const cand = { cols, rows, tile, fits: total <= h, waste: cols * rows - n };
    if (!tightest || total < tightest.rows * (tightest.tile * o.aspect + o.bar) + o.gap * (tightest.rows - 1)) tightest = cand;
    if (!cand.fits) continue;
    // Biggest tile wins; then the least empty cells, then the fewest rows.
    if (!best || tile > best.tile || (tile === best.tile && (cand.waste < best.waste || (cand.waste === best.waste && rows < best.rows)))) best = cand;
  }
  const pick = best ?? { ...tightest!, fits: false };
  return { cols: pick.cols, rows: pick.rows, tile: pick.tile, fits: pick.fits };
}

/** Watches an element's size (px). */
export function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}
