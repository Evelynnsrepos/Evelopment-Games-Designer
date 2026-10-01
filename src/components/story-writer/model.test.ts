import { describe, expect, it } from 'vitest'
import { deleteNodes } from '@/shared/canvas'
import {
  connectNodes,
  createDefaultStory,
  createNodeAfter,
  findConnector,
  isLinkSet,
  outgoing,
  setNodeColor,
  severConnector,
  STORY_COLORS,
  storyNodes,
  type StoryItem,
} from './model'
import type { Scene } from '@/shared/canvas'

function start() {
  const scene = createDefaultStory().scene
  return { scene, layer: scene.layers[0].id }
}

/** Create-tool click on empty space, continuing from `from`. */
function click(scene: Scene<StoryItem>, layer: string, from: string | null, x: number) {
  return createNodeAfter(scene, from, layer, { x, y: 0 })
}

describe('story writer model (spec 8.5 AC)', () => {
  it('three clicks make A -> B -> C', () => {
    const { scene: s0, layer } = start()
    const a = click(s0, layer, null, 0)
    const b = click(a.scene, layer, a.node.id, 300)
    const c = click(b.scene, layer, b.node.id, 600)
    expect(storyNodes(c.scene)).toHaveLength(3)
    expect(findConnector(c.scene, a.node.id, b.node.id)).toBeDefined()
    expect(findConnector(c.scene, b.node.id, c.node.id)).toBeDefined()
    expect(a.isBranch || b.isBranch || c.isBranch).toBe(false)
    // continuing a line keeps its color
    expect(c.node.fillColor).toBe(a.node.fillColor)
  })

  it('clicking A then empty space branches to D, offers colors, and sever/connect work', () => {
    const { scene: s0, layer } = start()
    const a = click(s0, layer, null, 0)
    const b = click(a.scene, layer, a.node.id, 300)
    const c = click(b.scene, layer, b.node.id, 600)
    const d = click(c.scene, layer, a.node.id, 300)
    expect(d.isBranch).toBe(true)
    expect(d.node.fillColor).not.toBe(a.node.fillColor)
    expect(outgoing(d.scene, a.node.id).map((x) => x.toId)).toEqual([b.node.id, d.node.id])

    const ab = findConnector(d.scene, a.node.id, b.node.id)!
    const severed = severConnector(d.scene, ab.id)
    expect(findConnector(severed, a.node.id, b.node.id)).toBeUndefined()
    expect(storyNodes(severed)).toHaveLength(4)

    const linked = connectNodes(severed, d.node.id, c.node.id)
    expect(findConnector(linked, d.node.id, c.node.id)).toBeDefined()
  })

  it('starts unconnected when the last node was deleted', () => {
    const { scene: s0, layer } = start()
    const a = click(s0, layer, null, 0)
    const gone = deleteNodes(a.scene, [a.node.id])
    const b = click(gone, layer, a.node.id, 100)
    expect(b.scene.nodes).toHaveLength(1)
  })

  it('does not link a node to itself or twice', () => {
    const { scene: s0, layer } = start()
    const a = click(s0, layer, null, 0)
    const b = click(a.scene, layer, a.node.id, 300)
    expect(connectNodes(b.scene, a.node.id, a.node.id)).toBe(b.scene)
    expect(connectNodes(b.scene, a.node.id, b.node.id)).toBe(b.scene)
  })

  it('recolors a node and its incoming arrows', () => {
    const { scene: s0, layer } = start()
    const a = click(s0, layer, null, 0)
    const b = click(a.scene, layer, a.node.id, 300)
    const colored = setNodeColor(b.scene, b.node.id, STORY_COLORS[3])
    expect(findConnector(colored, a.node.id, b.node.id)!.strokeColor).toBe(STORY_COLORS[3])
    expect(storyNodes(colored).find((n) => n.id === b.node.id)!.fillColor).toBe(STORY_COLORS[3])
  })

  it('treats half-filled links as unset', () => {
    expect(isLinkSet(null)).toBe(false)
    expect(isLinkSet({ kind: 'url', url: ' ' })).toBe(false)
    expect(isLinkSet({ kind: 'node', targetId: '' })).toBe(false)
    expect(isLinkSet({ kind: 'url', url: 'example.com' })).toBe(true)
  })
})
