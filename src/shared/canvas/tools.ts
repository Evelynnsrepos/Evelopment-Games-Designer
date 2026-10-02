import { Circle, Hand, MousePointer2, MoveUpRight, Pencil, Slash, Square, StickyNote, Type } from 'lucide-react'
import { newId, type Id } from '@/core/model'
import { rectFromPoints, rectsIntersect, simplifyPoints, snapAngle } from './geometry'
import { addNodes, selectableNodes, translateNodes } from './scene'
import { NOTE_COLORS } from './nodeTypes'
import type { CanvasApi, CanvasTool, EllipseNode, LineNode, NodeBase, NoteNode, Point, RectNode, TextNode, ToolPointerEvent } from './types'
import { useSettings } from '@/core/state'

/** Labels kept as constants so they can be translated later. */
export const TOOL_LABELS = {
  select: 'Select',
  hand: 'Pan',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  pen: 'Pen',
  text: 'Text',
  note: 'Sticky note',
}

/** Pointer travel (screen px) before a press counts as a drag. */
export const DRAG_THRESHOLD = 4

const movedEnough = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y) >= DRAG_THRESHOLD

function isAbsolute(api: CanvasApi<NodeBase>) {
  return (n: NodeBase) => !!api.nodeTypes[n.kind]?.absolute
}

/**
 * Select tool (V): click to select, Shift/Ctrl-click to toggle, drag to move,
 * drag on empty canvas for a selection box, double-click to edit.
 */
export const selectTool: CanvasTool<any> = {
  id: 'select',
  label: TOOL_LABELS.select,
  icon: MousePointer2,
  shortcut: 'V',
  pointerDown(e, api) {
    if (e.button !== 0) return
    if (e.targetId) return startMove(e, api, e.targetId)
    return startMarquee(e, api)
  },
}

/** Moves the clicked node (and the rest of the selection). Reusable by custom tools. */
export function startMove(e: ToolPointerEvent, api: CanvasApi<any>, targetId: Id) {
  if (e.clickCount === 2) {
    api.select([targetId])
    api.activateNode(targetId)
    return
  }
  const additive = e.shift || e.mod
  const wasSelected = api.selection.includes(targetId)
  let ids: Id[]
  if (additive) {
    ids = wasSelected ? api.selection.filter((id) => id !== targetId) : [...api.selection, targetId]
    api.select(ids)
    if (wasSelected) return
  } else {
    ids = wasSelected ? api.selection : [targetId]
    if (!wasSelected) api.select(ids)
  }
  const abs = isAbsolute(api)
  const start = e.screen
  const startWorld = e.world
  let dragging = false
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(start, m.screen)) return
      dragging = true
      const dx = m.world.x - startWorld.x
      const dy = m.world.y - startWorld.y
      api.preview((s) => translateNodes(s, ids, dx, dy, abs))
    },
    up() {
      if (dragging) api.commitPreview()
      // Plain click inside a multi-selection narrows it to the clicked node.
      else if (wasSelected && !additive && ids.length > 1) api.select([targetId])
    },
    cancel() {
      api.preview(null)
    },
  }
}

/** Selection box from an empty-canvas drag. Reusable by custom tools. */
export function startMarquee(e: ToolPointerEvent, api: CanvasApi<any>) {
  const additive = e.shift || e.mod
  const startWorld = e.world
  const start = e.screen
  let dragging = false
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(start, m.screen)) return
      dragging = true
      api.setMarquee(rectFromPoints(startWorld, m.world))
    },
    up(m: ToolPointerEvent) {
      api.setMarquee(null)
      if (!dragging) {
        if (!additive) api.select([])
        return
      }
      const box = rectFromPoints(startWorld, m.world)
      const hits = selectableNodes(api.scene)
        .filter((n) => {
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

/** Hand tool (H): drag to pan. Middle mouse and Space+drag pan with any tool. */
export const handTool: CanvasTool<any> = {
  id: 'hand',
  label: TOOL_LABELS.hand,
  icon: Hand,
  shortcut: 'H',
  cursor: 'grab',
  // Panning is handled by the engine for this tool id.
}

// ---- drawing tools ----

interface ToolOptions<T> {
  shortcut?: string
  /** Style for new nodes, read each time a node is created (e.g. from a color picker). */
  defaults?: () => Partial<T>
}

type BoxNode = RectNode | EllipseNode | NoteNode

function boxTool<T extends BoxNode>(
  kind: T['kind'],
  meta: { id: string; label: string; icon: CanvasTool['icon']; shortcut: string },
  defaultSize: { width: number; height: number },
  extra: () => Partial<T>,
  options: ToolOptions<T> = {},
): CanvasTool<any> {
  const make = (api: CanvasApi<any>, r: { x: number; y: number; width: number; height: number }) =>
    ({ id: newId(), kind, layerId: api.activeLayerId, ...extra(), ...options.defaults?.(), ...r }) as unknown as T

  return {
    ...meta,
    shortcut: options.shortcut ?? meta.shortcut,
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      const start = e.world
      const startScreen = e.screen
      let dragging = false
      const box = (p: Point, square: boolean) => {
        let end = p
        if (square) {
          const size = Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y))
          end = { x: start.x + Math.sign(p.x - start.x || 1) * size, y: start.y + Math.sign(p.y - start.y || 1) * size }
        }
        return rectFromPoints(start, end)
      }
      return {
        move(m) {
          if (!dragging && !movedEnough(startScreen, m.screen)) return
          dragging = true
          api.setDraft([make(api, box(m.world, m.shift))])
        },
        up(m) {
          api.setDraft(null)
          const r = dragging ? box(m.world, m.shift) : { x: start.x - defaultSize.width / 2, y: start.y - defaultSize.height / 2, ...defaultSize }
          const node = make(api, r)
          api.update((s) => addNodes(s, [node]))
          api.select([node.id])
          if (kind === 'note') api.editText(node.id)
        },
        cancel() {
          api.setDraft(null)
        },
      }
    },
  }
}

export const rectTool = (options?: ToolOptions<RectNode>) =>
  boxTool<RectNode>('rect', { id: 'rect', label: TOOL_LABELS.rect, icon: Square, shortcut: 'R' }, { width: 160, height: 100 }, () => ({}), options)

export const ellipseTool = (options?: ToolOptions<EllipseNode>) =>
  boxTool<EllipseNode>('ellipse', { id: 'ellipse', label: TOOL_LABELS.ellipse, icon: Circle, shortcut: 'O' }, { width: 120, height: 120 }, () => ({}), options)

export const noteTool = (options?: ToolOptions<NoteNode>) =>
  boxTool<NoteNode>('note', { id: 'note', label: TOOL_LABELS.note, icon: StickyNote, shortcut: 'N' }, { width: 180, height: 180 }, () => ({ text: '', fillColor: NOTE_COLORS[0] }), options)

function lineLikeTool(arrow: boolean, options: ToolOptions<LineNode> = {}): CanvasTool<any> {
  return {
    id: arrow ? 'arrow' : 'line',
    label: arrow ? TOOL_LABELS.arrow : TOOL_LABELS.line,
    icon: arrow ? MoveUpRight : Slash,
    shortcut: options.shortcut ?? (arrow ? 'A' : 'L'),
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      const start = e.world
      const make = (p: Point): LineNode => ({
        id: newId(),
        kind: 'line',
        layerId: api.activeLayerId,
        x: start.x,
        y: start.y,
        arrow,
        ...options.defaults?.(),
        points: [0, 0, p.x - start.x, p.y - start.y],
      })
      let last: Point | null = null
      return {
        move(m) {
          if (!last && !movedEnough(e.screen, m.screen)) return
          last = m.shift ? snapAngle(start, m.world) : m.world
          api.setDraft([make(last)])
        },
        up() {
          api.setDraft(null)
          if (!last) return
          const node = make(last)
          api.update((s) => addNodes(s, [node]))
          api.select([node.id])
        },
        cancel() {
          api.setDraft(null)
        },
      }
    },
  }
}

export const lineTool = (options?: ToolOptions<LineNode>) => lineLikeTool(false, options)
export const arrowTool = (options?: ToolOptions<LineNode>) => lineLikeTool(true, options)

/** Freehand pen (P). */
export const penTool = (options: ToolOptions<LineNode> = {}): CanvasTool<any> => ({
  id: 'pen',
  label: TOOL_LABELS.pen,
  icon: Pencil,
  shortcut: options.shortcut ?? 'P',
  cursor: 'crosshair',
  pointerDown(e, api) {
    if (e.button !== 0) return
    const origin = e.world
    const points = [0, 0]
    const { penSize, penSmoothing, penOpacity } = useSettings.getState()
    // Stabilizer: each drawn point only moves part of the way to the pointer, which irons out shaky hands.
    const follow = 1 - Math.min(0.9, penSmoothing * 0.9)
    let sx = 0
    let sy = 0
    let raw = { x: 0, y: 0 }
    const make = (pts: number[]): LineNode => ({
      id: newId(),
      kind: 'line',
      layerId: api.activeLayerId,
      x: origin.x,
      y: origin.y,
      smooth: true,
      ...options.defaults?.(),
      strokeWidth: penSize,
      ...(penOpacity < 1 ? { opacity: penOpacity } : {}),
      points: pts,
    })
    return {
      move(m) {
        raw = { x: m.world.x - origin.x, y: m.world.y - origin.y }
        sx += (raw.x - sx) * follow
        sy += (raw.y - sy) * follow
        points.push(sx, sy)
        api.setDraft([make(points)])
      },
      up() {
        api.setDraft(null)
        if (points.length < 4) points.push(0.5, 0.5) // a dot
        else points.push(raw.x, raw.y) // the stroke still ends where the pointer was let go
        const node = make(simplifyPoints(points, 1.5 / api.viewport.scale))
        api.update((s) => addNodes(s, [node]))
      },
      cancel() {
        api.setDraft(null)
      },
    }
  },
})

/** Text (T): click to type; click existing text to edit it. */
export const textTool = (options: ToolOptions<TextNode> = {}): CanvasTool<any> => ({
  id: 'text',
  label: TOOL_LABELS.text,
  icon: Type,
  shortcut: options.shortcut ?? 'T',
  cursor: 'text',
  pointerDown(e, api) {
    if (e.button !== 0) return
    const target = e.targetId ? api.scene.nodes.find((n) => n.id === e.targetId) : undefined
    if (target && api.nodeTypes[target.kind]?.textEdit) {
      api.select([target.id])
      api.editText(target.id)
      return
    }
    const fontSize = 20
    const node: TextNode = {
      id: newId(),
      kind: 'text',
      layerId: api.activeLayerId,
      x: e.world.x,
      y: e.world.y - (fontSize * 1.25) / 2,
      text: '',
      fontSize,
      width: 240,
      ...options.defaults?.(),
    }
    api.editText(node.id, node)
  },
})

/** Every built-in tool, in toolbar order. Components pick the ones they need. */
export function defaultTools(): CanvasTool<any>[] {
  return [selectTool, handTool, rectTool(), ellipseTool(), lineTool(), arrowTool(), penTool(), textTool(), noteTool()]
}
