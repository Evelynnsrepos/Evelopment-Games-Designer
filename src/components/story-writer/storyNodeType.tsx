import { Group, Rect, Text } from 'react-konva'
import { BUILTIN_NODE_TYPES, CanvasImage, measureTextHeight, type ConnectorNode, type NodeType, type NodeTypes, type RenderContext } from '@/shared/canvas'
import { isLinkSet, MIN_NODE_WIDTH, type StoryLink, type StoryNode } from './model'

export const STORY_NODE_UI = {
  untitled: 'Untitled',
  label: 'Story node',
  missing: 'Missing link',
}

const PAD = 12
const BAR = 5
const TITLE_SIZE = 17
const BODY_SIZE = 13
const LINK_SIZE = 12
const GAP = 6
const LINE_HEIGHT = 1.25

interface Layout {
  titleH: number
  bodyY: number
  bodyH: number
  imageY: number
  imageH: number
  linkY: number
  height: number
}

function layout(n: StoryNode, font: string): Layout {
  const inner = n.width - PAD * 2
  const titleH = measureTextHeight(n.title, TITLE_SIZE, inner, font)
  let y = PAD + titleH
  const bodyH = n.body ? measureTextHeight(n.body, BODY_SIZE, inner, font) : 0
  const bodyY = y + GAP
  if (n.body) y = bodyY + bodyH
  const imageH = n.src ? Math.round(inner * 0.6) : 0
  const imageY = y + GAP + 2
  if (n.src) y = imageY + imageH
  const linkY = y + GAP
  if (isLinkSet(n.link)) y = linkY + LINK_SIZE * LINE_HEIGHT
  return { titleH, bodyY, bodyH, imageY, imageH, linkY, height: y + PAD }
}

export interface StoryTypeOptions {
  /** Where the next Create click attaches (SW-9). */
  lastId: string | null
  /** First node picked with the Connect tool. */
  pendingId: string | null
  /** Connector under the Sever tool. */
  severHoverId: string | null
  /** Display text of a link, or null when its target is gone. */
  linkLabel(link: StoryLink): string | null
}

/** Node kinds for the Story Writer canvas: story nodes plus a connector that highlights under the Sever tool. */
export function makeStoryNodeTypes(o: StoryTypeOptions): NodeTypes {
  const storyNode: NodeType<StoryNode> = {
    label: STORY_NODE_UI.label,
    render: (n: StoryNode, ctx: RenderContext) => {
      const { theme } = ctx
      const l = layout(n, theme.font)
      const inner = n.width - PAD * 2
      const highlighted = n.id === o.lastId || n.id === o.pendingId
      const hasLink = isLinkSet(n.link)
      const linkText = hasLink ? o.linkLabel(n.link!) : null
      return (
        <Group>
          {highlighted && (
            <Rect
              x={-6}
              y={-6}
              width={n.width + 12}
              height={l.height + 12}
              cornerRadius={12}
              stroke={n.id === o.pendingId ? theme.focus : theme.accent}
              strokeWidth={2}
              dash={[8, 5]}
            />
          )}
          <Rect
            width={n.width}
            height={l.height}
            cornerRadius={8}
            fill={theme.bgElevated}
            stroke={n.fillColor}
            strokeWidth={2}
            shadowColor="#000"
            shadowOpacity={0.25}
            shadowBlur={10}
            shadowOffsetY={2}
          />
          <Rect width={n.width} height={BAR} cornerRadius={[8, 8, 0, 0]} fill={n.fillColor} />
          <Text
            x={PAD}
            y={PAD}
            width={inner}
            text={n.title}
            fontSize={TITLE_SIZE}
            fontFamily={theme.font}
            lineHeight={LINE_HEIGHT}
            fill={theme.text}
            wrap="word"
          />
          {n.body ? (
            <Text x={PAD} y={l.bodyY} width={inner} text={n.body} fontSize={BODY_SIZE} fontFamily={theme.font} lineHeight={LINE_HEIGHT} fill={theme.textMuted} wrap="word" />
          ) : null}
          {n.src ? (
            <Group x={PAD} y={l.imageY}>
              <CanvasImage src={n.src} width={inner} height={l.imageH} ctx={ctx} />
            </Group>
          ) : null}
          {hasLink ? (
            <Text
              x={PAD}
              y={l.linkY}
              width={inner}
              text={'\u{1F517} ' + (linkText ?? STORY_NODE_UI.missing)}
              fontSize={LINK_SIZE}
              fontFamily={theme.font}
              fill={linkText ? theme.accent : theme.danger}
              wrap="none"
              ellipsis
            />
          ) : null}
        </Group>
      )
    },
    bounds: (n: StoryNode, ctx: RenderContext) => ({ x: 0, y: 0, width: n.width, height: layout(n, ctx.theme.font).height }),
    rotatable: false,
    // Only the width changes; the height follows the text.
    resize: (n: StoryNode, sx: number) => ({ ...n, width: Math.max(MIN_NODE_WIDTH, Math.round(n.width * sx)) }),
    textEdit: {
      get: (n: StoryNode) => n.title,
      set: (n: StoryNode, title: string) => ({ ...n, title }),
      fontSize: () => TITLE_SIZE,
      padding: PAD,
    },
  }

  const base = BUILTIN_NODE_TYPES.connector as NodeType<ConnectorNode>
  const connector: NodeType<ConnectorNode> = {
    ...base,
    render: (n, ctx) => base.render(n.id === o.severHoverId ? { ...n, strokeColor: ctx.theme.danger, strokeWidth: 3, dashed: true } : n, ctx),
  }

  return { 'story-node': storyNode, connector }
}
