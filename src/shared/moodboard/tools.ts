import { Scissors } from 'lucide-react'
import { DRAG_THRESHOLD, rectFromPoints, simplifyPoints, updateNode, worldToLocal, type CanvasApi, type CanvasTool, type Id, type Point, type ToolPointerEvent } from '@/shared/canvas'
import { cutoutFromWorld, ellipseOutline, isImage, rectOutline, type CutoutKind, type MoodImageNode, type MoodNode } from './model'
import type { CutoutDraftNode } from './nodeTypes'

type Api = CanvasApi<MoodNode>

export const CUTOUT_LABELS = {
  tool: 'Cut out',
  kinds: { rect: 'Rectangle cutout', ellipse: 'Ellipse cutout', polygon: 'Polygon cutout (click points, double-click to finish)', lasso: 'Freehand cutout (lasso)' } as Record<CutoutKind, string>,
}

/** Close a polygon when clicking this close (screen px) to its first point. */
const CLOSE_DISTANCE = 10
const movedEnough = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y) >= DRAG_THRESHOLD

/** The image to cut: the single selected image (so hidden parts can be cut back in), else the image under the pointer. */
function pickImage(api: Api, targetId: Id | null): MoodImageNode | null {
  const byId = (id: Id | null) => (id ? api.scene.nodes.find((n) => n.id === id) : undefined)
  if (api.selection.length === 1) {
    const sel = byId(api.selection[0])
    if (isImage(sel)) return sel
  }
  const t = byId(targetId)
  return isImage(t) ? t : null
}

function draftFor(img: MoodImageNode, outline: Point[], closed: boolean): CutoutDraftNode {
  const local = outline.flatMap((p) => {
    const l = worldToLocal(p, img)
    return [l.x, l.y]
  })
  return {
    id: 'cutout-draft',
    kind: 'cutout-draft',
    layerId: img.layerId,
    x: img.x,
    y: img.y,
    rotation: img.rotation,
    scaleX: img.scaleX,
    scaleY: img.scaleY,
    src: img.src,
    width: img.width,
    height: img.height,
    outline: local,
    closed,
  }
}

/**
 * Cut out (X, MB-2): select an image, then drag a rectangle or ellipse, draw a
 * freehand lasso, or click polygon points over it. Everything outside is hidden;
 * the original stays, so cutting again replaces the cutout (MB-8).
 */
export function cutoutTool(kind: () => CutoutKind, onNoImage?: () => void): CanvasTool<MoodNode> {
  let polygon: { img: MoodImageNode; points: Point[] } | null = null

  const show = (api: Api, img: MoodImageNode | null, outline: Point[], closed: boolean) =>
    api.setDraft(img ? [draftFor(img, outline, closed) as unknown as MoodNode] : null)

  const apply = (api: Api, img: MoodImageNode, outline: Point[], k: CutoutKind) => {
    polygon = null
    api.setDraft(null)
    const cutout = cutoutFromWorld(img, outline, k)
    if (!cutout) return
    api.update((s) => updateNode(s, img.id, (n) => ({ ...n, cutout }) as MoodNode))
    api.select([img.id])
  }

  const finishPolygon = (api: Api) => {
    if (polygon && polygon.points.length >= 3) apply(api, polygon.img, polygon.points, 'polygon')
    else cancel(api)
  }
  const cancel = (api: Api) => {
    polygon = null
    api.setDraft(null)
  }

  return {
    id: 'cutout',
    label: CUTOUT_LABELS.tool,
    icon: Scissors,
    shortcut: 'X',
    cursor: 'crosshair',
    pointerDown(e: ToolPointerEvent, api: Api) {
      if (e.button !== 0) return
      const k = kind()

      if (k === 'polygon') {
        if (polygon) {
          const first = polygon.points[0]
          const firstScreen = { x: first.x * api.viewport.scale + api.viewport.x, y: first.y * api.viewport.scale + api.viewport.y }
          if (e.clickCount >= 2 || Math.hypot(e.screen.x - firstScreen.x, e.screen.y - firstScreen.y) < CLOSE_DISTANCE) return finishPolygon(api)
          polygon.points.push(e.world)
          show(api, polygon.img, polygon.points, false)
          return
        }
        const img = pickImage(api, e.targetId)
        if (!img) return onNoImage?.()
        api.select([img.id])
        polygon = { img, points: [e.world] }
        show(api, img, polygon.points, false)
        return
      }

      const img = pickImage(api, e.targetId)
      if (!img) return onNoImage?.()
      api.select([img.id])
      const start = e.world
      const lasso: Point[] = [start]
      let dragging = false
      const outline = (end: Point): Point[] => {
        if (k === 'lasso') return lasso
        const r = rectFromPoints(start, end)
        return k === 'ellipse' ? ellipseOutline(r) : rectOutline(r)
      }
      return {
        move(m) {
          if (!dragging && !movedEnough(e.screen, m.screen)) return
          dragging = true
          if (k === 'lasso') lasso.push(m.world)
          show(api, img, outline(m.world), k !== 'lasso')
        },
        up(m) {
          if (!dragging) return show(api, img, [], false)
          let pts = outline(m.world)
          if (k === 'lasso') {
            const flat = simplifyPoints(pts.flatMap((p) => [p.x, p.y]), 2 / api.viewport.scale)
            pts = Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[i * 2], y: flat[i * 2 + 1] }))
          }
          apply(api, img, pts, k)
        },
        cancel: () => api.setDraft(null),
      }
    },
    hover(e, api) {
      if (polygon) return show(api, polygon.img, e ? [...polygon.points, e.world] : polygon.points, false)
      // Show the whole image faded while hovering it, so hidden parts can be cut back in.
      show(api, e ? pickImage(api, e.targetId) : null, [], false)
    },
    keyDown(e, api) {
      if (!polygon) return false
      if (e.key === 'Escape') cancel(api)
      else if (e.key === 'Enter') finishPolygon(api)
      else if (e.key === 'Backspace') {
        polygon.points.pop()
        if (polygon.points.length === 0) cancel(api)
        else show(api, polygon.img, polygon.points, false)
      } else return false
      return true
    },
    deactivate: cancel,
  }
}
