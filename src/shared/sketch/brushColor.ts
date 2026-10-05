/** Colour helpers for brush colour dynamics (hue, saturation and brightness changes per stamp or stroke). */

export type HSV = [h: number, s: number, v: number]

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

/** h 0..1, s 0..1, v 0..1 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, max ? d / max : 0, max]
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 1) + 1) % 1
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6]
  return [r * 255, g * 255, b * 255]
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Shift a colour: `hue` turns around the wheel (1 = half way either side),
 * `sat` and `bright` move saturation and brightness (-1..1). Returns #rrggbb.
 */
export function shiftColor(hex: string, hue: number, sat: number, bright: number): string {
  if (!hue && !sat && !bright) return hex
  const [h, s, v] = rgbToHsv(...hexToRgb(hex))
  return rgbToHex(...hsvToRgb(h + hue * 0.5, clamp01(s + sat), clamp01(v + bright)))
}
