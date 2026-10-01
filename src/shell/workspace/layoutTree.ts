import type { ComponentType, Id, LayoutNode, Panel, SplitDirection } from '@/core/model'

/** Pure functions over the tiling layout tree (ED-3, ED-6, ED-9). No React here. */

export type DropSide = 'left' | 'right' | 'top' | 'bottom'
export type Direction = 'left' | 'right' | 'up' | 'down'
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** A path from the root to a node: 0 = first child, 1 = second child. */
export type NodePath = number[]

export function leaves(node: LayoutNode | null): Panel[] {
  if (!node) return []
  return node.kind === 'panel' ? [node.panel] : [...leaves(node.first), ...leaves(node.second)]
}

export function findPanel(node: LayoutNode | null, panelId: Id): Panel | undefined {
  return leaves(node).find((p) => p.id === panelId)
}

/** ED-10: a document can be open only once. */
export function findOpen(node: LayoutNode | null, type: ComponentType, documentId: Id | null): Panel | undefined {
  return leaves(node).find((p) => p.type === type && p.documentId === documentId)
}

/** Split the target panel and put `panel` on the given side of it. */
export function insertPanel(root: LayoutNode | null, panel: Panel, targetId: Id | null, side: DropSide): LayoutNode {
  const leaf: LayoutNode = { kind: 'panel', panel }
  if (!root) return leaf
  const direction: SplitDirection = side === 'left' || side === 'right' ? 'row' : 'column'
  const before = side === 'left' || side === 'top'
  const wrap = (target: LayoutNode): LayoutNode => ({
    kind: 'split',
    direction,
    ratio: 0.5,
    first: before ? leaf : target,
    second: before ? target : leaf,
  })
  if (!targetId) return wrap(root)
  const visit = (node: LayoutNode): LayoutNode => {
    if (node.kind === 'panel') return node.panel.id === targetId ? wrap(node) : node
    return { ...node, first: visit(node.first), second: visit(node.second) }
  }
  return visit(root)
}

/** Remove a panel; its sibling takes the freed space. */
export function removePanel(root: LayoutNode | null, panelId: Id): LayoutNode | null {
  if (!root) return null
  if (root.kind === 'panel') return root.panel.id === panelId ? null : root
  const first = removePanel(root.first, panelId)
  const second = removePanel(root.second, panelId)
  if (!first) return second
  if (!second) return first
  return { ...root, first, second }
}

export function setRatio(root: LayoutNode, path: NodePath, ratio: number): LayoutNode {
  const clamped = Math.min(0.9, Math.max(0.1, ratio))
  if (root.kind !== 'split') return root
  if (path.length === 0) return { ...root, ratio: clamped }
  const [head, ...rest] = path
  return head === 0
    ? { ...root, first: setRatio(root.first, rest, ratio) }
    : { ...root, second: setRatio(root.second, rest, ratio) }
}

/** Normalised (0..1) rectangle of every panel. */
export function panelRects(node: LayoutNode | null, rect: Rect = { x: 0, y: 0, w: 1, h: 1 }): { panel: Panel; rect: Rect }[] {
  if (!node) return []
  if (node.kind === 'panel') return [{ panel: node.panel, rect }]
  const { x, y, w, h } = rect
  const r = node.ratio
  const [a, b]: [Rect, Rect] =
    node.direction === 'row'
      ? [{ x, y, w: w * r, h }, { x: x + w * r, y, w: w * (1 - r), h }]
      : [{ x, y, w, h: h * r }, { x, y: y + h * r, w, h: h * (1 - r) }]
  return [...panelRects(node.first, a), ...panelRects(node.second, b)]
}

const EPS = 1e-6

/** The panel that touches `panelId`'s edge in `dir`, with the most shared border. */
export function neighbor(root: LayoutNode | null, panelId: Id, dir: Direction): Panel | undefined {
  const rects = panelRects(root)
  const self = rects.find((r) => r.panel.id === panelId)?.rect
  if (!self) return undefined
  let best: { panel: Panel; overlap: number } | undefined
  for (const { panel, rect } of rects) {
    if (panel.id === panelId) continue
    const touches =
      (dir === 'left' && Math.abs(rect.x + rect.w - self.x) < EPS) ||
      (dir === 'right' && Math.abs(self.x + self.w - rect.x) < EPS) ||
      (dir === 'up' && Math.abs(rect.y + rect.h - self.y) < EPS) ||
      (dir === 'down' && Math.abs(self.y + self.h - rect.y) < EPS)
    if (!touches) continue
    const overlap =
      dir === 'left' || dir === 'right'
        ? Math.min(self.y + self.h, rect.y + rect.h) - Math.max(self.y, rect.y)
        : Math.min(self.x + self.w, rect.x + rect.w) - Math.max(self.x, rect.x)
    if (overlap > EPS && (!best || overlap > best.overlap)) best = { panel, overlap }
  }
  return best?.panel
}

/** Swap two panels' positions (ED-6 arrows). */
export function swapPanels(root: LayoutNode, aId: Id, bId: Id): LayoutNode {
  const a = findPanel(root, aId)
  const b = findPanel(root, bId)
  if (!a || !b) return root
  const visit = (node: LayoutNode): LayoutNode => {
    if (node.kind === 'panel') {
      if (node.panel.id === aId) return { kind: 'panel', panel: b }
      if (node.panel.id === bId) return { kind: 'panel', panel: a }
      return node
    }
    return { ...node, first: visit(node.first), second: visit(node.second) }
  }
  return visit(root)
}

/** Where a click-to-open goes: split the largest panel along its longer side. */
export function autoPlacement(root: LayoutNode | null, aspect = 16 / 9): { targetId: Id | null; side: DropSide } {
  const rects = panelRects(root)
  if (rects.length === 0) return { targetId: null, side: 'right' }
  const largest = rects.reduce((a, b) => (b.rect.w * b.rect.h > a.rect.w * a.rect.h + EPS ? b : a))
  const wide = largest.rect.w * aspect >= largest.rect.h
  return { targetId: largest.panel.id, side: wide ? 'right' : 'bottom' }
}

/** Which half of a panel the pointer is over, from coordinates relative to the panel (0..1). */
export function sideFromPoint(px: number, py: number): DropSide {
  const dx = px - 0.5
  const dy = py - 0.5
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'top' : 'bottom'
}
