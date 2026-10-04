import { Eraser } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Id } from '@/core/model'
import { Modal } from '../ui'
import { colorStroke, drawPreview, GRAINS, SHAPES, StrokeStamper, type BrushDef, type BrushGrain, type BrushSettings, type BrushShape } from './brushes'
import { useBrushLibrary } from './library'

const SECTIONS = ['Stroke path', 'Stabilization', 'Taper', 'Shape', 'Grain', 'Rendering', 'Dynamics', 'Pen pressure', 'Properties'] as const
type Section = (typeof SECTIONS)[number]

const UI = {
  title: 'Brush Studio',
  pad: 'Drawing pad: try the brush here',
  clearPad: 'Clear the drawing pad',
  cancel: 'Cancel',
  done: 'Done',
}

/** Edit every setting of a brush, with a drawing pad to try it. */
export function BrushStudio({ brushId, color, onClose }: { brushId: Id; color: string; onClose: () => void }) {
  const brush = useBrushLibrary((s) => s.brushes.find((b) => b.id === brushId))
  const update = useBrushLibrary((s) => s.updateBrush)
  const [original] = useState<BrushDef | undefined>(brush)
  const [section, setSection] = useState<Section>('Stroke path')
  if (!brush) return null
  const set = (patch: Partial<BrushSettings & { name: string }>) => update(brush.id, patch)

  const cancel = () => {
    if (original) update(brush.id, original)
    onClose()
  }

  const num = (label: string, key: keyof BrushSettings, min: number, max: number, step: number, fmt: (v: number) => string = (v) => `${Math.round(v * 100)}%`) => (
    <Row label={label} value={fmt(brush[key] as number)}>
      <input type="range" min={min} max={max} step={step} value={brush[key] as number} onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<BrushSettings>)} />
    </Row>
  )
  const px = (v: number) => `${Math.round(v)} px`

  return (
    <Modal onClose={cancel}>
      <div className="studio">
        <div className="studio-head">
          <h3>
            {UI.title}: {brush.name}
          </h3>
        </div>
        <div className="studio-body">
          <nav className="studio-nav">
            {SECTIONS.map((s) => (
              <button key={s} className={`studio-tab${s === section ? ' is-active' : ''}`} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
          </nav>
          <div className="studio-settings">
            {section === 'Stroke path' && (
              <>
                {num('Spacing', 'spacing', 0.02, 1.5, 0.01)}
                {num('Spacing jitter', 'spacingJitter', 0, 1, 0.05)}
                {num('Scatter', 'scatter', 0, 1.5, 0.05)}
                {num('Count', 'count', 1, 8, 1, (v) => String(v))}
              </>
            )}
            {section === 'Stabilization' && num('StreamLine', 'streamline', 0, 1, 0.05)}
            {section === 'Taper' && (
              <>
                {num('Start', 'taperStart', 0, 200, 1, (v) => (v ? px(v) : 'Off'))}
                {num('End', 'taperEnd', 0, 200, 1, (v) => (v ? px(v) : 'Off'))}
              </>
            )}
            {section === 'Shape' && (
              <>
                <Row label="Shape">
                  <select className="input" value={brush.shape} onChange={(e) => set({ shape: e.target.value as BrushShape })}>
                    {SHAPES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Row>
                {num('Hardness', 'hardness', 0, 1, 0.05)}
                {num('Roundness', 'roundness', 0.05, 1, 0.05)}
                <Row label="Rotation">
                  <select
                    className="input"
                    value={typeof brush.rotation === 'number' ? 'fixed' : brush.rotation}
                    onChange={(e) => set({ rotation: e.target.value === 'fixed' ? 0 : (e.target.value as 'follow' | 'random') })}
                  >
                    <option value="follow">Follow the stroke</option>
                    <option value="random">Random</option>
                    <option value="fixed">Fixed angle</option>
                  </select>
                </Row>
                {typeof brush.rotation === 'number' && (
                  <Row label="Angle" value={`${brush.rotation}°`}>
                    <input type="range" min={0} max={180} step={1} value={brush.rotation} onChange={(e) => set({ rotation: Number(e.target.value) })} />
                  </Row>
                )}
              </>
            )}
            {section === 'Grain' && (
              <>
                <Row label="Grain">
                  <select className="input" value={brush.grain} onChange={(e) => set({ grain: e.target.value as BrushGrain })}>
                    {GRAINS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </Row>
                {brush.grain !== 'none' && num('Depth', 'grainDepth', 0, 1, 0.05)}
              </>
            )}
            {section === 'Rendering' && num('Flow', 'flow', 0.02, 1, 0.01)}
            {section === 'Dynamics' && (
              <>
                {num('Size jitter', 'sizeJitter', 0, 1, 0.05)}
                {num('Opacity jitter', 'opacityJitter', 0, 1, 0.05)}
              </>
            )}
            {section === 'Pen pressure' && (
              <>
                {num('Size', 'pressureSize', 0, 1, 0.05)}
                {num('Opacity', 'pressureOpacity', 0, 1, 0.05)}
              </>
            )}
            {section === 'Properties' && (
              <>
                <Row label="Name">
                  <input className="input" value={brush.name} onChange={(e) => set({ name: e.target.value })} />
                </Row>
                {num('Size', 'size', 1, 400, 1, px)}
                {num('Opacity', 'opacity', 0.05, 1, 0.05)}
              </>
            )}
          </div>
          <DrawingPad brush={brush} color={color} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={cancel}>
            {UI.cancel}
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            {UI.done}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <label className="studio-row">
      <span>{label}</span>
      {children}
      <span className="studio-value">{value}</span>
    </label>
  )
}

/** The preview stroke on top and a white pad below to draw on with the brush being edited. */
function DrawingPad({ brush, color }: { brush: BrushSettings; color: string }) {
  const preview = useRef<HTMLCanvasElement>(null)
  const pad = useRef<HTMLCanvasElement>(null)
  const live = useRef<{ mask: HTMLCanvasElement; stamper: StrokeStamper } | null>(null)
  const [, redraw] = useState(0)

  useEffect(() => {
    if (preview.current) drawPreview(preview.current, brush, color)
  }, [brush, color])

  const pos = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * pad.current!.width,
      y: ((e.clientY - r.top) / r.height) * pad.current!.height,
      pressure: e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 1,
    }
  }

  const commit = () => {
    const l = live.current
    const c = pad.current
    if (!l || !c) return
    l.stamper.finish()
    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    colorStroke(l.mask, out.getContext('2d')!, color, brush)
    const ctx = c.getContext('2d')!
    ctx.globalAlpha = brush.opacity
    ctx.drawImage(out, 0, 0)
    ctx.globalAlpha = 1
    live.current = null
    redraw((n) => n + 1)
  }

  return (
    <div className="studio-pad">
      <canvas ref={preview} width={320} height={90} className="studio-preview" />
      <span className="muted">{UI.pad}</span>
      <canvas
        ref={pad}
        width={320}
        height={240}
        className="studio-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const mask = document.createElement('canvas')
          mask.width = pad.current!.width
          mask.height = pad.current!.height
          const stamper = new StrokeStamper(mask.getContext('2d')!, brush)
          stamper.add(pos(e))
          live.current = { mask, stamper }
        }}
        onPointerMove={(e) => {
          if (!live.current) return
          for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) live.current.stamper.add(pos(ev as unknown as React.PointerEvent))
          // Show progress by committing a colored copy of the mask so far.
          const c = pad.current!
          const ctx = c.getContext('2d')!
          const out = document.createElement('canvas')
          out.width = c.width
          out.height = c.height
          colorStroke(live.current.mask, out.getContext('2d')!, color, brush)
          const snap = (c as HTMLCanvasElement & { _base?: ImageData })._base ?? ctx.getImageData(0, 0, c.width, c.height)
          ;(c as HTMLCanvasElement & { _base?: ImageData })._base = snap
          ctx.putImageData(snap, 0, 0)
          ctx.globalAlpha = brush.opacity
          ctx.drawImage(out, 0, 0)
          ctx.globalAlpha = 1
        }}
        onPointerUp={() => {
          const c = pad.current as (HTMLCanvasElement & { _base?: ImageData }) | null
          if (c?._base) c.getContext('2d')!.putImageData(c._base, 0, 0)
          if (c) c._base = undefined
          commit()
        }}
      />
      <button className="btn btn-ghost studio-clear" onClick={() => pad.current?.getContext('2d')!.clearRect(0, 0, 320, 240)}>
        <Eraser size={14} /> {UI.clearPad}
      </button>
    </div>
  )
}
