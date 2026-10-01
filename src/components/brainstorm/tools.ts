import { Cable, MapPin, MousePointer2, SquareDashed } from 'lucide-react'
import { newId, type Id } from '@/core/model'
import { promptDialog } from '@/shared/dialogs'
import {
  addNodes,
  DRAG_THRESHOLD,
  rectContainsRect,
  rectFromPoints,
  rectsIntersect,
  selectableNodes,
  translateNodes,
  type CanvasApi,
  type CanvasTool,
  type LineNode,
  type Point,
  type Scene,
  type ToolPointerEvent,
} from '@/shared/canvas'
import { DEFAULT_STRING_COLOR, type BoardColor } from './colors'
import {
  addToBottom,
  areaContents,
  areaRect,
  bringToFront,
  detachPins,
  duplicateBoardNodes,
  findHost,
  followPins,
  stickPin,
  type AreaNode,
  type BoardNode,
  type PinNode,
  type StringNode,
} from './model'
import { LABELS } from './nodeTypes'

type Api = CanvasApi<BoardNode>
/** The color picked in the toolbar, or null for each kind's default. */
export type ColorSource = () => BoardColor | null

export const TOOL_LABELS = {
  select: 'Select',
  pin: 'Pin',
  string: 'String',
  area: 'Mark area',
  nameArea: 'Name this area',
  defaultAreaName: (n: number) => `Area ${n}`,
}

const movedEnough = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y) >= DRAG_THRESHOLD
const isAbsolute = (api: Api) => (n: BoardNode) => !!api.nodeTypes[n.kind]?.absolute
const findNode = (api: Api, id: Id | null) => (id ? api.scene.nodes.find((n) => n.id === id) : undefined)

/**
 * Drag nodes like the shared select tool, plus the board rules: things inside a
 * dragged area come along (BB-8), stuck pins follow their host, and pins dragged
 * on their own stick to whatever they are dropped on (BB-7).
 */
function moveGesture(e: ToolPointerEvent, api: Api, ids: Id[]) {
  const scene0 = api.scene
  const moved = new Set([...ids, ...areaContents(scene0, ids, api.getWorldBounds)])
  const loosePins = scene0.nodes.filter((n): n is PinNode => n.kind === 'pin' && moved.has(n.id) && !(n.hostId && moved.has(n.hostId))).map((n) => n.id)
  const abs = isAbsolute(api)
  const startWorld = e.world
  let dragging = false
  let delta = { x: 0, y: 0 }
  const moveRecipe = (s: typeof scene0) => followPins(translateNodes(detachPins(s, loosePins), moved, delta.x, delta.y, abs))
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(e.screen, m.screen)) return
      dragging = true
      delta = { x: m.world.x - startWorld.x, y: m.world.y - startWorld.y }
      api.preview(moveRecipe)
    },
    up() {
      if (!dragging) {
        // Plain click inside a multi-selection narrows it to the clicked node.
        if (ids.length > 1 && !(e.shift || e.mod) && e.targetId) api.select([e.targetId])
        return
      }
      api.preview(null)
      api.update((s) => {
        let next = moveRecipe(s)
        for (const pinId of loosePins) {
          const pin = next.nodes.find((n) => n.id === pinId)
          if (!pin) continue
          const host = findHost(next, pin, api.getWorldBounds, moved)
          next = stickPin(next, pinId, host)
          if (host) next = bringToFront(next, [pinId])
        }
        return next
      })
    },
    cancel() {
      api.preview(null)
    },
  }
}

/** Selection box; an area is picked only when the box holds all of it, so boxes drawn inside areas pick their contents. */
function marqueeGesture(e: ToolPointerEvent, api: Api) {
  const additive = e.shift || e.mod
  let dragging = false
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(e.screen, m.screen)) return
      dragging = true
      api.setMarquee(rectFromPoints(e.world, m.world))
    },
    up(m: ToolPointerEvent) {
      api.setMarquee(null)
      if (!dragging) {
        if (!additive) api.select([])
        return
      }
      const box = rectFromPoints(e.world, m.world)
      const hits = selectableNodes(api.scene)
        .filter((n) => {
          if (n.kind === 'area') return rectContainsRect(box, areaRect(n as AreaNode))
          const b = api.getWorldBounds(n.id)
          return b ? rectsIntersect(box, b) : false
        })
        .map((n) => n.id)
      api.select(hits, additive ? 'add' : 'replace')
    },
    cancel() {
      api.setMarquee(null)
    },
  }
}

export const boardSelectTool: CanvasTool<BoardNode> = {
  id: 'select',
  label: TOOL_LABELS.select,
  icon: MousePointer2,
  shortcut: 'V',
  pointerDown(e, api) {
    if (e.button !== 0) return
    const target = e.targetId
    if (!target) return marqueeGesture(e, api)
    if (e.clickCount === 2) {
      api.select([target])
      api.activateNode(target)
      return
    }
    const wasSelected = api.selection.includes(target)
    if (e.shift || e.mod) {
      api.select([target], 'toggle')
      if (wasSelected) return
      return moveGesture(e, api, api.selection)
    }
    const ids = wasSelected ? api.selection : [target]
    if (!wasSelected) api.select(ids)
    return moveGesture(e, api, ids)
  },
  keyDown(e, api) {
    // Ctrl+D also copies the pins stuck to the copied notes.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && api.selection.length > 0) {
      let ids: Id[] = []
      api.update((s) => {
        const r = duplicateBoardNodes(s, api.selection)
        ids = r.ids
        return r.scene
      })
      api.select(ids)
      return true
    }
    return false
  },
}

function makePin(api: Api, p: Point, color: ColorSource): { pin: PinNode; hostId: Id | null } {
  const c = color()
  const pin: PinNode = { id: newId(), kind: 'pin', layerId: api.activeLayerId, x: p.x, y: p.y, ...(c ? { pinColor: c.strong } : {}) }
  return { pin, hostId: findHost(api.scene, p, api.getWorldBounds) }
}

/** Add new pins (stuck to their hosts) in one scene change. */
function withPins(s: Scene<BoardNode>, pins: { pin: PinNode; hostId: Id | null }[]) {
  let next = addNodes<BoardNode>(s, pins.map((p) => p.pin))
  for (const p of pins) if (p.hostId) next = stickPin(next, p.pin.id, p.hostId)
  return next
}

/** Pin (I): click anywhere; on a note, image, clip or shape the pin sticks to it. */
export function pinTool(color: ColorSource): CanvasTool<BoardNode> {
  return {
    id: 'pin',
    label: TOOL_LABELS.pin,
    icon: MapPin,
    shortcut: 'I',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      const target = findNode(api, e.targetId)
      if (target?.kind === 'pin') return moveGesture(e, api, [target.id])
      const made = makePin(api, e.world, color)
      api.update((s) => withPins(s, [made]))
      api.select([made.pin.id])
    },
  }
}

type End = { pinId: Id; point: Point; made?: { pin: PinNode; hostId: Id | null } }

/**
 * String (S): drag from one pin to another, or click one then the other.
 * Starting or ending on a note, image or empty board puts a new pin there.
 */
export function stringTool(color: ColorSource): CanvasTool<BoardNode> {
  let pending: End | null = null

  const endAt = (api: Api, e: ToolPointerEvent): End => {
    const target = findNode(api, e.targetId)
    if (target?.kind === 'pin') return { pinId: target.id, point: { x: target.x, y: target.y } }
    const made = makePin(api, e.world, color)
    return { pinId: made.pin.id, point: e.world, made }
  }
  const draftLine = (api: Api, from: Point, to: Point): LineNode => ({
    id: 'string-draft',
    kind: 'line',
    layerId: api.activeLayerId,
    x: from.x,
    y: from.y,
    points: [0, 0, to.x - from.x, to.y - from.y],
    strokeColor: color()?.strong ?? DEFAULT_STRING_COLOR,
    strokeWidth: 2.5,
  })
  const showDraft = (api: Api, from: End, to: Point | null) => {
    const nodes: BoardNode[] = []
    if (to) nodes.push(draftLine(api, from.point, to))
    if (from.made) nodes.push(from.made.pin)
    api.setDraft(nodes.length ? nodes : null)
  }
  const reset = (api: Api) => {
    pending = null
    api.setDraft(null)
  }
  const finish = (api: Api, a: End, b: End) => {
    reset(api)
    if (a.pinId === b.pinId) {
      if (a.made) api.update((s) => withPins(s, [a.made!]))
      return
    }
    const c = color()
    const str: StringNode = {
      id: newId(),
      kind: 'string',
      layerId: api.activeLayerId,
      x: 0,
      y: 0,
      fromId: a.pinId,
      toId: b.pinId,
      ...(c ? { strokeColor: c.strong } : {}),
    }
    const made = [a.made, b.made].filter((m): m is NonNullable<End['made']> => !!m)
    // Strings go above notes; pins go above strings.
    api.update((s) => bringToFront(addNodes(withPins(s, made), [str]), [a.pinId, b.pinId]))
    api.select([str.id])
  }

  return {
    id: 'string',
    label: TOOL_LABELS.string,
    icon: Cable,
    shortcut: 'S',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      if (pending) return finish(api, pending, endAt(api, e))
      const start = endAt(api, e)
      let dragging = false
      return {
        move(m) {
          if (!dragging && !movedEnough(e.screen, m.screen)) return
          dragging = true
          showDraft(api, start, m.world)
        },
        up(m) {
          if (dragging) finish(api, start, endAt(api, m))
          else {
            pending = start
            showDraft(api, start, null)
          }
        },
        cancel: () => reset(api),
      }
    },
    hover(e, api) {
      if (pending) showDraft(api, pending, e ? e.world : null)
    },
    keyDown(e, api) {
      if (e.key !== 'Escape' || !pending) return false
      reset(api)
      return true
    },
    deactivate: reset,
  }
}

/** Mark area (M): drag a rectangle, then name it (BB-6). */
export function areaTool(color: ColorSource): CanvasTool<BoardNode> {
  return {
    id: 'area',
    label: TOOL_LABELS.area,
    icon: SquareDashed,
    shortcut: 'M',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      const make = (end: Point): AreaNode => {
        const r = rectFromPoints(e.world, end)
        const c = color()
        return { id: newId(), kind: 'area', layerId: api.activeLayerId, ...r, ...(c ? { areaColor: c.strong } : {}) }
      }
      let dragging = false
      return {
        move(m) {
          if (!dragging && !movedEnough(e.screen, m.screen)) return
          dragging = true
          api.setDraft([make(m.world)])
        },
        async up(m) {
          let area = make(m.world)
          if (!dragging || area.width < 24 || area.height < 24) area = { ...area, x: e.world.x - 160, y: e.world.y - 110, width: 320, height: 220 }
          api.setDraft([area])
          const count = api.scene.nodes.filter((n) => n.kind === 'area').length
          const fallback = TOOL_LABELS.defaultAreaName(count + 1)
          const name = await promptDialog(TOOL_LABELS.nameArea, fallback)
          api.setDraft(null)
          const named: AreaNode = { ...area, name: name?.trim() || fallback }
          api.update((s) => addToBottom(s, [named]))
          api.select([named.id])
        },
        cancel: () => api.setDraft(null),
      }
    },
  }
}

export { LABELS }
