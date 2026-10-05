import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { GRADIENT_PRESETS, rgbHex, sampleGradient, type GradientStop } from './color'

const UI = {
  presets: 'Ready-made gradients',
  help: 'Click the bar to add a colour, drag a marker to move it.',
  color: 'Marker colour',
  remove: 'Remove this colour',
}

const gradientCss = (stops: GradientStop[]) =>
  `linear-gradient(to right, ${[...stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${s.color} ${Math.round(s.at * 100)}%`)
    .join(', ')})`

/** Gradient map colours: ready-made gradients plus a bar with draggable colour markers. */
export function GradientEditor({ stops, onChange }: { stops: GradientStop[]; onChange(stops: GradientStop[]): void }) {
  const [sel, setSel] = useState(0)
  const bar = useRef<HTMLDivElement>(null)
  const current = stops[Math.min(sel, stops.length - 1)]

  const posOf = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }

  const drag = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    setSel(index)
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => onChange(stops.map((s, i) => (i === index ? { ...s, at: posOf(ev.clientX) } : s)))
    const up = () => {
      el.removeEventListener('pointermove', move as EventListener)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move as EventListener)
    el.addEventListener('pointerup', up)
  }

  const add = (e: React.PointerEvent) => {
    const at = posOf(e.clientX)
    onChange([...stops, { at, color: rgbHex(sampleGradient(stops, at)) }])
    setSel(stops.length)
  }

  return (
    <div className="adjust-gradient">
      <div className="adjust-presets" aria-label={UI.presets}>
        {GRADIENT_PRESETS.map((p) => (
          <button key={p.name} className="adjust-preset" title={p.name} style={{ background: gradientCss(p.stops) }} onClick={() => onChange(p.stops)} />
        ))}
      </div>
      <div ref={bar} className="adjust-gradient-bar" style={{ background: gradientCss(stops) }} onPointerDown={add} title={UI.help}>
        {stops.map((s, i) => (
          <span
            key={i}
            className={`adjust-stop${i === sel ? ' is-active' : ''}`}
            style={{ left: `${s.at * 100}%`, background: s.color }}
            onPointerDown={drag(i)}
          />
        ))}
      </div>
      {current && (
        <div className="sketch-row">
          <input type="color" value={current.color} aria-label={UI.color} onChange={(e) => onChange(stops.map((s, i) => (i === sel ? { ...s, color: e.target.value } : s)))} />
          <span className="adjust-hint">{UI.help}</span>
          <button
            className="icon-btn"
            title={UI.remove}
            disabled={stops.length <= 2}
            onClick={() => {
              onChange(stops.filter((_, i) => i !== sel))
              setSel(0)
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
