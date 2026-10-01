import Konva from 'konva'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { expandRect, pointsBounds, rectCenter, type NodeType, type NodeTypes, type RenderContext } from '@/shared/canvas'
import { DEFAULT_AREA_COLOR, DEFAULT_PIN_COLOR, DEFAULT_STRING_COLOR, textOn } from './colors'
import type { AreaNode, AudioNode, PinNode, StringNode } from './model'

export const LABELS = {
  pin: 'Pin',
  string: 'String',
  area: 'Area',
  untitledArea: 'Untitled area',
  audio: 'Audio clip',
  untitledAudio: 'Untitled clip',
}

const PIN_RADIUS = 8
const TAG_HEIGHT = 24
const TAG_GAP = 4
const TAG_FONT = 13

const widthCache = new Map<string, number>()
let measurer: Konva.Text | null = null
function textWidth(text: string, fontSize: number, fontFamily: string) {
  const key = `${fontSize}|${fontFamily}|${text}`
  const hit = widthCache.get(key)
  if (hit !== undefined) return hit
  measurer ??= new Konva.Text({})
  measurer.setAttrs({ text, fontSize, fontFamily, fontStyle: 'bold' })
  const w = measurer.width()
  if (widthCache.size > 1000) widthCache.clear()
  widthCache.set(key, w)
  return w
}

const pinType: NodeType<PinNode> = {
  label: LABELS.pin,
  render: (n, ctx) => {
    const color = n.pinColor ?? DEFAULT_PIN_COLOR
    return (
      <Group>
        <Circle x={1.5} y={2.5} radius={PIN_RADIUS} fill="#000" opacity={0.3} listening={false} />
        <Circle radius={PIN_RADIUS} fill={color} stroke={ctx.theme.bg} strokeWidth={1.5} />
        <Circle x={-2.5} y={-2.5} radius={2.5} fill="#fff" opacity={0.65} listening={false} />
      </Group>
    )
  },
  bounds: () => ({ x: -PIN_RADIUS - 1, y: -PIN_RADIUS - 1, width: PIN_RADIUS * 2 + 2, height: PIN_RADIUS * 2 + 2 }),
  transformable: false,
}

/** Pin centers (or node centers) a string runs between, with a little sag in the middle. */
function stringPoints(n: StringNode, ctx: RenderContext): number[] | null {
  const a = ctx.getWorldBounds(n.fromId)
  const b = ctx.getWorldBounds(n.toId)
  if (!a || !b) return null
  const p = rectCenter(a)
  const q = rectCenter(b)
  const sag = Math.min(36, Math.hypot(q.x - p.x, q.y - p.y) * 0.08)
  return [p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2 + sag, q.x, q.y]
}

const stringType: NodeType<StringNode> = {
  label: LABELS.string,
  absolute: true,
  memo: false,
  render: (n, ctx) => {
    const points = stringPoints(n, ctx)
    if (!points) return null
    return (
      <Line
        points={points}
        tension={0.5}
        stroke={n.strokeColor ?? DEFAULT_STRING_COLOR}
        strokeWidth={2.5}
        lineCap="round"
        hitStrokeWidth={14}
        shadowColor="#000"
        shadowOpacity={0.25}
        shadowBlur={2}
        shadowOffsetY={1}
      />
    )
  },
  bounds: (n, ctx) => {
    const p = stringPoints(n, ctx)
    return p ? expandRect(pointsBounds(p), 4) : { x: 0, y: 0, width: 0, height: 0 }
  },
}

export function areaTitle(n: AreaNode) {
  return n.name?.trim() || LABELS.untitledArea
}

const areaType: NodeType<AreaNode> = {
  label: LABELS.area,
  render: (n, ctx) => {
    const color = n.areaColor ?? DEFAULT_AREA_COLOR
    const title = areaTitle(n)
    const tagWidth = textWidth(title, TAG_FONT, ctx.theme.font) + 20
    return (
      <Group>
        <Rect width={n.width} height={n.height} fill={color} opacity={0.13} cornerRadius={8} listening={false} />
        {/* Only the border and the name tag pick the area, so clicks inside it reach the board (selection box, drawing). */}
        <Rect width={n.width} height={n.height} stroke={color} strokeWidth={2} cornerRadius={8} fillEnabled={false} hitStrokeWidth={14} />
        <Group y={-TAG_HEIGHT - TAG_GAP}>
          <Rect width={tagWidth} height={TAG_HEIGHT} fill={color} cornerRadius={5} />
          <Text x={10} y={(TAG_HEIGHT - TAG_FONT) / 2} text={title} fontSize={TAG_FONT} fontStyle="bold" fontFamily={ctx.theme.font} fill={textOn(color)} listening={false} />
        </Group>
      </Group>
    )
  },
  bounds: (n) => ({ x: 0, y: -TAG_HEIGHT - TAG_GAP, width: n.width, height: n.height + TAG_HEIGHT + TAG_GAP }),
  rotatable: false,
  resize: (n, sx, sy) => {
    // The transformer box includes the name tag; keep the tag's height out of the new body height.
    const total = (n.height + TAG_HEIGHT + TAG_GAP) * sy
    return { ...n, width: Math.max(60, n.width * sx), height: Math.max(40, total - TAG_HEIGHT - TAG_GAP) }
  },
}

export function audioTitle(n: AudioNode) {
  return n.name?.trim() || LABELS.untitledAudio
}

/** Where the HTML `<audio>` player sits inside the card, in the card's local space. */
export const AUDIO_PLAYER_BOX = { x: 12, y: 42, height: 38 }

const audioType: NodeType<AudioNode> = {
  label: LABELS.audio,
  render: (n, ctx) => (
    <Group>
      <Rect
        width={n.width}
        height={n.height}
        fill={ctx.theme.bgElevated}
        stroke={ctx.theme.border}
        strokeWidth={1}
        cornerRadius={10}
        shadowColor="#000"
        shadowOpacity={0.25}
        shadowBlur={8}
        shadowOffsetY={2}
      />
      <Text x={12} y={11} text="♪" fontSize={18} fill={ctx.theme.accent} fontFamily={ctx.theme.font} listening={false} />
      <Text
        x={34}
        y={14}
        width={n.width - 46}
        text={audioTitle(n)}
        fontSize={14}
        fontStyle="bold"
        fontFamily={ctx.theme.font}
        fill={ctx.theme.text}
        wrap="none"
        ellipsis
        listening={false}
      />
    </Group>
  ),
  bounds: (n) => ({ x: 0, y: 0, width: n.width, height: n.height }),
  transformable: false,
}

export const BOARD_NODE_TYPES: NodeTypes = {
  pin: pinType,
  string: stringType,
  area: areaType,
  audio: audioType,
}
