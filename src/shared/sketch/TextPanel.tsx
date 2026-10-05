import { AlignCenter, AlignLeft, AlignRight, Bold, CaseUpper, Italic, Underline } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import { allLocalFonts, GENERIC_FONTS, importFontFile, systemFonts } from './fonts'
import { shownInTree } from './layers'
import type { LayerHost } from './LayersPanel'
import { updateLayer, type SketchLayer } from './model'
import { normalizeText, type SketchText } from './text'
import { textBox } from './textLayers'
import './text.css'

const UI = {
  title: 'Text',
  placeholder: 'Type here',
  font: 'Font',
  fontHint: 'Pick a font or type any font name installed on this computer',
  moreFonts: 'List all fonts',
  moreFontsHint: 'Lists every font on this computer (the app may ask first)',
  importFont: 'Import font',
  importHint: 'Add a TTF, OTF or TTC font file to this drawing',
  imported: (n: number) => `${n} font${n === 1 ? '' : 's'} added`,
  noFont: 'That file is not a font this app can read',
  size: 'Size',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  caps: 'All caps',
  vertical: 'Vertical',
  verticalHint: 'Letters top to bottom, lines as columns from right to left',
  left: 'Align left',
  center: 'Align center',
  right: 'Align right',
  color: 'Colour',
  outline: 'Outline',
  tracking: 'Spacing',
  trackingHint: 'Space between letters',
  kerning: 'Font kerning',
  kerningHint: 'Use the font’s own spacing between letter pairs',
  leading: 'Lines',
  leadingHint: 'Space between lines',
  baseline: 'Lift',
  baselineHint: 'Moves the text up (or down with a minus number)',
  width: 'Wrap at',
  widthHint: 'Wrap lines at this width in pixels; 0 = no wrapping',
  opacity: 'Opacity',
  rasterize: 'Rasterize',
  rasterizeHint: 'Turn the text into pixels so you can paint on it (it is no longer editable as text)',
  paintHint: 'This is a text layer. Rasterize it to paint on it.',
}

/** Dashed boxes around text layers on the canvas (in document space). */
export function TextBoxes({ layers, activeId, scale, all }: { layers: SketchLayer[]; activeId: Id | undefined; scale: number; all: boolean }) {
  return (
    <>
      {layers.map((l) => {
        if (!l.text || (!all && l.id !== activeId) || !shownInTree(layers, l.id)) return null
        const b = textBox(normalizeText(l.text))
        const pad = 4 / scale
        return (
          <rect
            key={l.id}
            className={`sketch-textbox${l.id === activeId ? ' is-active' : ''}`}
            x={b.x - pad}
            y={b.y - pad}
            width={b.w + pad * 2}
            height={b.h + pad * 2}
            strokeWidth={1 / scale}
            strokeDasharray={`${4 / scale} ${3 / scale}`}
          />
        )
      })}
    </>
  )
}

/** Side panel for the active text layer. */
export function TextPanel({ host, layer }: { host: LayerHost; layer: SketchLayer }) {
  const t = normalizeText(layer.text!)
  const root = useProjectStore((s) => s.root)
  const [local, setLocal] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // A new text layer: ready to type over the placeholder.
  useEffect(() => {
    // After the click that made the layer has finished moving the focus.
    const f = requestAnimationFrame(() => {
      area.current?.focus()
      area.current?.select()
    })
    return () => cancelAnimationFrame(f)
  }, [layer.id])

  const set = (patch: Partial<SketchText>) => host.update((d) => updateLayer(d, layer.id, { text: { ...normalizeText(d.layers.find((l) => l.id === layer.id)?.text ?? t), ...patch } }))
  const imported = (host.doc.fonts ?? []).map((f) => f.family)
  const list = [...new Set([...imported, ...GENERIC_FONTS, ...systemFonts(), ...local])]

  const importFonts = async (files: FileList) => {
    if (!root) return
    const added: NonNullable<typeof host.doc.fonts> = []
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const tagName = String.fromCharCode(...bytes.subarray(0, 4))
      if (!['ttcf', 'OTTO', 'true', '\0\x01\0\0'].includes(tagName)) continue
      added.push(...(await importFontFile(root, f.name, bytes)))
    }
    setNote(added.length ? UI.imported(added.length) : UI.noFont)
    setTimeout(() => setNote(null), 3000)
    if (!added.length) return
    host.update((d) => ({ ...d, fonts: [...(d.fonts ?? []), ...added] }))
    set({ font: added[0].family })
  }

  const toggle = (key: 'bold' | 'italic' | 'underline' | 'caps' | 'vertical', label: string, Icon?: typeof Bold, hint?: string) => (
    <button className={`icon-btn sketch-tool${t[key] ? ' is-active' : ''}`} title={hint ?? label} aria-label={label} aria-pressed={t[key]} onClick={() => set({ [key]: !t[key] })}>
      {Icon ? <Icon size={15} /> : <span className="sketch-text-glyph">↓A</span>}
    </button>
  )

  return (
    <section className="sketch-text-panel">
      <h4>{UI.title}</h4>
      <textarea ref={area} className="input sketch-text-input" rows={3} value={t.text} placeholder={UI.placeholder} onChange={(e) => set({ text: e.target.value })} />
      <label className="sketch-text-row" title={UI.fontHint}>
        <span>{UI.font}</span>
        <input className="input" list="sketch-font-list" value={t.font} onChange={(e) => e.target.value.trim() && set({ font: e.target.value })} />
        <datalist id="sketch-font-list">
          {list.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <div className="sketch-text-buttons">
        <button className="btn btn-ghost sketch-small" title={UI.moreFontsHint} onClick={() => void allLocalFonts().then(setLocal)}>
          {UI.moreFonts}
        </button>
        <button className="btn btn-ghost sketch-small" title={UI.importHint} disabled={!root} onClick={() => fileInput.current?.click()}>
          {UI.importFont}
        </button>
        <input ref={fileInput} type="file" accept=".ttf,.otf,.ttc" multiple hidden onChange={(e) => e.target.files && void importFonts(e.target.files).finally(() => (e.target.value = ''))} />
        {note && <span className="sketch-text-note">{note}</span>}
      </div>
      <Num label={UI.size} value={t.size} min={1} max={2000} onChange={(size) => set({ size })} />
      <div className="sketch-text-buttons">
        {toggle('bold', UI.bold, Bold)}
        {toggle('italic', UI.italic, Italic)}
        {toggle('underline', UI.underline, Underline)}
        {toggle('caps', UI.caps, CaseUpper)}
        {toggle('vertical', UI.vertical, undefined, UI.verticalHint)}
        <span className="sketch-sep" />
        {(
          [
            ['left', UI.left, AlignLeft],
            ['center', UI.center, AlignCenter],
            ['right', UI.right, AlignRight],
          ] as const
        ).map(([a, label, Icon]) => (
          <button key={a} className={`icon-btn sketch-tool${t.align === a ? ' is-active' : ''}`} title={label} aria-label={label} aria-pressed={t.align === a} onClick={() => set({ align: a })}>
            <Icon size={15} />
          </button>
        ))}
      </div>
      <label className="sketch-text-row">
        <span>{UI.color}</span>
        <input type="color" value={t.color} onChange={(e) => set({ color: e.target.value })} />
        <span>{UI.outline}</span>
        <input type="color" value={t.outlineColor} onChange={(e) => set({ outlineColor: e.target.value })} />
        <input className="input sketch-text-num" type="number" min={0} max={500} value={t.outline} onChange={(e) => set({ outline: Math.max(0, Number(e.target.value) || 0) })} />
      </label>
      <Range label={UI.tracking} hint={UI.trackingHint} min={-50} max={200} step={1} value={t.tracking} shown={`${Math.round(t.tracking)}%`} onChange={(tracking) => set({ tracking })} />
      <label className="sketch-check" title={UI.kerningHint}>
        <input type="checkbox" checked={t.kerning} onChange={(e) => set({ kerning: e.target.checked })} /> {UI.kerning}
      </label>
      <Range label={UI.leading} hint={UI.leadingHint} min={0.5} max={3} step={0.05} value={t.leading} shown={t.leading.toFixed(2)} onChange={(leading) => set({ leading })} />
      <Num label={UI.baseline} hint={UI.baselineHint} value={t.baseline} min={-10000} max={10000} onChange={(baseline) => set({ baseline })} />
      <Num label={UI.width} hint={UI.widthHint} value={t.width} min={0} max={100000} onChange={(width) => set({ width })} />
      <Range
        label={UI.opacity}
        min={0}
        max={1}
        step={0.01}
        value={layer.opacity}
        shown={`${Math.round(layer.opacity * 100)}%`}
        onChange={(opacity) => host.update((d) => updateLayer(d, layer.id, { opacity }))}
      />
      <p className="sketch-text-note">{UI.paintHint}</p>
      <button className="btn sketch-small" title={UI.rasterizeHint} onClick={() => host.update((d) => ({ ...d, layers: d.layers.map((l) => (l.id === layer.id ? rasterized(l) : l)) }))}>
        {UI.rasterize}
      </button>
    </section>
  )
}

/** The layer without its text settings: plain pixels from now on. */
function rasterized(l: SketchLayer): SketchLayer {
  const out = { ...l }
  delete out.text
  return out
}

function Range(p: { label: string; hint?: string; min: number; max: number; step: number; value: number; shown: string; onChange(v: number): void }) {
  return (
    <label className="sketch-slider" title={p.hint}>
      <span>{p.label}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
      <span className="sketch-slider-value">{p.shown}</span>
    </label>
  )
}

function Num(p: { label: string; hint?: string; value: number; min: number; max: number; onChange(v: number): void }) {
  return (
    <label className="sketch-text-row" title={p.hint}>
      <span>{p.label}</span>
      <input
        className="input sketch-text-num"
        type="number"
        min={p.min}
        max={p.max}
        value={Math.round(p.value * 100) / 100}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) p.onChange(Math.min(p.max, Math.max(p.min, v)))
        }}
      />
    </label>
  )
}
