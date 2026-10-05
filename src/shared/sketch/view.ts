/**
 * The canvas view (Sketch Pro): pan, zoom, rotate and flip. View only; the
 * picture's pixels never change. A document point p lands on screen at
 * (x, y) + rotate(rot) · (p.x · scale · (flip ? -1 : 1), p.y · scale).
 */

export interface View {
  x: number
  y: number
  scale: number
  /** Radians; missing = 0. */
  rot?: number
  /** Mirrored left/right on screen; missing = false. */
  flip?: boolean
}

interface Pt {
  x: number
  y: number
}

/** The view as a 2D matrix [a, b, c, d, e, f] (canvas setTransform / SVG matrix order). */
export function viewMatrix(v: View): [number, number, number, number, number, number] {
  const r = v.rot ?? 0
  const sx = v.scale * (v.flip ? -1 : 1)
  return [sx * Math.cos(r), sx * Math.sin(r), -v.scale * Math.sin(r), v.scale * Math.cos(r), v.x, v.y]
}

export function toScreen(v: View, p: Pt): Pt {
  const [a, b, c, d, e, f] = viewMatrix(v)
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }
}

/** Screen point (relative to the canvas element) to document point. */
export function toDocPoint(v: View, s: Pt): Pt {
  const r = v.rot ?? 0
  const dx = s.x - v.x
  const dy = s.y - v.y
  const px = dx * Math.cos(r) + dy * Math.sin(r)
  const py = -dx * Math.sin(r) + dy * Math.cos(r)
  return { x: px / (v.scale * (v.flip ? -1 : 1)), y: py / v.scale }
}

/** Move the view so document point `doc` sits at screen point `screen`. */
export function anchor(v: View, doc: Pt, screen: Pt): View {
  const at = toScreen({ ...v, x: 0, y: 0 }, doc)
  return { ...v, x: screen.x - at.x, y: screen.y - at.y }
}

export const MIN_SCALE = 0.05
export const MAX_SCALE = 32

/** Zoom by `factor` keeping the point under `s` still. */
export function zoomAbout(v: View, factor: number, s: Pt): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
  return anchor({ ...v, scale }, toDocPoint(v, s), s)
}

/** Snap to the nearest quarter turn when within ~4°. */
export function snapRotation(rot: number): number {
  const q = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2)
  return Math.abs(rot - q) < 0.07 ? q : rot
}

/** Rotate by `angle` radians around screen point `s`. */
export function rotateAbout(v: View, angle: number, s: Pt): View {
  return anchor({ ...v, rot: normalizeAngle((v.rot ?? 0) + angle) }, toDocPoint(v, s), s)
}

/** Mirror the view left/right around screen point `s`. */
export function flipAbout(v: View, s: Pt): View {
  // Flipping also mirrors the rotation, so what's on screen stays put except for the mirror.
  return anchor({ ...v, flip: !v.flip, rot: normalizeAngle(-(v.rot ?? 0)) }, toDocPoint(v, s), s)
}

function normalizeAngle(a: number) {
  const t = Math.PI * 2
  a = ((a % t) + t) % t
  return a > Math.PI ? a - t : a
}

/**
 * Two-finger pinch: the view at the start of the gesture, the two fingers then
 * (a0, b0) and now (a1, b1). The picture follows the fingers: moved, zoomed and turned.
 */
export function pinch(v0: View, a0: Pt, b0: Pt, a1: Pt, b1: Pt, rotate = true): View {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y)
  const turn = rotate ? Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x) : 0
  const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }
  const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (v0.scale * d1) / d0))
  return anchor({ ...v0, scale, rot: snapRotation(normalizeAngle((v0.rot ?? 0) + turn)) }, toDocPoint(v0, mid0), mid1)
}
