import type { Id } from '@/core/model'
import { blendPixel, CANVAS_BLENDS, type BlendMode } from './blend'
import { colorStroke, StrokeStamper, type BrushSettings } from './brushes'
import { GlCompositor, parseHex, type GlLayer } from './gl'
import { mirrored, type InputPoint, type SketchDoc, type SketchLayer, type SymmetryMode } from './model'
import { TileHistory, tilesIn, type Rect } from './tiles'

/**
 * The raster painting engine behind SketchEditor: one offscreen canvas per
 * layer, a stroke buffer so a stroke never gets darker than its opacity
 * (overlapping dabs inside one stroke don't stack), clipping masks, alpha
 * lock, symmetry, a selection that clips painting, and tile-diff undo (250 steps).
 * Layers are blended on the GPU with every blend mode (Sketch Pro); without
 * WebGL2 they are blended in Canvas 2D.
 */

type Canvas2D = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

function makeCanvas(w: number, h: number): Canvas2D {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!
  return { canvas, ctx }
}

export interface StrokeOptions {
  layer: SketchLayer
  brush: BrushSettings
  color: string
  symmetry: SymmetryMode
  erase: boolean
  /** Copies of each dab for a symmetry guide; replaces `symmetry` when set (Sketch Pro guides). */
  mirror?: ((p: { x: number; y: number }) => { x: number; y: number }[]) | null
}

type LayerStack = Pick<SketchDoc, 'layers' | 'backgroundColor'>

export class SketchEngine {
  readonly width: number
  readonly height: number
  private layers = new Map<Id, Canvas2D>()
  private composite: Canvas2D
  private scratch: Canvas2D
  /** Alpha mask of the stroke being drawn. */
  private stroke: Canvas2D | null = null
  private stamper: StrokeStamper | null = null
  private strokeOpts: StrokeOptions | null = null
  /** How far the stroke being drawn reaches (dab centers), so undo only keeps those tiles. */
  private strokeBounds: { x0: number; y0: number; x1: number; y1: number } | null = null
  /** Predicted points ahead of the pen, shown for one frame only and never saved (Sketch Pro). */
  private predicted: Canvas2D | null = null
  private joined: Canvas2D | null = null
  /** The stroke colored, ready to composite. */
  private paint: Canvas2D
  /** Pixels being moved with the Move tool, lifted off their layer. */
  private floating: { layerId: Id; piece: Canvas2D; rects: Rect[]; before: ImageData[]; dx: number; dy: number } | null = null
  private history = new TileHistory()
  /** Bumped per layer whenever its pixels change, so the GPU only uploads changed layers. */
  private layerVersions = new Map<Id, number>()
  private previewVersion = 0
  private gpu: GlCompositor | null
  /** Painting only lands inside this path (canvas pixels); null = everywhere. */
  selection: Path2D | null = null
  /** Bumped on every visible change; the view redraws when it changes. */
  version = 0

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.composite = makeCanvas(width, height)
    this.scratch = makeCanvas(width, height)
    this.paint = makeCanvas(width, height)
    this.gpu = GlCompositor.create(width, height)
  }

  /** True when layers are blended on the GPU. */
  get gpuActive() {
    return !!this.gpu && !this.gpu.lost
  }

  private touched(id: Id) {
    this.layerVersions.set(id, (this.layerVersions.get(id) ?? 0) + 1)
    this.version++
  }

  layerCanvas(id: Id): HTMLCanvasElement {
    return this.ensure(id).canvas
  }

  private ensure(id: Id): Canvas2D {
    let c = this.layers.get(id)
    if (!c) {
      c = makeCanvas(this.width, this.height)
      this.layers.set(id, c)
    }
    return c
  }

  /** Replace a layer's pixels with an image (loading a saved document). */
  setLayerImage(id: Id, img: CanvasImageSource | null) {
    const { ctx } = this.ensure(id)
    ctx.clearRect(0, 0, this.width, this.height)
    if (img) ctx.drawImage(img, 0, 0)
    this.touched(id)
  }

  dropLayer(id: Id) {
    this.layers.delete(id)
    this.layerVersions.delete(id)
    this.history.dropLayer(id)
    this.version++
  }

  /** Copy all pixels of one layer into another (duplicate layer). */
  copyLayer(from: Id, to: Id) {
    const dst = this.ensure(to)
    dst.ctx.clearRect(0, 0, this.width, this.height)
    dst.ctx.drawImage(this.ensure(from).canvas, 0, 0)
    this.touched(to)
  }

  // ---- Strokes --------------------------------------------------------------

  /** Mirror copies of a dab, remembering how far the stroke reaches. */
  private mirrorFor(opts: StrokeOptions) {
    return (q: { x: number; y: number }) => {
      const pts = opts.mirror ? opts.mirror(q) : mirrored(q, this.width, this.height, opts.symmetry)
      const b = (this.strokeBounds ??= { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
      for (const m of pts) {
        b.x0 = Math.min(b.x0, m.x)
        b.y0 = Math.min(b.y0, m.y)
        b.x1 = Math.max(b.x1, m.x)
        b.y1 = Math.max(b.y1, m.y)
      }
      return pts
    }
  }

  beginStroke(opts: StrokeOptions, p: InputPoint) {
    this.stroke = makeCanvas(this.width, this.height)
    this.predicted = null
    this.strokeOpts = opts
    this.strokeBounds = null
    this.stamper = new StrokeStamper(this.stroke.ctx, opts.brush, this.mirrorFor(opts))
    this.stamper.add(p)
    this.version++
  }

  strokeTo(p: InputPoint) {
    if (!this.stamper) return
    this.stamper.add(p)
    this.version++
  }

  /**
   * Show predicted points ahead of the stroke (pointer prediction). They are
   * drawn for the live view only: the next call, the end of the stroke or a
   * restroke throws them away, so they never reach the layer or undo.
   */
  predict(points: InputPoint[], from: InputPoint | null) {
    if (!this.stroke || !this.strokeOpts) return
    if (!points.length) {
      if (this.predicted) this.version++
      this.predicted = null
      return
    }
    const pred = (this.predicted ??= makeCanvas(this.width, this.height))
    pred.ctx.clearRect(0, 0, this.width, this.height)
    const opts = this.strokeOpts
    const mirror = (q: { x: number; y: number }) => (opts.mirror ? opts.mirror(q) : mirrored(q, this.width, this.height, opts.symmetry))
    const s = new StrokeStamper(pred.ctx, opts.brush, mirror, 3)
    if (from) s.add(from)
    for (const p of points) s.add(p)
    this.version++
  }

  /** Replace the stroke being drawn with new points (QuickShape). */
  restroke(points: InputPoint[]) {
    if (!this.stroke || !this.strokeOpts) return
    this.stroke.ctx.clearRect(0, 0, this.width, this.height)
    this.predicted = null
    this.strokeBounds = null
    this.stamper = new StrokeStamper(this.stroke.ctx, this.strokeOpts.brush, this.mirrorFor(this.strokeOpts), 1)
    for (const p of points) this.stamper.add(p)
    this.version++
  }

  /** Draw the stroke into `ctx` the way it will land on the layer (with predicted points for the live view only). */
  private applyStroke(ctx: CanvasRenderingContext2D, opts: StrokeOptions, live = false) {
    let mask = this.stroke!.canvas
    if (live && this.predicted) {
      // The prediction joins the stroke mask the same way dabs do, so the preview has no seam.
      const m = (this.joined ??= makeCanvas(this.width, this.height)).ctx
      m.clearRect(0, 0, this.width, this.height)
      m.drawImage(mask, 0, 0)
      m.drawImage(this.predicted.canvas, 0, 0)
      mask = m.canvas
    }
    colorStroke(mask, this.paint.ctx, opts.erase ? '#000' : opts.color, opts.brush)
    ctx.save()
    if (this.selection) ctx.clip(this.selection)
    ctx.globalAlpha = opts.brush.opacity
    ctx.globalCompositeOperation = opts.erase ? 'destination-out' : opts.layer.alphaLock ? 'source-atop' : 'source-over'
    ctx.drawImage(this.paint.canvas, 0, 0)
    ctx.restore()
  }

  /** Finish the stroke: merge it into the layer and record undo. Returns the changed layer. */
  endStroke(): Id | null {
    const opts = this.strokeOpts
    if (!this.stroke || !opts) return null
    this.predicted = null
    this.stamper?.finish()
    const layer = this.ensure(opts.layer.id)
    const b = this.strokeBounds
    const reach = opts.brush.size * (1 + opts.brush.sizeJitter + opts.brush.scatter) + 4
    const area = b ? { x: b.x0 - reach, y: b.y0 - reach, w: b.x1 - b.x0 + 2 * reach, h: b.y1 - b.y0 + 2 * reach } : null
    this.withUndo(opts.layer.id, area, () => this.applyStroke(layer.ctx, opts))
    this.stroke = null
    this.stamper = null
    this.strokeOpts = null
    this.strokeBounds = null
    return opts.layer.id
  }

  cancelStroke() {
    this.predicted = null
    this.stroke = null
    this.stamper = null
    this.strokeOpts = null
    this.strokeBounds = null
    this.version++
  }

  get stroking() {
    return !!this.stroke
  }

  // ---- Pixel edits ----------------------------------------------------------

  private snapshot(layerId: Id, rects: Rect[]) {
    const { ctx } = this.ensure(layerId)
    return rects.map((r) => ctx.getImageData(r.x, r.y, r.w, r.h))
  }

  /** Run `fn` and keep the tiles it changed inside `area` (null = whole layer) for undo. */
  private withUndo(layerId: Id, area: Rect | null, fn: () => void) {
    const rects = tilesIn(area ?? { x: 0, y: 0, w: this.width, h: this.height }, this.width, this.height)
    const before = this.snapshot(layerId, rects)
    fn()
    this.history.push(layerId, rects, before, this.snapshot(layerId, rects))
    this.touched(layerId)
  }

  /** Run a pixel edit on a layer with undo, e.g. clear or fill. */
  edit(layerId: Id, fn: (ctx: CanvasRenderingContext2D) => void): Id {
    const layer = this.ensure(layerId)
    this.withUndo(layerId, null, () => {
      layer.ctx.save()
      fn(layer.ctx)
      layer.ctx.restore()
    })
    return layerId
  }

  /** Clear the selection (or the whole layer). */
  clear(layerId: Id): Id {
    return this.edit(layerId, (ctx) => {
      if (this.selection) {
        ctx.clip(this.selection)
      }
      ctx.clearRect(0, 0, this.width, this.height)
    })
  }

  /** Fill the selection (or the whole layer) with a color. */
  fill(layerId: Id, color: string, alphaLock: boolean): Id {
    return this.edit(layerId, (ctx) => {
      if (this.selection) ctx.clip(this.selection)
      ctx.globalCompositeOperation = alphaLock ? 'source-atop' : 'source-over'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, this.width, this.height)
    })
  }

  /** Flip the selection (or the whole layer) horizontally or vertically. */
  flip(layerId: Id, axis: 'x' | 'y'): Id {
    return this.edit(layerId, (ctx) => {
      const src = makeCanvas(this.width, this.height)
      src.ctx.drawImage(ctx.canvas, 0, 0)
      ctx.clearRect(0, 0, this.width, this.height)
      ctx.translate(axis === 'x' ? this.width : 0, axis === 'y' ? this.height : 0)
      ctx.scale(axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1)
      ctx.drawImage(src.canvas, 0, 0)
    })
  }

  /** Lift the selected pixels (or the whole layer) so they can be dragged with a live preview. */
  beginMove(layerId: Id) {
    const layer = this.ensure(layerId)
    const rects = tilesIn({ x: 0, y: 0, w: this.width, h: this.height }, this.width, this.height)
    const before = this.snapshot(layerId, rects)
    const piece = makeCanvas(this.width, this.height)
    piece.ctx.save()
    if (this.selection) piece.ctx.clip(this.selection)
    piece.ctx.drawImage(layer.canvas, 0, 0)
    piece.ctx.restore()
    layer.ctx.save()
    if (this.selection) layer.ctx.clip(this.selection)
    layer.ctx.clearRect(0, 0, this.width, this.height)
    layer.ctx.restore()
    this.floating = { layerId, piece, rects, before, dx: 0, dy: 0 }
    this.touched(layerId)
  }

  moveTo(dx: number, dy: number) {
    if (!this.floating) return
    this.floating.dx = dx
    this.floating.dy = dy
    this.version++
  }

  /** Drop the lifted pixels at their new place. Returns the changed layer. */
  endMove(): Id | null {
    const f = this.floating
    if (!f) return null
    this.floating = null
    const layer = this.ensure(f.layerId)
    if (!f.dx && !f.dy) {
      f.rects.forEach((r, i) => layer.ctx.putImageData(f.before[i], r.x, r.y))
      this.touched(f.layerId)
      return null
    }
    layer.ctx.drawImage(f.piece.canvas, Math.round(f.dx), Math.round(f.dy))
    this.history.push(f.layerId, f.rects, f.before, this.snapshot(f.layerId, f.rects))
    this.touched(f.layerId)
    return f.layerId
  }

  get moving() {
    return !!this.floating
  }

  /** Merge `upper` into `lower` with the upper layer's opacity and blend mode. */
  mergeDown(upper: SketchLayer, lowerId: Id): Id {
    const lower: SketchLayer = { ...upper, id: lowerId, opacity: 1, blend: 'source-over', clip: false, visible: true }
    const merged = makeCanvas(this.width, this.height)
    merged.ctx.drawImage(this.render({ layers: [lower, { ...upper, clip: false, visible: true }], backgroundColor: null }, false), 0, 0)
    return this.edit(lowerId, (ctx) => {
      ctx.clearRect(0, 0, this.width, this.height)
      ctx.drawImage(merged.canvas, 0, 0)
    })
  }

  private replay(step: ReturnType<TileHistory['undo']>, which: 'before' | 'after'): Id | null {
    if (!step) return null
    const { ctx } = this.ensure(step.layerId)
    for (const t of step.tiles) ctx.putImageData(t[which], t.rect.x, t.rect.y)
    this.touched(step.layerId)
    return step.layerId
  }

  undo(): Id | null {
    return this.replay(this.history.undo(), 'before')
  }

  redo(): Id | null {
    return this.replay(this.history.redo(), 'after')
  }

  get canUndo() {
    return this.history.canUndo
  }
  get canRedo() {
    return this.history.canRedo
  }

  // ---- Compositing ----------------------------------------------------------

  /** A layer's pixels as they look right now: with the live stroke or the lifted pixels on top. */
  private livePixels(layer: SketchLayer): { canvas: HTMLCanvasElement; live: boolean } {
    const src = this.ensure(layer.id).canvas
    const stroking = this.stroke && this.strokeOpts?.layer.id === layer.id
    const moving = this.floating?.layerId === layer.id
    if (!stroking && !moving) return { canvas: src, live: false }
    const s = this.scratch.ctx
    s.globalCompositeOperation = 'source-over'
    s.globalAlpha = 1
    s.clearRect(0, 0, this.width, this.height)
    s.drawImage(src, 0, 0)
    if (stroking) this.applyStroke(s, this.strokeOpts!, true)
    else s.drawImage(this.floating!.piece.canvas, this.floating!.dx, this.floating!.dy)
    return { canvas: this.scratch.canvas, live: true }
  }

  /** Flatten the visible layers (with the live stroke) into one canvas at document size. */
  render(doc: LayerStack, withBackground = true): HTMLCanvasElement {
    if (this.gpu && !this.gpu.lost) {
      try {
        return this.renderGpu(doc, withBackground)
      } catch {
        this.gpu = null
      }
    }
    return this.renderCanvas2d(doc, withBackground)
  }

  private renderGpu(doc: LayerStack, withBackground: boolean): HTMLCanvasElement {
    const gpu = this.gpu!
    const stack: GlLayer[] = []
    let base: string | null = null
    for (const layer of doc.layers) {
      const { canvas, live } = this.livePixels(layer)
      // The live preview has its own texture so the layer's own texture stays valid.
      const key = live ? `${layer.id}:live` : layer.id
      const version = live ? ++this.previewVersion : (this.layerVersions.get(layer.id) ?? 0)
      const entry: GlLayer = { source: canvas, version, key, opacity: layer.opacity, blend: layer.blend, clipTo: layer.clip ? base : null }
      if (!layer.clip) base = key
      // A clipping base must be in the stack even when hidden, with no effect of its own.
      stack.push(layer.visible ? entry : { ...entry, opacity: 0 })
    }
    gpu.prune(new Set([...stack.map((l) => l.key), ...doc.layers.map((l) => l.id)]))
    const bg = withBackground && doc.backgroundColor ? parseHex(doc.backgroundColor) : null
    return gpu.render(stack, bg)
  }

  private renderCanvas2d(doc: LayerStack, withBackground: boolean): HTMLCanvasElement {
    const { ctx, canvas } = this.composite
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, this.width, this.height)
    if (withBackground && doc.backgroundColor) {
      ctx.fillStyle = doc.backgroundColor
      ctx.fillRect(0, 0, this.width, this.height)
    }
    let base: HTMLCanvasElement | null = null
    for (const layer of doc.layers) {
      let src = this.livePixels(layer).canvas
      if (layer.clip && base) {
        // Clipping mask: keep only where the base layer has pixels.
        const tmp = makeCanvas(this.width, this.height)
        tmp.ctx.drawImage(src, 0, 0)
        tmp.ctx.globalCompositeOperation = 'destination-in'
        tmp.ctx.drawImage(base, 0, 0)
        src = tmp.canvas
      } else if (!layer.clip) {
        base = this.ensure(layer.id).canvas
      }
      if (!layer.visible) continue
      if (CANVAS_BLENDS.has(layer.blend)) {
        ctx.globalAlpha = layer.opacity
        ctx.globalCompositeOperation = layer.blend as GlobalCompositeOperation
        ctx.drawImage(src, 0, 0)
      } else {
        ctx.restore()
        cpuBlend(ctx, src, layer.blend, layer.opacity)
        ctx.save()
      }
    }
    ctx.restore()
    return canvas
  }

  /** The color under a canvas pixel in the flattened picture, as #rrggbb, or null if transparent. */
  pickColor(doc: SketchDoc, x: number, y: number): string | null {
    const canvas = this.render(doc)
    const [r, g, b, a] =
      canvas === this.gpu?.canvas ? this.gpu.readPixel(x, y) : canvas.getContext('2d')!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
    if (a === 0) return null
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  }

  layerPng(layerId: Id): Promise<Blob> {
    return toPng(this.ensure(layerId).canvas)
  }

  flattenedPng(doc: SketchDoc, withBackground = true): Promise<Blob> {
    return toPng(this.render(doc, withBackground))
  }

  /** True when the layer has no visible pixels (saved as an empty layer instead of a PNG). */
  isEmpty(layerId: Id): boolean {
    const data = this.ensure(layerId).ctx.getImageData(0, 0, this.width, this.height).data
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false
    return true
  }
}

/** Blend modes Canvas 2D lacks, pixel by pixel (only used without WebGL2). */
function cpuBlend(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, mode: BlendMode, opacity: number) {
  const { width: w, height: h } = ctx.canvas
  const dst = ctx.getImageData(0, 0, w, h)
  const top = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const d = dst.data
  for (let i = 0; i < d.length; i += 4) {
    if (!top[i + 3]) continue
    const o = blendPixel(mode, [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, d[i + 3] / 255], [top[i] / 255, top[i + 1] / 255, top[i + 2] / 255, top[i + 3] / 255], opacity)
    d[i] = o[0] * 255
    d[i + 1] = o[1] * 255
    d[i + 2] = o[2] * 255
    d[i + 3] = o[3] * 255
  }
  ctx.putImageData(dst, 0, 0)
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png'))
}
