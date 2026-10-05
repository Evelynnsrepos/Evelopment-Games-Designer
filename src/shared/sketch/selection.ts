/**
 * Pixel helpers for selections, ColorDrop and the magic wand (Sketch Pro).
 * Masks are one byte per pixel (0 = out, 255 = in). Everything here is pure.
 */

/** How far two RGBA pixels are apart, 0..1 (alpha counts, so lines and empty space differ). */
function distance(d: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number) {
  const da = d[i + 3] - a
  // Compare colours as they look over each other's alpha, so empty pixels of any colour match.
  const dr = (d[i] * d[i + 3]) / 255 - (r * a) / 255
  const dg = (d[i + 1] * d[i + 3]) / 255 - (g * a) / 255
  const db = (d[i + 2] * d[i + 3]) / 255 - (b * a) / 255
  return Math.sqrt((dr * dr + dg * dg + db * db + da * da) / 4) / 255
}

/**
 * Pixels that look like the one at (x, y), within `threshold` (0..1).
 * contiguous: only the connected area (a flood fill); otherwise every matching pixel.
 */
export function floodMask(d: Uint8ClampedArray, w: number, h: number, x: number, y: number, threshold: number, contiguous = true): Uint8Array {
  const mask = new Uint8Array(w * h)
  x = Math.floor(x)
  y = Math.floor(y)
  if (x < 0 || y < 0 || x >= w || y >= h) return mask
  const s = (y * w + x) * 4
  const [r, g, b, a] = [d[s], d[s + 1], d[s + 2], d[s + 3]]
  const t = Math.max(0, threshold)
  const near = (p: number) => distance(d, p * 4, r, g, b, a) <= t
  if (!contiguous) {
    for (let p = 0; p < w * h; p++) if (near(p)) mask[p] = 255
    return mask
  }
  // Scanline flood fill.
  const stack = [x, y]
  while (stack.length) {
    const sy = stack.pop()!
    let sx = stack.pop()!
    let p = sy * w + sx
    while (sx > 0 && !mask[p - 1] && near(p - 1)) {
      sx--
      p--
    }
    let up = false
    let down = false
    for (; sx < w && !mask[p] && near(p); sx++, p++) {
      mask[p] = 255
      if (sy > 0) {
        const q = p - w
        if (!mask[q] && near(q)) {
          if (!up) stack.push(sx, sy - 1)
          up = true
        } else up = false
      }
      if (sy < h - 1) {
        const q = p + w
        if (!mask[q] && near(q)) {
          if (!down) stack.push(sx, sy + 1)
          down = true
        } else down = false
      }
    }
  }
  return mask
}

/** Grow a mask by `px` pixels (so fills tuck under soft line edges). */
export function grow(mask: Uint8Array, w: number, h: number, px = 1): Uint8Array {
  let cur = mask
  for (let n = 0; n < px; n++) {
    const out = cur.slice()
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        if (cur[p]) continue
        const v = Math.max(x > 0 ? cur[p - 1] : 0, x < w - 1 ? cur[p + 1] : 0, y > 0 ? cur[p - w] : 0, y < h - 1 ? cur[p + w] : 0)
        if (v) out[p] = v
      }
    cur = out
  }
  return cur
}

/** Soften a mask's edge: three box blurs, about a Gaussian of `radius` px. */
export function feather(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const r = Math.max(0, Math.round(radius / 1.7))
  if (!r) return mask.slice()
  const a = Float32Array.from(mask)
  const b = new Float32Array(w * h)
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const [n, m] = horizontal ? [h, w] : [w, h]
    const at = (line: number, i: number) => (horizontal ? line * w + i : i * w + line)
    for (let line = 0; line < n; line++) {
      let sum = 0
      // Pixels past the edge count as the edge pixel.
      for (let i = -r; i <= r; i++) sum += src[at(line, Math.min(m - 1, Math.max(0, i)))]
      for (let i = 0; i < m; i++) {
        dst[at(line, i)] = sum / (2 * r + 1)
        sum += src[at(line, Math.min(m - 1, i + r + 1))] - src[at(line, Math.max(0, i - r))]
      }
    }
  }
  for (let k = 0; k < 3; k++) {
    pass(a, b, true)
    pass(b, a, false)
  }
  return Uint8Array.from(a, (v) => Math.round(v))
}

/** Edges of a mask (where it crosses half) as line segments [x0, y0, x1, y1, ...] in pixel units, merged into runs. */
export function maskEdges(alpha: (p: number) => number, w: number, h: number): number[] {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha(y * w + x) >= 128
  const out: number[] = []
  for (let y = 0; y <= h; y++) {
    let start = -1
    for (let x = 0; x <= w; x++) {
      const edge = x < w && inside(x, y - 1) !== inside(x, y)
      if (edge && start < 0) start = x
      if (!edge && start >= 0) {
        out.push(start, y, x, y)
        start = -1
      }
    }
  }
  for (let x = 0; x <= w; x++) {
    let start = -1
    for (let y = 0; y <= h; y++) {
      const edge = y < h && inside(x - 1, y) !== inside(x, y)
      if (edge && start < 0) start = y
      if (!edge && start >= 0) {
        out.push(x, start, x, y)
        start = -1
      }
    }
  }
  return out
}

/** Smallest rectangle around pixels with alpha, or null when empty. */
export function alphaBounds(alpha: (p: number) => number, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (alpha(y * w + x)) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
