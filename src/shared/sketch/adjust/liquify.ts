/**
 * Liquify (Sketch Pro): a displacement field over the canvas. Each node says
 * where (relative to itself) its pixel takes its colour from; the GPU or the
 * CPU then warps the layer by it. Brushes reshape the field. Pure maths, no DOM.
 */

export const LIQUIFY_MODES = [
  { id: 'push', label: 'Push' },
  { id: 'twirlCw', label: 'Twirl right' },
  { id: 'twirlCcw', label: 'Twirl left' },
  { id: 'pinch', label: 'Pinch' },
  { id: 'expand', label: 'Expand' },
  { id: 'crystals', label: 'Crystals' },
  { id: 'edge', label: 'Edge' },
  { id: 'reconstruct', label: 'Reconstruct' },
  { id: 'adjust', label: 'Smooth out' },
] as const

export type LiquifyMode = (typeof LIQUIFY_MODES)[number]['id']

export interface LiquifyDab {
  mode: LiquifyMode
  /** Brush centre in canvas pixels. */
  x: number
  y: number
  /** How far the pen moved since the last dab (push). */
  dx: number
  dy: number
  radius: number
  /** 0..1, already including pen pressure. */
  strength: number
  /** 0..1 randomness added to the shape changes. */
  distortion: number
  seed: number
}

const fract = (v: number) => v - Math.floor(v)
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)

/** Bilinear displacement at grid position (gx, gy), into `out`. */
export function fieldAt(field: Float32Array, fw: number, fh: number, gx: number, gy: number, out: number[]) {
  gx = Math.min(fw - 1, Math.max(0, gx))
  gy = Math.min(fh - 1, Math.max(0, gy))
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const x1 = Math.min(fw - 1, x0 + 1)
  const y1 = Math.min(fh - 1, y0 + 1)
  const fx = gx - x0
  const fy = gy - y0
  for (let c = 0; c < 2; c++) {
    const a = field[(y0 * fw + x0) * 2 + c] * (1 - fx) + field[(y0 * fw + x1) * 2 + c] * fx
    const b = field[(y1 * fw + x0) * 2 + c] * (1 - fx) + field[(y1 * fw + x1) * 2 + c] * fx
    out[c] = a * (1 - fy) + b * fy
  }
}

export class LiquifyField {
  readonly cell: number
  readonly fw: number
  readonly fh: number
  data: Float32Array

  /** A node every `cell` pixels (about 1024 nodes across at most). */
  constructor(width: number, height: number, cell = Math.max(1, Math.ceil(Math.max(width, height) / 1024))) {
    this.cell = cell
    this.fw = Math.ceil(width / cell) + 1
    this.fh = Math.ceil(height / cell) + 1
    this.data = new Float32Array(this.fw * this.fh * 2)
  }

  reset() {
    this.data.fill(0)
  }

  get empty() {
    return this.data.every((v) => v === 0)
  }

  /** Displacement at a canvas pixel. */
  at(x: number, y: number): [number, number] {
    const o = [0, 0]
    fieldAt(this.data, this.fw, this.fh, x / this.cell, y / this.cell, o)
    return [o[0], o[1]]
  }

  /** Reshape the field under one brush dab. */
  apply(d: LiquifyDab) {
    const { cell, fw, fh, data } = this
    const R = d.radius
    const gx0 = Math.max(0, Math.floor((d.x - R) / cell))
    const gy0 = Math.max(0, Math.floor((d.y - R) / cell))
    const gx1 = Math.min(fw - 1, Math.ceil((d.x + R) / cell))
    const gy1 = Math.min(fh - 1, Math.ceil((d.y + R) / cell))
    if (gx1 < gx0 || gy1 < gy0) return
    const bw = gx1 - gx0 + 1
    // New values are worked out from the old field, then written back.
    const next = new Float32Array(bw * (gy1 - gy0 + 1) * 2)
    const old = [0, 0]
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++) {
        const px = gx * cell
        const py = gy * cell
        const i = (gy * fw + gx) * 2
        const o = ((gy - gy0) * bw + (gx - gx0)) * 2
        const rx = px - d.x
        const ry = py - d.y
        const dist = Math.hypot(rx, ry)
        const t = dist / R
        if (t >= 1) {
          next[o] = data[i]
          next[o + 1] = data[i + 1]
          continue
        }
        const f = (1 - t * t) * (1 - t * t)
        const k = d.strength * f
        if (d.mode === 'reconstruct') {
          next[o] = data[i] * (1 - 0.2 * k)
          next[o + 1] = data[i + 1] * (1 - 0.2 * k)
          continue
        }
        if (d.mode === 'adjust') {
          // Smooth out: blend toward the neighbours' average.
          const n = (x: number, y: number, c: number) => data[(Math.min(fh - 1, Math.max(0, y)) * fw + Math.min(fw - 1, Math.max(0, x))) * 2 + c]
          for (let c = 0; c < 2; c++) next[o + c] = data[i + c] + ((n(gx - 1, gy, c) + n(gx + 1, gy, c) + n(gx, gy - 1, c) + n(gx, gy + 1, c)) / 4 - data[i + c]) * 0.5 * k
          continue
        }
        // Where this pixel's colour should now come from.
        let qx = px
        let qy = py
        if (d.mode === 'push') {
          qx -= d.dx * k
          qy -= d.dy * k
        } else if (d.mode === 'twirlCw' || d.mode === 'twirlCcw') {
          const a = (d.mode === 'twirlCw' ? -1 : 1) * 0.08 * k
          qx = d.x + Math.cos(a) * rx - Math.sin(a) * ry
          qy = d.y + Math.sin(a) * rx + Math.cos(a) * ry
        } else if (d.mode === 'pinch' || d.mode === 'expand') {
          const s = 1 + (d.mode === 'pinch' ? 0.06 : -0.06) * k
          qx = d.x + rx * s
          qy = d.y + ry * s
        } else if (d.mode === 'edge') {
          const s = 1 + 0.06 * k * (t < 0.5 ? -1 : 1)
          qx = d.x + rx * s
          qy = d.y + ry * s
        } else if (d.mode === 'crystals') {
          const cx = Math.floor(px / (R * 0.25))
          const cy = Math.floor(py / (R * 0.25))
          qx += (hash(cx + d.seed, cy) - 0.5) * R * 0.15 * k
          qy += (hash(cx, cy + d.seed) - 0.5) * R * 0.15 * k
        }
        if (d.distortion > 0) {
          qx += (hash(gx + d.seed, gy) - 0.5) * d.distortion * k * R * 0.05
          qy += (hash(gx, gy + d.seed) - 0.5) * d.distortion * k * R * 0.05
        }
        fieldAt(data, fw, fh, qx / cell, qy / cell, old)
        next[o] = qx - px + old[0]
        next[o + 1] = qy - py + old[1]
      }
    for (let gy = gy0; gy <= gy1; gy++) data.set(next.subarray((gy - gy0) * bw * 2, (gy - gy0 + 1) * bw * 2), (gy * fw + gx0) * 2)
  }
}
