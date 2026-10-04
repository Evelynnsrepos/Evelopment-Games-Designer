/**
 * Layer blend modes (Sketch Pro). The GPU compositor runs the same formulas as
 * `blendPixel` below; the CPU version is the fallback and the reference for tests.
 * Ids of the modes Canvas 2D also has are its composite operation names, so
 * drawings saved before Sketch Pro keep their modes.
 */

export const BLEND_MODES = [
  { id: 'source-over', label: 'Normal', group: 'Normal' },
  { id: 'darken', label: 'Darken', group: 'Darken' },
  { id: 'multiply', label: 'Multiply', group: 'Darken' },
  { id: 'color-burn', label: 'Color burn', group: 'Darken' },
  { id: 'linear-burn', label: 'Linear burn', group: 'Darken' },
  { id: 'darker-color', label: 'Darker color', group: 'Darken' },
  { id: 'lighten', label: 'Lighten', group: 'Lighten' },
  { id: 'screen', label: 'Screen', group: 'Lighten' },
  { id: 'color-dodge', label: 'Color dodge', group: 'Lighten' },
  { id: 'lighter', label: 'Add', group: 'Lighten' },
  { id: 'lighter-color', label: 'Lighter color', group: 'Lighten' },
  { id: 'overlay', label: 'Overlay', group: 'Contrast' },
  { id: 'soft-light', label: 'Soft light', group: 'Contrast' },
  { id: 'hard-light', label: 'Hard light', group: 'Contrast' },
  { id: 'vivid-light', label: 'Vivid light', group: 'Contrast' },
  { id: 'linear-light', label: 'Linear light', group: 'Contrast' },
  { id: 'pin-light', label: 'Pin light', group: 'Contrast' },
  { id: 'hard-mix', label: 'Hard mix', group: 'Contrast' },
  { id: 'difference', label: 'Difference', group: 'Difference' },
  { id: 'exclusion', label: 'Exclusion', group: 'Difference' },
  { id: 'subtract', label: 'Subtract', group: 'Difference' },
  { id: 'divide', label: 'Divide', group: 'Difference' },
  { id: 'hue', label: 'Hue', group: 'Color' },
  { id: 'saturation', label: 'Saturation', group: 'Color' },
  { id: 'color', label: 'Color', group: 'Color' },
  { id: 'luminosity', label: 'Luminosity', group: 'Color' },
] as const

export type BlendMode = (typeof BLEND_MODES)[number]['id']

/** Index of each mode in the shader. */
export const blendIndex = (m: BlendMode) => Math.max(0, BLEND_MODES.findIndex((b) => b.id === m))

/** Modes Canvas 2D can draw itself (used by the fallback compositor). */
export const CANVAS_BLENDS: ReadonlySet<string> = new Set([
  'source-over', 'darken', 'multiply', 'color-burn', 'lighten', 'screen', 'color-dodge', 'lighter', 'overlay', 'soft-light',
  'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
])

type RGB = [number, number, number]

const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
function clipColor(c: RGB): RGB {
  const l = lum(c)
  const n = Math.min(...c)
  const x = Math.max(...c)
  let out = c
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n)) as RGB
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as RGB
  return out
}
const setLum = (c: RGB, l: number): RGB => {
  const d = l - lum(c)
  return clipColor([c[0] + d, c[1] + d, c[2] + d])
}
const sat = (c: RGB) => Math.max(...c) - Math.min(...c)
function setSat(c: RGB, s: number): RGB {
  const mx = Math.max(...c)
  const mn = Math.min(...c)
  if (mx === mn) return [0, 0, 0]
  return c.map((v) => ((v - mn) * s) / (mx - mn)) as RGB
}

const burn = (b: number, s: number) => (b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s))
const dodge = (b: number, s: number) => (b <= 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)))
const softLight = (b: number, s: number) => {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b)
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)
  return b + (2 * s - 1) * (d - b)
}
const hardLight = (b: number, s: number) => (s <= 0.5 ? b * 2 * s : 1 - (1 - b) * (1 - (2 * s - 1)))
const vivid = (b: number, s: number) => (s <= 0.5 ? burn(b, 2 * s) : dodge(b, 2 * s - 1))
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** B(backdrop, source) for one mode, straight (not premultiplied) colors 0..1. */
export function blendColor(mode: BlendMode, b: RGB, s: RGB): RGB {
  const each = (f: (b: number, s: number) => number): RGB => [f(b[0], s[0]), f(b[1], s[1]), f(b[2], s[2])]
  switch (mode) {
    case 'darken': return each(Math.min)
    case 'multiply': return each((x, y) => x * y)
    case 'color-burn': return each(burn)
    case 'linear-burn': return each((x, y) => clamp01(x + y - 1))
    case 'darker-color': return lum(s) < lum(b) ? s : b
    case 'lighten': return each(Math.max)
    case 'screen': return each((x, y) => x + y - x * y)
    case 'color-dodge': return each(dodge)
    case 'lighter': return each((x, y) => Math.min(1, x + y))
    case 'lighter-color': return lum(s) > lum(b) ? s : b
    case 'overlay': return each((x, y) => hardLight(y, x))
    case 'soft-light': return each(softLight)
    case 'hard-light': return each(hardLight)
    case 'vivid-light': return each(vivid)
    case 'linear-light': return each((x, y) => clamp01(x + 2 * y - 1))
    case 'pin-light': return each((x, y) => (y <= 0.5 ? Math.min(x, 2 * y) : Math.max(x, 2 * y - 1)))
    case 'hard-mix': return each((x, y) => (vivid(x, y) < 0.5 ? 0 : 1))
    case 'difference': return each((x, y) => Math.abs(x - y))
    case 'exclusion': return each((x, y) => x + y - 2 * x * y)
    case 'subtract': return each((x, y) => Math.max(0, x - y))
    case 'divide': return each((x, y) => (y <= 0 ? (x > 0 ? 1 : 0) : Math.min(1, x / y)))
    case 'hue': return setLum(setSat(s, sat(b)), lum(b))
    case 'saturation': return setLum(setSat(b, sat(s)), lum(b))
    case 'color': return setLum(s, lum(b))
    case 'luminosity': return setLum(b, lum(s))
    default: return s
  }
}

/**
 * Composite one source pixel over a backdrop pixel (W3C compositing, source-over
 * with a blend function). Straight RGBA 0..1 in and out.
 */
export function blendPixel(mode: BlendMode, b: [number, number, number, number], s: [number, number, number, number], opacity = 1): [number, number, number, number] {
  const as = s[3] * opacity
  const ab = b[3]
  const ao = as + ab * (1 - as)
  if (ao <= 0) return [0, 0, 0, 0]
  const mixed = blendColor(mode, [b[0], b[1], b[2]], [s[0], s[1], s[2]])
  const out = [0, 1, 2].map((i) => {
    const cs = (1 - ab) * s[i] + ab * mixed[i]
    return (as * cs + ab * (1 - as) * b[i]) / ao
  })
  return [out[0], out[1], out[2], ao]
}

/** The same formulas in GLSL for the GPU compositor; `mode` is `blendIndex`. */
export const GLSL_BLEND = /* glsl */ `
float lumOf(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lumOf(c); float n = min(min(c.r, c.g), c.b); float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lumOf(c))); }
float satOf(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b); float mn = min(min(c.r, c.g), c.b);
  return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}
float burn1(float b, float s) { return b >= 1.0 ? 1.0 : (s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s)); }
float dodge1(float b, float s) { return b <= 0.0 ? 0.0 : (s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s))); }
float hard1(float b, float s) { return s <= 0.5 ? b * 2.0 * s : 1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)); }
float soft1(float b, float s) {
  if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (d - b);
}
float vivid1(float b, float s) { return s <= 0.5 ? burn1(b, 2.0 * s) : dodge1(b, 2.0 * s - 1.0); }
float pin1(float b, float s) { return s <= 0.5 ? min(b, 2.0 * s) : max(b, 2.0 * s - 1.0); }
float div1(float b, float s) { return s <= 0.0 ? (b > 0.0 ? 1.0 : 0.0) : min(1.0, b / s); }
#define EACH(f) vec3(f(b.r, s.r), f(b.g, s.g), f(b.b, s.b))
vec3 blendColor(int m, vec3 b, vec3 s) {
  if (m == 1) return min(b, s);
  if (m == 2) return b * s;
  if (m == 3) return EACH(burn1);
  if (m == 4) return clamp(b + s - 1.0, 0.0, 1.0);
  if (m == 5) return lumOf(s) < lumOf(b) ? s : b;
  if (m == 6) return max(b, s);
  if (m == 7) return b + s - b * s;
  if (m == 8) return EACH(dodge1);
  if (m == 9) return min(vec3(1.0), b + s);
  if (m == 10) return lumOf(s) > lumOf(b) ? s : b;
  if (m == 11) return vec3(hard1(s.r, b.r), hard1(s.g, b.g), hard1(s.b, b.b));
  if (m == 12) return EACH(soft1);
  if (m == 13) return EACH(hard1);
  if (m == 14) return EACH(vivid1);
  if (m == 15) return clamp(b + 2.0 * s - 1.0, 0.0, 1.0);
  if (m == 16) return EACH(pin1);
  if (m == 17) return step(0.5, EACH(vivid1));
  if (m == 18) return abs(b - s);
  if (m == 19) return b + s - 2.0 * b * s;
  if (m == 20) return max(vec3(0.0), b - s);
  if (m == 21) return EACH(div1);
  if (m == 22) return setLum(setSat(s, satOf(b)), lumOf(b));
  if (m == 23) return setLum(setSat(b, satOf(s)), lumOf(b));
  if (m == 24) return setLum(s, lumOf(b));
  if (m == 25) return setLum(b, lumOf(s));
  return s;
}
`
