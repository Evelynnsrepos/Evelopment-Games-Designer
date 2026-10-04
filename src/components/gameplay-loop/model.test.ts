import { describe, expect, it } from 'vitest'
import { arcs, createLoopDoc, depth, moveNode, newBranch, removeBranch, removeNode, totalMinutes } from './model'

describe('gameplay loop', () => {
  it('splits the circle evenly or by time', () => {
    const d = createLoopDoc()
    const even = arcs(d)
    expect(even[0].start).toBeCloseTo(-Math.PI / 2)
    expect(even[3].end).toBeCloseTo(Math.PI * 1.5)
    expect(even[0].end - even[0].start).toBeCloseTo(Math.PI / 2)
    const timed = arcs({ ...d, timed: true })
    expect(totalMinutes(d)).toBe(8)
    expect(timed[0].end - timed[0].start).toBeCloseTo((3 / 8) * Math.PI * 2)
  })

  it('removes branches with everything growing out of them', () => {
    let d = createLoopDoc()
    const a = newBranch(d.nodes[0].id)
    const b = newBranch(d.nodes[0].id, a.id)
    const c = newBranch(d.nodes[0].id, b.id)
    const other = newBranch(d.nodes[1].id)
    d = { ...d, branches: [a, b, c, other] }
    expect(depth(d.branches, c)).toBe(3)
    expect(removeBranch(d, b.id).branches.map((x) => x.id)).toEqual([a.id, other.id])
    expect(removeNode(d, d.nodes[0].id).branches).toEqual([other])
  })

  it('moves steps around the loop, wrapping at the ends', () => {
    const d = createLoopDoc()
    expect(moveNode(d, d.nodes[0].id, -1).nodes.map((n) => n.title)).toEqual(['Upgrade', 'Fight', 'Loot', 'Explore'])
    expect(moveNode(d, d.nodes[1].id, 1).nodes.map((n) => n.title)).toEqual(['Explore', 'Loot', 'Fight', 'Upgrade'])
  })
})
