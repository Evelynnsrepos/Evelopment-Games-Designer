import { useEffect, useRef } from 'react'
import type { Id } from '@/core/model'
import { insertAbove, isGroup, shownInTree } from './layers'
import type { LayerHost } from './LayersPanel'
import { newLayer, updateLayer, type SketchLayer } from './model'
import { cssFont, defaultText, drawText, layoutText, normalizeText, type SketchText } from './text'

/** Text layers in the editor (Sketch Pro): drawing them into their layer canvas, and the Text tool. */

/** Measuring canvas for hit tests and boxes. */
let measureCtx: CanvasRenderingContext2D | null = null
export function textBox(t: SketchText) {
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  const ctx = measureCtx
  ctx.font = cssFont(t)
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(t.size * t.tracking) / 100}px`
  ctx.fontKerning = t.kerning ? 'normal' : 'none'
  return layoutText(t, (s) => ctx.measureText(s).width).box
}

/** One reused canvas to draw text in before it replaces the layer's pixels. */
let scratch: HTMLCanvasElement | null = null
function renderText(host: LayerHost, l: SketchLayer) {
  const { width, height } = host.engine
  scratch ??= document.createElement('canvas')
  if (scratch.width !== width || scratch.height !== height) {
    scratch.width = width
    scratch.height = height
  }
  const ctx = scratch.getContext('2d')!
  ctx.clearRect(0, 0, width, height)
  drawText(ctx, normalizeText(l.text!))
  host.engine.setLayerImage(l.id, scratch)
}

/** Draw text layers again whenever their settings (or the loaded fonts) change. */
export function useTextLayers(host: LayerHost, fontsReady: number) {
  const seen = useRef(new Map<Id, string>())
  useEffect(() => {
    for (const l of host.doc.layers) {
      if (!l.text) {
        seen.current.delete(l.id)
        continue
      }
      const key = `${JSON.stringify(l.text)}|${fontsReady}`
      const prev = seen.current.get(l.id)
      if (prev === key) continue
      seen.current.set(l.id, key)
      // Saved text opens with its saved pixels until something changes.
      if (prev === undefined && l.image) continue
      renderText(host, l)
      host.markDirty(l.id)
    }
  })
}

/** The Text tool: click to add a text layer, drag a text box to move it. */
export function useTextTool(host: LayerHost) {
  const drag = useRef<{ id: Id; from: { x: number; y: number }; start: { x: number; y: number } } | null>(null)
  const hitAt = (p: { x: number; y: number }) =>
    [...host.doc.layers].reverse().find((l) => {
      if (!l.text || !shownInTree(host.doc.layers, l.id)) return false
      const b = textBox(normalizeText(l.text))
      const pad = 8
      return p.x >= b.x - pad && p.y >= b.y - pad && p.x <= b.x + b.w + pad && p.y <= b.y + b.h + pad
    })
  return {
    /** `moveOnly`: the Move tool on a text layer drags it instead of its pixels. */
    down(p: { x: number; y: number }, moveOnly = false) {
      const active = host.doc.layers.find((l) => l.id === host.activeId)
      const hit = moveOnly ? active : hitAt(p)
      if (hit?.text) {
        host.setActive(hit.id)
        drag.current = { id: hit.id, from: p, start: { x: hit.text.x, y: hit.text.y } }
        return
      }
      if (moveOnly || host.doc.layers.filter((l) => !isGroup(l)).length >= host.limit) return
      const size = Math.max(12, Math.round(Math.min(host.doc.width, host.doc.height) / 12))
      const layer: SketchLayer = { ...newLayer('Text'), text: defaultText(Math.round(p.x), Math.round(p.y - size * 0.6), size, host.color) }
      host.adopt(layer.id)
      host.engine.setLayerImage(layer.id, null)
      host.update((d) => ({ ...d, layers: insertAbove(d.layers, layer, host.activeId) }))
      host.setActive(layer.id)
    },
    move(p: { x: number; y: number }) {
      const g = drag.current
      if (!g) return false
      const x = Math.round(g.start.x + p.x - g.from.x)
      const y = Math.round(g.start.y + p.y - g.from.y)
      host.update((d) => updateLayer(d, g.id, { text: { ...d.layers.find((l) => l.id === g.id)!.text!, x, y } }))
      return true
    },
    up() {
      const was = !!drag.current
      drag.current = null
      return was
    },
  }
}

