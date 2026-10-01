import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFs, setFs } from '@/core/fs'
import { useProjectStore, type UseDocumentResult } from '@/core/state'
import { createDamagePresetDoc, type DamagePresetDoc } from '@/shared/calculators'
import { switchFormula } from './logic'
import { DamageCalculator } from './View'

const fakeDoc = <T,>(data: T): UseDocumentResult<T> => ({ data, update: () => {}, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false })
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('Damage Calculator view', () => {
  beforeEach(async () => {
    useProjectStore.setState({ root: null, meta: null })
    // Server rendering reads stores' initial state; read the live state instead so entities show up.
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot())
    setFs(new MemoryFs())
    await useProjectStore.getState().create({ name: `Dmg ${Math.random()}`, description: '', components: ['damage-calculator'] })
  })

  it('opens with the formula groups and percentage armor at 66.67 (spec 8.3 AC)', () => {
    const doc = useProjectStore.getState().addDocument('damage-calculator', 'Sword basic attack')
    const out = text(renderToStaticMarkup(<DamageCalculator documentId={doc.id} doc={fakeDoc(createDamagePresetDoc())} />))
    for (const g of ['Elemental reactions', 'Raw damage with armor', 'Critical hits', 'Damage over time and multi-hit', 'Resistances and weaknesses']) expect(out).toContain(g)
    expect(out).toContain('Damage = 66.67')
    expect(out).toContain('Damage = ATK × (1 − DEF ÷ (DEF + K))')
    expect(out).toContain('Add enemies in the Enemy List')
  })

  it('renders a custom formula with an error and a chart', () => {
    const doc = useProjectStore.getState().addDocument('damage-calculator', 'Custom')
    const base = switchFormula(createDamagePresetDoc(), null)
    const data: DamagePresetDoc = { ...base, expression: 'ATK * (', range: { ...base.range, mode: 'chart' } }
    const out = text(renderToStaticMarkup(<DamageCalculator documentId={doc.id} doc={fakeDoc(data)} />))
    expect(out).toContain('Functions you can use')
    expect(out).toContain('Fix the formula')
    const ok = renderToStaticMarkup(<DamageCalculator documentId={doc.id} doc={fakeDoc({ ...base, range: { ...base.range, mode: 'chart' as const } })} />)
    expect(ok).toContain('<svg')
  })
})
