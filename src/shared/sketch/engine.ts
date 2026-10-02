import type { Id } from '@/core/model'
import { colorStroke, StrokeStamper, type BrushSettings } from './brushes'
import { mirrored, type InputPoint, type SketchDoc, type SketchLayer, type SymmetryMode } from './model'

/**
 * The raster painting engine behind SketchEditor: one offscreen canvas per
 * layer, a stroke buffer so a stroke never gets darker than its opacity
 * (overlapping dabs inside one stroke don't stack), clipping masks, alpha
 * lock, symmetry, a selection that clips painting, and pixel undo.
 */

type Canvas2D = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

function makeCanvas(w: number, h: number): Canvas2D {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!
  return { canvas, ctx }
}

interface UndoStep {
  layerId: Id
  before: ImageData
  after: ImageData
}

const MAX_UNDO = 40

export interface StrokeOptions {
  layer: SketchLayer
  brush: BrushSettings
  color: string
  symmetry: SymmetryMode
  erase: boolean
}

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
  /** The stroke colored, ready to composite. */
  private paint: Canvas2D
  /** Pixels being moved with the Move tool, lifted off their layer. */
  private floating: { layerId: Id; piece: Canvas2D; before: ImageData; dx: number; dy: number } | null = null
  private undoStack: UndoStep[] = []
  private redoStack: UndoStep[] = []
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
    this.version++
  }

  dropLayer(id: Id) {
    this.layers.delete(id)
    this.undoStack = this.undoStack.filter((s) => s.layerId !== id)
    this.redoStack = this.redoStack.filter((s) => s.layerId !== id)
    this.version++
  }

  /** Copy all pixels of one layer into another (duplicate layer). */
  copyLayer(from: Id, to: Id) {
    const dst = this.ensure(to)
    dst.ctx.clearRect(0, 0, this.width, this.height)
    dst.ctx.drawImage(this.ensure(from).canvas, 0, 0)
    this.version++
  }

  // ---- Strokes --------------------------------------------------------------

  beginStroke(opts: StrokeOptions, p: InputPoint) {
    this.stroke = makeCanvas(this.width, this.height)
    this.strokeOpts = opts
    const mirror = (q: { x: number; y: number }) => mirrored(q, this.width, this.height, opts.symmetry)
    this.stamper = new StrokeStamper(this.stroke.ctx, opts.brush, mirror)
    this.stamper.add(p)
    this.version++
  }

  strokeTo(p: InputPoint) {
    if (!this.stamper) return
    this.stamper.add(p)
    this.version++
  }

  /** Draw the stroke into `ctx` the way it will land on the layer. */
  private applyStroke(ctx: CanvasRenderingContext2D, opts: StrokeOptions) {
    colorStroke(this.stroke!.canvas, this.paint.ctx, opts.erase ? '#000' : opts.color, opts.brush)
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
    this.stamper?.finish()
    const layer = this.ensure(opts.layer.id)
    const before = layer.ctx.getImageData(0, 0, this.width, this.height)
    this.applyStroke(layer.ctx, opts)
    this.record(opts.layer.id, before)
    this.stroke = null
    this.stamper = null
    this.strokeOpts = null
    this.version++
    return opts.layer.id
  }

  cancelStroke() {
    this.stroke = null
    this.stamper = null
    this.strokeOpts = null
    this.version++
  }

  get stroking() {
    return !!this.stroke
  }

  // ---- Pixel edits ----------------------------------------------------------

  private record(layerId: Id, before: ImageData) {
    const after = this.ensure(layerId).ctx.getImageData(0, 0, this.width, this.height)
    this.undoStack.push({ layerId, before, after })
    // ponytail: full-layer snapshots, ~8 MB each at 1080p; store dirty rectangles if memory becomes a problem.
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift()
    this.redoStack = []
  }

  /** Run a pixel edit on a layer with undo, e.g. clear or fill. */
  edit(layerId: Id, fn: (ctx: CanvasRenderingContext2D) => void): Id {
    const layer = this.ensure(layerId)
    const before = layer.ctx.getImageData(0, 0, this.width, this.height)
    layer.ctx.save()
    fn(layer.ctx)
    layer.ctx.restore()
    this.record(layerId, before)
    this.version++
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
    const before = layer.ctx.getImageData(0, 0, this.width, this.height)
    const piece = makeCanvas(this.width, this.height)
    piece.ctx.save()
    if (this.selection) piece.ctx.clip(this.selection)
    piece.ctx.drawImage(layer.canvas, 0, 0)
    piece.ctx.restore()
    layer.ctx.save()
    if (this.selection) layer.ctx.clip(this.selection)
    layer.ctx.clearRect(0, 0, this.width, this.height)
    layer.ctx.restore()
    this.floating = { layerId, piece, before, dx: 0, dy: 0 }
    this.version++
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
    layer.ctx.drawImage(f.piece.canvas, Math.round(f.dx), Math.round(f.dy))
    if (!f.dx && !f.dy) {
      layer.ctx.putImageData(f.before, 0, 0)
      this.version++
      return null
    }
    this.record(f.layerId, f.before)
    this.version++
    return f.layerId
  }

  get moving() {
    return !!this.floating
  }

  /** Merge `upper` into `lower` with the upper layer's opacity and blend mode. */
  mergeDown(upper: SketchLayer, lowerId: Id): Id {
    const top = this.ensure(upper.id).canvas
    return this.edit(lowerId, (ctx) => {
      ctx.globalAlpha = upper.opacity
      ctx.globalCompositeOperation = upper.blend
      ctx.drawImage(top, 0, 0)
    })
  }

  undo(): Id | null {
    const step = this.undoStack.pop()
    if (!step) return null
    this.ensure(step.layerId).ctx.putImageData(step.before, 0, 0)
    this.redoStack.push(step)
    this.version++
    return step.layerId
  }

  redo(): Id | null {
    const step = this.redoStack.pop()
    if (!step) return null
    this.ensure(step.layerId).ctx.putImageData(step.after, 0, 0)
    this.undoStack.push(step)
    this.version++
    return step.layerId
  }

  get canUndo() {
    return this.undoStack.length > 0
  }
  get canRedo() {
    return this.redoStack.length > 0
  }

  // ---- Compositing ----------------------------------------------------------

  /** Flatten the visible layers (with the live stroke) into one canvas at document size. */
  render(doc: Pick<SketchDoc, 'layers' | 'backgroundColor'>, withBackground = true): HTMLCanvasElement {
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
      let src = this.ensure(layer.id).canvas
      if (this.stroke && this.strokeOpts?.layer.id === layer.id) {
        // Show the stroke as it will land, without touching the layer yet.
        const s = this.scratch.ctx
        s.globalCompositeOperation = 'source-over'
        s.globalAlpha = 1
        s.clearRect(0, 0, this.width, this.height)
        s.drawImage(src, 0, 0)
        this.applyStroke(s, this.strokeOpts)
        src = this.scratch.canvas
      } else if (this.floating?.layerId === layer.id) {
        const s = this.scratch.ctx
        s.globalCompositeOperation = 'source-over'
        s.globalAlpha = 1
        s.clearRect(0, 0, this.width, this.height)
        s.drawImage(src, 0, 0)
        s.drawImage(this.floating.piece.canvas, this.floating.dx, this.floating.dy)
        src = this.scratch.canvas
      }
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
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = layer.blend
      ctx.drawImage(src, 0, 0)
    }
    ctx.restore()
    return canvas
  }

  /** The color under a canvas pixel in the flattened picture, as #rrggbb, or null if transparent. */
  pickColor(doc: SketchDoc, x: number, y: number): string | null {
    const canvas = this.render(doc)
    const [r, g, b, a] = canvas.getContext('2d')!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
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

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png'))
}
