import { Eraser } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { drawPreview, penTilt, scaledBrush, type BrushSettings } from './brushes'
import { SketchEngine } from './engine'
import { newLayer, type SketchDoc } from './model'
import { preloadBrush } from './library'

const UI = {
  thumbnail: 'Library preview',
  pad: 'Drawing pad: try the brush here',
  color: 'Test color',
  size: 'Preview size',
  clear: 'Clear',
  smudge: 'Smudge',
}

const W = 340
const H = 280

// One small engine for every drawing pad (each one holds a GPU context).
let shared: { engine: SketchEngine; doc: Pick<SketchDoc, 'layers' | 'backgroundColor'> } | null = null
function pad() {
  if (!shared || !shared.engine.gpuActive) {
    const layer = newLayer('Pad')
    shared = { engine: new SketchEngine(W, H), doc: { layers: [layer], backgroundColor: '#ffffff' } }
  }
  return shared
}

/** The brush's library preview and a pad to draw on with it, using the real engine (wet mix and smudge too). */
export function DrawingPad({ brush, color: startColor }: { brush: BrushSettings; color: string }) {
  const thumb = useRef<HTMLCanvasElement>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [color, setColor] = useState(startColor)
  const [scale, setScale] = useState(() => Math.min(1, 50 / brush.size))
  const [smudge, setSmudge] = useState(false)
  const [ready, setReady] = useState(0)

  useEffect(() => {
    void preloadBrush(brush).then(() => setReady((n) => n + 1))
  }, [brush])

  useEffect(() => {
    if (thumb.current) drawPreview(thumb.current, brush, color)
  }, [brush, color, ready])

  const show = () => {
    const { engine, doc } = pad()
    const g = view.current?.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, W, H)
    g.drawImage(engine.render(doc), 0, 0)
  }
  useEffect(show, [])

  const clear = () => {
    const { engine, doc } = pad()
    engine.setLayerImage(doc.layers[0].id, null)
    show()
  }

  const point = (e: PointerEvent | React.PointerEvent) => {
    const r = view.current!.getBoundingClientRect()
    const pen = e.pointerType === 'pen'
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
      pressure: pen ? Math.max(0.05, e.pressure) : 1,
      pen,
      time: e.timeStamp,
      ...(pen ? penTilt(e as PointerEvent) : {}),
    }
  }

  return (
    <div className="studio-pad">
      <span className="muted">{UI.thumbnail}</span>
      <canvas ref={thumb} width={W} height={70} className="studio-preview" />
      <span className="muted">{UI.pad}</span>
      <canvas
        ref={view}
        width={W}
        height={H}
        className="studio-canvas"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const { engine, doc } = pad()
          drawing.current = true
          engine.beginStroke({ layer: doc.layers[0], brush: scaledBrush(brush, scale), color, symmetry: 'off', erase: false, smudge }, point(e))
          show()
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const { engine } = pad()
          for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) engine.strokeTo(point(ev))
          show()
        }}
        onPointerUp={() => {
          if (!drawing.current) return
          drawing.current = false
          pad().engine.endStroke()
          show()
        }}
      />
      <div className="studio-pad-tools">
        <label title={UI.color}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="studio-pad-size">
          {UI.size}
          <input type="range" min={0.1} max={2} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
          <span>{Math.round(brush.size * scale)} px</span>
        </label>
        <label className="studio-check">
          <input type="checkbox" checked={smudge} onChange={(e) => setSmudge(e.target.checked)} /> {UI.smudge}
        </label>
        <button className="btn btn-ghost" onClick={clear}>
          <Eraser size={14} /> {UI.clear}
        </button>
      </div>
    </div>
  )
}
