import { Hexagon, Landmark, Route, Trees } from 'lucide-react'
import { addNodes, DRAG_THRESHOLD, deleteNodes, rectContainsPoint, startMove, type CanvasApi, type CanvasTool, type Point, type ToolPointerEvent } from '@/shared/canvas'
import { brushPositions, dedupePoints, isCity, isStamp, makeStamp, makeStreet, makeZone, type MapNode, type StreetStyle } from './model'
import type { StampKind } from './stamps'

export const TOOL_UI = {
  city: 'City',
  street: 'Street (click points, double-click or Enter to finish)',
  stamp: 'Terrain stamp (drag to paint, Alt+drag to erase)',
  zone: 'Zone, e.g. the land of a faction (click corners, double-click or Enter to close)',
}

/** What the tools need from the Map Creator view. */
export interface MapToolHost {
  /** Open the "new city" popup at a world position. */
  requestCity(at: Point): void
  /** Close the popup; true if one was open. */
  cancelCity(): boolean
  streetStyle(): StreetStyle
  stamp(): { icon: StampKind; size: number }
  /** Color for a new zone. */
  zoneColor(): string
  /** A zone was drawn: select it so its panel opens. */
  zoneDrawn(id: string): void
}

type Api = CanvasApi<MapNode>

/** City (C): click empty map to name a new city or place an existing town; drag a city to move it (MP-2, MP-5). */
export function cityTool(host: MapToolHost): CanvasTool<MapNode> {
  return {
    id: 'city',
    label: TOOL_UI.city,
    icon: Landmark,
    shortcut: 'C',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      const target = e.targetId ? api.scene.nodes.find((n) => n.id === e.targetId) : undefined
      if (isCity(target)) return startMove(e, api, target.id)
      api.select([])
      host.requestCity(e.world)
    },
    keyDown(e) {
      return e.key === 'Escape' && host.cancelCity()
    },
    deactivate() {
      host.cancelCity()
    },
  }
}

/** Point under the pointer, snapped to a city's marker when one is under it. */
function snapToCity(e: ToolPointerEvent, api: Api): Point {
  const target = e.targetId ? api.scene.nodes.find((n) => n.id === e.targetId) : undefined
  return isCity(target) ? { x: target.x, y: target.y } : e.world
}

/** Street (S): click to add points, double-click or Enter to finish, Backspace removes the last point (MP-2). */
export function streetTool(host: MapToolHost): CanvasTool<MapNode> {
  let points: Point[] = []
  let hover: Point | null = null

  const showDraft = (api: Api) => {
    const all = hover ? [...points, hover] : points
    const draft = makeStreet(all, host.streetStyle())
    api.setDraft(draft ? [draft] : null)
  }
  const reset = (api: Api) => {
    points = []
    hover = null
    api.setDraft(null)
  }
  const finish = (api: Api) => {
    const street = makeStreet(dedupePoints(points), host.streetStyle())
    reset(api)
    if (!street) return
    api.update((s) => addNodes(s, [{ ...street, layerId: api.activeLayerId }]))
  }

  return {
    id: 'street',
    label: TOOL_UI.street,
    icon: Route,
    shortcut: 'S',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      points.push(snapToCity(e, api))
      if (e.clickCount === 2) finish(api)
      else showDraft(api)
    },
    hover(e, api) {
      if (points.length === 0) return
      hover = e ? snapToCity(e, api) : null
      showDraft(api)
    },
    keyDown(e, api) {
      if (points.length === 0) return false
      if (e.key === 'Enter') finish(api)
      else if (e.key === 'Escape') reset(api)
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        points.pop()
        showDraft(api)
      } else return false
      return true
    },
    deactivate(api) {
      finish(api)
    },
  }
}

/** Stamp (B): click to place the chosen terrain stamp, drag to paint many, Alt+drag to erase stamps (MP-3). */
export function stampTool(host: MapToolHost): CanvasTool<MapNode> {
  return {
    id: 'stamp',
    label: TOOL_UI.stamp,
    icon: Trees,
    shortcut: 'B',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      if (e.alt) return eraseGesture(e, api)

      const { icon, size } = host.stamp()
      const layerId = api.activeLayerId
      const path: Point[] = [e.world]
      const seed = Math.floor(Math.random() * 1000)
      let dragging = false
      const stamps = () =>
        dragging
          ? brushPositions(path, size * 0.9, seed).map((p) => ({ ...makeStamp(icon, p, size * p.scale), layerId }))
          : [{ ...makeStamp(icon, e.world, size), layerId }]
      api.setDraft(stamps())
      return {
        move(m) {
          if (!dragging && Math.hypot(m.screen.x - e.screen.x, m.screen.y - e.screen.y) < DRAG_THRESHOLD) return
          dragging = true
          path.push(m.world)
          api.setDraft(stamps())
        },
        up() {
          const nodes = stamps()
          api.setDraft(null)
          api.update((s) => addNodes(s, nodes))
        },
        cancel() {
          api.setDraft(null)
        },
      }
    },
  }
}

function eraseGesture(e: ToolPointerEvent, api: Api) {
  const erased = new Set<string>()
  const eraseAt = (p: Point) => {
    let changed = false
    for (const n of api.scene.nodes) {
      if (!isStamp(n) || n.locked || erased.has(n.id)) continue
      const b = api.getWorldBounds(n.id)
      if (b && rectContainsPoint(b, p)) {
        erased.add(n.id)
        changed = true
      }
    }
    if (changed) api.preview((s) => deleteNodes(s, erased))
  }
  eraseAt(e.world)
  return {
    move(m: ToolPointerEvent) {
      eraseAt(m.world)
    },
    up() {
      if (erased.size > 0) api.commitPreview()
    },
    cancel() {
      api.preview(null)
    },
  }
}

/** Zone (Z): click corners, double-click or Enter to close the shape, Backspace removes the last corner (v0.12). */
export function zoneTool(host: MapToolHost): CanvasTool<MapNode> {
  let points: Point[] = []
  let hover: Point | null = null

  const showDraft = (api: Api) => {
    const all = hover ? [...points, hover] : points
    const draft = all.length >= 3 ? makeZone(all, host.zoneColor()) : makeStreet(all, 'border')
    api.setDraft(draft ? [draft] : null)
  }
  const reset = (api: Api) => {
    points = []
    hover = null
    api.setDraft(null)
  }
  const finish = (api: Api) => {
    const zone = makeZone(dedupePoints(points), host.zoneColor())
    reset(api)
    if (!zone) return
    api.update((s) => addNodes(s, [{ ...zone, layerId: api.activeLayerId }]))
    host.zoneDrawn(zone.id)
  }

  return {
    id: 'zone',
    label: TOOL_UI.zone,
    icon: Hexagon,
    shortcut: 'Z',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      points.push(e.world)
      if (e.clickCount === 2) finish(api)
      else showDraft(api)
    },
    hover(e, api) {
      if (points.length === 0) return
      hover = e ? e.world : null
      showDraft(api)
    },
    keyDown(e, api) {
      if (points.length === 0) return false
      if (e.key === 'Enter') finish(api)
      else if (e.key === 'Escape') reset(api)
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        points.pop()
        showDraft(api)
      } else return false
      return true
    },
    deactivate(api) {
      finish(api)
    },
  }
}
