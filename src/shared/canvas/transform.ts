import type { Point } from './types'

/** A node's transform as Konva applies it: scale, then rotate, then translate to x/y. */
export interface NodeTransform {
  x: number
  y: number
  rotation?: number
  scaleX?: number
  scaleY?: number
}

/** A point in a node's local space to world space. */
export function localToWorld(p: Point, t: NodeTransform): Point {
  const rad = ((t.rotation ?? 0) * Math.PI) / 180
  const x = p.x * (t.scaleX ?? 1)
  const y = p.y * (t.scaleY ?? 1)
  return { x: t.x + x * Math.cos(rad) - y * Math.sin(rad), y: t.y + x * Math.sin(rad) + y * Math.cos(rad) }
}

/** A world point in a node's local space (inverse of `localToWorld`), e.g. for pins stuck to a note or image cutouts. */
export function worldToLocal(p: Point, t: NodeTransform): Point {
  const rad = ((t.rotation ?? 0) * Math.PI) / 180
  const dx = p.x - t.x
  const dy = p.y - t.y
  const x = dx * Math.cos(rad) + dy * Math.sin(rad)
  const y = -dx * Math.sin(rad) + dy * Math.cos(rad)
  return { x: x / (t.scaleX || 1), y: y / (t.scaleY || 1) }
}
