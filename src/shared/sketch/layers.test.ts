import { describe, expect, it } from 'vitest'
import {
  addMask,
  combineDown,
  depthOf,
  duplicateTree,
  exportLayers,
  groupLayers,
  layerRows,
  layerTree,
  moveSibling,
  moveTo,
  removeTree,
  siblingBelow,
  ungroup,
} from './layers'
import { newLayer, type SketchLayer } from './model'

const L = (name: string, extra: Partial<SketchLayer> = {}): SketchLayer => ({ ...newLayer(name), id: name, ...extra })
const names = (ls: SketchLayer[]) => ls.map((l) => l.name)

describe('layer tree', () => {
  it('reads old flat lists unchanged', () => {
    const ls = [L('a'), L('b'), L('c')]
    expect(layerTree(ls).map((n) => n.layer.name)).toEqual(['a', 'b', 'c'])
  })

  it('nests groups, attaches masks and ignores broken parents', () => {
    const ls = [L('a', { parent: 'g' }), L('m', { kind: 'mask', parent: 'g' }), L('g', { kind: 'group' }), L('x', { parent: 'nope' }), L('loop1', { kind: 'group', parent: 'loop2' }), L('loop2', { kind: 'group', parent: 'loop1' })]
    const t = layerTree(ls)
    expect(t.map((n) => n.layer.name)).toEqual(['g', 'x', 'loop1', 'loop2'])
    expect(t[0].children!.map((n) => n.layer.name)).toEqual(['a'])
    expect(t[0].children![0].mask?.name).toBe('m')
  })

  it('groups, ungroups and keeps the flat order with groups above their contents', () => {
    const ls = [L('a'), L('b'), L('c')]
    const { layers, group } = groupLayers(ls, ['a', 'b'], 'G')
    expect(names(layers)).toEqual(['a', 'b', 'G', 'c'])
    expect(layers.find((l) => l.name === 'a')!.parent).toBe(group.id)
    expect(depthOf(layers, 'b')).toBe(1)
    expect(names(ungroup(layers, group.id))).toEqual(['a', 'b', 'c'])
    expect(ungroup(layers, group.id).every((l) => !l.parent)).toBe(true)
  })

  it('nests groups inside groups', () => {
    const g1 = groupLayers([L('a'), L('b'), L('c')], ['a'], 'G1')
    const g2 = groupLayers(g1.layers, [g1.group.id, 'b'], 'G2')
    expect(names(g2.layers)).toEqual(['a', 'G1', 'b', 'G2', 'c'])
    expect(depthOf(g2.layers, 'a')).toBe(2)
    expect(layerRows(g2.layers).map((r) => `${r.depth}${r.layer.name}`)).toEqual(['0c', '0G2', '1b', '1G1', '2a'])
    const folded = g2.layers.map((l) => (l.id === g2.group.id ? { ...l, collapsed: true } : l))
    expect(layerRows(folded).map((r) => r.layer.name)).toEqual(['c', 'G2'])
  })

  it('moves layers among siblings, into groups and never into themselves', () => {
    const { layers, group } = groupLayers([L('a'), L('b'), L('c')], ['a'], 'G')
    expect(names(moveSibling(layers, 'b', -1))).toEqual(['b', 'a', 'G', 'c'])
    const into = moveTo(layers, 'c', group.id, 'inside')
    expect(into.find((l) => l.name === 'c')!.parent).toBe(group.id)
    expect(names(into)).toEqual(['a', 'c', 'G', 'b'])
    expect(moveTo(into, group.id, 'a', 'above')).toBe(into)
    expect(names(moveTo(layers, 'c', 'b', 'below'))).toEqual(['a', 'G', 'c', 'b'])
  })

  it('masks travel with their layer', () => {
    const { layers, mask } = addMask([L('a'), L('b')], 'a')
    expect(names(layers)).toEqual(['a', 'Mask', 'b'])
    expect(addMask(layers, 'a').mask).toBeNull()
    expect(names(moveSibling(layers, 'a', 1))).toEqual(['b', 'a', 'Mask'])
    expect(names(removeTree(layers, 'a'))).toEqual(['b'])
    expect(names(removeTree(layers, mask!.id))).toEqual(['a', 'b'])
  })

  it('combines down into a group, or into the group below', () => {
    const c = combineDown([L('a'), L('b'), L('c')], 'b', 'G')
    expect(names(c.layers)).toEqual(['a', 'b', 'G', 'c'])
    const again = combineDown(c.layers, 'c', 'G2')
    expect(again.group).toBe(c.group)
    expect(names(again.layers)).toEqual(['a', 'b', 'c', 'G'])
    expect(combineDown([L('a')], 'a', 'G').group).toBeNull()
    expect(siblingBelow(c.layers, 'c')?.name).toBe('G')
  })

  it('duplicates whole groups with new ids', () => {
    const { layers, group } = groupLayers([L('a'), L('b')], ['a'], 'G')
    const d = duplicateTree(layers, group.id)
    expect(names(d.layers)).toEqual(['a', 'G', 'a', 'G copy', 'b'])
    expect(d.map.size).toBe(2)
    expect(new Set(d.layers.map((l) => l.id)).size).toBe(5)
    const copyA = d.layers[2]
    expect(copyA.parent).toBe(d.top)
  })

  it('leaves private layers and their contents out of exports', () => {
    const { layers, group } = groupLayers([L('a'), L('b'), L('c', { private: true })], ['a'], 'G')
    expect(exportLayers(layers)).toHaveLength(4 - 1)
    const priv = layers.map((l) => (l.id === group.id ? { ...l, private: true } : l))
    expect(names(exportLayers(priv))).toEqual(['b'])
  })
})

describe('layer stacks', () => {
  it('inserts above a layer without stealing its mask, and cuts out subtrees', async () => {
    const { insertAbove, subtreeStack } = await import('./layers')
    const { layers } = addMask([L('a'), L('b')], 'a')
    expect(names(insertAbove(layers, L('n'), 'a'))).toEqual(['a', 'Mask', 'n', 'b'])
    expect(names(insertAbove(layers, L('n'), undefined))).toEqual(['a', 'Mask', 'b', 'n'])
    const g = groupLayers(layers, ['a'], 'G')
    const st = subtreeStack(g.layers, g.group.id)
    expect(names(st)).toEqual(['a', 'Mask', 'G'])
    expect(st[2].parent).toBeNull()
  })
})
