import { LayoutTemplate, MousePointerClick } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { newId } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument } from '@/core/state'
import { promptDialog } from '@/shared/dialogs'
import {
  addNodes,
  arrowTool,
  BUILTIN_NODE_TYPES,
  CanvasEditor,
  createScene,
  handTool,
  noteTool,
  rectTool,
  sceneBinding,
  selectTool,
  textTool,
  updateNode,
  useCanvasState,
  type BuiltinNode,
  type CanvasTool,
  type NodeBase,
  type NodeType,
  type Scene,
} from '@/shared/canvas'
import { commentTool } from '@/shared/reviews'
import './ui-flow.css'

/**
 * UI / menu flow mockups (v0.10): screens as device frames with simple
 * widgets, joined with arrows to show how players move between menus.
 */

interface ScreenNode extends NodeBase {
  kind: 'screen'
  title: string
  width: number
  height: number
}

const WIDGETS = ['button', 'toggle', 'slider', 'input', 'list', 'image', 'tabs', 'bar'] as const
type WidgetKind = (typeof WIDGETS)[number]

interface WidgetNode extends NodeBase {
  kind: 'widget'
  widget: WidgetKind
  label: string
  width: number
  height: number
}

type FlowNode = BuiltinNode | ScreenNode | WidgetNode

interface FlowDoc {
  scene: Scene<FlowNode>
}

const DEVICES = [
  { id: 'phone', label: 'Phone', w: 360, h: 640 },
  { id: 'tablet', label: 'Tablet', w: 768, h: 1024 },
  { id: 'desktop', label: 'Desktop / console', w: 1280, h: 720 },
  { id: 'popup', label: 'Popup', w: 420, h: 260 },
] as const

const WIDGET_SIZE: Record<WidgetKind, [number, number, string]> = {
  button: [160, 44, 'Button'],
  toggle: [180, 32, 'Option'],
  slider: [220, 32, 'Volume'],
  input: [240, 40, 'Name'],
  list: [260, 180, 'List'],
  image: [200, 140, 'Picture'],
  tabs: [300, 36, 'Tab 1|Tab 2|Tab 3'],
  bar: [240, 18, 'Health'],
}

const resizeBox = <N extends { width: number; height: number }>(n: N, sx: number, sy: number): N => ({ ...n, width: Math.max(20, n.width * sx), height: Math.max(12, n.height * sy) })

const screenType: NodeType<ScreenNode> = {
  label: 'Screen',
  render: (n, ctx) => (
    <Group>
      <Text text={n.title} y={-26} fontSize={18} fontStyle="bold" fill={ctx.theme.text} fontFamily={ctx.theme.font} />
      <Rect width={n.width} height={n.height} cornerRadius={14} fill={ctx.theme.bgElevated} stroke={ctx.theme.border} strokeWidth={3} />
    </Group>
  ),
  bounds: (n) => ({ x: 0, y: -28, width: n.width, height: n.height + 28 }),
  resize: resizeBox,
}

const widgetType: NodeType<WidgetNode> = {
  label: 'Widget',
  render: (n, ctx) => {
    const { width: w, height: h } = n
    const accent = ctx.theme.accent
    const text = ctx.theme.text
    const muted = ctx.theme.textMuted
    const font = ctx.theme.font
    switch (n.widget) {
      case 'button':
        return (
          <Group>
            <Rect width={w} height={h} cornerRadius={8} fill={accent} />
            <Text text={n.label} width={w} height={h} align="center" verticalAlign="middle" fill="#fff" fontSize={15} fontStyle="bold" fontFamily={font} />
          </Group>
        )
      case 'toggle':
        return (
          <Group>
            <Text text={n.label} y={h / 2 - 8} fill={text} fontSize={15} fontFamily={font} />
            <Rect x={w - 44} y={h / 2 - 11} width={44} height={22} cornerRadius={11} fill={accent} />
            <Circle x={w - 13} y={h / 2} radius={8} fill="#fff" />
          </Group>
        )
      case 'slider':
        return (
          <Group>
            <Text text={n.label} y={0} fill={muted} fontSize={12} fontFamily={font} />
            <Line points={[0, h - 8, w, h - 8]} stroke={muted} strokeWidth={4} lineCap="round" />
            <Line points={[0, h - 8, w * 0.6, h - 8]} stroke={accent} strokeWidth={4} lineCap="round" />
            <Circle x={w * 0.6} y={h - 8} radius={8} fill={accent} />
          </Group>
        )
      case 'input':
        return (
          <Group>
            <Rect width={w} height={h} cornerRadius={6} stroke={muted} strokeWidth={1.5} />
            <Text text={n.label} x={10} width={w - 20} height={h} verticalAlign="middle" fill={muted} fontSize={14} fontFamily={font} />
          </Group>
        )
      case 'list':
        return (
          <Group>
            <Rect width={w} height={h} cornerRadius={6} stroke={muted} strokeWidth={1.5} />
            {Array.from({ length: Math.max(1, Math.floor(h / 36)) }, (_, i) => (
              <Group key={i} y={i * 36}>
                <Text text={`${n.label} ${i + 1}`} x={12} y={11} fill={text} fontSize={14} fontFamily={font} />
                {i > 0 && <Line points={[0, 0, w, 0]} stroke={ctx.theme.border} strokeWidth={1} />}
              </Group>
            ))}
          </Group>
        )
      case 'image':
        return (
          <Group>
            <Rect width={w} height={h} cornerRadius={6} fill={ctx.theme.bgSunken} stroke={muted} strokeWidth={1.5} />
            <Line points={[0, 0, w, h]} stroke={muted} strokeWidth={1} />
            <Line points={[w, 0, 0, h]} stroke={muted} strokeWidth={1} />
            <Text text={n.label} width={w} height={h} align="center" verticalAlign="middle" fill={muted} fontSize={13} fontFamily={font} />
          </Group>
        )
      case 'tabs': {
        const tabs = n.label.split('|')
        const tw = w / tabs.length
        return (
          <Group>
            {tabs.map((t, i) => (
              <Group key={i} x={i * tw}>
                <Rect width={tw} height={h} fill={i === 0 ? accent : 'transparent'} stroke={muted} strokeWidth={1} />
                <Text text={t} width={tw} height={h} align="center" verticalAlign="middle" fill={i === 0 ? '#fff' : text} fontSize={13} fontFamily={font} />
              </Group>
            ))}
          </Group>
        )
      }
      case 'bar':
        return (
          <Group>
            <Rect width={w} height={h} cornerRadius={h / 2} fill={ctx.theme.bgSunken} stroke={muted} strokeWidth={1} />
            <Rect width={w * 0.7} height={h} cornerRadius={h / 2} fill="#e03131" />
            <Text text={n.label} x={8} height={h} verticalAlign="middle" fill="#fff" fontSize={11} fontFamily={font} />
          </Group>
        )
    }
  },
  bounds: (n) => ({ x: 0, y: 0, width: n.width, height: n.height }),
  resize: resizeBox,
}

const NODE_TYPES = { ...BUILTIN_NODE_TYPES, screen: screenType, widget: widgetType }

const createFlowDoc = (): FlowDoc => ({ scene: createScene<FlowNode>() })

export default function View({ documentId, active }: PanelProps) {
  const doc = useDocument<FlowDoc>('ui-flow', documentId!, createFlowDoc)
  const canvas = useCanvasState()
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('phone')
  const [widget, setWidget] = useState<WidgetKind>('button')

  const tools = useMemo<CanvasTool<FlowNode>[]>(() => {
    const screenTool: CanvasTool<FlowNode> = {
      id: 'screen',
      label: 'Screen',
      icon: LayoutTemplate,
      shortcut: 'S',
      cursor: 'crosshair',
      pointerDown(e, api) {
        if (e.button !== 0) return
        const d = DEVICES.find((x) => x.id === device)!
        const n: ScreenNode = { id: newId(), kind: 'screen', layerId: api.activeLayerId, x: e.world.x, y: e.world.y, title: 'New screen', width: d.w, height: d.h }
        api.update((s) => addNodes(s, [n]))
        api.select([n.id])
        api.setTool('select')
      },
    }
    const widgetTool: CanvasTool<FlowNode> = {
      id: 'widget',
      label: 'Widget',
      icon: MousePointerClick,
      shortcut: 'W',
      cursor: 'crosshair',
      pointerDown(e, api) {
        if (e.button !== 0) return
        const [w, h, label] = WIDGET_SIZE[widget]
        const n: WidgetNode = { id: newId(), kind: 'widget', layerId: api.activeLayerId, x: e.world.x, y: e.world.y, widget, label, width: w, height: h }
        api.update((s) => addNodes(s, [n]))
        api.select([n.id])
      },
    }
    return [selectTool, handTool, screenTool, widgetTool, rectTool(), textTool(), arrowTool(), noteTool(), commentTool('ui-flow', documentId ?? null)]
  }, [device, widget, documentId])

  if (!doc.data) return null

  const rename = async (id: string) => {
    const n = doc.data!.scene.nodes.find((x) => x.id === id)
    if (!n || (n.kind !== 'screen' && n.kind !== 'widget')) return
    const current = n.kind === 'screen' ? n.title : n.label
    const next = await promptDialog(n.kind === 'screen' ? 'Screen name' : n.kind === 'widget' && n.widget === 'tabs' ? 'Tabs (separate with |)' : 'Label', current)
    if (next === null) return
    doc.update((d) => ({ ...d, scene: updateNode(d.scene, id, (x: FlowNode) => (x.kind === 'screen' ? { ...x, title: next } : x.kind === 'widget' ? { ...x, label: next } : x)) }))
  }

  const toolbarExtra = (
    <>
      <select className="input uf-select" title="Screen size" value={device} onChange={(e) => setDevice(e.target.value as typeof device)}>
        {DEVICES.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      <select className="input uf-select" title="Widget" value={widget} onChange={(e) => setWidget(e.target.value as WidgetKind)}>
        {WIDGETS.map((w) => (
          <option key={w} value={w}>
            {w[0].toUpperCase() + w.slice(1)}
          </option>
        ))}
      </select>
    </>
  )

  return (
    <div className="uf">
      <CanvasEditor<FlowNode>
        scene={doc.data.scene}
        {...sceneBinding(doc)}
        active={active}
        tools={tools}
        nodeTypes={NODE_TYPES}
        canvas={canvas}
        toolbarExtra={toolbarExtra}
        ariaLabel="UI flow"
        onNodeDoubleClick={(id, api) => {
          const n = api.scene.nodes.find((x) => x.id === id)
          if (n?.kind === 'screen' || n?.kind === 'widget') void rename(id)
          else if (n && api.nodeTypes[n.kind]?.textEdit) api.editText(id)
        }}
      />
      {doc.data.scene.nodes.length === 0 && (
        <div className="uf-hint">Pick a screen size and click with the Screen tool (S) to place a screen. Add widgets with W, join screens with arrows (A), double-click to rename.</div>
      )}
    </div>
  )
}
