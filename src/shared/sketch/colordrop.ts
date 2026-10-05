import { useEffect, useMemo, useState } from 'react'
import type { Id } from '@/core/model'
import type { SketchEngine } from './engine'
import { isGroup, lockedInTree } from './layers'
import type { SketchDoc, SketchLayer } from './model'
import { floodMask, grow } from './selection'

type Pt = { x: number; y: number }

export interface DropContext {
  doc: SketchDoc
  layer: SketchLayer | undefined
  /** Screen point to canvas pixels, or null when outside the canvas. */
  toDoc(clientX: number, clientY: number): Pt | null
  markDirty(id: Id | null): void
}

/** How long the pen rests on the canvas before sideways drags change the threshold. */
const HOLD_MS = 450

/**
 * ColorDrop (Sketch Pro): drag the colour onto the canvas to fill the area under it.
 * Rest before letting go and drag sideways to change the threshold with a live preview.
 * Afterwards "Continue filling" fills with every click; Recolor swaps a colour in place.
 */
export class ColorDrop {
  threshold = 0.12
  /** Clicks on the canvas keep filling with this colour. */
  continuing: string | null = null
  recolor = false
  /** Coloured preview of the fill (document size) while adjusting the threshold. */
  preview: HTMLCanvasElement | null = null
  /** The colour being dragged and where the pointer is (screen), for the drag chip. */
  dragging: { color: string; x: number; y: number } | null = null
  version = 0
  ctx: DropContext | null = null
  private engine: SketchEngine
  private onChange: () => void = () => {}
  private hold: { at: Pt; sx: number; base: number; data: ImageData; mask?: Uint8Array; adjusting: boolean; timer?: ReturnType<typeof setTimeout> } | null = null

  constructor(engine: SketchEngine) {
    this.engine = engine
  }

  listen(fn: () => void) {
    this.onChange = fn
  }

  bind(ctx: DropContext) {
    this.ctx = ctx
  }

  private changed() {
    this.version++
    this.onChange()
  }

  patch(p: Partial<Pick<ColorDrop, 'threshold' | 'recolor' | 'continuing'>>) {
    Object.assign(this, p)
    this.changed()
  }

  stop() {
    if (!this.continuing && !this.recolor) return
    this.continuing = null
    this.recolor = false
    this.changed()
  }

  private target(): SketchLayer | null {
    const l = this.ctx?.layer
    if (!l || isGroup(l) || !l.visible || lockedInTree(this.ctx!.doc.layers, l.id)) return null
    return l
  }

  /** Pixels the fill looks at: the reference layer when there is one (not for Recolor), else the layer itself. */
  private source(layer: SketchLayer): ImageData {
    const ref = this.recolor ? null : this.ctx!.doc.layers.find((l) => l.reference && !isGroup(l))
    return this.engine.pixels(this.ctx!.doc, (ref ?? layer).id)
  }

  private maskAt(data: ImageData, p: Pt, threshold: number) {
    return grow(floodMask(data.data, data.width, data.height, p.x, p.y, threshold), data.width, data.height, this.recolor ? 0 : 1)
  }

  /** Fill (or recolour) at a canvas point. */
  fillAt(p: Pt, color: string, threshold = this.threshold, data?: ImageData, mask?: Uint8Array) {
    const layer = this.target()
    if (!layer) return
    data ??= this.source(layer)
    mask ??= this.maskAt(data, p, threshold)
    this.ctx!.markDirty(this.engine.fillMask(layer.id, mask, color, this.recolor || layer.alphaLock))
  }

  // ---- Dragging the colour from the panel -----------------------------------

  /** Start dragging `color` (pointer down on the colour swatch). */
  begin(color: string, e: { clientX: number; clientY: number; pointerId: number }) {
    const move = (ev: PointerEvent) => this.move(color, ev)
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      this.end(color, ev)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    this.dragging = { color, x: e.clientX, y: e.clientY }
    this.changed()
  }

  private move(color: string, ev: PointerEvent) {
    this.dragging = { color, x: ev.clientX, y: ev.clientY }
    const p = this.ctx?.toDoc(ev.clientX, ev.clientY) ?? null
    const h = this.hold
    if (h?.adjusting) {
      // Sideways drags change the threshold.
      const t = Math.min(1, Math.max(0, h.base + (ev.clientX - h.sx) / 400))
      if (Math.abs(t - this.threshold) > 0.004) {
        this.threshold = t
        this.showPreview(color)
      }
      return this.changed()
    }
    if (h && p && Math.hypot(p.x - h.at.x, p.y - h.at.y) < 3) return this.changed()
    // The pointer moved: rest again before adjusting.
    if (h?.timer) clearTimeout(h.timer)
    this.hold = null
    const layer = this.target()
    if (p && layer) {
      const timer = setTimeout(() => {
        if (this.hold?.timer !== timer) return
        this.hold.data = this.source(layer)
        this.hold.adjusting = true
        this.showPreview(color)
        this.changed()
      }, HOLD_MS)
      this.hold = { at: p, sx: ev.clientX, base: this.threshold, data: null as unknown as ImageData, adjusting: false, timer }
    }
    this.changed()
  }

  private showPreview(color: string) {
    const h = this.hold
    if (!h?.data) return
    h.mask = this.maskAt(h.data, h.at, this.threshold)
    const c = this.preview ?? document.createElement('canvas')
    c.width = h.data.width
    c.height = h.data.height
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(c.width, c.height)
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
    for (let p = 0; p < h.mask.length; p++) {
      if (!h.mask[p]) continue
      img.data.set([r, g, b, h.mask[p]], p * 4)
    }
    ctx.putImageData(img, 0, 0)
    this.preview = c
  }

  private end(color: string, ev: PointerEvent) {
    const h = this.hold
    if (h?.timer) clearTimeout(h.timer)
    this.hold = null
    this.dragging = null
    this.preview = null
    const p = this.ctx?.toDoc(ev.clientX, ev.clientY) ?? null
    if (p) {
      if (h?.adjusting) this.fillAt(h.at, color, this.threshold, h.data, h.mask)
      else this.fillAt(p, color)
      this.continuing = color
    }
    this.changed()
  }
}

export function useColorDrop(engine: SketchEngine, ctx: DropContext, tool: string): ColorDrop {
  const drop = useMemo(() => new ColorDrop(engine), [engine])
  const [, setVersion] = useState(0)
  useEffect(() => {
    drop.listen(() => setVersion(drop.version))
  }, [drop])
  useEffect(() => {
    drop.bind(ctx)
  })
  // Picking another tool ends continue filling.
  useEffect(() => drop.stop(), [drop, tool])
  return drop
}
