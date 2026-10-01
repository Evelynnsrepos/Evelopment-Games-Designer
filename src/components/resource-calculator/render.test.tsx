import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFs, setFs } from '@/core/fs'
import type { Enemy } from '@/core/model'
import { useProjectStore, type UseDocumentResult } from '@/core/state'
import { createResourceDoc, type ResourceDoc } from './logic'
import { ResourceCalculator } from './View'

const fakeDoc = <T,>(data: T): UseDocumentResult<T> => ({ data, update: () => {}, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false })
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('Resource Calculator view', () => {
  beforeEach(async () => {
    useProjectStore.setState({ root: null, meta: null })
    // Server rendering reads stores' initial state; read the live state instead so entities show up.
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
    setFs(new MemoryFs())
    await useProjectStore.getState().create({ name: `Res ${Math.random()}`, description: '', components: ['resource-calculator'] })
  })

  it('lists Cave Golem as an Ore source with 400 kills and 6 h 40 min (spec 8.9 AC)', () => {
    const s = useProjectStore.getState()
    const ore = s.addEntity('item', 'Ore')
    const golem = s.addEntity('enemy', 'Cave Golem')
    s.updateEntity('enemy', golem.id, {
      dropTable: [{ id: 'd', itemId: ore.id, amountMin: 2, amountMax: 2, chancePercent: 50 }],
      timeToDefeatSeconds: 60,
    } as Partial<Enemy>)
    const doc = s.addDocument('resource-calculator', 'Ore farming')
    const data: ResourceDoc = { ...createResourceDoc(), goal: { ...createResourceDoc().goal, mode: 'amount', itemId: ore.id, amount: 400 } }
    const out = text(renderToStaticMarkup(<ResourceCalculator documentId={doc.id} doc={fakeDoc(data)} />))
    expect(out).toContain('Where to get it: 400 Ore')
    expect(out).toContain('Cave Golem')
    expect(out).toContain('400 6 h 40 min')
    expect(out).toContain('Fastest')
  })

  it('renders an empty plan', () => {
    const doc = useProjectStore.getState().addDocument('resource-calculator', 'Empty')
    const out = text(renderToStaticMarkup(<ResourceCalculator documentId={doc.id} doc={fakeDoc(createResourceDoc())} />))
    expect(out).toContain('No level presets yet')
    expect(out).toContain('Pick a goal')
  })
})
