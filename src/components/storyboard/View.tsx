import { ArrowLeft, ArrowRight, Copy, ImagePlus, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { pickAndImportAssets, useAssetUrl } from '@/core/assets'
import { newId, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore, useUndoRedoKeys } from '@/core/state'
import { NumberInput, PresetHeader } from '@/shared/calculators'
import '@/shared/listDetail/listDetail.css'
import { ProofTextarea } from '@/shared/spell'
import './storyboard.css'

/** Storyboard for cutscenes (v0.10): frames with shots, camera moves, dialogue and timing, played as an animatic. */

const SHOTS = ['Wide', 'Medium', 'Close-up', 'Extreme close-up', 'Over the shoulder', 'Point of view', 'Aerial', 'Insert'] as const
const CAMERA = ['Static', 'Pan', 'Tilt', 'Zoom in', 'Zoom out', 'Tracking', 'Shake', 'Cut'] as const

interface Frame {
  id: Id
  image: string | null
  shot: (typeof SHOTS)[number]
  camera: (typeof CAMERA)[number]
  seconds: number
  action: string
  dialogue: string
  sound: string
}

interface StoryboardDoc {
  frames: Frame[]
}

const newFrame = (): Frame => ({ id: newId(), image: null, shot: 'Wide', camera: 'Static', seconds: 3, action: '', dialogue: '', sound: '' })
const createStoryboardDoc = (): StoryboardDoc => ({ frames: [newFrame()] })

function FrameImage({ path, className }: { path: string | null; className: string }) {
  const url = useAssetUrl(path)
  return url ? <img className={className} src={url} alt="" /> : <div className={`${className} sb-blank`}>No picture</div>
}

export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<StoryboardDoc>('storyboard', documentId!, createStoryboardDoc)
  useUndoRedoKeys(doc, active)
  const root = useProjectStore((s) => s.root)
  const [sel, setSel] = useState(0)
  const [playing, setPlaying] = useState<number | null>(null)
  const frames = useMemo(() => doc.data?.frames ?? [], [doc.data])

  useEffect(() => {
    if (playing === null) return
    const f = frames[playing]
    const t = setTimeout(() => setPlaying(f && playing + 1 < frames.length ? playing + 1 : null), f ? Math.max(0.3, f.seconds) * 1000 : 0)
    return () => clearTimeout(t)
  }, [playing, frames])

  if (!doc.data) return null
  const set = (fn: (f: Frame[]) => Frame[]) => doc.update((d) => ({ ...d, frames: fn(d.frames) }))
  const i = Math.min(sel, frames.length - 1)
  const f = frames[i]
  const edit = (patch: Partial<Frame>) => f && set((list) => list.map((x) => (x.id === f.id ? { ...x, ...patch } : x)))
  const total = frames.reduce((s, x) => s + x.seconds, 0)
  const move = (by: number) => {
    const j = i + by
    if (j < 0 || j >= frames.length) return
    set((list) => {
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setSel(j)
  }
  const shown = playing !== null ? frames[playing] : null

  return (
    <div className="sb">
      <div className="sb-head">
        <PresetHeader documentId={documentId!} kind="Storyboard" undo={doc.undo} redo={doc.redo} canUndo={doc.canUndo} canRedo={doc.canRedo} />
      </div>
      <div className="ld-toolbar">
        <button className="btn btn-primary" onClick={() => setPlaying(playing === null ? 0 : null)} disabled={!frames.length}>
          {playing === null ? <Play size={14} /> : <Pause size={14} />} {playing === null ? 'Play animatic' : 'Stop'}
        </button>
        <button
          className="btn"
          onClick={() => {
            set((list) => [...list.slice(0, i + 1), newFrame(), ...list.slice(i + 1)])
            setSel(i + 1)
          }}
        >
          <Plus size={14} /> Frame
        </button>
        <span className="muted">
          {frames.length} frames · {Math.round(total * 10) / 10} seconds
        </span>
      </div>
      <div className="sb-body">
        <div className="sb-main">
          {shown ? (
            <div className="sb-player">
              <FrameImage path={shown.image} className="sb-big" />
              {shown.dialogue && <div className="sb-sub">{shown.dialogue}</div>}
              <div className="sb-count">
                {playing! + 1} / {frames.length} · {shown.shot} · {shown.camera}
              </div>
            </div>
          ) : (
            f && (
              <div className="sb-player">
                <FrameImage path={f.image} className="sb-big" />
                {f.dialogue && <div className="sb-sub">{f.dialogue}</div>}
              </div>
            )
          )}
          <div className="sb-strip">
            {frames.map((x, n) => (
              <button key={x.id} className={`sb-frame${n === i ? ' on' : ''}${n === playing ? ' playing' : ''}`} onClick={() => setSel(n)}>
                <FrameImage path={x.image} className="sb-thumb" />
                <span>
                  {n + 1} · {x.shot} · {x.seconds}s
                </span>
              </button>
            ))}
          </div>
        </div>
        {f && (
          <aside className="sb-side">
            <strong>Frame {i + 1}</strong>
            {root && (
              <button
                className="btn"
                onClick={async () => {
                  const [a] = await pickAndImportAssets(root, 'image', 'Picture for the frame')
                  if (a) edit({ image: a.path })
                }}
              >
                <ImagePlus size={14} /> {f.image ? 'Change picture' : 'Add picture'}
              </button>
            )}
            <label className="ld-field">
              <span>Shot</span>
              <select className="input" value={f.shot} onChange={(e) => edit({ shot: e.target.value as Frame['shot'] })}>
                {SHOTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="ld-field">
              <span>Camera</span>
              <select className="input" value={f.camera} onChange={(e) => edit({ camera: e.target.value as Frame['camera'] })}>
                {CAMERA.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="ld-field">
              <span>Seconds</span>
              <NumberInput value={f.seconds} min={0.3} onChange={(seconds) => edit({ seconds })} />
            </label>
            <label className="ld-field">
              <span>What happens</span>
              <ProofTextarea className="input" rows={3} value={f.action} onChange={(e) => edit({ action: e.target.value })} />
            </label>
            <label className="ld-field">
              <span>Dialogue</span>
              <ProofTextarea className="input" rows={2} value={f.dialogue} onChange={(e) => edit({ dialogue: e.target.value })} />
            </label>
            <label className="ld-field">
              <span>Sound and music</span>
              <input className="input" value={f.sound} onChange={(e) => edit({ sound: e.target.value })} />
            </label>
            <div className="ld-inline">
              <button className="icon-btn" title="Move earlier" aria-label="Move earlier" onClick={() => move(-1)}>
                <ArrowLeft size={14} />
              </button>
              <button className="icon-btn" title="Move later" aria-label="Move later" onClick={() => move(1)}>
                <ArrowRight size={14} />
              </button>
              <button
                className="icon-btn"
                title="Duplicate"
                aria-label="Duplicate"
                onClick={() => {
                  set((list) => [...list.slice(0, i + 1), { ...f, id: newId() }, ...list.slice(i + 1)])
                  setSel(i + 1)
                }}
              >
                <Copy size={14} />
              </button>
              <button
                className="btn btn-danger"
                disabled={frames.length < 2}
                onClick={() => {
                  set((list) => list.filter((x) => x.id !== f.id))
                  setSel(Math.max(0, i - 1))
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
