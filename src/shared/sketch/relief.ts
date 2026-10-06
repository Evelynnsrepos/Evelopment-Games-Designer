/**
 * 3D paint (Sketch Pro): a brush with Height makes thick paint. The stroke's own
 * coverage is its height; light from the top left shades the slopes and puts a
 * shine on the ridges, so strokes look raised like impasto. Baked into the paint.
 */

export interface ReliefArea {
  x: number
  y: number
  w: number
  h: number
}

const LIGHT = (() => {
  const v = [-0.55, -0.6, 0.58]
  const l = Math.hypot(v[0], v[1], v[2])
  return v.map((c) => c / l)
})()
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1]
  const l = Math.hypot(v[0], v[1], v[2])
  return v.map((c) => c / l)
})()

/** Smooth a height field in place with a box blur of radius `r` (rows, then columns). */
function boxBlur(h: Float32Array, w: number, hh: number, r: number) {
  if (r < 1) return
  const tmp = new Float32Array(h.length)
  for (let y = 0; y < hh; y++) {
    let sum = 0
    const row = y * w
    for (let x = -r; x <= r; x++) sum += h[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / (2 * r + 1)
      sum += h[row + Math.min(w - 1, x + r + 1)] - h[row + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(hh - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < hh; y++) {
      h[y * w + x] = sum / (2 * r + 1)
      sum += tmp[Math.min(hh - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
}

/** Light the colours in `rgba` by the height in `alpha` (both w × h). Pure, for tests. */
export function shade(rgba: Uint8ClampedArray, alpha: Uint8ClampedArray, w: number, h: number, amount: number) {
  const k = Math.max(0, Math.min(1, amount))
  if (!k) return
  const height = new Float32Array(w * h)
  for (let i = 0; i < height.length; i++) height[i] = alpha[i] / 255
  boxBlur(height, w, h, Math.round(1 + k * 3))
  const steep = 3 + k * 8
  const flat = LIGHT[2]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!rgba[i * 4 + 3]) continue
      const dx = (height[y * w + Math.min(w - 1, x + 1)] - height[y * w + Math.max(0, x - 1)]) * steep
      const dy = (height[Math.min(h - 1, y + 1) * w + x] - height[Math.max(0, y - 1) * w + x]) * steep
      const nl = Math.hypot(dx, dy, 1)
      const nx = -dx / nl
      const ny = -dy / nl
      const nz = 1 / nl
      // Soft shading: shadows never go black, and thin edges of the stroke are shaded less.
      const diffuse = Math.max(-0.45, Math.min(0.5, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / flat - 1))
      const cover = Math.min(1, alpha[i] / 160)
      const spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 40) * 0.45 * k * cover
      const lit = 1 + diffuse * 0.8 * k * cover
      for (let c = 0; c < 3; c++) rgba[i * 4 + c] = rgba[i * 4 + c] * lit + 255 * spec
    }
}

/** Shade the coloured stroke in `paint` using the stroke mask's coverage as height, inside `area`. */
export function applyRelief(paint: CanvasRenderingContext2D, mask: HTMLCanvasElement, area: ReliefArea | undefined, amount: number) {
  const W = paint.canvas.width
  const H = paint.canvas.height
  const a = area ?? { x: 0, y: 0, w: W, h: H }
  const x = Math.max(0, Math.floor(a.x))
  const y = Math.max(0, Math.floor(a.y))
  const w = Math.min(W, Math.ceil(a.x + a.w)) - x
  const h = Math.min(H, Math.ceil(a.y + a.h)) - y
  if (w <= 2 || h <= 2) return
  const m = mask.getContext('2d')!.getImageData(x, y, w, h).data
  const alpha = new Uint8ClampedArray(w * h)
  for (let i = 0; i < alpha.length; i++) alpha[i] = m[i * 4 + 3]
  const img = paint.getImageData(x, y, w, h)
  shade(img.data, alpha, w, h, amount)
  paint.putImageData(img, x, y)
}
