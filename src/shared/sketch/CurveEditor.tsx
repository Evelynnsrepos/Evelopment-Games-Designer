import { useRef } from 'react'
import { applyCurve, MAX_CURVE_POINTS, type CurvePoint } from './pen'

const UI = {
  help: 'Drag the dots. Click the line to add a dot, double-click a dot to remove it.',
  input: 'Pen',
  output: 'Brush',
}

const PAD = 8

/**
 * A small curve with up to six handles, for pressure (and later tilt) curves.
 * x = what the pen reports, y = what the brush gets; both 0..1.
 */
export function CurveEditor({ points, onChange, size = 180, marker }: { points: CurvePoint[]; onChange(points: CurvePoint[]): void; size?: number; marker?: number | null }) {
  const svg = useRef<SVGSVGElement>(null)
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const inner = size - PAD * 2
  const sx = (x: number) => PAD + x * inner
  const sy = (y: number) => PAD + (1 - y) * inner

  const toCurve = (e: { clientX: number; clientY: number }): CurvePoint => {
    const r = svg.current!.getBoundingClientRect()
    const k = size / r.width
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    return { x: clamp(((e.clientX - r.left) * k - PAD) / inner), y: clamp(1 - ((e.clientY - r.top) * k - PAD) / inner) }
  }

  const drag = (index: number, start: CurvePoint[]) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const p = toCurve(ev)
      // Keep the order: a dot can't pass its neighbours.
      const lo = index > 0 ? start[index - 1].x + 0.01 : 0
      const hi = index < start.length - 1 ? start[index + 1].x - 0.01 : 1
      onChange(start.map((q, i) => (i === index ? { x: Math.min(hi, Math.max(lo, p.x)), y: p.y } : q)))
    }
    const up = () => {
      target.removeEventListener('pointermove', move as EventListener)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move as EventListener)
    target.addEventListener('pointerup', up)
  }

  const add = (e: React.PointerEvent) => {
    if (sorted.length >= MAX_CURVE_POINTS) return
    const p = toCurve(e)
    if (sorted.some((q) => Math.abs(q.x - p.x) < 0.02)) return
    const next = [...sorted, p].sort((a, b) => a.x - b.x)
    onChange(next)
    drag(next.indexOf(p), next)(e)
  }

  const remove = (index: number) => {
    if (sorted.length <= 2) return
    onChange(sorted.filter((_, i) => i !== index))
  }

  const line = Array.from({ length: 65 }, (_, i) => {
    const x = i / 64
    return `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(applyCurve(sorted, x)).toFixed(1)}`
  }).join('')

  return (
    <div className="curve-editor">
      <svg ref={svg} viewBox={`0 0 ${size} ${size}`} width={size} height={size} onPointerDown={add} role="img" aria-label={UI.help}>
        <rect x={PAD} y={PAD} width={inner} height={inner} className="curve-bg" />
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t} className="curve-grid">
            <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(1)} />
            <line x1={sx(0)} y1={sy(t)} x2={sx(1)} y2={sy(t)} />
          </g>
        ))}
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="curve-diagonal" />
        {marker != null && <line x1={sx(marker)} y1={sy(0)} x2={sx(marker)} y2={sy(1)} className="curve-marker" />}
        <path d={line} className="curve-line" />
        {sorted.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={6} className="curve-handle" onPointerDown={drag(i, sorted)} onDoubleClick={() => remove(i)} />
        ))}
      </svg>
      <div className="curve-axes">
        <span>
          ↑ {UI.output} · → {UI.input}
        </span>
      </div>
      <p className="curve-help">{UI.help}</p>
    </div>
  )
}
