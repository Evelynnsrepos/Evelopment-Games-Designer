import { newId, type Id } from '@/core/model'

/**
 * Brushes (v0.5), with a Brush Library and Brush Studio:
 * brushes live in sets, every brush has a stroke preview, and all settings
 * can be edited. A stroke is a row of stamps ("dabs") of the brush shape.
 * Stamps are drawn as an alpha mask and colored once per stroke, so colored
 * strokes have clean edges and overlapping stamps never get darker.
 */

export const SHAPES = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'chalk', label: 'Chalk' },
  { id: 'splatter', label: 'Splatter' },
  { id: 'bristle', label: 'Bristle' },
] as const
export type BrushShape = (typeof SHAPES)[number]['id']

export const GRAINS = [
  { id: 'none', label: 'None' },
  { id: 'paper', label: 'Paper' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'noise', label: 'Noise' },
] as const
export type BrushGrain = (typeof GRAINS)[number]['id']

export interface BrushSettings {
  // Properties
  /** Diameter in canvas pixels at full pressure. */
  size: number
  /** 0..1, the most a single stroke can cover. */
  opacity: number
  // Stroke path
  /** Distance between stamps as a fraction of their diameter. */
  spacing: number
  /** 0..1 random change of the spacing. */
  spacingJitter: number
  /** 0..1 random sideways offset, as a fraction of the size. */
  scatter: number
  /** Stamps per point, scattered around it. */
  count: number
  // Stabilization
  /** 0..1, StreamLine. */
  streamline: number
  // Taper
  /** Length in px over which the stroke grows / shrinks at its ends; 0 = off. */
  taperStart: number
  taperEnd: number
  // Shape
  shape: BrushShape
  /** 0..1, 1 = crisp edge. */
  hardness: number
  /** 0.05..1, 1 = circle, lower = flat ellipse. */
  roundness: number
  /** 'follow' turns stamps with the stroke; a number is a fixed angle in degrees. */
  rotation: 'follow' | 'random' | number
  // Grain
  grain: BrushGrain
  /** 0..1 */
  grainDepth: number
  // Rendering
  /** 0..1, how much each stamp adds; low flow builds up like an airbrush. */
  flow: number
  // Dynamics
  sizeJitter: number
  opacityJitter: number
  // Pressure
  /** 0..1 how much pen pressure changes size / opacity. */
  pressureSize: number
  pressureOpacity: number
}

export interface BrushDef extends BrushSettings {
  id: Id
  name: string
  /** Built-in brushes can be reset to these settings. */
  builtIn?: boolean
}

export interface BrushSet {
  id: Id
  name: string
  brushIds: Id[]
  builtIn?: boolean
}

export interface BrushLibrary {
  sets: BrushSet[]
  brushes: BrushDef[]
  /** Most recent first, at most 8. */
  recent: Id[]
}

const base: BrushSettings = {
  size: 12,
  opacity: 1,
  spacing: 0.1,
  spacingJitter: 0,
  scatter: 0,
  count: 1,
  streamline: 0.3,
  taperStart: 0,
  taperEnd: 0,
  shape: 'round',
  hardness: 0.9,
  roundness: 1,
  rotation: 'follow',
  grain: 'none',
  grainDepth: 0.6,
  flow: 1,
  sizeJitter: 0,
  opacityJitter: 0,
  pressureSize: 0.6,
  pressureOpacity: 0,
}

type Def = [id: string, name: string, settings: Partial<BrushSettings>]

/** The default library: sets and brushes. Ids are fixed so built-ins can be reset. */
const DEFAULT_SETS: [setId: string, name: string, brushes: Def[]][] = [
  [
    'sketching',
    'Sketching',
    [
      ['hb-pencil', 'HB Pencil', { size: 5, opacity: 0.85, flow: 0.55, shape: 'chalk', hardness: 0.7, grain: 'paper', grainDepth: 0.55, pressureSize: 0.5, pressureOpacity: 0.8, streamline: 0.15, spacing: 0.12 }],
      ['6b-pencil', '6B Pencil', { size: 10, opacity: 0.95, flow: 0.7, shape: 'chalk', hardness: 0.6, grain: 'paper', grainDepth: 0.75, pressureSize: 0.5, pressureOpacity: 0.9, streamline: 0.1 }],
      ['sketch-pen', 'Sketch Pen', { size: 4, hardness: 1, pressureSize: 0.7, streamline: 0.35, taperStart: 20, taperEnd: 20, spacing: 0.06 }],
    ],
  ],
  [
    'inking',
    'Inking',
    [
      ['studio-pen', 'Studio Pen', { size: 10, hardness: 1, pressureSize: 0.9, streamline: 0.55, taperStart: 30, taperEnd: 40, spacing: 0.05 }],
      ['technical-pen', 'Technical Pen', { size: 6, hardness: 1, pressureSize: 0.15, streamline: 0.6, spacing: 0.05 }],
      ['dry-ink', 'Dry Ink', { size: 14, hardness: 0.95, shape: 'chalk', grain: 'paper', grainDepth: 0.45, pressureSize: 0.8, streamline: 0.4, taperEnd: 25, spacing: 0.06 }],
    ],
  ],
  [
    'calligraphy',
    'Calligraphy',
    [
      ['chisel', 'Chisel', { size: 24, hardness: 1, roundness: 0.18, rotation: 35, pressureSize: 0.4, streamline: 0.5, spacing: 0.04 }],
      ['brush-pen', 'Brush Pen', { size: 18, hardness: 1, roundness: 0.6, pressureSize: 1, streamline: 0.5, taperStart: 30, taperEnd: 60, spacing: 0.04 }],
    ],
  ],
  [
    'painting',
    'Painting',
    [
      ['round-brush', 'Round Brush', { size: 40, flow: 0.45, hardness: 0.65, pressureSize: 0.5, pressureOpacity: 0.6, streamline: 0.25, spacing: 0.07 }],
      ['flat-brush', 'Flat Brush', { size: 46, flow: 0.6, shape: 'bristle', hardness: 0.8, roundness: 0.35, pressureSize: 0.4, pressureOpacity: 0.5, streamline: 0.25, spacing: 0.05 }],
      ['gouache', 'Gouache', { size: 50, flow: 0.8, shape: 'bristle', hardness: 0.7, grain: 'canvas', grainDepth: 0.4, pressureSize: 0.4, pressureOpacity: 0.3, spacing: 0.06 }],
    ],
  ],
  [
    'airbrushing',
    'Airbrushing',
    [
      ['soft-airbrush', 'Soft Airbrush', { size: 140, flow: 0.06, hardness: 0, pressureSize: 0.1, pressureOpacity: 0.9, streamline: 0.2, spacing: 0.06 }],
      ['medium-airbrush', 'Medium Airbrush', { size: 70, flow: 0.12, hardness: 0.4, pressureSize: 0.2, pressureOpacity: 0.9, spacing: 0.06 }],
      ['hard-airbrush', 'Hard Airbrush', { size: 50, flow: 0.25, hardness: 0.9, pressureSize: 0.2, pressureOpacity: 0.7, spacing: 0.06 }],
    ],
  ],
  [
    'markers',
    'Markers',
    [
      ['marker', 'Marker', { size: 28, opacity: 0.65, hardness: 0.85, pressureSize: 0.2, streamline: 0.3 }],
      ['highlighter', 'Highlighter', { size: 30, opacity: 0.45, shape: 'square', hardness: 1, roundness: 0.35, rotation: 0, pressureSize: 0, streamline: 0.5 }],
    ],
  ],
  [
    'textures',
    'Textures',
    [
      ['spray', 'Spray Paint', { size: 60, flow: 0.35, shape: 'splatter', hardness: 1, count: 3, scatter: 0.6, spacing: 0.25, spacingJitter: 0.5, sizeJitter: 0.5, rotation: 'random', pressureSize: 0.3, pressureOpacity: 0.6 }],
      ['chalk', 'Chalk', { size: 30, flow: 0.8, shape: 'chalk', hardness: 0.6, grain: 'noise', grainDepth: 0.8, pressureSize: 0.4, pressureOpacity: 0.6, rotation: 'random' }],
      ['stipple', 'Stipple', { size: 40, flow: 1, shape: 'round', hardness: 1, count: 4, scatter: 1, spacing: 0.9, spacingJitter: 1, sizeJitter: 0.9, pressureSize: 0.3, pressureOpacity: 0 }],
    ],
  ],
  [
    'erasers',
    'Erasers',
    [
      ['hard-eraser', 'Hard Eraser', { size: 40, hardness: 0.95, pressureSize: 0.3 }],
      ['soft-eraser', 'Soft Eraser', { size: 90, hardness: 0, flow: 0.3, pressureSize: 0.2, pressureOpacity: 0.6 }],
    ],
  ],
]

export function defaultLibrary(): BrushLibrary {
  const brushes: BrushDef[] = []
  const sets: BrushSet[] = []
  for (const [setId, name, defs] of DEFAULT_SETS) {
    sets.push({ id: setId, name, brushIds: defs.map((d) => d[0]), builtIn: true })
    for (const [id, bname, s] of defs) brushes.push({ ...base, ...s, id, name: bname, builtIn: true })
  }
  return { sets, brushes, recent: [] }
}

/** Settings of a built-in brush as shipped (for Reset). */
export function builtInBrush(id: Id): BrushDef | undefined {
  return defaultLibrary().brushes.find((b) => b.id === id)
}

export const DEFAULT_BRUSH_ID = 'hb-pencil'
export const DEFAULT_ERASER_ID = 'hard-eraser'

/** Fill in settings added in later versions, so old libraries keep working. */
export function normalizeBrush(b: Partial<BrushDef> & { id: Id; name: string }): BrushDef {
  return { ...base, ...b } as BrushDef
}

export function newBrush(name = 'New brush'): BrushDef {
  return { ...base, id: newId(), name }
}

export function newSet(name: string): BrushSet {
  return { id: newId(), name, brushIds: [] }
}

// ---- Stamps -----------------------------------------------------------------

/** Deterministic random numbers, so a stroke redrawn with its end taper looks the same. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

const shapeCache = new Map<string, HTMLCanvasElement>()
const TIP = 128

/** The brush tip as a white alpha mask, 128px. */
export function tipImage(shape: BrushShape, hardness: number): HTMLCanvasElement {
  const key = `${shape}|${hardness.toFixed(2)}`
  const cached = shapeCache.get(key)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = c.height = TIP
  const g = c.getContext('2d')!
  const r = TIP / 2
  const h = Math.min(0.99, Math.max(0.01, hardness))
  const soft = (x: number, y: number, rad: number, a = 1) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, `rgba(255,255,255,${a})`)
    grad.addColorStop(h, `rgba(255,255,255,${a})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
  }
  const rnd = seeded(shape.length * 977 + Math.round(hardness * 100))
  if (shape === 'round') soft(r, r, r)
  else if (shape === 'square') {
    g.fillStyle = '#fff'
    const inset = (1 - h) * 12
    g.filter = inset ? `blur(${inset / 2}px)` : 'none'
    g.fillRect(inset, inset, TIP - inset * 2, TIP - inset * 2)
    g.filter = 'none'
  } else if (shape === 'chalk') {
    soft(r, r, r * 0.95)
    // Bite random holes out of the edge and the inside.
    g.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 260; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * r
      g.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.6})`
      g.fillRect(r + Math.cos(a) * d, r + Math.sin(a) * d, 2 + rnd() * 5, 2 + rnd() * 5)
    }
  } else if (shape === 'splatter') {
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.pow(rnd(), 0.7) * r * 0.9
      soft(r + Math.cos(a) * d, r + Math.sin(a) * d, 1.5 + rnd() * 5, 0.6 + rnd() * 0.4)
    }
  } else if (shape === 'bristle') {
    for (let i = 0; i < 44; i++) {
      const x = 8 + rnd() * (TIP - 16)
      soft(x, r + (rnd() - 0.5) * 30, 4 + rnd() * 6, 0.35 + rnd() * 0.5)
    }
  }
  shapeCache.set(key, c)
  return c
}

const grainCache = new Map<string, CanvasPattern>()

/** A repeating alpha texture that is multiplied into the stroke. */
export function grainPattern(ctx: CanvasRenderingContext2D, grain: BrushGrain, depth: number): CanvasPattern | null {
  if (grain === 'none') return null
  const key = `${grain}|${depth.toFixed(2)}`
  let p = grainCache.get(key)
  if (p) return p
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  const rnd = seeded(grain.length * 31)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v: number
      if (grain === 'canvas') v = 0.55 + 0.45 * Math.abs(Math.sin(x * 0.7) * Math.sin(y * 0.7)) * (0.7 + rnd() * 0.3)
      else if (grain === 'paper') v = 0.5 + rnd() * 0.5 * (0.6 + 0.4 * Math.sin((x + y * 0.3) * 0.15))
      else v = rnd()
      const a = 1 - depth * (1 - v)
      const i = (y * size + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255)
    }
  }
  g.putImageData(img, 0, 0)
  p = ctx.createPattern(c, 'repeat')!
  grainCache.set(key, p)
  return p
}

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Stamps one stroke into an alpha mask. Keeps the distance travelled so taper
 * and spacing are right; `redraw` replays all points once the end is known.
 */
export class StrokeStamper {
  private points: StrokePoint[] = []
  private dist = 0
  private carry = 0
  private rand: () => number
  private seed: number
  private ctx: CanvasRenderingContext2D
  private brush: BrushSettings
  private mirror: (p: { x: number; y: number }) => { x: number; y: number }[]

  constructor(
    ctx: CanvasRenderingContext2D,
    brush: BrushSettings,
    mirror: (p: { x: number; y: number }) => { x: number; y: number }[] = (p) => [p],
    seed = Math.floor(Math.random() * 1e9),
  ) {
    this.ctx = ctx
    this.brush = brush
    this.mirror = mirror
    this.seed = seed
    this.rand = seeded(seed)
  }

  get length() {
    return this.dist
  }

  add(p: StrokePoint) {
    const prev = this.points[this.points.length - 1]
    this.points.push(p)
    if (!prev) {
      this.stamp(p, 0, 0, Infinity)
      this.carry = this.stepAt(p.pressure, 0, Infinity)
    } else this.segment(prev, p, Infinity)
  }

  /** Clear and draw the whole stroke again with the end taper (the stroke length is known now). */
  finish() {
    if (!this.brush.taperEnd || this.points.length < 2) return
    const total = this.dist
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
    this.rand = seeded(this.seed)
    this.dist = 0
    this.carry = 0
    const pts = this.points
    this.points = []
    for (const p of pts) {
      const prev = this.points[this.points.length - 1]
      this.points.push(p)
      if (!prev) {
        this.stamp(p, 0, 0, total)
        this.carry = this.stepAt(p.pressure, 0, total)
      } else this.segment(prev, p, total)
    }
  }

  /** Distance to the next stamp, for the size at `pressure` / position `at`. */
  private stepAt(pressure: number, at: number, total: number) {
    const size = this.sizeAt(pressure, at, total)
    return Math.max(0.4, size * this.brush.spacing * (1 + (this.rand() - 0.5) * 2 * this.brush.spacingJitter))
  }

  private segment(a: StrokePoint, b: StrokePoint, total: number) {
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d === 0) return
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    // `carry` is how far into this segment the next stamp goes, so spacing stays even across points.
    let t = this.carry
    while (t <= d) {
      const k = t / d
      const pressure = lerp(a.pressure, b.pressure, k)
      this.stamp({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), pressure }, angle, this.dist + t, total)
      t += this.stepAt(pressure, this.dist + t, total)
    }
    this.carry = t - d
    this.dist += d
  }

  private sizeAt(pressure: number, at: number, total: number) {
    const b = this.brush
    let s = b.size * lerp(1, Math.max(0.02, pressure), b.pressureSize)
    if (b.taperStart > 0) s *= Math.min(1, 0.15 + (0.85 * at) / b.taperStart)
    if (b.taperEnd > 0 && Number.isFinite(total)) s *= Math.min(1, 0.15 + (0.85 * Math.max(0, total - at)) / b.taperEnd)
    return Math.max(0.5, s)
  }

  private stamp(p: StrokePoint, angle: number, at: number, total: number) {
    const b = this.brush
    const ctx = this.ctx
    const tip = tipImage(b.shape, b.hardness)
    const baseSize = this.sizeAt(p.pressure, at, total)
    for (let i = 0; i < Math.max(1, b.count); i++) {
      const size = baseSize * (1 - b.sizeJitter * this.rand() * 0.8)
      const alpha = b.flow * lerp(1, Math.max(0.02, p.pressure), b.pressureOpacity) * (1 - b.opacityJitter * this.rand())
      const off = b.scatter * baseSize * (this.rand() - 0.5)
      const x = p.x - Math.sin(angle) * off + (b.count > 1 ? (this.rand() - 0.5) * baseSize * b.scatter : 0)
      const y = p.y + Math.cos(angle) * off + (b.count > 1 ? (this.rand() - 0.5) * baseSize * b.scatter : 0)
      const rot = b.rotation === 'follow' ? angle : b.rotation === 'random' ? this.rand() * Math.PI * 2 : (b.rotation * Math.PI) / 180
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha))
      for (const m of this.mirror({ x, y })) {
        ctx.save()
        ctx.translate(m.x, m.y)
        ctx.rotate(rot)
        ctx.scale(1, b.roundness)
        ctx.drawImage(tip, -size / 2, -size / 2, size, size)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
  }
}

/**
 * Turn a stroke's alpha mask into paint: color it, add grain. Draws into `out`
 * (cleared first) so callers can composite it with the brush opacity.
 */
export function colorStroke(mask: HTMLCanvasElement, out: CanvasRenderingContext2D, color: string, brush: BrushSettings) {
  out.save()
  out.globalCompositeOperation = 'source-over'
  out.globalAlpha = 1
  out.clearRect(0, 0, out.canvas.width, out.canvas.height)
  out.drawImage(mask, 0, 0)
  out.globalCompositeOperation = 'source-in'
  out.fillStyle = color
  out.fillRect(0, 0, out.canvas.width, out.canvas.height)
  const grain = grainPattern(out, brush.grain, brush.grainDepth)
  if (grain) {
    out.globalCompositeOperation = 'destination-in'
    out.fillStyle = grain
    out.fillRect(0, 0, out.canvas.width, out.canvas.height)
  }
  out.restore()
}

/** Preview: an S-curve left to right, pressure rising then falling off at the end. */
export function drawPreview(canvas: HTMLCanvasElement, brush: BrushSettings, color: string) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  const mask = document.createElement('canvas')
  mask.width = w
  mask.height = h
  // Big brushes are shown smaller so the whole stroke fits.
  const fit = Math.min(1, (h * 0.55) / brush.size)
  const s = new StrokeStamper(mask.getContext('2d')!, { ...brush, size: brush.size * fit, taperStart: brush.taperStart * fit, taperEnd: brush.taperEnd * fit }, undefined, 7)
  const n = 60
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const pressure = t < 0.75 ? 0.15 + t * 1.1 : Math.max(0.05, 1 - (t - 0.75) * 3.6)
    s.add({ x: 10 + t * (w - 20), y: h / 2 + Math.sin(t * Math.PI * 2) * h * 0.22, pressure })
  }
  s.finish()
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  colorStroke(mask, out.getContext('2d')!, color, brush)
  ctx.globalAlpha = brush.opacity
  ctx.drawImage(out, 0, 0)
  ctx.globalAlpha = 1
}
