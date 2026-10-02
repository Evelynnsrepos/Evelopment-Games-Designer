import type { Id } from '@/core/model'
import { createScene, worldToLocal, type BuiltinNode, type ImageNode, type NodeBase, type Point, type Rect, type Scene } from '@/shared/canvas'

/** How a cutout was drawn (MB-2). Rectangles and ellipses are stored as polygons too. */
export type CutoutKind = 'rect' | 'ellipse' | 'polygon' | 'lasso'

/**
 * A non-destructive cutout (MB-8): the image is kept whole and only the area
 * inside `points` is shown. Points are x/y pairs relative to the image size
 * (0..1), so they stay put when the image is resized.
 */
export interface Cutout {
  kind: CutoutKind
  points: number[]
}

/** The built-in image node plus an optional cutout. */
export interface MoodImageNode extends ImageNode {
  cutout?: Cutout
}

export type MoodNode = Exclude<BuiltinNode, ImageNode> | MoodImageNode

export interface MoodboardDoc {
  scene: Scene<MoodNode>
  /** MB-6: new drawings and text go to the always-on-top layer. */
  alwaysOnTop?: boolean
}

export const IMAGES_LAYER_NAME = 'Images'

export const createMoodboardDoc = (): MoodboardDoc => ({ scene: createScene<MoodNode>(IMAGES_LAYER_NAME) })

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** A cutout from a world-space outline drawn over the image (works for rotated and scaled images). */
export function cutoutFromWorld(img: MoodImageNode, outline: Point[], kind: CutoutKind): Cutout | null {
  if (outline.length < 3 || img.width <= 0 || img.height <= 0) return null
  const points: number[] = []
  for (const p of outline) {
    const l = worldToLocal(p, img)
    points.push(clamp01(l.x / img.width), clamp01(l.y / img.height))
  }
  const c = { kind, points }
  const b = cutoutBounds({ ...img, cutout: c })
  // Too small to see (e.g. drawn completely outside the image).
  return b.width < 2 || b.height < 2 ? null : c
}

/** The cutout outline in the image's local pixels. */
export function cutoutPixels(img: MoodImageNode): number[] {
  const pts = img.cutout?.points ?? []
  return pts.map((v, i) => (i % 2 === 0 ? v * img.width : v * img.height))
}

/** Local bounds of what is visible: the cutout's box, or the whole image. */
export function cutoutBounds(img: MoodImageNode): Rect {
  const px = cutoutPixels(img)
  if (px.length < 6) return { x: 0, y: 0, width: img.width, height: img.height }
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (let i = 0; i + 1 < px.length; i += 2) {
    x1 = Math.min(x1, px[i])
    x2 = Math.max(x2, px[i])
    y1 = Math.min(y1, px[i + 1])
    y2 = Math.max(y2, px[i + 1])
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

/** The four corners of an axis-aligned world rectangle. */
export function rectOutline(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ]
}

/** An ellipse inside a world rectangle, as a polygon. */
export function ellipseOutline(r: Rect, segments = 64): Point[] {
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2
    return { x: cx + Math.cos(a) * (r.width / 2), y: cy + Math.sin(a) * (r.height / 2) }
  })
}

export function isImage(n: NodeBase | undefined): n is MoodImageNode {
  return n?.kind === 'image'
}

/** Nodes of one layer, top first (the order a layers panel lists them). */
export function layerNodesTopFirst<N extends NodeBase>(scene: Scene<N>, layerId: Id): N[] {
  return scene.nodes.filter((n) => n.layerId === layerId).reverse()
}
