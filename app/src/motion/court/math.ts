/** Small column-major 4x4 matrix helpers for the court scene (no dependencies). */

export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export const mat4 = (): Mat4 => {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};

export function multiply(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
  return out;
}

export function perspective(fovyDeg: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan((fovyDeg * Math.PI) / 360);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export const sub = (a: readonly number[], b: readonly number[]): Vec3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
export const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
export const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
export const normalize = (a: readonly number[]): Vec3 => {
  const l = Math.hypot(a[0]!, a[1]!, a[2]!) || 1;
  return [a[0]! / l, a[1]! / l, a[2]! / l];
};

/** View matrix looking from `eye` at `target`, with an optional roll (radians). */
export function lookAt(eye: readonly number[], target: readonly number[], roll = 0): Mat4 {
  const f = normalize(sub(target, eye));
  const upHint: Vec3 = Math.abs(f[1]) > 0.99 ? [0, 0, -1] : [0, 1, 0];
  let s = normalize(cross(f, upHint));
  let u = cross(s, f);
  if (roll) {
    const c = Math.cos(roll);
    const n = Math.sin(roll);
    const s2: Vec3 = [s[0] * c + u[0] * n, s[1] * c + u[1] * n, s[2] * c + u[2] * n];
    u = cross(s2, f);
    s = s2;
  }
  const m = new Float32Array(16);
  m[0] = s[0];
  m[4] = s[1];
  m[8] = s[2];
  m[1] = u[0];
  m[5] = u[1];
  m[9] = u[2];
  m[2] = -f[0];
  m[6] = -f[1];
  m[10] = -f[2];
  m[12] = -dot(s, eye);
  m[13] = -dot(u, eye);
  m[14] = dot(f, eye);
  m[15] = 1;
  return m;
}

/** Translation · rotation (Y, then X, then Z) · scale. */
export function compose(pos: readonly number[], rot: readonly number[], scale: readonly number[], out: Mat4 = new Float32Array(16)): Mat4 {
  const [rx, ry, rz] = rot as Vec3;
  const cx = Math.cos(rx),
    sx = Math.sin(rx),
    cy = Math.cos(ry),
    sy = Math.sin(ry),
    cz = Math.cos(rz),
    sz = Math.sin(rz);
  // R = Ry * Rx * Rz
  const r00 = cy * cz + sy * sx * sz,
    r01 = -cy * sz + sy * sx * cz,
    r02 = sy * cx;
  const r10 = cx * sz,
    r11 = cx * cz,
    r12 = -sx;
  const r20 = -sy * cz + cy * sx * sz,
    r21 = sy * sz + cy * sx * cz,
    r22 = cy * cx;
  const [kx, ky, kz] = scale as Vec3;
  out[0] = r00 * kx;
  out[1] = r10 * kx;
  out[2] = r20 * kx;
  out[3] = 0;
  out[4] = r01 * ky;
  out[5] = r11 * ky;
  out[6] = r21 * ky;
  out[7] = 0;
  out[8] = r02 * kz;
  out[9] = r12 * kz;
  out[10] = r22 * kz;
  out[11] = 0;
  out[12] = pos[0]!;
  out[13] = pos[1]!;
  out[14] = pos[2]!;
  out[15] = 1;
  return out;
}

/** A box or rod from `a` to `b` (its local y axis), `thick` wide. */
export function rod(a: readonly number[], b: readonly number[], thick: number, out: Mat4 = new Float32Array(16)): Mat4 {
  const d = sub(b, a);
  const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
  const y = normalize(d);
  const x = normalize(cross(y, Math.abs(y[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]));
  const z = cross(x, y);
  out.set([x[0] * thick, x[1] * thick, x[2] * thick, 0, y[0] * len, y[1] * len, y[2] * len, 0, z[0] * thick, z[1] * thick, z[2] * thick, 0, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2, (a[2]! + b[2]!) / 2, 1]);
  return out;
}

/** Apply a matrix to a point. */
export function transformPoint(m: Mat4, p: readonly number[]): Vec3 {
  const x = p[0]!,
    y = p[1]!,
    z = p[2]!;
  return [m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!];
}
