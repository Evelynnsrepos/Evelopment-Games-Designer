import { describe, expect, it } from 'vitest'
import { createLocDoc, exportCSV, importCSV, merge, progress, slug } from './model'

describe('localization', () => {
  it('merges found texts without losing translations', () => {
    let d = createLocDoc()
    d = merge(d, [{ key: 'item.sword.name', context: 'Item', text: 'Sword' }]).doc
    d = { ...d, items: d.items.map((s) => ({ ...s, values: { ...s.values, de: 'Schwert' } })) }
    const r = merge(d, [
      { key: 'item.sword.name', context: 'Item', text: 'Sword' },
      { key: 'item.bow.name', context: 'Item', text: 'Bow' },
    ])
    expect(r.added).toBe(1)
    expect(r.updated).toBe(0)
    expect(r.doc.items[0].values.de).toBe('Schwert')
    expect(progress(r.doc)).toEqual({ en: 1, de: 0.5 })
    expect(slug("The Old King's Crown!")).toBe('the_old_kings_crown')
  })

  it('round-trips CSV and adds new languages', () => {
    const d = merge(createLocDoc(), [{ key: 'ui.start', context: 'Menu', text: 'Start' }]).doc
    const csv = exportCSV(d).replace('ui.start,Menu,Start,', 'ui.start,Menu,Start,Starten') + 'ui.quit,Menu,Quit,Beenden\r\n'
    const back = importCSV(d, csv.replace('key,context,en,de', 'key,context,en,de,fr'))
    expect(back.languages).toEqual(['en', 'de', 'fr'])
    expect(back.items.map((s) => [s.key, s.values.de])).toEqual([
      ['ui.start', 'Starten'],
      ['ui.quit', 'Beenden'],
    ])
  })
})
