import { newId, type AssetPath, type Id } from '@/core/model'

/**
 * Raster sketch documents (v0.5), shared by the Sketch tool and Design Language.
 * Pixels live in the project's assets as one PNG per layer (`assets/images/<uuid>.png`);
 * the JSON only holds the layer stack, so documents stay small and sync well.
 */

/** Canvas 2D composite operations offered as layer blend modes. */
export const BLEND_MODES = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'darken', label: 'Darken' },
  { id: 'lighten', label: 'Lighten' },
  { id: 'color-dodge', label: 'Color dodge' },
  { id: 'color-burn', label: 'Color burn' },
  { id: 'hard-light', label: 'Hard light' },
  { id: 'soft-light', label: 'Soft light' },
  { id: 'difference', label: 'Difference' },
  { id: 'hue', label: 'Hue' },
  { id: 'saturation', label: 'Saturation' },
  { id: 'color', label: 'Color' },
  { id: 'luminosity', label: 'Luminosity' },
  { id: 'lighter', label: 'Add' },
] as const

export type BlendMode = (typeof BLEND_MODES)[number]['id']

export interface SketchLayer {
  id: Id
  name: string
  visible: boolean
  /** 0..1 */
  opacity: number
  blend: BlendMode
  /** Paint only where the layer already has pixels. */
  alphaLock: boolean
  /** Show only inside the pixels of the layer below (clipping mask). */
  clip: boolean
  /** PNG with the layer's pixels; null = empty. */
  image: AssetPath | null
}

/** An image floating over the canvas to draw from; not part of the picture. */
export interface SketchReference {
  id: Id
  image: AssetPath
  /** Screen position and width of the floating window, in px. */
  x: number
  y: number
  width: number
}

export interface SketchDoc {
  width: number
  height: number
  /** null = transparent. */
  backgroundColor: string | null
  /** Bottom to top. */
  layers: SketchLayer[]
  references: SketchReference[]
}

export const newLayer = (name: string): SketchLayer => ({
  id: newId(),
  name,
  visible: true,
  opacity: 1,
  blend: 'source-over',
  alphaLock: false,
  clip: false,
  image: null,
})

export const createSketchDoc = (width = 1920, height = 1080): SketchDoc => ({
  width,
  height,
  backgroundColor: '#ffffff',
  layers: [newLayer('Layer 1')],
  references: [],
})

export const CANVAS_PRESETS = [
  { label: 'Full HD 1920 × 1080', width: 1920, height: 1080 },
  { label: 'Square 2048 × 2048', width: 2048, height: 2048 },
  { label: 'Portrait A4 2480 × 3508', width: 2480, height: 3508 },
  { label: 'Icon 512 × 512', width: 512, height: 512 },
  { label: 'Sprite 256 × 256', width: 256, height: 256 },
] as const

export function nextLayerName(doc: SketchDoc): string {
  let n = doc.layers.length + 1
  while (doc.layers.some((l) => l.name === `Layer ${n}`)) n++
  return `Layer ${n}`
}

export function updateLayer(doc: SketchDoc, id: Id, patch: Partial<SketchLayer>): SketchDoc {
  return { ...doc, layers: doc.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }
}

/** Move a layer one step up (+1) or down (-1) in the stack. */
export function moveLayer(doc: SketchDoc, id: Id, dir: 1 | -1): SketchDoc {
  const i = doc.layers.findIndex((l) => l.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= doc.layers.length) return doc
  const layers = [...doc.layers]
  ;[layers[i], layers[j]] = [layers[j], layers[i]]
  return { ...doc, layers }
}

// ---- Brushes ---------------------------------------------------------------

export interface Brush {
  id: string
  label: string
  /** Diameter in canvas pixels at full pressure. */
  size: number
  /** 0..1, the most a single stroke can cover. */
  opacity: number
  /** 0..1, how much each dab adds; low flow builds up like an airbrush. */
  flow: number
  /** 0..1, 1 = hard edge. */
  hardness: number
  /** Distance between dabs as a fraction of the diameter. */
  spacing: number
  /** How much pen pressure changes size / opacity (0..1). */
  pressureSize: number
  pressureOpacity: number
  /** 0..1 stabilizer. */
  smoothing: number
  /** Random size change per dab, 0..1 (pencil grain). */
  jitter: number
}

export const BRUSHES: Brush[] = [
  { id: 'pencil', label: 'Pencil', size: 6, opacity: 0.9, flow: 0.6, hardness: 0.9, spacing: 0.15, pressureSize: 0.6, pressureOpacity: 0.7, smoothing: 0.2, jitter: 0.25 },
  { id: 'ink', label: 'Ink', size: 10, opacity: 1, flow: 1, hardness: 1, spacing: 0.08, pressureSize: 0.9, pressureOpacity: 0, smoothing: 0.5, jitter: 0 },
  { id: 'marker', label: 'Marker', size: 28, opacity: 0.6, flow: 1, hardness: 0.85, spacing: 0.1, pressureSize: 0.2, pressureOpacity: 0, smoothing: 0.3, jitter: 0 },
  { id: 'paint', label: 'Paint', size: 40, opacity: 1, flow: 0.35, hardness: 0.6, spacing: 0.08, pressureSize: 0.5, pressureOpacity: 0.5, smoothing: 0.3, jitter: 0 },
  { id: 'airbrush', label: 'Airbrush', size: 120, opacity: 0.8, flow: 0.06, hardness: 0, spacing: 0.06, pressureSize: 0.1, pressureOpacity: 0.9, smoothing: 0.2, jitter: 0 },
  { id: 'eraser', label: 'Eraser', size: 40, opacity: 1, flow: 1, hardness: 0.8, spacing: 0.1, pressureSize: 0.5, pressureOpacity: 0, smoothing: 0.2, jitter: 0 },
]

export interface InputPoint {
  x: number
  y: number
  /** 0..1; mice report 0.5 while pressed, which callers map to 1. */
  pressure: number
}

export interface Dab {
  x: number
  y: number
  /** Diameter. */
  size: number
  /** 0..1 alpha of this dab. */
  alpha: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** The dab for one pressure value. */
export function dabFor(brush: Brush, size: number, x: number, y: number, pressure: number, random = Math.random): Dab {
  const p = Math.min(1, Math.max(0, pressure))
  const s = size * lerp(1, p, brush.pressureSize) * (1 - brush.jitter * random() * 0.5)
  return { x, y, size: Math.max(0.5, s), alpha: brush.flow * lerp(1, p, brush.pressureOpacity) }
}

/**
 * Dabs from `a` to `b`, evenly spaced; `carry` is how far past the last dab the
 * previous segment ended, so spacing stays even across pointer events.
 * Returns the dabs and the new carry.
 */
export function dabsAlong(brush: Brush, size: number, a: InputPoint, b: InputPoint, carry: number, random = Math.random): { dabs: Dab[]; carry: number } {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const dabs: Dab[] = []
  let d = carry
  // Spacing follows the size at the start of the segment; at least half a pixel.
  const step = () => Math.max(0.5, size * lerp(1, Math.max(a.pressure, 0.05), brush.pressureSize) * brush.spacing)
  for (let s = step(); d + s <= dist; s = step()) {
    d += s
    const t = d / dist
    dabs.push(dabFor(brush, size, lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.pressure, b.pressure, t), random))
  }
  return { dabs, carry: d - dist }
}

/** Stabilizer: moves `prev` part of the way toward `next`. */
export function stabilize(prev: InputPoint, next: InputPoint, smoothing: number): InputPoint {
  const follow = 1 - Math.min(0.92, smoothing * 0.92)
  return { x: lerp(prev.x, next.x, follow), y: lerp(prev.y, next.y, follow), pressure: lerp(prev.pressure, next.pressure, follow) }
}

/** Mirror copies of a point for symmetry guides through the canvas center. */
export function mirrored<T extends { x: number; y: number }>(p: T, width: number, height: number, mode: SymmetryMode): T[] {
  const out = [p]
  if (mode === 'vertical' || mode === 'quad') out.push({ ...p, x: width - p.x })
  if (mode === 'horizontal' || mode === 'quad') out.push({ ...p, y: height - p.y })
  if (mode === 'quad') out.push({ ...p, x: width - p.x, y: height - p.y })
  return out
}

export type SymmetryMode = 'off' | 'vertical' | 'horizontal' | 'quad'
