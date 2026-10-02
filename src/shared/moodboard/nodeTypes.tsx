import type Konva from 'konva'
import { Group, Line, Shape } from 'react-konva'
import { BUILTIN_NODE_TYPES, CanvasImage, placeholderPattern, useLoadedImage, type NodeBase, type NodeType, type NodeTypes, type RenderContext } from '@/shared/canvas'
import { cutoutBounds, cutoutPixels, type MoodImageNode } from './model'

function tracePolygon(g: CanvasRenderingContext2D | Konva.Context, px: number[], dx: number, dy: number) {
  g.beginPath()
  g.moveTo(px[0] - dx, px[1] - dy)
  for (let i = 2; i + 1 < px.length; i += 2) g.lineTo(px[i] - dx, px[i + 1] - dy)
  g.closePath()
}

/**
 * An image with its cutout applied (MB-2). Drawn by a Konva Shape whose own box
 * is the cutout's box, so selection handles hug the visible part.
 */
function CutoutImage({ node, ctx }: { node: MoodImageNode; ctx: RenderContext }) {
  const loaded = useLoadedImage(node.src ? ctx.resolveImageSrc(node.src) : null)
  const px = cutoutPixels(node)
  const b = cutoutBounds(node)
  const img = loaded.status === 'ok' ? loaded.img : undefined
  return (
    <Shape
      x={b.x}
      y={b.y}
      width={b.width}
      height={b.height}
      fill="#000"
      sceneFunc={(c) => {
        const g = (c as unknown as { _context: CanvasRenderingContext2D })._context
        g.save()
        tracePolygon(g, px, b.x, b.y)
        g.clip()
        if (img) g.drawImage(img, -b.x, -b.y, node.width, node.height)
        else {
          g.globalAlpha *= loaded.status === 'loading' ? 0.4 : 1
          g.fillStyle = g.createPattern(placeholderPattern(), 'repeat') ?? '#ff00dc'
          g.fillRect(0, 0, b.width, b.height)
        }
        g.restore()
      }}
      hitFunc={(c, shape) => {
        tracePolygon(c, px, b.x, b.y)
        c.fillStrokeShape(shape)
      }}
    />
  )
}

const builtinImage = BUILTIN_NODE_TYPES.image as NodeType<MoodImageNode>

/** The built-in image kind, plus cutouts. */
const moodImageType: NodeType<MoodImageNode> = {
  ...builtinImage,
  render: (n, ctx) => (n.cutout && n.cutout.points.length >= 6 ? <CutoutImage node={n} ctx={ctx} /> : <CanvasImage src={n.src} width={n.width} height={n.height} ctx={ctx} />),
  bounds: (n) => cutoutBounds(n),
}

/**
 * Shown while cutting (never saved): the whole image faded, so the hidden parts
 * can be cut back in, and the outline being drawn, in the image's local space.
 */
export interface CutoutDraftNode extends NodeBase {
  kind: 'cutout-draft'
  src: string
  width: number
  height: number
  /** Outline so far, local pixels. */
  outline: number[]
  closed: boolean
}

const cutoutDraftType: NodeType<CutoutDraftNode> = {
  label: 'Cutout',
  render: (n, ctx) => (
    <Group listening={false}>
      <Group opacity={0.4}>
        <CanvasImage src={n.src} width={n.width} height={n.height} ctx={ctx} />
      </Group>
      {n.outline.length >= 4 ? (
        <>
          <Line points={n.outline} closed={n.closed} stroke="#000" strokeWidth={3} strokeScaleEnabled={false} opacity={0.5} />
          <Line points={n.outline} closed={n.closed} stroke={ctx.theme.accent} strokeWidth={1.5} dash={[6, 4]} strokeScaleEnabled={false} />
        </>
      ) : null}
    </Group>
  ),
  bounds: (n) => ({ x: 0, y: 0, width: n.width, height: n.height }),
  transformable: false,
}

export const MOOD_NODE_TYPES: NodeTypes = {
  image: moodImageType,
  'cutout-draft': cutoutDraftType,
}
