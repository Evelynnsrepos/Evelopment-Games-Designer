import { newId, type Id } from '@/core/model'
import {
  addNodes,
  createScene,
  deleteNodes,
  localToWorld,
  rectContainsRect,
  rectContainsPoint,
  renderOrder,
  worldToLocal,
  type BuiltinNode,
  type NodeBase,
  type Point,
  type Rect,
  type Scene,
} from '@/shared/canvas'

/**
 * Brainstorm Board data (spec 8.8). Pins can be stuck to a note, image, clip
 * or shape (BB-7): they keep `hostId` plus a point in the host's local space,
 * and `followPins` moves them whenever the host moves.
 */
export interface PinNode extends NodeBase {
  kind: 'pin'
  pinColor?: string
  hostId?: Id
  localX?: number
  localY?: number
}

/** Detective-board string between two pins (BB-5). Deleting a pin deletes its strings. */
export interface StringNode extends NodeBase {
  kind: 'string'
  fromId: Id
  toId: Id
  strokeColor?: string
}

/** Named, colored rectangle (BB-6). `name` is the area name; things inside move with it (BB-8). */
export interface AreaNode extends NodeBase {
  kind: 'area'
  width: number
  height: number
  areaColor?: string
}

/** Music or voice clip card (BB-4). `name` is the title. */
export interface AudioNode extends NodeBase {
  kind: 'audio'
  src: string
  width: number
  height: number
}

export type BoardNode = BuiltinNode | PinNode | StringNode | AreaNode | AudioNode

export interface BrainstormDoc {
  scene: Scene<BoardNode>
}

export const createBrainstormDoc = (): BrainstormDoc => ({ scene: createScene<BoardNode>() })

/** Kinds a pin can be stuck to. */
export const HOST_KINDS = new Set(['note', 'image', 'audio', 'rect', 'ellipse', 'text'])

export const AUDIO_CARD = { width: 280, height: 92 }

type Bounds = (id: Id) => Rect | null

function isPin(n: BoardNode): n is PinNode {
  return n.kind === 'pin'
}

/** Put every stuck pin back on its host (after the host moved, rotated or was resized). */
export function followPins(scene: Scene<BoardNode>): Scene<BoardNode> {
  const byId = new Map(scene.nodes.map((n) => [n.id, n]))
  let changed = false
  const nodes = scene.nodes.map((n) => {
    if (!isPin(n) || !n.hostId) return n
    const host = byId.get(n.hostId)
    if (!host) {
      changed = true
      return detached(n)
    }
    const p = localToWorld({ x: n.localX ?? 0, y: n.localY ?? 0 }, host)
    if (Math.abs(p.x - n.x) < 1e-6 && Math.abs(p.y - n.y) < 1e-6) return n
    changed = true
    return { ...n, x: p.x, y: p.y }
  })
  return changed ? { ...scene, nodes } : scene
}

function detached(p: PinNode): PinNode {
  const { hostId: _h, localX: _x, localY: _y, ...rest } = p
  return rest
}

/** Unstick pins (they keep their position). */
export function detachPins(scene: Scene<BoardNode>, ids: Iterable<Id>): Scene<BoardNode> {
  const set = new Set(ids)
  if (set.size === 0) return scene
  return { ...scene, nodes: scene.nodes.map((n) => (isPin(n) && set.has(n.id) && n.hostId ? detached(n) : n)) }
}

/** Stick a pin to a host at the pin's current position, or unstick it when `hostId` is null. */
export function stickPin(scene: Scene<BoardNode>, pinId: Id, hostId: Id | null): Scene<BoardNode> {
  const host = hostId ? scene.nodes.find((n) => n.id === hostId) : undefined
  return {
    ...scene,
    nodes: scene.nodes.map((n) => {
      if (n.id !== pinId || !isPin(n)) return n
      if (!host) return detached(n)
      const l = worldToLocal(n, host)
      return { ...n, hostId: host.id, localX: l.x, localY: l.y }
    }),
  }
}

/** Topmost node a pin dropped at `p` would stick to, or null. */
export function findHost(scene: Scene<BoardNode>, p: Point, bounds: Bounds, exclude: ReadonlySet<Id> = new Set()): Id | null {
  const ordered = renderOrder(scene).flatMap(({ layer, nodes }) => (layer.hidden || layer.locked ? [] : nodes))
  for (let i = ordered.length - 1; i >= 0; i--) {
    const n = ordered[i]
    if (n.hidden || n.locked || !HOST_KINDS.has(n.kind) || exclude.has(n.id)) continue
    const b = bounds(n.id)
    if (b && rectContainsPoint(b, p)) return n.id
  }
  return null
}

/** The colored body of an area in world space (without its name tag). */
export function areaRect(a: AreaNode): Rect {
  return { x: a.x, y: a.y, width: a.width, height: a.height }
}

/** Movable nodes lying completely inside the given areas (BB-8). Strings are skipped; they follow their pins. */
export function areaContents(scene: Scene<BoardNode>, areaIds: Iterable<Id>, bounds: Bounds): Id[] {
  const set = new Set(areaIds)
  const areas = scene.nodes.filter((n): n is AreaNode => n.kind === 'area' && set.has(n.id))
  if (areas.length === 0) return []
  const out: Id[] = []
  for (const n of scene.nodes) {
    if (set.has(n.id) || n.kind === 'string' || n.kind === 'connector' || n.locked) continue
    const b = bounds(n.id)
    if (b && areas.some((a) => rectContainsRect(areaRect(a), b))) out.push(n.id)
  }
  return out
}

/** Pins stuck to any of the given nodes. */
export function pinsOn(scene: Scene<BoardNode>, hostIds: Iterable<Id>): Id[] {
  const set = new Set(hostIds)
  return scene.nodes.filter((n) => isPin(n) && n.hostId && set.has(n.hostId)).map((n) => n.id)
}

/** Delete nodes, the pins stuck to them, and the strings on those pins. */
export function deleteBoardNodes(scene: Scene<BoardNode>, ids: Iterable<Id>): Scene<BoardNode> {
  const list = [...ids]
  return deleteNodes(scene, [...list, ...pinsOn(scene, list)])
}

/**
 * Copy nodes (and the pins stuck to them) with new ids, offset by (dx, dy).
 * Strings between two copied pins are copied too and point at the copies.
 */
export function duplicateBoardNodes(scene: Scene<BoardNode>, ids: Iterable<Id>, dx = 24, dy = 24): { scene: Scene<BoardNode>; ids: Id[] } {
  const base = [...ids]
  const set = new Set([...base, ...pinsOn(scene, base)])
  const idMap = new Map<Id, Id>()
  for (const n of scene.nodes) if (set.has(n.id) && n.kind !== 'string') idMap.set(n.id, newId())
  for (const n of scene.nodes) if (n.kind === 'string' && idMap.has(n.fromId) && idMap.has(n.toId)) idMap.set(n.id, newId())

  const copies: BoardNode[] = []
  for (const n of scene.nodes) {
    const id = idMap.get(n.id)
    if (!id) continue
    if (n.kind === 'string') copies.push({ ...n, id, fromId: idMap.get(n.fromId)!, toId: idMap.get(n.toId)! })
    else if (isPin(n) && n.hostId && idMap.has(n.hostId)) copies.push({ ...n, id, hostId: idMap.get(n.hostId)!, x: n.x + dx, y: n.y + dy })
    else if (isPin(n) && n.hostId) copies.push({ ...detached(n), id, x: n.x + dx, y: n.y + dy })
    else copies.push({ ...n, id, x: n.x + dx, y: n.y + dy })
  }
  return { scene: followPins(addNodes(scene, copies)), ids: copies.filter((c) => base.some((b) => idMap.get(b) === c.id)).map((c) => c.id) }
}

/** Move nodes to the top of their layer, keeping their relative order. */
export function bringToFront(scene: Scene<BoardNode>, ids: Iterable<Id>): Scene<BoardNode> {
  const set = new Set(ids)
  if (set.size === 0) return scene
  return { ...scene, nodes: [...scene.nodes.filter((n) => !set.has(n.id)), ...scene.nodes.filter((n) => set.has(n.id))] }
}

/** Insert nodes below everything else (areas sit under the things they group). */
export function addToBottom(scene: Scene<BoardNode>, nodes: BoardNode[]): Scene<BoardNode> {
  return nodes.length ? { ...scene, nodes: [...nodes, ...scene.nodes] } : scene
}
