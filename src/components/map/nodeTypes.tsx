import { Circle, Group, Line, Rect, Star, Text } from 'react-konva'
import { CanvasImage, expandRect, pointsBounds, type NodeType, type NodeTypes } from '@/shared/canvas'
import type { Id } from '@/core/model'
import { INK, type BackdropNode, type CityNode, type CitySize, type StampNode, type StreetNode } from './model'
import { StampShape } from './stamps'

export const MAP_NODE_UI = {
  missingTown: 'Missing town',
  city: 'City',
  street: 'Street',
  stamp: 'Stamp',
  backdrop: 'Background image',
}

const HALO = '#fbf6e9'
const MISSING = '#b8323f'

const LABEL: Record<CitySize, { fontSize: number; bold: boolean; marker: number }> = {
  village: { fontSize: 12, bold: false, marker: 4 },
  town: { fontSize: 14, bold: false, marker: 6 },
  city: { fontSize: 16, bold: true, marker: 7 },
  capital: { fontSize: 19, bold: true, marker: 10 },
}

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string, fontSize: number, bold: boolean, font: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * fontSize * 0.6
  measureCtx.font = `${bold ? 'bold ' : ''}${fontSize}px ${font}`
  return measureCtx.measureText(text).width
}

function CityMarker({ mode, color }: { mode: CitySize; color: string }) {
  const r = LABEL[mode].marker
  switch (mode) {
    case 'capital':
      return <Star numPoints={5} innerRadius={r * 0.45} outerRadius={r} fill={color} stroke={HALO} strokeWidth={2} />
    case 'city':
      return <Rect x={-r} y={-r} width={r * 2} height={r * 2} fill={color} stroke={HALO} strokeWidth={2} />
    default:
      return <Circle radius={r} fill={color} stroke={HALO} strokeWidth={2} />
  }
}

const STREET_STYLE: Record<StreetNode['mode'], { stroke: string; width: number; dash?: number[]; tension?: number; casing?: string }> = {
  road: { stroke: '#d9c08a', width: 3, casing: '#6e5131' },
  path: { stroke: '#7b5a36', width: 2, dash: [6, 5] },
  river: { stroke: '#4a86c5', width: 5, tension: 0.5 },
  border: { stroke: '#9b3b4a', width: 2, dash: [12, 4, 2, 4] },
}

/** Node kinds of the Map Creator. City labels come from the Town List, so the types depend on `townName`. */
export function makeMapNodeTypes(opts: { townName(id: Id): string | null }): NodeTypes {
  const label = (n: CityNode) => opts.townName(n.townId)

  const city: NodeType<CityNode> = {
    label: MAP_NODE_UI.city,
    render: (n, ctx) => {
      const style = LABEL[n.mode] ?? LABEL.town
      const name = label(n)
      const text = name ?? MAP_NODE_UI.missingTown
      const w = textWidth(text, style.fontSize, style.bold, ctx.theme.font) + 8
      const common = {
        text,
        x: -w / 2,
        y: style.marker + 3,
        width: w,
        align: 'center' as const,
        fontSize: style.fontSize,
        fontFamily: ctx.theme.font,
        fontStyle: name ? (style.bold ? 'bold' : 'normal') : 'italic',
      }
      return (
        <Group>
          <CityMarker mode={n.mode} color={n.markerColor} />
          {/* Light halo so labels stay readable over stamps and streets. */}
          <Text {...common} stroke={HALO} strokeWidth={4} lineJoin="round" listening={false} />
          <Text {...common} fill={name ? INK : MISSING} />
        </Group>
      )
    },
    bounds: (n, ctx) => {
      const style = LABEL[n.mode] ?? LABEL.town
      const text = label(n) ?? MAP_NODE_UI.missingTown
      const w = Math.max(textWidth(text, style.fontSize, style.bold, ctx.theme.font) + 8, style.marker * 2)
      return { x: -w / 2, y: -style.marker, width: w, height: style.marker * 2 + 3 + style.fontSize * 1.2 }
    },
    transformable: false,
    // The label changes when the town is renamed in the Town List.
    memo: false,
  }

  const street: NodeType<StreetNode> = {
    label: MAP_NODE_UI.street,
    render: (n) => {
      const s = STREET_STYLE[n.mode] ?? STREET_STYLE.road
      const common = { points: n.points, lineCap: 'round' as const, lineJoin: 'round' as const, tension: s.tension ?? 0 }
      return (
        <Group>
          {s.casing && <Line {...common} stroke={s.casing} strokeWidth={s.width + 3} />}
          <Line {...common} stroke={s.stroke} strokeWidth={s.width} dash={s.dash} hitStrokeWidth={Math.max(14, s.width + 10)} />
        </Group>
      )
    },
    bounds: (n) => expandRect(pointsBounds(n.points), 5),
  }

  const stamp: NodeType<StampNode> = {
    label: MAP_NODE_UI.stamp,
    render: (n) => <StampShape icon={n.icon} />,
    bounds: () => ({ x: -16, y: -16, width: 32, height: 32 }),
    keepRatio: true,
  }

  const backdrop: NodeType<BackdropNode> = {
    label: MAP_NODE_UI.backdrop,
    render: (n, ctx) => (
      <Group opacity={n.opacity}>
        <CanvasImage src={n.src} width={n.width} height={n.height} ctx={ctx} />
      </Group>
    ),
    bounds: (n) => ({ x: 0, y: 0, width: n.width, height: n.height }),
    keepRatio: true,
    resize: (n, sx, sy) => ({ ...n, width: Math.max(8, n.width * sx), height: Math.max(8, n.height * sy) }),
  }

  return { city, street, stamp, backdrop }
}
