/**
 * Dev-only playground for the canvas engine. Not part of the app build.
 * Run `npm run dev` and open http://localhost:5173/src/shared/canvas/playground/index.html
 */
import { Download, Eye, EyeOff, Link2, Lock, MapPin, Moon, Plus, Sun, Unlock } from 'lucide-react'
import { StrictMode, useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Circle, Group, Text } from 'react-konva'
import { newId } from '@/core/model'
import { History } from '@/core/state/history'
import '@/index.css'
import '@/shared/ui.css'
import {
  addLayer,
  addNodes,
  CanvasEditor,
  createScene,
  defaultTools,
  ensureTopLayer,
  orderedLayers,
  rectCenter,
  updateLayer,
  useCanvasState,
  type CanvasApi,
  type CanvasTool,
  type ConnectorNode,
  type LineNode,
  type NodeBase,
  type NodeType,
  type NodeTypes,
  type BuiltinNode,
  type Scene,
  type SceneRecipe,
  type UpdateOptions,
} from '..'

/** Example custom kind, the way a component would add one (e.g. Brainstorm pins). */
interface PinNode extends NodeBase {
  kind: 'pin'
  pinColor: string
}
type DemoNode = BuiltinNode | PinNode

const pinType: NodeType<PinNode> = {
  label: 'Pin',
  render: (n, ctx) => (
    <Group>
      <Circle radius={9} fill={n.pinColor} stroke={ctx.theme.bg} strokeWidth={2} />
      {n.name ? <Text x={14} y={-7} text={n.name} fontSize={13} fill={ctx.theme.text} fontFamily={ctx.theme.font} /> : null}
    </Group>
  ),
  bounds: () => ({ x: -10, y: -10, width: 20, height: 20 }),
  transformable: false,
}
const nodeTypes: NodeTypes = { pin: pinType }

const pinTool: CanvasTool<DemoNode> = {
  id: 'pin',
  label: 'Pin',
  icon: MapPin,
  shortcut: 'I',
  cursor: 'crosshair',
  pointerDown(e, api) {
    const pin: PinNode = { id: newId(), kind: 'pin', layerId: api.activeLayerId, x: e.world.x, y: e.world.y, pinColor: '#ef5d6c' }
    api.update((s) => addNodes(s, [pin]))
  },
}

/** Example custom tool: click a node, then another, to connect them (like the story writer's Connect tool). */
function connectTool(): CanvasTool<DemoNode> {
  let from: string | null = null
  const reset = (api: CanvasApi<DemoNode>) => {
    from = null
    api.setDraft(null)
  }
  return {
    id: 'connect',
    label: 'Connect',
    icon: Link2,
    shortcut: 'C',
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (!e.targetId || api.scene.nodes.find((n) => n.id === e.targetId)?.kind === 'connector') return reset(api)
      if (!from || from === e.targetId) {
        from = e.targetId
        api.select([from])
        return
      }
      const link: ConnectorNode = { id: newId(), kind: 'connector', layerId: api.activeLayerId, x: 0, y: 0, fromId: from, toId: e.targetId }
      api.update((s) => addNodes(s, [link]))
      reset(api)
      api.select([link.id])
    },
    hover(e, api) {
      const b = from && e ? api.getWorldBounds(from) : null
      if (!b || !e) return api.setDraft(null)
      const c = rectCenter(b)
      const line: LineNode = { id: 'connect-draft', kind: 'line', layerId: api.activeLayerId, x: c.x, y: c.y, points: [0, 0, e.world.x - c.x, e.world.y - c.y], arrow: true }
      api.setDraft([line])
    },
    keyDown(e, api) {
      if (e.key !== 'Escape' || !from) return false
      reset(api)
      return true
    },
    deactivate: reset,
  }
}

function sampleScene(): Scene<DemoNode> {
  const s = createScene<DemoNode>()
  const L = s.layers[0].id
  const a = newId()
  const b = newId()
  return addNodes(s, [
    { id: newId(), kind: 'rect', layerId: L, x: 0, y: 0, width: 220, height: 140, cornerRadius: 10, fillColor: '#2f6fe033' },
    { id: newId(), kind: 'ellipse', layerId: L, x: 280, y: 10, width: 120, height: 120, strokeColor: '#d46cf0' },
    { id: a, kind: 'note', layerId: L, x: 40, y: 220, width: 180, height: 140, text: 'Double-click me to edit. Drag to move.', fillColor: '#ffe27a' },
    { id: b, kind: 'note', layerId: L, x: 360, y: 260, width: 180, height: 140, text: 'Connected notes follow each other.', fillColor: '#8fd3ff' },
    { id: newId(), kind: 'connector', layerId: L, x: 0, y: 0, fromId: a, toId: b },
    { id: newId(), kind: 'text', layerId: L, x: 0, y: -60, width: 420, fontSize: 28, text: 'Canvas playground' },
    { id: newId(), kind: 'image', layerId: L, x: 460, y: 0, width: 120, height: 120, src: 'missing.png' },
    { id: newId(), kind: 'pin', layerId: L, x: 250, y: 460, pinColor: '#9ef0b0', name: 'A pin' },
  ])
}

/** Stand-in for useDocument: scene state with undo history. */
function useLocalScene(initial: () => Scene<DemoNode>) {
  const [scene, setScene] = useState(initial)
  const ref = useRef(scene)
  const history = useRef(new History<Scene<DemoNode>>())
  const [, bump] = useState(0)
  const set = (next: Scene<DemoNode>) => {
    ref.current = next
    setScene(next)
    bump((n) => n + 1)
  }
  const onChange = useCallback((recipe: SceneRecipe<DemoNode>, options?: UpdateOptions) => {
    const next = recipe(ref.current)
    if (next === ref.current) return
    if (options?.undoable !== false) history.current.record(ref.current)
    set(next)
  }, [])
  const onUndo = () => {
    const prev = history.current.undo(ref.current)
    if (prev) set(prev)
  }
  const onRedo = () => {
    const next = history.current.redo(ref.current)
    if (next) set(next)
  }
  return { scene, onChange, onUndo, onRedo, canUndo: history.current.canUndo, canRedo: history.current.canRedo }
}

const tools = [...defaultTools(), pinTool, connectTool()] as CanvasTool<DemoNode>[]

function Playground() {
  const doc = useLocalScene(sampleScene)
  const canvas = useCanvasState()
  const apiRef = useRef<CanvasApi<DemoNode> | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const activeLayer = apiRef.current?.activeLayerId ?? canvas.activeLayerId

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
  }
  const exportPng = () => {
    const url = apiRef.current?.exportPng()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = 'canvas.png'
    a.click()
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: 220, padding: 12, borderRight: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'grid', alignContent: 'start', gap: 8 }}>
        <strong>Layers</strong>
        {[...orderedLayers(doc.scene)].reverse().map((l) => (
          <div
            key={l.id}
            onClick={() => canvas.setActiveLayerId(l.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 6px',
              borderRadius: 6,
              cursor: 'pointer',
              background: l.id === activeLayer ? 'var(--bg-hover)' : undefined,
            }}
          >
            <span style={{ flex: 1 }}>
              {l.name}
              {l.alwaysOnTop ? ' (top)' : ''}
            </span>
            <button className="icon-btn" title="Show/hide" onClick={(e) => (e.stopPropagation(), doc.onChange((s) => updateLayer(s, l.id, { hidden: !l.hidden })))}>
              {l.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button className="icon-btn" title="Lock/unlock" onClick={(e) => (e.stopPropagation(), doc.onChange((s) => updateLayer(s, l.id, { locked: !l.locked })))}>
              {l.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
        ))}
        <button className="btn" onClick={() => doc.onChange((s) => addLayer(s).scene)}>
          <Plus size={14} /> Add layer
        </button>
        <button
          className="btn"
          onClick={() => {
            let id = ''
            doc.onChange((s) => {
              const r = ensureTopLayer(s)
              id = r.id
              return r.scene
            })
            canvas.setActiveLayerId(id)
          }}
        >
          Draw always on top
        </button>
        <hr style={{ width: '100%', borderColor: 'var(--border)' }} />
        <button className="btn" onClick={exportPng}>
          <Download size={14} /> Export PNG
        </button>
        <button className="btn" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Light' : 'Dark'} theme
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
          Click the canvas first. V select, H pan, R O L A P T N draw, I pin, C connect. Space+drag or middle mouse pans, wheel zooms. Delete, Ctrl+Z/Y, Ctrl+D,
          Ctrl+A, arrows nudge, Ctrl+[ ] reorder.
        </p>
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>
        <CanvasEditor<DemoNode>
          {...doc}
          active
          canvas={canvas}
          tools={tools}
          nodeTypes={nodeTypes}
          apiRef={apiRef}
          ariaLabel="Playground canvas"
        />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
)
