import { useRef, useState } from 'react'
import { curveAt, LINEAR, type CurvePoint } from './brushCurve'

const UI = {
  help: 'Drag the points. Double-click to add a point, double-click a point to remove it.',
  reset: 'Straight line',
}

const S = 168
const PAD = 8

/** A response curve graph (pressure, tilt, speed): input left to right, effect bottom to top. */
export function CurveEditor({ value, onChange, xLabel, yLabel }: { value: CurvePoint[]; onChange: (c: CurvePoint[]) => void; xLabel: string; yLabel: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const pts = [...value].sort((a, b) => a.x - b.x)
  const toPx = (p: CurvePoint) => ({ x: PAD + p.x * (S - 2 * PAD), y: S - PAD - p.y * (S - 2 * PAD) })
  const fromEvent = (e: React.PointerEvent | React.MouseEvent): CurvePoint => {
    const r = svg.current!.getBoundingClientRect()
    const clamp = (v: number) => Math.min(1, Math.max(0, v))
    return { x: clamp(((e.clientX - r.left) / r.width) * (S / (S - 2 * PAD)) - PAD / (S - 2 * PAD)), y: clamp(1 - (((e.clientY - r.top) / r.height) * S - PAD) / (S - 2 * PAD)) }
  }
  let d = ''
  for (let i = 0; i <= 48; i++) {
    const x = i / 48
    const p = toPx({ x, y: curveAt(pts, x) })
    d += `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }
  return (
    <div className="studio-curve">
      <svg
        ref={svg}
        viewBox={`0 0 ${S} ${S}`}
        width={S}
        height={S}
        onPointerMove={(e) => {
          if (drag === null) return
          const p = fromEvent(e)
          const next = pts.map((q, i) => (i === drag ? p : q))
          // Points keep their order left to right.
          const lo = drag > 0 ? next[drag - 1].x + 0.01 : 0
          const hi = drag < next.length - 1 ? next[drag + 1].x - 0.01 : 1
          next[drag] = { x: Math.min(hi, Math.max(lo, p.x)), y: p.y }
          onChange(next)
        }}
        onPointerUp={() => setDrag(null)}
        onDoubleClick={(e) => {
          if (e.target !== svg.current && (e.target as Element).tagName !== 'path') return
          const p = fromEvent(e)
          onChange([...pts, p].sort((a, b) => a.x - b.x))
        }}
      >
        <rect x={PAD} y={PAD} width={S - 2 * PAD} height={S - 2 * PAD} className="studio-curve-bg" />
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g} className="studio-curve-grid">
            <line x1={PAD + g * (S - 2 * PAD)} y1={PAD} x2={PAD + g * (S - 2 * PAD)} y2={S - PAD} />
            <line x1={PAD} y1={PAD + g * (S - 2 * PAD)} x2={S - PAD} y2={PAD + g * (S - 2 * PAD)} />
          </g>
        ))}
        <path d={d} className="studio-curve-line" />
        {pts.map((p, i) => {
          const q = toPx(p)
          return (
            <circle
              key={i}
              cx={q.x}
              cy={q.y}
              r={6}
              className="studio-curve-point"
              onPointerDown={(e) => {
                e.currentTarget.ownerSVGElement!.setPointerCapture(e.pointerId)
                setDrag(i)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (pts.length > 2) onChange(pts.filter((_, j) => j !== i))
              }}
            />
          )
        })}
      </svg>
      <div className="studio-curve-side">
        <span className="muted">
          ↑ {yLabel}
          <br />→ {xLabel}
        </span>
        <span className="muted studio-curve-help">{UI.help}</span>
        <button className="btn btn-ghost" onClick={() => onChange(LINEAR.map((p) => ({ ...p })))}>
          {UI.reset}
        </button>
      </div>
    </div>
  )
}
