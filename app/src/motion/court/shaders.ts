import { color } from '../../design/tokens';
import { glslColor } from './glkit';

/**
 * GLSL for "Domain Expansion: Deadly Sentencing". The courtroom is ordinary
 * instanced geometry (cheap to compile and draw on phones), lit only by
 * theatre spotlights with soft shadows, volumetric beams and dust, then
 * bloomed and graded. Surface detail (marble veins, wood grain) comes from a
 * small texture made once at start, not from per-pixel noise. Every pass
 * scrubs invalid values, so a GPU glitch can't smear into black blocks.
 * Colours come from the design tokens (linear light).
 */

export const NUM_LIGHTS = 6;

const palette = `
#define INK950 ${glslColor(color.ink[950])}
#define INK900 ${glslColor(color.ink[900])}
#define INK800 ${glslColor(color.ink[800])}
#define INK600 ${glslColor(color.ink[600])}
#define PAPER ${glslColor(color.paper.DEFAULT)}
#define PAPER_DIM ${glslColor(color.paper.dim)}
#define GOLD ${glslColor(color.spot.DEFAULT)}
#define GOLD_SOFT ${glslColor(color.spot.soft)}
#define CRIMSON ${glslColor(color.crimson.DEFAULT)}
#define CRIMSON_DEEP ${glslColor(color.crimson.deep)}
#define VIOLET_DEEP ${glslColor(color.violet.deep)}
`;

const noise = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise2(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

const instanceAttribs = `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 iM0;
layout(location = 3) in vec4 iM1;
layout(location = 4) in vec4 iM2;
layout(location = 5) in vec4 iM3;
layout(location = 6) in vec4 iColor;
layout(location = 7) in vec4 iMat;
`;

export const MESH_VERT = `#version 300 es
precision highp float;
${instanceAttribs}
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
out vec4 vColor;
out vec4 vMat;
out vec3 vUnit;
out vec3 vScale;
out vec3 vLocalN;
out vec3 vAxX;
out vec3 vAxY;
out vec3 vAxZ;
void main() {
  mat4 M = mat4(iM0, iM1, iM2, iM3);
  vec4 w = M * vec4(aPos, 1.0);
  vWorld = w.xyz;
  mat3 N = transpose(inverse(mat3(M)));
  vNormal = normalize(N * aNormal);
  vScale = vec3(length(M[0].xyz), length(M[1].xyz), length(M[2].xyz));
  vLocal = aPos * vScale;
  vUnit = aPos;
  vLocalN = aNormal;
  vAxX = normalize(N[0]);
  vAxY = normalize(N[1]);
  vAxZ = normalize(N[2]);
  vColor = iColor;
  vMat = iMat;
  gl_Position = uViewProj * w;
}`;

export const DEPTH_VERT = `#version 300 es
precision highp float;
${instanceAttribs}
uniform mat4 uViewProj;
void main() {
  gl_Position = uViewProj * mat4(iM0, iM1, iM2, iM3) * vec4(aPos, 1.0);
}`;

export const DEPTH_FRAG = `#version 300 es
precision mediump float;
void main() {}`;

export const MESH_FRAG = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
in vec4 vColor;
in vec4 vMat;
in vec3 vUnit;
in vec3 vScale;
in vec3 vLocalN;
in vec3 vAxX;
in vec3 vAxY;
in vec3 vAxZ;
out vec4 fragColor;

uniform vec3 uCamPos;
uniform float uTime;
uniform vec3 uLPos[${NUM_LIGHTS}];
uniform vec3 uLDir[${NUM_LIGHTS}];
uniform vec3 uLCol[${NUM_LIGHTS}];
uniform vec2 uLCone[${NUM_LIGHTS}];
uniform float uLInt[${NUM_LIGHTS}];
uniform int uShadowIdx0;
uniform int uShadowIdx1;
uniform mat4 uShadowVP0;
uniform mat4 uShadowVP1;
uniform sampler2DShadow uShadow0;
uniform sampler2DShadow uShadow1;
uniform float uShadowTexel;
uniform float uShock;
uniform vec3 uStrike;
uniform float uHdrScale;
uniform sampler2D uDetail; // r marble veins, g wood grain, b stone, a mottling (tileable)
${palette}

float pcf(sampler2DShadow s, mat4 vp, vec3 p) {
  vec4 lp = vp * vec4(p, 1.0);
  if (lp.w <= 0.001) return 1.0;
  vec3 c = lp.xyz / lp.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float z = c.z - 0.0008;
  float o = uShadowTexel * 1.25;
  return 0.25 * (textureLod(s, vec3(c.xy + vec2(-o, -o), z), 0.0) + textureLod(s, vec3(c.xy + vec2(o, -o), z), 0.0)
               + textureLod(s, vec3(c.xy + vec2(-o, o), z), 0.0) + textureLod(s, vec3(c.xy + vec2(o, o), z), 0.0));
}

void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // Bevelled edges (boxes only): bend the normal toward the neighbouring face near each edge,
  // so edges catch the light like rounded, machined corners instead of razor-flat planes.
  if (vColor.a > 0.5) {
    vec3 dist = (0.5 - abs(vUnit)) * vScale + abs(vLocalN) * 100.0;
    float e = min(dist.x, min(dist.y, dist.z));
    vec3 adj = dist.x <= e ? vAxX * sign(vUnit.x) : (dist.y <= e ? vAxY * sign(vUnit.y) : vAxZ * sign(vUnit.z));
    float bevel = smoothstep(0.045, 0.0, e);
    n = normalize(mix(n, normalize(n + adj), bevel));
  }
  vec3 V = normalize(uCamPos - vWorld);
  float kind = vMat.z;
  vec3 alb = vColor.rgb;
  float rough = vMat.x;
  float metal = vMat.y;

  // Surface detail so nothing reads as a flat fill.
  if (kind < 0.5) {
    // Lacquered wood: grain along the plank.
    alb *= 0.7 + 0.6 * texture(uDetail, vec2((vLocal.x + vLocal.z) * 0.22, vLocal.y * 0.45 + vLocal.z * 0.07)).g;
  } else if (kind < 1.5) {
    // Polished marble: veins that run across tiles.
    vec4 m = texture(uDetail, vWorld.xz * 0.11);
    alb = mix(alb * (0.85 + 0.3 * m.a), PAPER_DIM * 0.12, m.r * 0.8);
  } else if (kind > 3.5) {
    // Stone: weathered.
    alb *= 0.7 + 0.5 * texture(uDetail, vLocal.xy * 0.35 + vLocal.z * 0.2).b;
  }

  float shin = mix(6.0, 220.0, pow(1.0 - rough, 2.0));
  vec3 F0 = mix(vec3(0.04), alb, metal);
  // Very little ambient: the court lives in the dark. A faint cool fill from the
  // camera's side keeps unlit wood from reading as flat black slabs.
  vec3 col = alb * mix(INK950, INK800, n.y * 0.5 + 0.5) * 0.18;
  col += alb * VIOLET_DEEP * 0.22 * max(dot(n, normalize(V + vec3(0.0, 0.6, 0.0))), 0.0);

  for (int i = 0; i < ${NUM_LIGHTS}; i++) {
    if (uLInt[i] <= 0.0) continue;
    vec3 Lv = uLPos[i] - vWorld;
    float d = length(Lv);
    vec3 L = Lv / d;
    float cone = smoothstep(uLCone[i].x, uLCone[i].y, dot(-L, uLDir[i]));
    if (cone <= 0.0) continue;
    float ndl = max(dot(n, L), 0.0);
    float sh = 1.0;
    if (i == uShadowIdx0) sh = pcf(uShadow0, uShadowVP0, vWorld + n * 0.03);
    else if (i == uShadowIdx1) sh = pcf(uShadow1, uShadowVP1, vWorld + n * 0.03);
    vec3 radiance = uLCol[i] * uLInt[i] * cone * sh * (180.0 / (d * d + 10.0));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), shin) * (shin + 8.0) / 25.0;
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    col += radiance * ndl * (alb * (1.0 - metal) + F * spec);
  }

  if (kind > 2.5 && kind < 3.5) col += alb * 0.6 * pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.4; // velvet sheen
  float edge = pow(1.0 - max(dot(n, V), 0.0), 2.0);
  // Metal catches a little of the dark room and the beams.
  col += F0 * metal * (0.035 + 0.12 * edge);
  // Gold energy while a piece flies in, and the flash when it locks.
  col += (GOLD_SOFT * 0.6 + GOLD * 3.0 * edge) * vMat.w;
  // Contact darkening where things meet the floor.
  if (kind != 1.0) col *= mix(0.45, 1.0, smoothstep(0.0, 0.7, vWorld.y));

  // The gavel's shockwave races across the floor and up the walls.
  if (uShock >= 0.0) {
    float R = uShock * 26.0;
    float k = pow(1.0 - uShock, 1.5);
    float dF = abs(length(vWorld.xz - uStrike.xz) - R);
    col += (PAPER * 6.0 * exp(-dF * 6.0) + GOLD * 2.0 * exp(-dF * 1.2)) * k * smoothstep(0.3, 0.0, vWorld.y);
    col += GOLD_SOFT * 2.0 * exp(-abs(length(vWorld - uStrike) - R) * 3.0) * k;
  }

  float dist = length(uCamPos - vWorld);
  col = mix(col, INK950 * 0.03, 1.0 - exp(-dist * 0.03));
  // Never write an invalid or runaway value: bloom would smear it into a block.
  col = clamp(col, 0.0, 64.0);
  if (any(isnan(col))) col = vec3(0.0);
  fragColor = vec4(col * uHdrScale, 1.0);
}`;

export const BEAM_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec3 vWorld;
out vec3 vNormal;
out float vAlong;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vAlong = -aPos.y;
  gl_Position = uViewProj * w;
}`;

export const BEAM_FRAG = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vNormal;
in float vAlong;
out vec4 fragColor;
uniform vec3 uCamPos;
uniform vec3 uColor;
uniform float uInt;
uniform float uTime;
uniform float uHdrScale;
uniform sampler2D uDetail;
void main() {
  float facing = abs(dot(normalize(vNormal), normalize(uCamPos - vWorld)));
  float a = pow(clamp(facing, 0.0, 1.0), 2.2) * pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.3) * smoothstep(0.0, 0.12, vAlong);
  float dust = 0.55 + 0.45 * texture(uDetail, vWorld.xz * 0.12 + vec2(0.0, uTime * 0.05)).a * (0.6 + 0.4 * texture(uDetail, vWorld.xy * 0.2 - uTime * 0.03).b);
  vec3 c = uColor * uInt * a * dust * 0.16;
  if (any(isnan(c))) c = vec3(0.0);
  fragColor = vec4(c * uHdrScale, 1.0);
}`;

export const POINTS_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aCol;
uniform mat4 uViewProj;
uniform float uPxScale;
out vec3 vCol;
void main() {
  vec4 c = uViewProj * vec4(aPos, 1.0);
  gl_Position = c;
  gl_PointSize = clamp(aCol.a * uPxScale / max(c.w, 0.1), 1.0, 12.0);
  vCol = aCol.rgb;
}`;

export const POINTS_FRAG = `#version 300 es
precision mediump float;
in vec3 vCol;
out vec4 fragColor;
uniform float uHdrScale;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d));
  fragColor = vec4(vCol * a * a * uHdrScale, 1.0);
}`;

export const BRIGHT_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uInvHdr;
uniform float uThreshold;
void main() {
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture(uSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture(uSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture(uSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25 * uInvHdr;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = clamp(c, 0.0, 64.0);
  float l = max(c.r, max(c.g, c.b));
  float knee = 0.5;
  float s = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  s = s * s / (4.0 * knee + 1e-4);
  fragColor = vec4(c * max(s, l - uThreshold) / max(l, 1e-4), 1.0);
}`;

export const BLUR_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uDir;
void main() {
  vec3 c = texture(uSrc, vUv).rgb * 0.2270270;
  c += (texture(uSrc, vUv + uDir * 1.3846154).rgb + texture(uSrc, vUv - uDir * 1.3846154).rgb) * 0.3162162;
  c += (texture(uSrc, vUv + uDir * 3.2307692).rgb + texture(uSrc, vUv - uDir * 3.2307692).rgb) * 0.0702703;
  fragColor = vec4(c, 1.0);
}`;

export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene, uB1, uB2, uB3;
uniform vec2 uRes;
uniform float uFxaa;
uniform float uInvHdr, uTime, uAberr, uImpact, uFlash, uFade, uShock, uInk;
uniform vec2 uShockUv;
${palette}
${noise}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSrgb(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }

// FXAA: smooths jagged edges in one pass (used when the phone can't afford 4x MSAA).
float lumaOf(vec3 c) { c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sceneAA(vec2 uv) {
  vec2 px = 1.0 / uRes;
  vec3 m = texture(uScene, uv).rgb;
  float lM = lumaOf(m);
  float lNW = lumaOf(texture(uScene, uv + vec2(-1.0, -1.0) * px).rgb);
  float lNE = lumaOf(texture(uScene, uv + vec2(1.0, -1.0) * px).rgb);
  float lSW = lumaOf(texture(uScene, uv + vec2(-1.0, 1.0) * px).rgb);
  float lSE = lumaOf(texture(uScene, uv + vec2(1.0, 1.0) * px).rgb);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return m;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * px;
  vec3 a = 0.5 * (texture(uScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(uScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(uScene, uv - dir * 0.5).rgb + texture(uScene, uv + dir * 0.5).rgb);
  float lB = lumaOf(b);
  return (lB < lMin || lB > lMax) ? a : b;
}

// The ordinary world before the domain closes over it: a dim manga page with speed lines and screentone.
vec3 page(vec2 uv, float aspect) {
  vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
  float a = atan(d.y, d.x);
  float lines = step(0.88, hash12(vec2(floor(a * 80.0), 7.0))) * smoothstep(0.15, 0.75, length(d));
  vec2 g = fract(uv * uRes / 7.0) - 0.5;
  float dots = smoothstep(0.32, 0.22, length(g)) * 0.05;
  return toSrgb(INK800) + toSrgb(PAPER_DIM) * (lines * 0.22 + dots);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 d = uv - uShockUv;
  d.x *= aspect;
  float r = length(d);
  if (uShock >= 0.0) {
    float x = (r - uShock * 1.7) / 0.11;
    float amt = exp(-x * x) * (1.0 - uShock) * 0.04;
    vec2 dir = d / max(r, 1e-4);
    dir.x /= aspect;
    uv -= dir * amt;
  }
  vec3 col = uFxaa > 0.5 ? sceneAA(uv) : texture(uScene, uv).rgb;
  // Colour fringing only where it shows: the strike and the domain closing.
  if (uAberr > 0.002) {
    vec2 off = (uv - 0.5) * uAberr * 2.0;
    col.r = texture(uScene, uv + off).r;
    col.b = texture(uScene, uv - off).b;
  }
  col *= uInvHdr;
  col += texture(uB1, uv).rgb * 0.22 + texture(uB2, uv).rgb * 0.3 + texture(uB3, uv).rgb * 0.42;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  col = clamp(col, 0.0, 64.0);
  col = toSrgb(aces(col * 0.95));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  // Crushed, cold shadows; warm highlights.
  col = mix(col * vec3(0.85, 0.85, 1.05), col, smoothstep(0.05, 0.6, l));
  col = mix(vec3(l), col, 1.12);
  vec2 vc = vUv - 0.5;
  col *= 1.0 - dot(vc * vec2(1.4, 0.95), vc * vec2(1.4, 0.95)) * 1.25;

  // The domain closing: ink spreads from the centre with a burning crimson edge.
  if (uInk < 10.0) {
    float rr = length((vUv - 0.5) * vec2(aspect, 1.0));
    float e = rr - uInk + (fbm2(vUv * 7.0 + uTime * 0.6) - 0.5) * 0.18;
    if (e > 0.0) col = page(vUv, aspect);
    col += toSrgb(CRIMSON) * exp(-abs(e) * 35.0) * 0.9 + toSrgb(GOLD) * exp(-abs(e) * 120.0) * 0.6;
  }

  // Speed lines bursting from the strike.
  if (uShock >= 0.0 && uShock < 0.3) {
    float a = atan(d.y, d.x);
    float line = step(0.86, hash12(vec2(floor(a * 110.0), 3.0))) * smoothstep(0.12, 0.5, r);
    col = mix(col, toSrgb(PAPER), line * (1.0 - uShock / 0.3) * 0.7);
  }
  col += (hash12(vUv * uRes + fract(uTime * 7.0) * 311.0) - 0.5) * 0.05;
  if (uImpact > 0.5) {
    // The anime impact frame: a hard negative in ink, paper and crimson.
    col = l > 0.34 ? toSrgb(INK950) : (l > 0.2 ? toSrgb(CRIMSON) : toSrgb(PAPER));
  }
  col = mix(col, toSrgb(PAPER), uFlash);
  col *= 1.0 - uFade;
  float bar = 0.05;
  col *= step(bar, vUv.y) * step(vUv.y, 1.0 - bar);
  fragColor = vec4(col, 1.0);
}`;
