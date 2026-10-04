import { AlignCenter, AlignLeft, AlignRight, Bold, Calculator, Italic, Minus, PaintBucket, Plus, Type, Underline } from 'lucide-react'
import { useEffect, useState } from 'react'
import { calcPreset } from './engine'
import type { Border, CellStyle, NumberFormat } from './model'

const FORMATS: { id: NumberFormat; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'number', label: 'Number' },
  { id: 'percent', label: 'Percent' },
  { id: 'currency', label: 'Currency (€)' },
  { id: 'date', label: 'Date' },
  { id: 'text', label: 'Text' },
]

type BorderMode = 'all' | 'outer' | 'bottom' | 'top' | 'left' | 'right' | 'none'

/** Formatting bar above the grid. */
export function Toolbar({
  style,
  onStyle,
  presets,
  onInsertCalc,
}: {
  style: CellStyle
  onStyle(patch: Partial<CellStyle> | ((s: CellStyle) => CellStyle)): void
  presets: string[]
  onInsertCalc(name: string): void
}) {
  const [line, setLine] = useState<Border>({ w: 1, color: '#888888' })
  const [calcOpen, setCalcOpen] = useState(false)
  useEffect(() => {
    if (!calcOpen) return
    const close = (e: MouseEvent) => !(e.target as Element).closest?.('.ss-calcwrap') && setCalcOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [calcOpen])
  const toggle = (key: 'b' | 'i' | 'u') => onStyle({ [key]: style[key] ? undefined : true })
  const border = (mode: BorderMode) =>
    onStyle((s) => {
      const b = mode === 'none' ? undefined : line
      if (mode === 'none') return { ...s, top: undefined, bottom: undefined, left: undefined, right: undefined }
      if (mode === 'all' || mode === 'outer') return { ...s, top: b, bottom: b, left: b, right: b }
      return { ...s, [mode]: b }
    })

  return (
    <div className="ss-toolbar" onMouseDown={(e) => e.target instanceof HTMLButtonElement && e.preventDefault()}>
      <button className={`icon-btn${style.b ? ' on' : ''}`} title="Bold (Ctrl+B)" aria-label="Bold" onClick={() => toggle('b')}>
        <Bold size={15} />
      </button>
      <button className={`icon-btn${style.i ? ' on' : ''}`} title="Italic (Ctrl+I)" aria-label="Italic" onClick={() => toggle('i')}>
        <Italic size={15} />
      </button>
      <button className={`icon-btn${style.u ? ' on' : ''}`} title="Underline (Ctrl+U)" aria-label="Underline" onClick={() => toggle('u')}>
        <Underline size={15} />
      </button>
      <label className="ss-color" title="Text color">
        <Type size={15} />
        <input type="color" value={style.color ?? '#000000'} onChange={(e) => onStyle({ color: e.target.value })} />
      </label>
      <label className="ss-color" title="Fill color">
        <PaintBucket size={15} />
        <input type="color" value={style.bg ?? '#ffffff'} onChange={(e) => onStyle({ bg: e.target.value })} />
      </label>
      <button className="btn btn-ghost ss-small" title="Remove colors" onClick={() => onStyle({ color: undefined, bg: undefined })}>
        No color
      </button>
      <span className="ss-sep" />
      {(['left', 'center', 'right'] as const).map((a) => {
        const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
        return (
          <button key={a} className={`icon-btn${style.align === a ? ' on' : ''}`} title={`Align ${a}`} aria-label={`Align ${a}`} onClick={() => onStyle({ align: style.align === a ? undefined : a })}>
            <Icon size={15} />
          </button>
        )
      })}
      <span className="ss-sep" />
      <select className="input ss-select" title="Number format" value={style.fmt ?? 'general'} onChange={(e) => onStyle({ fmt: e.target.value === 'general' ? undefined : (e.target.value as NumberFormat) })}>
        {FORMATS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <button className="icon-btn" title="Fewer decimals" aria-label="Fewer decimals" onClick={() => onStyle({ dp: Math.max(0, (style.dp ?? 2) - 1) })}>
        <Minus size={13} />
      </button>
      <span className="ss-dp" title="Decimals">{style.dp ?? 2}</span>
      <button className="icon-btn" title="More decimals" aria-label="More decimals" onClick={() => onStyle({ dp: Math.min(10, (style.dp ?? 2) + 1) })}>
        <Plus size={13} />
      </button>
      <span className="ss-sep" />
      <select className="input ss-select" title="Borders" value="" onChange={(e) => e.target.value && border(e.target.value as BorderMode)}>
        <option value="">Borders…</option>
        <option value="all">All sides</option>
        <option value="bottom">Bottom</option>
        <option value="top">Top</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
        <option value="none">No borders</option>
      </select>
      <select className="input ss-select" title="Line thickness" value={line.w} onChange={(e) => setLine({ ...line, w: Number(e.target.value) })}>
        <option value={1}>Thin</option>
        <option value={2}>Medium</option>
        <option value={3}>Thick</option>
      </select>
      <label className="ss-color" title="Line color">
        <span className="ss-linecolor" style={{ borderBottom: `${line.w + 1}px solid ${line.color}` }} />
        <input type="color" value={line.color} onChange={(e) => setLine({ ...line, color: e.target.value })} />
      </label>
      <span className="ss-sep" />
      <div className="ss-calcwrap">
        <button className="btn btn-ghost ss-small" title="Put a Damage Calculator result in this cell (or drag one from the sidebar)" onClick={() => setCalcOpen(!calcOpen)}>
          <Calculator size={14} /> Calculator
        </button>
        {calcOpen && (
          <div className="ss-calcmenu">
            {presets.length === 0 && <p>No Damage Calculator presets yet. Make one in the Damage Calculator first.</p>}
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onInsertCalc(p)
                  setCalcOpen(false)
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const CALC_RE = /^=CALC\(\s*"((?:[^"]|"")*)"\s*((?:,\s*"[^"]*"\s*,\s*[^,)]+)*)\s*\)$/

/** For a CALC() cell: each calculator input can come from a cell (an access point) or keep the preset's value. */
export function CalcPanel({ formula, onChange }: { formula: string; onChange(v: string): void }) {
  const m = CALC_RE.exec(formula.trim())
  if (!m) return null
  const name = m[1].replace(/""/g, '"')
  const preset = calcPreset(name)
  const links = new Map<string, string>()
  for (const pair of m[2].matchAll(/"([^"]*)"\s*,\s*([^,)]+)/g)) links.set(pair[1], pair[2].trim())
  if (!preset) return <div className="ss-calcpanel muted">No Damage Calculator preset called "{name}".</div>
  const write = (next: Map<string, string>) => {
    const args = [...next].filter(([, ref]) => ref).map(([v, ref]) => `, "${v}", ${ref}`)
    onChange(`=CALC("${name.replace(/"/g, '""')}"${args.join('')})`)
  }
  return (
    <div className="ss-calcpanel">
      <strong>{name}</strong>
      <span className="muted">Inputs from cells (empty = the preset's own value):</span>
      {Object.entries(preset.values).map(([v, def]) => (
        <label key={v}>
          {v}
          <input
            className="input"
            placeholder={String(def)}
            defaultValue={links.get(v) ?? ''}
            key={`${formula}-${v}`}
            onBlur={(e) => {
              const ref = e.target.value.trim().toUpperCase()
              if (ref === (links.get(v) ?? '')) return
              const next = new Map(links)
              if (ref) next.set(v, ref)
              else next.delete(v)
              write(next)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      ))}
    </div>
  )
}
