import { useMemo } from 'react'
import type { Id } from '@/core/model'
import './flow-graph.css'

/**
 * A small read-only flow graph (v0.7) for quest chains and dialogue trees:
 * nodes in columns by depth from the starting nodes, curved arrows between
 * them, cycles allowed. Click a node to select it.
 */

export interface FlowNode {
  id: Id
  label: string
  sub?: string
  color?: string
  /** Shown with a dashed outline, e.g. "not reachable". */
  muted?: boolean
}

export interface FlowEdge {
  from: Id
  to: Id
  label?: string
}

const W = 170
const H = 46
const GAP_X = 70
const GAP_Y = 22

/** Columns by longest path from a start (cycles are cut where they loop back). */
export function layoutFlow(nodes: FlowNode[], edges: FlowEdge[], starts?: Id[]): Map<Id, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id))
  const out = new Map<Id, Id[]>()
  const indeg = new Map<Id, number>()
  for (const n of nodes) indeg.set(n.id, 0)
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue
    out.set(e.from, [...(out.get(e.from) ?? []), e.to])
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }
  const roots = starts?.filter((s) => ids.has(s)) ?? []
  const level = new Map<Id, number>()
  const visit = (id: Id, depth: number, path: Set<Id>) => {
    if (path.has(id)) return
    if ((level.get(id) ?? -1) >= depth) return
    level.set(id, depth)
    path.add(id)
    for (const next of out.get(id) ?? []) visit(next, depth + 1, path)
    path.delete(id)
  }
  for (const r of roots.length ? roots : nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id)) visit(r, 0, new Set())
  // Anything still unplaced (only reachable through a cycle, or unreachable) starts its own chain.
  for (const n of nodes) if (!level.has(n.id)) visit(n.id, 0, new Set())
  const columns = new Map<number, Id[]>()
  for (const n of nodes) {
    const l = level.get(n.id) ?? 0
    columns.set(l, [...(columns.get(l) ?? []), n.id])
  }
  const pos = new Map<Id, { x: number; y: number }>()
  for (const [l, col] of columns) col.forEach((id, i) => pos.set(id, { x: l * (W + GAP_X), y: i * (H + GAP_Y) }))
  return pos
}

export function FlowGraph({ nodes, edges, starts, selectedId, onSelect }: { nodes: FlowNode[]; edges: FlowEdge[]; starts?: Id[]; selectedId?: Id | null; onSelect?: (id: Id) => void }) {
  const pos = useMemo(() => layoutFlow(nodes, edges, starts), [nodes, edges, starts])
  if (nodes.length === 0) return null
  const xs = [...pos.values()].map((p) => p.x)
  const ys = [...pos.values()].map((p) => p.y)
  const width = Math.max(...xs) + W + 20
  const height = Math.max(...ys) + H + 20
  return (
    <div className="flow-wrap">
      <svg className="flow" width={width} height={height} viewBox={`-10 -10 ${width} ${height}`}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="flow-arrowhead" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = pos.get(e.from)
          const b = pos.get(e.to)
          if (!a || !b) return null
          const back = b.x <= a.x
          const x1 = a.x + W
          const y1 = a.y + H / 2
          const x2 = back ? b.x + W / 2 : b.x
          const y2 = back ? b.y + H : b.y + H / 2
          const d = back
            ? `M${x1},${y1} C${x1 + 60},${y1} ${x2},${y2 + 60} ${x2},${y2}`
            : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
          return (
            <g key={i}>
              <path d={d} className={`flow-edge${back ? ' back' : ''}`} markerEnd="url(#flow-arrow)" />
              {e.label && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} className="flow-edge-label">
                  {e.label.length > 22 ? `${e.label.slice(0, 21)}…` : e.label}
                </text>
              )}
            </g>
          )
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!
          return (
            <g key={n.id} transform={`translate(${p.x} ${p.y})`} className={`flow-node${n.id === selectedId ? ' selected' : ''}${n.muted ? ' muted' : ''}`} onClick={() => onSelect?.(n.id)}>
              <rect width={W} height={H} rx={8} style={n.color ? { stroke: n.color } : undefined} />
              {n.color && <rect width={5} height={H} rx={2} style={{ fill: n.color, stroke: 'none' }} />}
              <text x={12} y={n.sub ? 19 : 28} className="flow-label">
                {n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label || '…'}
              </text>
              {n.sub && (
                <text x={12} y={36} className="flow-sub">
                  {n.sub.length > 28 ? `${n.sub.slice(0, 27)}…` : n.sub}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
