// GLSL for the "liquid neon club" background. One source, compiled as GLSL ES 3.00
// (WebGL2) or 1.00 (WebGL1); OCTAVES is baked per quality level.
//
// Layers (all in linear light, tone-mapped at the end):
//   domain-warped FBM smoke   → faint colored density with a marbled sheen (split-toned shadows)
//   plasma bands              → wide out-of-focus glow bands behind the ribbons
//   liquid-neon ribbons       → iso-lines of a smooth stripe field: hot core, bloom, halo
//   light leaks               → magenta haze top-left, cyan caught in dense smoke on the right
//   stage glow + moving heads → from bottom-center, swell with bass, flash on beats
//   bass rings                → wavefronts born on every beat, lighting smoke and ribbons
//   motes                     → dust drifting up through the light, twinkling with the treble
//   exposure (intensity), vignette, darker top for the UI, dither

export const VERTEX_ES3 = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

export const VERTEX_ES1 = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const HEADER_ES3 = `#version 300 es
precision highp float;
out vec4 outColor;
#define FRAG_COLOR outColor
`

const HEADER_ES1 = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define FRAG_COLOR gl_FragColor
`

const BODY = /* glsl */ `
uniform vec2 uRes;       // internal resolution (px)
uniform float uPx;       // css px per internal px
uniform float uTime;     // flow time (speed follows the music)
uniform float uClock;    // wall clock (s), for breathing / twinkles / dither
uniform vec4 uAudio;     // bass, mid, treble, energy (smoothed 0..1)
uniform vec4 uPulse;     // flash, presence, intensity, motion (1 normal, <1 reduced)
uniform vec4 uRingAge;   // seconds since each ring was born
uniform vec4 uRingAmp;   // ring strengths (0 = unused)
uniform vec3 uColA;      // accents, linear RGB
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uShadeA;    // shadow tones (split toning), linear RGB
uniform vec3 uShadeB;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 vnoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 a = hash22(i);
  vec2 b = hash22(i + vec2(1.0, 0.0));
  vec2 c = hash22(i + vec2(0.0, 1.0));
  vec2 d = hash22(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

// x = full FBM, y = only the first 2 octaves (smooth, for the ribbons).
vec2 fbmPair(vec2 p) {
  float s = 0.0;
  float low = 0.0;
  float a = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    s += a * vnoise(p);
    if (i == 1) low = s;
    p = ROT * p * 2.02 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return vec2(s * FBM_NORM, low * 1.333333);
}

vec2 fbm2(vec2 p) {
  vec2 s = vec2(0.0);
  float a = 0.5;
  for (int i = 0; i < OCT2; i++) {
    s += a * vnoise2(p);
    p = ROT * p * 2.03 + vec2(5.3, 1.3);
    a *= 0.5;
  }
  return s * FBM2_NORM;
}

float ring(float r, float age, float amp, float reach) {
  if (amp <= 0.0) return 0.0;
  float radius = reach * (1.0 - exp(-age * 1.5)) + age * 0.04;
  float width = 0.01 + age * 0.05;
  float d = (r - radius) / width;
  // Hot leading edge + a short glow trailing behind it.
  float edge = exp(-d * d);
  float wake = d < 0.0 ? exp(d * 1.1) * 0.24 : 0.0;
  return (edge + wake) * amp * exp(-age * 1.3);
}

// Moving-head beam from the stage: center angle a, soft angular width w.
float beam(float ang, float a, float w) {
  float x = (ang - a) / w;
  return exp(-x * x);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float minRes = min(uRes.x, uRes.y);
  vec2 p = (frag - 0.5 * uRes) / minRes;
  vec2 ext = 0.5 * uRes / minRes;             // half extents in p units
  float cssUnit = 1.0 / (minRes * uPx);        // one CSS px in p units
  float pxUnit = 1.0 / minRes;                 // one internal px in p units

  float bass = uAudio.x;
  float mid = uAudio.y;
  float treble = uAudio.z;
  float energy = uAudio.w;
  float flash = uPulse.x;
  float presence = uPulse.y;
  float intensity = uPulse.z;
  float motion = uPulse.w;
  float t = uTime;

  // Idle breathing (fades out when the music takes over).
  float breath = 0.5 + 0.5 * sin(uClock * 0.5 * motion + 1.3);
  float idle = 1.0 - presence;
  float live = presence * (0.35 + 0.65 * intensity);
  float kick = clamp(bass * live, 0.0, 1.0);
  float hit = clamp(flash * live, 0.0, 1.0);

  // ---- flow field: domain-warped FBM -----------------------------------------
  vec2 w = p * 0.95;
  vec2 q = fbm2(w * 0.8 + vec2(0.0, t * 0.05)) - 0.5;
  float warp = 1.45 + 0.85 * kick + 0.2 * breath * idle;
  vec2 fp = fbmPair(w + warp * q + vec2(t * 0.03, -t * 0.012));
  float f = fp.x;
  float fl = fp.y;
  float fs = smoothstep(0.36, 0.82, f);

  // Body hue: violet ↔ magenta drifting across the screen (cyan stays an accent).
  float hAB = smoothstep(-0.32, 0.32, q.x * 1.5 + p.x / ext.x * 0.25 + 0.12 * sin(t * 0.07));
  vec3 hue = mix(uColA, uColB, hAB);
  // Split toning: shadows lean towards the brand violet so dark album colors never turn to mud.
  vec3 shade = mix(uShadeA, uShadeB, hAB);

  // ---- base: violet-black, slightly lifted towards the bottom ----------------
  vec3 col = mix(vec3(0.0016, 0.0011, 0.0052), vec3(0.0058, 0.0034, 0.0195), smoothstep(0.95, 0.0, uv.y));

  // Smoke: faint colored density with a soft sheen along its contours.
  col += shade * pow(fs, 2.2) * 0.15;
  col += mix(hue, vec3(1.0), 0.15) * pow(0.5 + 0.5 * cos(f * 26.0 - t * 0.25), 14.0) * fs * fs * 0.1;

  // ---- plasma bands: wide out-of-focus glow behind the ribbons ---------------
  float s2 = p.y * 0.8 - p.x * 0.28 + (f - 0.5) * 1.7 + q.y * 1.2 + t * 0.03;
  float k2 = s2 / 0.95;
  float id2 = floor(k2 + 0.5);
  float d2 = abs(k2 - id2) * 0.95;
  float h2 = hash12(vec2(id2, 5.0));
  float soft = exp(-(d2 * d2) / 0.014);
  float along2 = smoothstep(0.22, 0.78, vnoise(vec2(p.x * 0.75 + id2 * 5.1 - t * 0.05, id2 * 1.7 + t * 0.02)));
  col += mix(mix(uColA, uColB, h2), shade, 0.7) * soft * along2 * (0.075 + 0.05 * kick + 0.04 * breath * idle);

  // ---- liquid-neon ribbons: iso-lines of a smooth stripe field ---------------
  float tilt = 0.3 * sin(t * 0.021);
  float sBase = p.y * 1.05 + p.x * tilt;
  float sField = sBase + (fl - 0.5) * 1.75 + q.x * 0.6 - t * 0.04;
  const float SPACING = 0.66;
  float k = sField / SPACING;
  float id = floor(k + 0.5);
  float d = abs(k - id) * SPACING;
  float rh = hash12(vec2(id, 17.0));
  // Brightness varies along each ribbon so they fade in and out like silk in light.
  float along = smoothstep(0.28, 0.7, vnoise(vec2(p.x * 1.1 + id * 7.31 + t * 0.1 * (rh - 0.5), id * 3.17 + t * 0.045)));
  along *= 0.5 + 0.5 * rh;
  float wCore = max(2.2 * cssUnit, 1.75 * pxUnit) * (1.0 + 0.8 * kick);
  float core = exp(-(d * d) / (wCore * wCore));
  float band = exp(-(d * d) / (0.0016 * (1.0 + 1.2 * kick)));
  float halo = exp(-d / (0.06 + 0.03 * kick));
  float bloom = exp(-d / (0.014 + 0.01 * kick));
  vec3 rc = rh < 0.42 ? uColB : rh < 0.78 ? uColA : uColC;
  rc = mix(rc, hue, rh < 0.78 ? 0.25 : 0.08);
  // Mids (vocals, synths) make the ribbons sing a little brighter.
  float ribbonGain = along * (0.85 + 0.55 * kick + 0.35 * hit + 0.3 * mid * live);
  col += rc * (core * 1.2 + bloom * 0.26 + band * 0.26 + halo * 0.08) * ribbonGain;
  col += vec3(1.0, 0.95, 1.0) * core * ribbonGain * 0.22;

  // ---- light leaks -----------------------------------------------------------
  vec2 l1 = p - vec2(-ext.x * 1.02 + 0.1 * sin(t * 0.11), ext.y * 0.62 + 0.08 * cos(t * 0.09));
  vec2 l2 = p - vec2(ext.x * 1.1 + 0.08 * cos(t * 0.08), -ext.y * 0.35 + 0.12 * sin(t * 0.07));
  float smoke = 0.3 + 0.7 * f;
  col += mix(uShadeB, uColB, 0.2) * exp(-dot(l1, l1) * 3.6) * smoke * 0.12;
  float l2k = exp(-dot(l2, l2) * 5.0);
  col += mix(uShadeA, uShadeB, 0.5) * l2k * smoke * 0.07;
  // Cyan light caught in the densest smoke (saturated, never a flat haze).
  col += uColC * l2k * smoothstep(0.45, 0.85, f) * 0.14;

  // ---- stage glow + moving-head beams from bottom-center ---------------------
  vec2 sp = p - vec2(0.0, -ext.y - 0.05);
  float sr = length(sp * vec2(0.72, 1.0));
  float stage = exp(-sr * 2.5);
  float swell = 0.36 + 0.2 * breath * idle + (0.45 * bass + 0.55 * flash) * live;
  vec3 stageCol = mix(uColA, uColB, 0.6);
  col += mix(uShadeA, uShadeB, 0.6) * stage * swell * (0.08 + 0.3 * fs);
  // Floor light hugging the bottom edge (breathes when idle, kicks with the bass).
  float floorLight = exp(-uv.y * 6.5) * exp(-abs(p.x) / (ext.x * 0.9));
  col += mix(stageCol, uColB, 0.3) * floorLight * swell * 0.07;
  col += mix(stageCol, vec3(1.0), 0.25) * exp(-sr * 7.0) * hit * 0.28;

  float ang = atan(sp.x, sp.y);
  float bt = t * 0.35;
  float b1 = beam(ang, 0.62 * sin(bt * 0.9 + 0.4), 0.06);
  float b2 = beam(ang, 0.7 * sin(bt * 0.7 + 2.5), 0.045);
  float b3 = beam(ang, 0.5 * sin(bt * 1.1 + 4.4), 0.075);
  float beams = b1 + b2 * 0.8 + b3 * 0.7;
  float haze = (0.35 + 0.65 * smoothstep(0.3, 0.75, f)) * exp(-sr * 1.35);
  float beamGain = 0.01 + 0.025 * breath * idle + (0.16 * bass + 0.22 * flash + 0.06 * energy) * live;
  col += (uColB * b1 + mix(uColC, uColB, 0.25) * b2 * 0.7 + uColA * b3 * 0.8) * haze * beamGain;

  // ---- bass rings: wavefronts that light up the smoke ------------------------
  float reach = length(vec2(ext.x, 2.0 * ext.y + 0.05)) * 1.05;
  float rr = sr + (f - 0.5) * 0.16;
  float rings = ring(rr, uRingAge.x, uRingAmp.x, reach)
              + ring(rr, uRingAge.y, uRingAmp.y, reach)
              + ring(rr, uRingAge.z, uRingAmp.z, reach)
              + ring(rr, uRingAge.w, uRingAmp.w, reach);
  rings *= (0.35 + 0.65 * intensity) * motion;
  vec3 ringCol = mix(uColB, uColC, smoothstep(0.2, 0.9, abs(sp.x) / reach * 1.4 + q.y * 0.6));
  col += mix(ringCol, vec3(1.0), 0.12) * rings * (0.16 + 0.8 * fs + 1.1 * band * along);

  // ---- motes: dust drifting up through the light, twinkling with the treble --
  float cells = minRes * uPx / 34.0;
  vec2 g = p * cells + vec2(0.0, -t * 0.9);
  vec2 gc = floor(g);
  vec2 gh = hash22(gc);
  vec2 gd = (fract(g) - 0.25 - 0.5 * gh) * (34.0 / uPx);
  float tw = 0.5 + 0.5 * sin(uClock * (1.2 + 3.0 * gh.x) * motion + gh.y * 6.2831);
  float mote = exp(-dot(gd, gd) * 0.7) * step(0.88, hash12(gc + 7.13)) * (0.25 + 0.75 * tw * tw);
  float lit = stage * 1.5 + beams * haze * 1.2 + rings * 0.9 + band * along * 0.6;
  col += mix(vec3(1.0, 0.9, 1.0), hue, 0.35) * mote * lit * (0.14 + 0.9 * treble * live);

  // ---- overall level, vignette, top fade -------------------------------------
  float exposure = mix(0.45, 1.0, intensity) * (0.92 + 0.1 * breath * idle) * (1.0 + (0.16 * bass + 0.08 * energy) * live);
  col *= exposure;

  vec2 vv = (uv - 0.5) * vec2(1.0, 1.1);
  col *= mix(0.35, 1.0, smoothstep(0.85, 0.2, length(vv)));
  col *= mix(1.0, 0.45, smoothstep(0.45, 1.0, uv.y));

  // Soft shoulder keeps hot spots glowing instead of clipping, then sRGB.
  col = 1.0 - exp(-col * 1.5);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash12(frag + fract(uClock * 7.13) * 91.7) - 0.5) / 255.0;
  FRAG_COLOR = vec4(col, 1.0);
}
`

export function fragmentSource(webgl2: boolean, octaves: number): string {
  const oct = Math.max(3, Math.min(6, Math.round(octaves)))
  const oct2 = Math.max(2, oct - 2)
  const norm = (n: number) => (1 / (1 - Math.pow(0.5, n))).toFixed(6)
  return (
    (webgl2 ? HEADER_ES3 : HEADER_ES1) +
    `#define OCTAVES ${oct}\n#define OCT2 ${oct2}\n#define FBM_NORM ${norm(oct)}\n#define FBM2_NORM ${norm(oct2)}\n` +
    BODY
  )
}
