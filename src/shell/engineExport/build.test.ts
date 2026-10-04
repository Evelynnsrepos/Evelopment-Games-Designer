import { describe, expect, it } from 'vitest'
import { createEntity } from '@/core/model'
import { buildExport, ident, type ExportInput } from './build'

const input = (): ExportInput => {
  const sword = { ...createEntity('item'), name: 'Fire Sword', stats: { ATK: 12 }, categories: { c1: 'Rare' } }
  const sword2 = { ...createEntity('item'), name: 'Fire Sword', stats: {} }
  return {
    projectName: 'Test',
    entities: { item: [sword, sword2], character: [], town: [], enemy: [] },
    categories: [{ id: 'c1', name: 'Rarity' } as never],
    quests: [],
    dialogues: [],
    strings: { languages: ['en', 'de'], items: [{ key: 'ui.start', values: { en: 'Start', de: 'Starten' } }] },
  }
}

describe('engine export', () => {
  it('writes JSON with unique ids, stats and category names', () => {
    const files = buildExport(input(), 'json')
    const items = JSON.parse(files.find((f) => f.path === 'items.json')!.text).items
    expect(items.map((i: { id: string }) => i.id)).toEqual(['fire_sword', 'fire_sword_2'])
    expect(items[0].stats).toEqual([{ name: 'ATK', value: 12 }])
    expect(items[0].categories).toEqual([{ name: 'Rarity', value: 'Rare' }])
    expect(files.find((f) => f.path === 'strings.csv')!.text).toContain('ui.start,Start,Starten')
    expect(ident('Ærøskøbing Tavern!')).toBe('aeroskobing_tavern')
  })

  it('adds engine files', () => {
    expect(buildExport(input(), 'godot').map((f) => f.path)).toContain('egd/egd_data.gd')
    expect(buildExport(input(), 'unity').map((f) => f.path)).toContain('Assets/Scripts/EgdData.cs')
    const dt = buildExport(input(), 'unreal').find((f) => f.path === 'DataTables/DT_Items.csv')!
    expect(dt.text.split('\r\n')[0]).toBe('Name,DisplayName,Description,atk,rarity')
    expect(dt.text).toContain('fire_sword,Fire Sword,,12,Rare')
  })
})
