import { CalendarPlus, GitBranchPlus } from 'lucide-react'
import type { Id } from '@/core/model'
import { DRAG_THRESHOLD, getNode, rectContainsPoint, startMarquee, updateNode, type CanvasApi, type CanvasTool, type Point, type ToolPointerEvent } from '@/shared/canvas'
import {
  addBranch,
  addEvent,
  cardRect,
  clamp,
  events,
  isLine,
  lineEnd,
  lineRange,
  lines,
  setLineLength,
  snapX,
  STEM,
  type TimelineEvent,
  type TimelineItem,
  type TimelineLine,
  type YearAxis,
} from './model'

export const TL_TOOL_UI = {
  event: 'Event',
  branch: 'Branch',
}

/** What the tools need from the View. */
export interface TimelineToolHost {
  axis(): YearAxis | null
  cards(): Map<Id, { lift: number; height: number }>
  /** A new event or branch was made: show its details, ready to type. */
  created(id: Id): void
}

type Api = CanvasApi<TimelineItem>

export type TimelineHit = { part: 'event'; node: TimelineEvent } | { part: 'handle' | 'line'; node: TimelineLine }

/** What is under a world point: an event card or dot, a line's end handle, or a line. Topmost first. */
export function hitTest(api: Api, host: TimelineToolHost, p: Point): TimelineHit | null {
  const tol = 9 / api.viewport.scale
  const scene = api.scene
  const lineMap = new Map(lines(scene).map((l) => [l.id, l]))
  const cards = host.cards()
  for (const ev of [...events(scene)].reverse()) {
    const l = lineMap.get(ev.lineId)
    if (!l || ev.hidden) continue
    const card = cards.get(ev.id) ?? { lift: STEM, height: 60 }
    if (rectContainsPoint(cardRect(ev, l.y, card), p) || Math.hypot(p.x - ev.x, p.y - l.y) <= tol + 4) return { part: 'event', node: ev }
  }
  for (const l of lines(scene)) if (Math.hypot(p.x - lineEnd(l), p.y - l.y) <= tol + 3) return { part: 'handle', node: l }
  for (const l of lines(scene)) {
    if (Math.abs(p.y - l.y) <= tol && p.x >= l.x - tol && p.x <= lineEnd(l) + tol) return { part: 'line', node: l }
  }
  return null
}

const movedEnough = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y) >= DRAG_THRESHOLD

/** Slide an event along its line (TL-9), snapping to whole years when years are set. */
function dragEvent(e: ToolPointerEvent, api: Api, host: TimelineToolHost, ev: TimelineEvent) {
  if (e.clickCount === 2) {
    api.select([ev.id])
    host.created(ev.id)
    return
  }
  if (e.shift || e.mod) {
    api.select([ev.id], 'toggle')
    return
  }
  api.select([ev.id])
  const grab = e.world.x - ev.x
  let dragging = false
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(e.screen, m.screen)) return
      dragging = true
      api.preview((s) =>
        updateNode(s, ev.id, (n) => {
          const line = getNode(s, ev.lineId)
          if (!isLine(line)) return n
          const [lo, hi] = lineRange(line)
          return { ...n, x: clamp(snapX(host.axis(), m.world.x - grab), lo, hi) }
        }),
      )
    },
    up() {
      if (dragging) api.commitPreview()
    },
    cancel() {
      api.preview(null)
    },
  }
}

/** Drag a line's end handle: branches get longer or shorter; the main line stretches the whole timeline. */
function dragHandle(e: ToolPointerEvent, api: Api, line: TimelineLine) {
  api.select([line.id])
  let dragging = false
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(e.screen, m.screen)) return
      dragging = true
      api.preview((s) => setLineLength(s, line.id, m.world.x - line.x))
    },
    up() {
      if (dragging) api.commitPreview()
    },
    cancel() {
      api.preview(null)
    },
  }
}

/** Drag a branch up or down to another lane. */
function dragLane(e: ToolPointerEvent, api: Api, host: TimelineToolHost, line: TimelineLine) {
  if (e.clickCount === 2) {
    api.select([line.id])
    host.created(line.id)
    return
  }
  api.select([line.id])
  if (line.main) return
  let dragging = false
  return {
    move(m: ToolPointerEvent) {
      if (!dragging && !movedEnough(e.screen, m.screen)) return
      dragging = true
      api.preview((s) => updateNode(s, line.id, (n) => ({ ...n, y: Math.round(line.y + m.world.y - e.world.y) })))
    },
    up() {
      if (dragging) api.commitPreview()
    },
    cancel() {
      api.preview(null)
    },
  }
}

function selectOrDrag(e: ToolPointerEvent, api: Api, host: TimelineToolHost, hit: TimelineHit | null) {
  if (hit?.part === 'event') return dragEvent(e, api, host, hit.node)
  if (hit?.part === 'handle') return dragHandle(e, api, hit.node)
  return null
}

/** Event tool (E), the default (TL-2): click a line to add an event there. */
export function eventTool(host: TimelineToolHost): CanvasTool<TimelineItem> {
  return {
    id: 'event',
    label: TL_TOOL_UI.event,
    icon: CalendarPlus,
    shortcut: 'E',
    cursor: 'crosshair',
    pointerDown(e, api: Api) {
      if (e.button !== 0) return
      const hit = hitTest(api, host, e.world)
      const gesture = selectOrDrag(e, api, host, hit)
      if (gesture !== null) return gesture ?? undefined
      if (hit?.part === 'line') {
        let made: TimelineEvent | null = null
        api.update((s) => {
          const r = addEvent(s, hit.node.id, snapX(host.axis(), e.world.x))
          made = r.event
          return r.scene
        })
        const ev = made as TimelineEvent | null
        if (ev) {
          api.select([ev.id])
          host.created(ev.id)
        }
        return
      }
      return startMarquee(e, api)
    },
  }
}

/** Branch tool (B, press again for the Event tool): click a point on a line to split off an alternative timeline (TL-5, TL-6). */
export function branchTool(host: TimelineToolHost): CanvasTool<TimelineItem> {
  return {
    id: 'branch',
    label: TL_TOOL_UI.branch,
    icon: GitBranchPlus,
    shortcut: 'B',
    cursor: 'crosshair',
    toggle: true,
    pointerDown(e, api: Api) {
      if (e.button !== 0) return
      const hit = hitTest(api, host, e.world)
      if (!hit) return startMarquee(e, api)
      const [lineId, x] = hit.part === 'event' ? [hit.node.lineId, hit.node.x] : [hit.node.id, snapX(host.axis(), e.world.x)]
      let made: TimelineLine | null = null
      api.update((s) => {
        const r = addBranch(s, lineId, x)
        made = r.branch
        return r.scene
      })
      const branch = made as TimelineLine | null
      if (branch) {
        api.select([branch.id])
        host.created(branch.id)
      }
    },
  }
}

/** Select tool (V): select, slide events, move branches to another lane, resize lines. */
export function timelineSelectTool(host: TimelineToolHost, base: CanvasTool<TimelineItem>): CanvasTool<TimelineItem> {
  return {
    ...base,
    pointerDown(e, api: Api) {
      if (e.button !== 0) return
      const hit = hitTest(api, host, e.world)
      const gesture = selectOrDrag(e, api, host, hit)
      if (gesture !== null) return gesture ?? undefined
      if (hit?.part === 'line') return dragLane(e, api, host, hit.node) ?? undefined
      return startMarquee(e, api)
    },
  }
}
