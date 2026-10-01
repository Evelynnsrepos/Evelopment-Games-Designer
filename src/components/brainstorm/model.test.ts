import { describe, expect, it } from 'vitest'
import { addNodes, createScene, translateNodes, type Rect } from '@/shared/canvas'
import { areaContents, deleteBoardNodes, duplicateBoardNodes, findHost, followPins, stickPin, type BoardNode, type PinNode } from './model'

function board() {
  const s = createScene<BoardNode>()
  const L = s.layers[0].id
  return addNodes<BoardNode>(s, [
    { id: 'area', kind: 'area', layerId: L, x: 0, y: 0, width: 500, height: 400, name: 'Act 1' },
    { id: 'note', kind: 'note', layerId: L, x: 20, y: 20, width: 100, height: 100, text: 'Hero' },
    { id: 'far', kind: 'note', layerId: L, x: 800, y: 0, width: 100, height: 100, text: 'Far away' },
    { id: 'p1', kind: 'pin', layerId: L, x: 50, y: 40 },
    { id: 'p2', kind: 'pin', layerId: L, x: 850, y: 30 },
    { id: 's', kind: 'string', layerId: L, x: 0, y: 0, fromId: 'p1', toId: 'p2' },
  ])
}

const bounds = (scene: ReturnType<typeof board>) => (id: string): Rect | null => {
  const n = scene.nodes.find((x) => x.id === id)
  if (!n) return null
  if ('width' in n && 'height' in n) return { x: n.x, y: n.y, width: n.width, height: n.height }
  return { x: n.x - 9, y: n.y - 9, width: 18, height: 18 }
}

describe('pins (BB-5, BB-7)', () => {
  it('a stuck pin follows its note', () => {
    let s = stickPin(board(), 'p1', 'note')
    s = followPins(translateNodes(s, ['note'], 100, 50))
    const pin = s.nodes.find((n) => n.id === 'p1') as PinNode
    expect(pin.x).toBeCloseTo(150)
    expect(pin.y).toBeCloseTo(90)
  })

  it('finds the topmost note under a point, skipping excluded ids', () => {
    const s = board()
    expect(findHost(s, { x: 50, y: 50 }, bounds(s))).toBe('note')
    expect(findHost(s, { x: 50, y: 50 }, bounds(s), new Set(['note']))).toBeNull()
    expect(findHost(s, { x: 300, y: 300 }, bounds(s))).toBeNull()
  })

  it('deleting a note deletes its pins and their strings', () => {
    const s = deleteBoardNodes(stickPin(board(), 'p1', 'note'), ['note'])
    expect(s.nodes.map((n) => n.id).sort()).toEqual(['area', 'far', 'p2'])
  })

  it('duplicating notes copies their pins and strings between copied pins', () => {
    let s = stickPin(board(), 'p1', 'note')
    s = stickPin(s, 'p2', 'far')
    const r = duplicateBoardNodes(s, ['note', 'far'])
    expect(r.ids).toHaveLength(2)
    const copies = r.scene.nodes.slice(s.nodes.length)
    const pins = copies.filter((n): n is PinNode => n.kind === 'pin')
    expect(pins).toHaveLength(2)
    expect(pins.every((p) => r.ids.includes(p.hostId!))).toBe(true)
    const str = copies.find((n) => n.kind === 'string')
    expect(str && 'fromId' in str && pins.some((p) => p.id === str.fromId)).toBe(true)
  })
})

describe('areas (BB-8)', () => {
  it('contains only what lies completely inside', () => {
    const s = board()
    expect(areaContents(s, ['area'], bounds(s)).sort()).toEqual(['note', 'p1'])
  })
})
