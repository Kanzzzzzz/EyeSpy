import { color } from '../../design/tokens';
import { createPass, createScreenTriangle, createTarget, deleteTarget, hasFloatTargets, linearRgb, type Pass, type Target } from './glkit';
import { DETAIL_SIZE, detailTexture } from './detail';
import { compose, cross, lookAt, type Mat4, mat4, multiply, normalize, perspective, rod, sub, type Vec3 } from './math';
import { GAVEL_PIVOT, LIGHTS, type Material, PIECES, type Parent, SCALES_AT, STRIKE, landTime, piecePose } from './set';
import { BEAM_FRAG, BEAM_VERT, BLUR_FRAG, BRIGHT_FRAG, COMPOSITE_FRAG, DEPTH_FRAG, DEPTH_VERT, MESH_FRAG, MESH_VERT, NUM_LIGHTS, POINTS_FRAG, POINTS_VERT } from './shaders';
import { type CourtShot, courtShot } from './timeline';

/**
 * Renders "Domain Expansion: Deadly Sentencing" with WebGL2: instanced
 * courtroom pieces lit by spotlights (two with soft shadow maps), additive
 * light beams, sparks and dust, then bloom and a cinematic composite. Small
 * shaders and plain geometry, so it compiles fast and runs on phones.
 *
 * Before the clip starts, `warmUp` times a few hidden frames and picks a
 * quality tier for this device; quality can still step down once mid-clip.
 * Slowness never cancels the scene: the slowest device just gets the lightest
 * tier. Each tier also has a pixel budget, so a big laptop window costs about
 * what a phone screen does (the browser scales the canvas up). The canvas is sized
 * to the render resolution, shadow maps refresh on alternate frames, and the
 * per-frame work allocates nothing.
 */

const STRIDE = 24; // floats per instance: matrix 16, colour 4, material 4
const MAX_POINTS = 900;

interface Tier {
  /** Render resolution, as a fraction of CSS pixels (capped by the screen's density). */
  scale: number;
  /** At most this many rendered pixels, however big the window. */
  maxPixels: number;
  /** 4x MSAA, or FXAA in the composite (nearly the same look, far cheaper). */
  msaa: boolean;
  shadow: number;
  bloomMax: number;
}
// The first step down keeps full resolution and only swaps MSAA for FXAA, which is
// almost invisible; resolution drops only on phones that can't hold that.
// A phone (412 x 915 CSS px) at 1.25x is about 590k pixels.
const TIERS: Tier[] = [
  { scale: 1.25, maxPixels: 700_000, msaa: true, shadow: 1024, bloomMax: 480 },
  { scale: 1.25, maxPixels: 700_000, msaa: false, shadow: 1024, bloomMax: 480 },
  { scale: 1.0, maxPixels: 480_000, msaa: false, shadow: 1024, bloomMax: 420 },
  { scale: 0.82, maxPixels: 330_000, msaa: false, shadow: 768, bloomMax: 360 },
];
/** A frame (timed with a GPU sync) must fit this to keep a tier. */
const BUDGET_MS = 24;
/** The most time spent choosing a tier before the clip starts. */
const WARMUP_LIMIT_MS = 1200;

type Rgb = [number, number, number];
const lin = linearRgb;
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mul = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (...cs: Rgb[]): Rgb => cs.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0] as Rgb);

// Materials from the design tokens: albedo, roughness, metalness, shader kind (0 wood, 1 marble, 2 gold, 3 velvet, 4 stone).
const MAHOGANY = add3(mul(lin(color.ink[900]), 0.55), mul(lin(color.crimson.deep), 0.25), mul(lin(color.spot.deep), 0.12));
const MATS: Record<Material, { rgb: Rgb; rough: number; metal: number; kind: number }> = {
  wood: { rgb: mul(MAHOGANY, 0.55), rough: 0.32, metal: 0, kind: 0 },
  woodDark: { rgb: mul(MAHOGANY, 0.28), rough: 0.28, metal: 0, kind: 0 },
  marbleA: { rgb: mul(lin(color.ink[950]), 1.5), rough: 0.1, metal: 0, kind: 1 },
  marbleB: { rgb: mul(lin(color.ink[800]), 1.3), rough: 0.1, metal: 0, kind: 1 },
  gold: { rgb: lin(color.spot.DEFAULT), rough: 0.3, metal: 1, kind: 2 },
  velvet: { rgb: mul(lin(color.crimson.deep), 0.22), rough: 0.95, metal: 0, kind: 3 },
  stone: { rgb: mul(lin(color.paper.dim), 0.22), rough: 0.7, metal: 0, kind: 4 },
};
const LIGHT_RGB: Record<'warm' | 'gold' | 'rim', Rgb> = {
  warm: mix(lin(color.paper.DEFAULT), lin(color.spot.soft), 0.35),
  gold: lin(color.spot.soft),
  rim: mix(lin(color.violet.deep), lin(color.crimson.deep), 0.45),
};
const ZERO: Vec3 = [0, 0, 0];
const IDENTITY = mat4();
const ONE: Vec3 = [1, 1, 1];
const SPARK = mul(lin(color.spot.soft), 5);
const EMBER = mix(lin(color.crimson.DEFAULT), lin(color.spot.DEFAULT), 0.3);

/** Deterministic hash, 0..1. */
const h = (a: number, b: number, c = 0) => {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

function boxGeometry() {
  const P: number[] = [];
  const I: number[] = [];
  const faces: [Vec3, Vec3, Vec3][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  for (const [n, u, v] of faces) {
    const base = P.length / 6;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      P.push(n[0] * 0.5 + u[0] * a! * 0.5 + v[0] * b! * 0.5, n[1] * 0.5 + u[1] * a! * 0.5 + v[1] * b! * 0.5, n[2] * 0.5 + u[2] * a! * 0.5 + v[2] * b! * 0.5, ...n);
    }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { P, I };
}

function cylinderGeometry(seg = 20) {
  const P: number[] = [];
  const I: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    P.push(c * 0.5, -0.5, s * 0.5, c, 0, s, c * 0.5, 0.5, s * 0.5, c, 0, s);
  }
  for (let i = 0; i < seg; i++) I.push(i * 2, i * 2 + 1, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 2);
  for (const y of [-0.5, 0.5]) {
    const centre = P.length / 6;
    P.push(0, y, 0, 0, Math.sign(y), 0);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      P.push(Math.cos(a) * 0.5, y, Math.sin(a) * 0.5, 0, Math.sign(y), 0);
    }
    for (let i = 0; i < seg; i++) I.push(centre, centre + 1 + i, centre + 2 + i);
  }
  return { P, I };
}

/** An open cone, apex at the origin, opening down -y to radius 1 at y = -1. */
function coneGeometry(seg = 28) {
  const P: number[] = [];
  const I: number[] = [];
  const k = 1 / Math.SQRT2;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    P.push(0, 0, 0, c * k, k, s * k, c, -1, s, c * k, k, s * k);
  }
  for (let i = 0; i < seg; i++) I.push(i * 2, i * 2 + 1, i * 2 + 3);
  return { P, I };
}

interface MeshBuffers {
  vao: WebGLVertexArrayObject;
  count: number;
  inst: WebGLBuffer | null;
  data: Float32Array;
  /** The same instances sorted nearest first, and the sort keys. */
  sorted: Float32Array;
  keys: Float64Array;
  n: number;
}

export class CourtRenderer {
  private gl: WebGL2RenderingContext;
  private tri: WebGLVertexArrayObject;
  private meshPass: Pass;
  private depthPass: Pass;
  private beamPass: Pass;
  private pointsPass: Pass;
  private bright: Pass;
  private blur: Pass;
  private composite: Pass;
  private hdr: boolean;
  private box: MeshBuffers;
  private cyl: MeshBuffers;
  private cone: { vao: WebGLVertexArrayObject; count: number };
  private points: { vao: WebGLVertexArrayObject; buf: WebGLBuffer; data: Float32Array; n: number };
  private shadows: { fbo: WebGLFramebuffer; tex: WebGLTexture; light: number; vp: Mat4 }[] = [];
  private shadowSize = 0;
  private scene: { ms: WebGLFramebuffer | null; rbs: WebGLRenderbuffer[]; target: Target; depth: WebGLRenderbuffer | null } | null = null;
  private bloom: Record<'b1' | 'b1t' | 'b2' | 'b2t' | 'b3' | 'b3t', Target> | null = null;
  private tier = 0;
  private msaaOk = true;
  private frameTimes: number[] = [];
  private lastFrame = 0;
  private downgradedLive = false;
  private frame = 0;
  private width = 0;
  private height = 0;
  private buffers: WebGLBuffer[] = [];
  private detail: WebGLTexture;
  // Scratch space, reused every frame.
  private tmp = mat4();
  private tmp2 = mat4();
  private par: Record<Exclude<Parent, null>, Mat4> = { scales: mat4(), scalesChain: mat4(), panL: mat4(), panR: mat4(), gavel: mat4() };
  private settled: (Mat4 | null)[] = PIECES.map(() => null);
  private lightInt = new Float32Array(NUM_LIGHTS);
  private lightStatic: { pos: Float32Array; dir: Float32Array; col: Float32Array; cone: Float32Array; basis: { dir: Vec3; a: Vec3; b: Vec3; range: number; tanO: number }[]; beams: (Mat4 | null)[] };

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.hdr = hasFloatTargets(gl);
    this.tri = createScreenTriangle(gl);
    this.meshPass = createPass(gl, MESH_FRAG, MESH_VERT);
    this.depthPass = createPass(gl, DEPTH_FRAG, DEPTH_VERT);
    this.beamPass = createPass(gl, BEAM_FRAG, BEAM_VERT);
    this.pointsPass = createPass(gl, POINTS_FRAG, POINTS_VERT);
    this.bright = createPass(gl, BRIGHT_FRAG);
    this.blur = createPass(gl, BLUR_FRAG);
    this.composite = createPass(gl, COMPOSITE_FRAG);

    const counts = { box: 0, cyl: 0 };
    for (const p of PIECES) counts[p.mesh]++;
    this.box = this.instancedMesh(boxGeometry(), counts.box);
    this.cyl = this.instancedMesh(cylinderGeometry(), counts.cyl);
    const c = coneGeometry();
    this.cone = { vao: this.staticMesh(c.P, c.I), count: c.I.length };
    this.points = this.pointBuffer();
    this.detail = this.detailTex();
    this.lightStatic = this.staticLights();
    this.applyTier(0);
  }

  /** The surface detail texture (tileable, mipmapped). */
  private detailTex() {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, DETAIL_SIZE, DETAIL_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, detailTexture());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  /** Everything about the lights that never changes, worked out once. */
  private staticLights() {
    const pos = new Float32Array(NUM_LIGHTS * 3);
    const dir = new Float32Array(NUM_LIGHTS * 3);
    const col = new Float32Array(NUM_LIGHTS * 3);
    const cone = new Float32Array(NUM_LIGHTS * 2);
    const basis: { dir: Vec3; a: Vec3; b: Vec3; range: number; tanO: number }[] = [];
    const beams: (Mat4 | null)[] = [];
    LIGHTS.forEach((l, i) => {
      const d = sub(l.target, l.pos);
      const range = Math.hypot(...d);
      const n = normalize(d);
      const a = normalize(cross(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const b = cross(n, a);
      const tanO = Math.tan((l.outer * Math.PI) / 180);
      pos.set(l.pos, i * 3);
      dir.set(n, i * 3);
      col.set(LIGHT_RGB[l.color], i * 3);
      cone.set([Math.cos((l.outer * Math.PI) / 180), Math.cos((l.inner * Math.PI) / 180)], i * 2);
      basis.push({ dir: n, a, b, range, tanO });
      // The back light only rims silhouettes; a visible beam would wash the void.
      if (l.color === 'rim') beams.push(null);
      else {
        const R = range * 1.12;
        const r = R * tanO;
        const z = cross(a, n);
        beams.push(new Float32Array([a[0] * r, a[1] * r, a[2] * r, 0, -n[0] * R, -n[1] * R, -n[2] * R, 0, z[0] * r, z[1] * r, z[2] * r, 0, l.pos[0], l.pos[1], l.pos[2], 1]));
      }
    });
    return { pos, dir, col, cone, basis, beams };
  }

  /** Switch quality tier: resolution, anti-aliasing, shadow size, bloom size. */
  private applyTier(i: number) {
    this.tier = Math.min(i, TIERS.length - 1);
    const t = TIERS[this.tier]!;
    if (t.shadow !== this.shadowSize) {
      const gl = this.gl;
      for (const s of this.shadows) {
        gl.deleteFramebuffer(s.fbo);
        gl.deleteTexture(s.tex);
      }
      this.shadows = [];
      this.shadowSize = t.shadow;
      LIGHTS.forEach((l, k) => {
        if (!l.shadow || this.shadows.length >= 2) return;
        const vp = multiply(perspective(l.outer * 2 + 8, 1, 2, 40), lookAt(l.pos, l.target));
        this.shadows.push({ ...this.shadowTarget(t.shadow), light: k, vp });
      });
    }
    this.resize();
  }

  /**
   * Time a few hidden frames of the busiest moment and settle on the best tier
   * this device can hold. It never gives up for slowness: the lowest tier
   * always plays.
   */
  /** Development previews: hold one tier instead of measuring. */
  forceTier(i: number) {
    this.applyTier(i);
    this.downgradedLive = true;
  }

  warmUp(): void {
    const gl = this.gl;
    const probe: CourtShot = { ...courtShot(2.6), fade: 1 }; // drawn black: nothing shows
    const px = new Uint8Array(4);
    const timed = () => {
      const t0 = performance.now();
      this.render(probe, 2.6, false);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU
      return performance.now() - t0;
    };
    const started = performance.now();
    timed(); // shader compiles and first uploads
    timed(); // drivers that compile lazily finish here
    while (this.tier < TIERS.length - 1) {
      // Measuring must not eat into the clip: past this, just take the lightest tier.
      if (performance.now() - started > WARMUP_LIMIT_MS) {
        this.applyTier(TIERS.length - 1);
        return;
      }
      if (Math.min(timed(), timed()) <= BUDGET_MS) return;
      this.applyTier(this.tier + 1);
      timed(); // first frame after a resize is not representative
    }
  }

  private buffer(target: number, data: BufferSource | number, usage: number) {
    const gl = this.gl;
    const b = gl.createBuffer()!;
    gl.bindBuffer(target, b);
    if (typeof data === 'number') gl.bufferData(target, data, usage);
    else gl.bufferData(target, data, usage);
    this.buffers.push(b);
    return b;
  }

  private staticMesh(P: number[], I: number[]) {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    this.buffer(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    this.buffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return vao;
  }

  private instancedMesh(geo: { P: number[]; I: number[] }, max: number): MeshBuffers {
    const gl = this.gl;
    const vao = this.staticMesh(geo.P, geo.I);
    gl.bindVertexArray(vao);
    const data = new Float32Array(Math.max(1, max) * STRIDE);
    const inst = this.buffer(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 6; i++) {
      gl.enableVertexAttribArray(2 + i);
      gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      gl.vertexAttribDivisor(2 + i, 1);
    }
    gl.bindVertexArray(null);
    return { vao, count: geo.I.length, inst, data, sorted: new Float32Array(data.length), keys: new Float64Array(Math.max(1, max)), n: 0 };
  }

  private pointBuffer() {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const data = new Float32Array(MAX_POINTS * 7);
    const buf = this.buffer(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    return { vao, buf, data, n: 0 };
  }

  private shadowTarget(size: number) {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Shadow target unsupported');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }

  private freeScene() {
    const gl = this.gl;
    if (this.scene) {
      if (this.scene.ms) gl.deleteFramebuffer(this.scene.ms);
      for (const rb of this.scene.rbs) gl.deleteRenderbuffer(rb);
      if (this.scene.depth) gl.deleteRenderbuffer(this.scene.depth);
      deleteTarget(gl, this.scene.target);
    }
    if (this.bloom) for (const t of Object.values(this.bloom)) deleteTarget(gl, t);
    this.scene = null;
    this.bloom = null;
  }

  private resize() {
    const gl = this.gl;
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const t = TIERS[this.tier]!;
    // Render, and present, at the tier's resolution: the browser scales the canvas up.
    const scale = Math.min(t.scale, window.devicePixelRatio || 1, Math.sqrt(t.maxPixels / Math.max(1, cssW * cssH)));
    const w = Math.max(160, Math.round(cssW * scale));
    const hh = Math.max(160, Math.round(cssH * scale));
    this.width = w;
    this.height = hh;
    this.canvas.width = w;
    this.canvas.height = hh;
    this.freeScene();
    const target = createTarget(gl, w, hh, this.hdr);
    let ms: WebGLFramebuffer | null = null;
    const rbs: WebGLRenderbuffer[] = [];
    let depth: WebGLRenderbuffer | null = null;
    const samples = t.msaa && this.msaaOk ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number) : 0;
    if (samples > 1) {
      ms = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
      const colorRb = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, colorRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, this.hdr ? gl.RGBA16F : gl.RGBA8, w, hh);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colorRb);
      const depthRb = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, hh);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
      rbs.push(colorRb, depthRb);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(ms);
        for (const rb of rbs) gl.deleteRenderbuffer(rb);
        rbs.length = 0;
        ms = null;
        this.msaaOk = false;
      }
    }
    if (!ms) {
      depth = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, hh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.scene = { ms, rbs, target, depth };
    const half = (n: number, k: number) => Math.max(8, Math.round(n / k));
    // Bloom from a capped size: it is blurred anyway.
    const bw = Math.min(w, t.bloomMax);
    const bh = Math.round((bw * hh) / w);
    this.bloom = {
      b1: createTarget(gl, half(bw, 2), half(bh, 2), this.hdr),
      b1t: createTarget(gl, half(bw, 2), half(bh, 2), this.hdr),
      b2: createTarget(gl, half(bw, 4), half(bh, 4), this.hdr),
      b2t: createTarget(gl, half(bw, 4), half(bh, 4), this.hdr),
      b3: createTarget(gl, half(bw, 8), half(bh, 8), this.hdr),
      b3t: createTarget(gl, half(bw, 8), half(bh, 8), this.hdr),
    };
  }

  /** If frames still run slow mid-clip, step down one tier (once: resizing costs a hitch). */
  private adapt(now: number) {
    if (this.lastFrame) this.frameTimes.push(now - this.lastFrame);
    this.lastFrame = now;
    if (this.downgradedLive || this.frameTimes.length < 15) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    this.frameTimes = [];
    if (median > 28 && this.tier < TIERS.length - 1) {
      this.downgradedLive = true;
      this.applyTier(this.tier + 1);
    }
  }

  private parents(shot: CourtShot) {
    const P = this.par;
    const y = shot.scalesY;
    const ex = 1.3 * Math.cos(shot.swing);
    const ey = 1.3 * Math.sin(shot.swing);
    compose([SCALES_AT[0], y, SCALES_AT[2]], ZERO, ONE, P.scalesChain);
    compose([SCALES_AT[0], y, SCALES_AT[2]], [0, 0, shot.swing], ONE, P.scales);
    compose([SCALES_AT[0] - ex, y - ey, SCALES_AT[2]], ZERO, ONE, P.panL);
    compose([SCALES_AT[0] + ex, y + ey, SCALES_AT[2]], ZERO, ONE, P.panR);
    compose(GAVEL_PIVOT, [0, 0, -shot.gavel], ONE, P.gavel);
    return P;
  }

  /** Lay out every visible piece and particle for time t, without allocating. */
  private build(shot: CourtShot, t: number) {
    const par = this.parents(shot);
    this.box.n = 0;
    this.cyl.n = 0;
    const pts = this.points.data;
    let np = 0;
    const point = (x: number, y: number, z: number, c: Rgb, k: number, size: number) => {
      if (np >= MAX_POINTS) return;
      const o = np * 7;
      pts[o] = x;
      pts[o + 1] = y;
      pts[o + 2] = z;
      pts[o + 3] = c[0] * k;
      pts[o + 4] = c[1] * k;
      pts[o + 5] = c[2] * k;
      pts[o + 6] = size;
      np++;
    };
    for (let idx = 0; idx < PIECES.length; idx++) {
      const p = PIECES[idx]!;
      if (t < p.start) continue;
      const mb = p.mesh === 'box' ? this.box : this.cyl;
      const since = t - landTime(p);
      let world: Mat4;
      let glow = 0;
      const cached = this.settled[idx];
      if (cached) world = cached;
      else {
        const pose = piecePose(p, t)!;
        glow = pose.glow;
        const local = p.to ? rod(pose.pos, p.to, p.size[0], this.tmp) : compose(pose.pos, pose.rot, pose.size, this.tmp);
        world = p.parent ? multiply(par[p.parent], local, this.tmp2) : local;
        // Once a piece has settled and cooled, its matrix never changes again.
        if (!p.parent && since > 1) this.settled[idx] = new Float32Array(world);
      }
      const m = MATS[p.mat];
      const o = mb.n * STRIDE;
      const d = mb.data;
      d.set(world, o);
      d[o + 16] = m.rgb[0];
      d[o + 17] = m.rgb[1];
      d[o + 18] = m.rgb[2];
      d[o + 19] = p.mesh === 'box' ? 1 : 0; // bevelled edges for boxes
      d[o + 20] = m.rough;
      d[o + 21] = m.metal;
      d[o + 22] = m.kind;
      d[o + 23] = glow;
      mb.n++;
      // Sparks where it locks in.
      if (p.sparks && since >= 0 && since < 0.6) {
        const top = p.pos[1] + p.size[1] / 2;
        const b = p.parent ? par[p.parent] : null;
        const tx = b ? b[0]! * p.pos[0] + b[4]! * top + b[8]! * p.pos[2] + b[12]! : p.pos[0];
        const ty = b ? b[1]! * p.pos[0] + b[5]! * top + b[9]! * p.pos[2] + b[13]! : top;
        const tz = b ? b[2]! * p.pos[0] + b[6]! * top + b[10]! * p.pos[2] + b[14]! : p.pos[2];
        const life = 1 - since / 0.6;
        for (let s = 0; s < p.sparks * 2; s++) {
          const vx = (h(idx, s, 1) - 0.5) * 6;
          const vy = 1.5 + h(idx, s, 2) * 3.5;
          const vz = (h(idx, s, 3) - 0.5) * 6;
          point(tx + vx * since, Math.max(0.02, ty + vy * since - 4.9 * since * since), tz + vz * since, SPARK, life, 0.05 * life + 0.01);
        }
      }
    }
    // Dust hanging in each beam.
    const L = this.lightStatic.basis;
    for (let i = 0; i < LIGHTS.length; i++) {
      const level = shot.lights[i]!;
      if (level <= 0 || LIGHTS[i]!.color === 'rim') continue;
      const l = LIGHTS[i]!;
      const { dir, a, b, range, tanO } = L[i]!;
      const c = LIGHT_RGB[l.color];
      const k = 0.6 * Math.min(level, 1.4);
      for (let q = 0; q < 40; q++) {
        const u = 0.3 + 0.68 * h(i, q, 4);
        const rad = u * range * tanO * Math.sqrt(h(i, q, 5)) * 0.85;
        const ang = h(i, q, 6) * Math.PI * 2 + t * 0.15;
        const ca = Math.cos(ang) * rad;
        const sa = Math.sin(ang) * rad;
        const drift = Math.sin(t * 0.6 + q) * 0.12;
        point(l.pos[0] + dir[0] * u * range + a[0] * ca + b[0] * sa, l.pos[1] + dir[1] * u * range + a[1] * ca + b[1] * sa + drift, l.pos[2] + dir[2] * u * range + a[2] * ca + b[2] * sa, c, k, 0.03);
      }
    }
    // Embers drifting up through the dark.
    const emberIn = Math.min(1, Math.max(0, (t - 0.5) / 0.6));
    if (emberIn > 0) {
      for (let q = 0; q < 50; q++) {
        const y = (h(q, 7) * 9 + t * (0.5 + h(q, 8))) % 9;
        point((h(q, 9) - 0.5) * 13 + Math.sin(t + q) * 0.3, y, 6 - h(q, 10) * 19, EMBER, emberIn * (1 - y / 9) * 1.6, 0.045);
      }
    }
    this.points.n = np;
  }

  private draw(pass: Pass, target: Target | null, setup: (u: (n: string) => WebGLUniformLocation | null) => void) {
    const gl = this.gl;
    gl.useProgram(pass.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.width, target ? target.h : this.height);
    setup(pass.uniform);
    gl.bindVertexArray(this.tri);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bind(unit: number, tex: WebGLTexture | null) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private drawMeshes() {
    const gl = this.gl;
    for (const mb of [this.box, this.cyl]) {
      if (!mb.n) continue;
      gl.bindVertexArray(mb.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, mb.count, gl.UNSIGNED_SHORT, 0, mb.n);
    }
  }

  render(shot: CourtShot, time: number, adaptive = true) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    if (adaptive) this.adapt(performance.now());
    this.build(shot, time);
    // Upload instances nearest first: the GPU's depth test then skips shading
    // whatever is hidden behind them (same picture, much less work).
    const [cx, cy, cz] = shot.cam.pos;
    for (const mb of [this.box, this.cyl]) {
      const { data, sorted, keys, n } = mb;
      for (let i = 0; i < n; i++) {
        const o = i * STRIDE;
        const dx = data[o + 12]! - cx;
        const dy = data[o + 13]! - cy;
        const dz = data[o + 14]! - cz;
        keys[i] = Math.floor((dx * dx + dy * dy + dz * dz) * 64) * 1024 + i;
      }
      const order = keys.subarray(0, n).sort();
      for (let i = 0; i < n; i++) {
        const src = (order[i]! % 1024) * STRIDE;
        sorted.set(data.subarray(src, src + STRIDE), i * STRIDE);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, mb.inst);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sorted, 0, n * STRIDE);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.points.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.points.data, 0, this.points.n * 7);

    const aspect = this.width / this.height;
    this.frame++;
    const view = lookAt(shot.cam.pos, shot.cam.target, shot.cam.roll);
    const proj = perspective(shot.cam.fov, aspect, 0.1, 80);
    const viewProj = multiply(proj, view);
    const hdrScale = this.hdr ? 1 : 0.25;
    gl.disable(gl.CULL_FACE);

    // 1. Shadow maps for the key spotlights: one refreshes per frame, in turn
    //    (both on warm-up), which halves their cost without visible lag.
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(this.depthPass.program);
    this.shadows.forEach((s, k) => {
      if (adaptive && this.shadows.length > 1 && this.frame % this.shadows.length !== k) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      if (shot.lights[s.light]! <= 0) return;
      gl.uniformMatrix4fv(this.depthPass.uniform('uViewProj'), false, s.vp);
      this.drawMeshes();
    });

    // 2. The court.
    const S = this.scene!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.ms ?? S.target.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const mp = this.meshPass;
    gl.useProgram(mp.program);
    const u = mp.uniform;
    gl.uniformMatrix4fv(u('uViewProj'), false, viewProj);
    gl.uniform3fv(u('uCamPos'), shot.cam.pos);
    gl.uniform1f(u('uTime'), time);
    const LS = this.lightStatic;
    for (let i = 0; i < LIGHTS.length; i++) this.lightInt[i] = shot.lights[i]! * LIGHTS[i]!.intensity;
    gl.uniform3fv(u('uLPos'), LS.pos);
    gl.uniform3fv(u('uLDir'), LS.dir);
    gl.uniform3fv(u('uLCol'), LS.col);
    gl.uniform2fv(u('uLCone'), LS.cone);
    gl.uniform1fv(u('uLInt'), this.lightInt);
    gl.uniform1i(u('uShadowIdx0'), this.shadows[0]?.light ?? -1);
    gl.uniform1i(u('uShadowIdx1'), this.shadows[1]?.light ?? -1);
    gl.uniformMatrix4fv(u('uShadowVP0'), false, this.shadows[0]?.vp ?? IDENTITY);
    gl.uniformMatrix4fv(u('uShadowVP1'), false, this.shadows[1]?.vp ?? IDENTITY);
    this.bind(0, this.shadows[0]?.tex ?? null);
    this.bind(1, this.shadows[1]?.tex ?? null);
    this.bind(2, this.detail);
    gl.uniform1i(u('uShadow0'), 0);
    gl.uniform1i(u('uShadow1'), 1);
    gl.uniform1i(u('uDetail'), 2);
    gl.uniform1f(u('uShadowTexel'), 1 / this.shadowSize);
    gl.uniform1f(u('uShock'), shot.shock);
    gl.uniform3fv(u('uStrike'), STRIKE);
    gl.uniform1f(u('uHdrScale'), hdrScale);
    this.drawMeshes();

    // Light beams and particles, added on top.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    const bp = this.beamPass;
    gl.useProgram(bp.program);
    gl.uniformMatrix4fv(bp.uniform('uViewProj'), false, viewProj);
    gl.uniform3fv(bp.uniform('uCamPos'), shot.cam.pos);
    gl.uniform1f(bp.uniform('uTime'), time);
    gl.uniform1f(bp.uniform('uHdrScale'), hdrScale);
    gl.uniform1i(bp.uniform('uDetail'), 2);
    // One side of each cone at double strength looks the same as both sides, at half the cost.
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.bindVertexArray(this.cone.vao);
    LIGHTS.forEach((l, i) => {
      const level = shot.lights[i]!;
      const model = LS.beams[i];
      if (level <= 0 || !model) return;
      gl.uniformMatrix4fv(bp.uniform('uModel'), false, model);
      gl.uniform3fv(bp.uniform('uColor'), LIGHT_RGB[l.color]);
      gl.uniform1f(bp.uniform('uInt'), level * l.intensity);
      gl.drawElements(gl.TRIANGLES, this.cone.count, gl.UNSIGNED_SHORT, 0);
    });
    gl.disable(gl.CULL_FACE);
    if (this.points.n) {
      const pp = this.pointsPass;
      gl.useProgram(pp.program);
      gl.uniformMatrix4fv(pp.uniform('uViewProj'), false, viewProj);
      gl.uniform1f(pp.uniform('uPxScale'), this.height / (2 * Math.tan((shot.cam.fov * Math.PI) / 360)));
      gl.uniform1f(pp.uniform('uHdrScale'), hdrScale);
      gl.bindVertexArray(this.points.vao);
      gl.drawArrays(gl.POINTS, 0, this.points.n);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // Resolve anti-aliasing.
    if (S.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.ms);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.target.fbo);
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    // 3. Bloom.
    const Bl = this.bloom!;
    this.bind(0, S.target.tex);
    this.draw(this.bright, Bl.b1, (uu) => {
      gl.uniform1i(uu('uSrc'), 0);
      gl.uniform2f(uu('uTexel'), 1 / S.target.w, 1 / S.target.h);
      gl.uniform1f(uu('uInvHdr'), 1 / hdrScale);
      gl.uniform1f(uu('uThreshold'), 1.2);
    });
    const blurInto = (src: Target, tmp: Target) => {
      this.bind(0, src.tex);
      this.draw(this.blur, tmp, (uu) => {
        gl.uniform1i(uu('uSrc'), 0);
        gl.uniform2f(uu('uDir'), 1 / src.w, 0);
      });
      this.bind(0, tmp.tex);
      this.draw(this.blur, src, (uu) => {
        gl.uniform1i(uu('uSrc'), 0);
        gl.uniform2f(uu('uDir'), 0, 1 / src.h);
      });
    };
    const downInto = (src: Target, dst: Target) => {
      this.bind(0, src.tex);
      this.draw(this.bright, dst, (uu) => {
        gl.uniform1i(uu('uSrc'), 0);
        gl.uniform2f(uu('uTexel'), 1 / src.w, 1 / src.h);
        gl.uniform1f(uu('uInvHdr'), 1);
        gl.uniform1f(uu('uThreshold'), 0);
      });
    };
    blurInto(Bl.b1, Bl.b1t);
    downInto(Bl.b1, Bl.b2);
    blurInto(Bl.b2, Bl.b2t);
    downInto(Bl.b2, Bl.b3);
    blurInto(Bl.b3, Bl.b3t);

    // 4. Composite to the screen.
    const sp = multiply(viewProj, compose(STRIKE, [0, 0, 0], [1, 1, 1]));
    const sw = sp[15]!;
    const strikeUv: [number, number] = sw > 0.1 ? [0.5 + (sp[12]! / sw) * 0.5, 0.5 + (sp[13]! / sw) * 0.5] : [0.5, 0.5];
    this.bind(0, S.target.tex);
    this.bind(1, Bl.b1.tex);
    this.bind(2, Bl.b2.tex);
    this.bind(3, Bl.b3.tex);
    this.draw(this.composite, null, (uu) => {
      gl.uniform1i(uu('uScene'), 0);
      gl.uniform1i(uu('uB1'), 1);
      gl.uniform1i(uu('uB2'), 2);
      gl.uniform1i(uu('uB3'), 3);
      gl.uniform2f(uu('uRes'), this.width, this.height);
      gl.uniform1f(uu('uFxaa'), S.ms ? 0 : 1);
      gl.uniform1f(uu('uInvHdr'), 1 / hdrScale);
      gl.uniform1f(uu('uTime'), time);
      gl.uniform1f(uu('uAberr'), shot.aberration);
      gl.uniform1f(uu('uImpact'), shot.impact);
      gl.uniform1f(uu('uFlash'), shot.flash);
      gl.uniform1f(uu('uFade'), shot.fade);
      gl.uniform1f(uu('uShock'), shot.shock);
      gl.uniform1f(uu('uInk'), shot.ink);
      gl.uniform2f(uu('uShockUv'), strikeUv[0], strikeUv[1]);
    });
  }

  dispose() {
    const gl = this.gl;
    this.freeScene();
    for (const s of this.shadows) {
      gl.deleteFramebuffer(s.fbo);
      gl.deleteTexture(s.tex);
    }
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteTexture(this.detail);
    for (const p of [this.meshPass, this.depthPass, this.beamPass, this.pointsPass, this.bright, this.blur, this.composite]) gl.deleteProgram(p.program);
    // Hand the GPU memory back straight away on phones.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
