import { describe, expect, it } from 'vitest'
import type { Panel } from '@/core/model'
import { autoPlacement, dropPanel, flipSplit, insertPanel, leaves, neighbor, panelRects, removePanel, setRatio, swapPanels, zoneFromPoint } from './layoutTree'

const p = (id: string): Panel => ({ id, type: 'wiki', documentId: null })

describe('layout tree', () => {
  it('splits 50/50 when dropping on the right half (spec 7 AC)', () => {
    let t = insertPanel(null, p('wiki'), null, 'right')
    t = insertPanel(t, p('items'), 'wiki', 'right')
    const rects = panelRects(t)
    expect(rects.map((r) => [r.panel.id, r.rect.w])).toEqual([
      ['wiki', 0.5],
      ['items', 0.5],
    ])
  })

  it('closing a panel lets the sibling fill the space', () => {
    let t = insertPanel(null, p('wiki'), null, 'right')
    t = insertPanel(t, p('items'), 'wiki', 'right')
    const after = removePanel(t, 'wiki')
    expect(after).toEqual({ kind: 'panel', panel: p('items') })
    expect(removePanel(after, 'items')).toBeNull()
  })

  it('finds neighbours and swaps', () => {
    let t = insertPanel(null, p('a'), null, 'right')
    t = insertPanel(t, p('b'), 'a', 'right')
    t = insertPanel(t, p('c'), 'b', 'bottom')
    expect(neighbor(t, 'a', 'right')?.id).toBe('b')
    expect(neighbor(t, 'c', 'left')?.id).toBe('a')
    expect(neighbor(t, 'c', 'up')?.id).toBe('b')
    expect(neighbor(t, 'a', 'left')).toBeUndefined()
    const swapped = swapPanels(t, 'a', 'c')
    expect(leaves(swapped).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('drags a panel onto another in Layout Mode', () => {
    let t = insertPanel(null, p('a'), null, 'right')
    t = insertPanel(t, p('b'), 'a', 'right')
    t = insertPanel(t, p('c'), 'b', 'bottom')
    expect(leaves(dropPanel(t, 'a', 'c', 'center')).map((x) => x.id)).toEqual(['c', 'b', 'a'])
    const moved = dropPanel(t, 'a', 'c', 'right')
    expect(leaves(moved).map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(dropPanel(t, 'a', 'a', 'left')).toBe(t)
    expect(zoneFromPoint(0.5, 0.5)).toBe('center')
    expect(zoneFromPoint(0.05, 0.5)).toBe('left')
    expect(zoneFromPoint(0.2, 0.05)).toBe('left')
    expect(zoneFromPoint(0.8, 0.95)).toBe('right')
    expect(zoneFromPoint(0.5, 0.2)).toBe('top')
    expect(zoneFromPoint(0.5, 0.8)).toBe('bottom')
    expect(zoneFromPoint(0.3, 0.6)).toBe('center')
  })

  it('flips a split between side by side and stacked', () => {
    let t = insertPanel(null, p('a'), null, 'right')
    t = insertPanel(t, p('b'), 'a', 'right')
    const f = flipSplit(t, [])
    expect(f.kind === 'split' && f.direction).toBe('column')
    expect(panelRects(f).map((r) => [r.panel.id, r.rect.y])).toEqual([
      ['a', 0],
      ['b', 0.5],
    ])
  })

  it('clamps resize ratios', () => {
    let t = insertPanel(null, p('a'), null, 'right')
    t = insertPanel(t, p('b'), 'a', 'right')
    const r = setRatio(t, [], 0.99)
    expect(r.kind === 'split' && r.ratio).toBe(0.9)
  })

  it('auto-places into the largest panel', () => {
    let t = insertPanel(null, p('a'), null, 'right')
    t = insertPanel(t, p('b'), 'a', 'right')
    t = insertPanel(t, p('c'), 'b', 'bottom')
    expect(autoPlacement(t)).toEqual({ targetId: 'a', side: 'bottom' })
  })
})
