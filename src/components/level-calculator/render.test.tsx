import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFs, setFs } from '@/core/fs'
import { useProjectStore, type UseDocumentResult } from '@/core/state'
import { createLevelPresetDoc, type LevelPresetDoc } from '@/shared/calculators'
import { LevelCalculator } from './View'

const fakeDoc = <T,>(data: T): UseDocumentResult<T> => ({ data, update: () => {}, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false })
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('Level Calculator view', () => {
  beforeEach(async () => {
    useProjectStore.setState({ root: null, meta: null })
    // Server rendering reads stores' initial state; read the live state instead so entities show up.
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
    setFs(new MemoryFs())
    await useProjectStore.getState().create({ name: `Lvl ${Math.random()}`, description: '', components: ['level-calculator'] })
  })

  it('shows damage per level 66.67, 73.33 against DEF 50 (spec 8.3 AC Level)', () => {
    const s = useProjectStore.getState()
    const ore = s.addEntity('item', 'Ore')
    s.addEntity('enemy', 'Cave Golem')
    const doc = s.addDocument('level-calculator', 'Sword')
    const data: LevelPresetDoc = {
      ...createLevelPresetDoc(),
      levelTo: 3,
      stats: [{ id: 'a', stat: 'ATK', base: 100, mode: 'flat', perLevel: 10, expression: '' }],
      damage: { source: 'formula', presetId: null, formulaId: 'percentage-armor', values: { ATK: 0, DEF: 0, K: 100 } },
      target: { mode: 'fixed', values: { DEF: 50, HP: 200 }, enemyId: null, enemyLevel: null },
      costs: [{ id: 'c', stat: '', itemId: ore.id, base: 20, mode: 'flat', perLevel: 0, expression: '' }],
    }
    const out = text(renderToStaticMarkup(<LevelCalculator documentId={doc.id} doc={fakeDoc(data)} />))
    expect(out).toContain('1 100 0 100 66.67 200 3 20')
    expect(out).toContain('2 282.84 100 110 73.33 200 3 20')
    expect(out).toContain('Total 1 → 3')
    expect(out).toContain('from stat growth')
    expect(out).toContain('from the target')
    expect(out).toContain('Cave Golem') // pull stats menu
  })

  it('renders a new preset and a missing damage preset', () => {
    const doc = useProjectStore.getState().addDocument('level-calculator', 'New')
    const fresh = text(renderToStaticMarkup(<LevelCalculator documentId={doc.id} doc={fakeDoc(createLevelPresetDoc())} />))
    expect(fresh).toContain('XP curve')
    const missing: LevelPresetDoc = { ...createLevelPresetDoc(), damage: { ...createLevelPresetDoc().damage, source: 'preset', presetId: 'gone' } }
    expect(text(renderToStaticMarkup(<LevelCalculator documentId={doc.id} doc={fakeDoc(missing)} />))).toContain('No damage presets yet')
  })
})
