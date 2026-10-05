import { applyCurve, type CurvePoint } from '../pen'

/**
 * Colour maths for Adjustments (Sketch Pro). Everything here is pure, so the
 * GPU shaders and the CPU fallback use exactly the same numbers: curves,
 * colour balance and gradient maps become 256-entry lookup tables.
 */

export type RGB = [number, number, number]

// ---- Hue / Saturation / Brightness --------------------------------------------

export function rgbToHsv(r: number, g: number, b: number): RGB {
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return [h / 6, max ? d / max : 0, max]
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h * 6) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}

/** Hue in degrees (-180..180), saturation and brightness -1..1 (0 = unchanged). Same as the GLSL `hsb`. */
export function hsbAdjust([r, g, b]: RGB, hue: number, sat: number, bright: number): RGB {
  const [h, s, v] = rgbToHsv(r, g, b)
  const nh = (((h + hue / 360) % 1) + 1) % 1
  const ns = clamp01(sat < 0 ? s * (1 + sat) : s + (1 - s) * sat * s)
  const nv = clamp01(bright < 0 ? v * (1 + bright) : v + (1 - v) * bright)
  return hsvToRgb(nh, ns, nv)
}

// ---- Colour balance -----------------------------------------------------------

export type ToneRange = 'shadows' | 'midtones' | 'highlights'
export const TONE_RANGES: ToneRange[] = ['shadows', 'midtones', 'highlights']

/** Cyan-red, magenta-green and yellow-blue shift for one tone range, each -1..1. */
export type Balance = Record<ToneRange, RGB>

/** How strongly a range applies at value `x` (0..1); the classic transfer weights. */
export function toneWeight(range: ToneRange, x: number): number {
  const a = 0.25
  const b = 0.333
  const k = 0.7
  if (range === 'shadows') return clamp01((x - b) / -a + 0.5) * k
  if (range === 'highlights') return clamp01((x + b - 1) / a + 0.5) * k
  return clamp01((x - b) / a + 0.5) * clamp01((x + b - 1) / -a + 0.5) * k
}

/** Per channel lookup tables (r, g, b) for a colour balance. */
export function balanceLut(bal: Balance): [Uint8Array, Uint8Array, Uint8Array] {
  const luts: [Uint8Array, Uint8Array, Uint8Array] = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)]
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 256; i++) {
      const x = i / 255
      let v = x
      for (const r of TONE_RANGES) v += bal[r][c] * toneWeight(r, x)
      luts[c][i] = Math.round(clamp01(v) * 255)
    }
  return luts
}

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Put the brightness of `orig` back into `c` (colour balance "keep brightness"). */
export function keepLuma(c: RGB, orig: RGB): RGB {
  const d = luma(...orig) - luma(...c)
  return [clamp01(c[0] + d), clamp01(c[1] + d), clamp01(c[2] + d)]
}

// ---- Curves -------------------------------------------------------------------

export const CURVE_CHANNELS = ['all', 'r', 'g', 'b'] as const
export type CurveChannel = (typeof CURVE_CHANNELS)[number]
export type Curves = Record<CurveChannel, CurvePoint[]>
export const MAX_CURVE_NODES = 11

export const defaultCurves = (): Curves => ({
  all: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  r: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  g: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  b: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
})

/** A curve as a 256-entry table (smooth through its nodes, never overshooting). */
export function curveTable(points: readonly CurvePoint[]): Uint8Array {
  const out = new Uint8Array(256)
  for (let i = 0; i < 256; i++) out[i] = Math.round(clamp01(applyCurve(points.slice(0, MAX_CURVE_NODES), i / 255)) * 255)
  return out
}

/** Tables for r, g, b: each channel's own curve, then the composite curve. */
export function curvesLut(c: Curves): [Uint8Array, Uint8Array, Uint8Array] {
  const all = curveTable(c.all)
  return [c.r, c.g, c.b].map((pts) => curveTable(pts).map((v) => all[v])) as [Uint8Array, Uint8Array, Uint8Array]
}

/** 256 bins of a channel (or brightness) over pixels that aren't fully transparent. */
export function histogram(data: Uint8ClampedArray, channel: CurveChannel): Uint32Array {
  const bins = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const v = channel === 'r' ? data[i] : channel === 'g' ? data[i + 1] : channel === 'b' ? data[i + 2] : Math.round(luma(data[i], data[i + 1], data[i + 2]))
    bins[v]++
  }
  return bins
}

// ---- Gradient map -------------------------------------------------------------

export interface GradientStop {
  /** 0..1 along the gradient (dark to light). */
  at: number
  color: string
}

export const GRADIENT_PRESETS: { name: string; stops: GradientStop[] }[] = [
  { name: 'Black and white', stops: [{ at: 0, color: '#000000' }, { at: 1, color: '#ffffff' }] },
  { name: 'Sepia', stops: [{ at: 0, color: '#1e1006' }, { at: 0.5, color: '#8a5a2b' }, { at: 1, color: '#f6e7c8' }] },
  { name: 'Sunset', stops: [{ at: 0, color: '#1b0b3a' }, { at: 0.45, color: '#c2306b' }, { at: 0.75, color: '#f28c38' }, { at: 1, color: '#ffe9a3' }] },
  { name: 'Ocean', stops: [{ at: 0, color: '#03132b' }, { at: 0.5, color: '#16698f' }, { at: 1, color: '#bff4ee' }] },
  { name: 'Heat', stops: [{ at: 0, color: '#000000' }, { at: 0.35, color: '#a3000f' }, { at: 0.7, color: '#ff9a00' }, { at: 1, color: '#ffffd8' }] },
  { name: 'Forest', stops: [{ at: 0, color: '#0b1a0c' }, { at: 0.5, color: '#3f7a2d' }, { at: 1, color: '#e8f2b0' }] },
  { name: 'Retro', stops: [{ at: 0, color: '#2b1b4f' }, { at: 0.5, color: '#22a39f' }, { at: 1, color: '#f4e285' }] },
  { name: 'Neon', stops: [{ at: 0, color: '#0d0221' }, { at: 0.5, color: '#ff2a6d' }, { at: 1, color: '#05d9e8' }] },
]

export function hexRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(full, 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const rgbHex = (c: RGB) => `#${c.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('')}`

/** Colour of the gradient at `t` (0..1), straight lines between stops, flat past the ends. */
export function sampleGradient(stops: readonly GradientStop[], t: number): RGB {
  const s = [...stops].sort((a, b) => a.at - b.at)
  if (!s.length) return [t, t, t]
  if (t <= s[0].at) return hexRgb(s[0].color)
  for (let i = 1; i < s.length; i++)
    if (t <= s[i].at) {
      const k = (t - s[i - 1].at) / (s[i].at - s[i - 1].at || 1)
      const a = hexRgb(s[i - 1].color)
      const b = hexRgb(s[i].color)
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
    }
  return hexRgb(s[s.length - 1].color)
}

/** The gradient as 256 RGB entries, indexed by brightness. */
export function gradientLut(stops: readonly GradientStop[]): [Uint8Array, Uint8Array, Uint8Array] {
  const luts: [Uint8Array, Uint8Array, Uint8Array] = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)]
  for (let i = 0; i < 256; i++) {
    const c = sampleGradient(stops, i / 255)
    for (let k = 0; k < 3; k++) luts[k][i] = Math.round(c[k] * 255)
  }
  return luts
}

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
