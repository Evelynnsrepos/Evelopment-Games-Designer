import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { CanvasImage, type NodeType, type NodeTypes, type RenderContext } from '@/shared/canvas'
import {
  BRANCH_STUB,
  CARD_FONT,
  CARD_IMAGE,
  CARD_LINE_HEIGHT,
  CARD_PAD,
  CARD_WIDTH,
  cardRect,
  isLine,
  LINK_ROW,
  lineEnd,
  STEM,
  xOfYear,
  YEAR_ROW,
  yearAt,
  yearTicks,
  type TimelineEvent,
  type TimelineLine,
  type YearAxis,
} from './model'

export const TYPES_UI = {
  line: 'Timeline',
  branch: 'Branch',
  event: 'Event',
  emptyEvent: 'New event',
}

export interface TimelineTypeOptions {
  /** Years as stored; the axis length is read live from the main line so a stretch preview stays right. */
  years: { start: number; end: number } | null
  mainId: string | undefined
  /** Card placement from `layoutCards`. */
  cards: Map<string, { lift: number; height: number }>
}

const HANDLE_R = 6

export function makeTimelineTypes(o: TimelineTypeOptions): NodeTypes {
  const axisOf = (ctx: RenderContext): YearAxis | null => {
    const main = o.mainId ? ctx.getNode(o.mainId) : undefined
    return o.years && isLine(main) ? { ...o.years, length: main.length } : null
  }
  const colorOf = (l: TimelineLine, ctx: RenderContext) => (l.main ? ctx.theme.textMuted : l.lineColor)

  const line: NodeType<TimelineLine> = {
    label: TYPES_UI.line,
    absolute: true,
    memo: false,
    render: (l, ctx) => {
      const color = colorOf(l, ctx)
      const end = lineEnd(l)
      const parent = l.parentId ? ctx.getNode(l.parentId) : undefined
      const axis = l.main ? axisOf(ctx) : null
      const startX = l.main ? l.x : l.x + BRANCH_STUB
      return (
        <Group>
          {isLine(parent) && (
            <Line
              points={[l.x, parent.y, l.x + BRANCH_STUB * 0.55, parent.y, l.x + BRANCH_STUB * 0.45, l.y, l.x + BRANCH_STUB, l.y]}
              bezier
              stroke={color}
              strokeWidth={3}
              lineCap="round"
              hitStrokeWidth={14}
            />
          )}
          <Line points={[startX, l.y, end, l.y]} stroke={color} strokeWidth={l.main ? 4 : 3} lineCap="round" hitStrokeWidth={18} />
          {l.main && <Circle x={l.x} y={l.y} radius={HANDLE_R} fill={color} />}
          <Circle x={end} y={l.y} radius={HANDLE_R} fill={ctx.theme.bgElevated} stroke={color} strokeWidth={2} hitStrokeWidth={10} />
          {!l.main && <Text x={startX + 6} y={l.y + 10} text={l.name || TYPES_UI.branch} fontSize={13} fontStyle="bold" fontFamily={ctx.theme.font} fill={color} />}
          {axis &&
            yearTicks(axis).map((year) => {
              const x = xOfYear(axis, year)
              return (
                <Group key={year} listening={false}>
                  <Line points={[x, l.y - 5, x, l.y + 5]} stroke={color} strokeWidth={1.5} />
                  <Text x={x - 40} y={l.y + 10} width={80} align="center" text={String(year)} fontSize={11} fontFamily={ctx.theme.font} fill={ctx.theme.textMuted} />
                </Group>
              )
            })}
        </Group>
      )
    },
    bounds: (l, ctx) => {
      const parent = l.parentId ? ctx.getNode(l.parentId) : undefined
      const top = Math.min(l.y, isLine(parent) ? parent.y : l.y)
      const bottom = Math.max(l.y, isLine(parent) ? parent.y : l.y)
      return { x: l.x - HANDLE_R, y: top - 8, width: l.length + HANDLE_R * 2, height: bottom - top + 16 }
    },
  }

  const event: NodeType<TimelineEvent> = {
    label: TYPES_UI.event,
    absolute: true,
    memo: false,
    render: (ev, ctx) => {
      const l = ctx.getNode(ev.lineId)
      if (!isLine(l)) return null
      const { theme } = ctx
      const axis = axisOf(ctx)
      const card = o.cards.get(ev.id) ?? { lift: STEM, height: 60 }
      const r = cardRect(ev, l.y, card)
      const color = colorOf(l, ctx)
      const inner = CARD_WIDTH - CARD_PAD * 2
      let y = r.y + CARD_PAD
      const yearY = y
      if (axis) y += YEAR_ROW
      const textY = y
      const imageY = r.y + r.height - CARD_PAD - (ev.links.length ? LINK_ROW : 0) - CARD_IMAGE
      const textBottom = ev.src ? imageY - 6 : imageY + CARD_IMAGE
      return (
        <Group>
          <Line points={[ev.x, l.y, ev.x, r.y + r.height]} stroke={color} strokeWidth={1.5} dash={[4, 3]} listening={false} />
          <Circle x={ev.x} y={l.y} radius={7} fill={color} stroke={theme.bgSunken} strokeWidth={2} />
          <Rect {...r} cornerRadius={6} fill={theme.bgElevated} stroke={theme.border} strokeWidth={1} shadowColor="#000" shadowOpacity={0.2} shadowBlur={6} shadowOffsetY={1} />
          <Rect x={r.x} y={r.y} width={3} height={r.height} fill={color} cornerRadius={[6, 0, 0, 6]} />
          {axis && <Text x={r.x + CARD_PAD} y={yearY} text={String(yearAt(axis, ev.x))} fontSize={12} fontStyle="bold" fontFamily={theme.font} fill={theme.accent} />}
          <Text
            x={r.x + CARD_PAD}
            y={textY}
            width={inner}
            height={Math.max(CARD_FONT * CARD_LINE_HEIGHT, textBottom - textY)}
            text={ev.text || TYPES_UI.emptyEvent}
            fontSize={CARD_FONT}
            lineHeight={CARD_LINE_HEIGHT}
            fontFamily={theme.font}
            fill={ev.text ? theme.text : theme.textMuted}
            wrap="word"
            ellipsis
          />
          {ev.src ? (
            <Group x={r.x + CARD_PAD} y={imageY}>
              <CanvasImage src={ev.src} width={inner} height={CARD_IMAGE} ctx={ctx} />
            </Group>
          ) : null}
          {ev.links.length ? (
            <Text x={r.x + CARD_PAD} y={r.y + r.height - CARD_PAD - 13} text={`\u{1F517} ${ev.links.length}`} fontSize={11} fontFamily={theme.font} fill={theme.textMuted} />
          ) : null}
        </Group>
      )
    },
    bounds: (ev, ctx) => {
      const l = ctx.getNode(ev.lineId)
      const ly = isLine(l) ? l.y : 0
      const r = cardRect(ev, ly, o.cards.get(ev.id) ?? { lift: STEM, height: 60 })
      return { x: r.x, y: r.y, width: r.width, height: ly + 8 - r.y }
    },
  }

  return { 'tl-line': line, 'tl-event': event }
}
