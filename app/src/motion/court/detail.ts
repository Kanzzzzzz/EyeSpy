/**
 * A small tileable detail texture for the court's surfaces, made once on the
 * CPU (then cached) so the GPU samples it instead of computing noise for
 * every pixel:
 *   r  marble veins (0..1, thin bright lines)
 *   g  wood grain (streaks along x)
 *   b  weathered stone
 *   a  soft mottling
 * Every channel wraps seamlessly, so tiles and planks show no edges.
 */

export const DETAIL_SIZE = 256;

const mod = (a: number, n: number) => ((a % n) + n) % n;

function hash(i: number, j: number, seed: number) {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise on a lattice that repeats every px by py cells. */
function noise(x: number, y: number, px: number, py: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(mod(xi, px), mod(yi, py), seed);
  const b = hash(mod(xi + 1, px), mod(yi, py), seed);
  const c = hash(mod(xi, px), mod(yi + 1, py), seed);
  const d = hash(mod(xi + 1, px), mod(yi + 1, py), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, px: number, py: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x, y, px, py, seed + o * 17);
    x *= 2;
    y *= 2;
    px *= 2;
    py *= 2;
    amp *= 0.5;
  }
  return sum;
}

let cached: Uint8Array | null = null;

export function detailTexture(): Uint8Array {
  if (cached) return cached;
  const N = DETAIL_SIZE;
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      // Marble: domain-warped noise, keeping only a thin band as veins.
      const wx = fbm(u * 4, v * 4, 4, 4, 11, 3);
      const wy = fbm(u * 4 + 5.2, v * 4 + 1.3, 4, 4, 23, 3);
      const m = fbm(u * 4 + wx * 2.4, v * 4 + wy * 2.4, 4, 4, 37);
      const vein = Math.max(0, 1 - Math.abs(m - 0.52) / 0.035);
      // Wood: stretched noise, fast across the grain.
      const wood = fbm(u * 2, v * 24, 2, 24, 51);
      const stone = fbm(u * 6, v * 6, 6, 6, 71);
      const mottle = fbm(u * 12, v * 12, 12, 12, 91, 3);
      const o = (y * N + x) * 4;
      out[o] = Math.round(vein * vein * 255);
      out[o + 1] = Math.round(wood * 255);
      out[o + 2] = Math.round(stone * 255);
      out[o + 3] = Math.round(mottle * 255);
    }
  }
  cached = out;
  return out;
}
