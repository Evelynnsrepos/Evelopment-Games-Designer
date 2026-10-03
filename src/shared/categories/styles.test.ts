import { describe, expect, it } from 'vitest'
import { builtInCategories, createEntity } from '@/core/model'
import { stylesFromRows } from './optionRows'
import { entityLook, isStyled, styleOf } from './styles'

describe('option styles (rarities)', () => {
  it('new projects get pre-saved rarity looks on items and characters', () => {
    const rarity = builtInCategories().find((c) => c.name === 'Rarity')!
    expect(isStyled(rarity)).toBe(true)
    expect(styleOf(rarity, 'Legendary')?.border).toBe('glow')
    expect(rarity.appliesTo.character).toEqual({ mode: 'all' })
  })

  it('older projects without stored styles use the defaults; an empty map turns them off', () => {
    const old = { ...builtInCategories().find((c) => c.name === 'Rarity')!, styles: undefined }
    expect(styleOf(old, 'Rare')?.color).toBe('#3e8ef7')
    expect(isStyled({ ...old, styles: {} })).toBe(false)
  })

  it('an entity takes the look of its rarity first', () => {
    const cats = builtInCategories()
    const rarity = cats.find((c) => c.name === 'Rarity')!
    const element = { ...cats[0], id: 'el', name: 'Element', builtIn: false, options: ['Fire'], styles: { Fire: { color: '#f00', border: 'solid' as const, icon: 'flame' } } }
    const item = { ...createEntity('item', 'Sword'), categories: { el: 'Fire', [rarity.id]: 'Epic' } }
    expect(entityLook([element, ...cats], 'item', item)?.value).toBe('Epic')
    expect(entityLook([element], 'item', item)?.style.color).toBe('#f00')
  })

  it('keeps styles with renamed options', () => {
    const rows = [{ key: 'a', original: 'Rare', value: 'Very rare', style: { color: '#123', border: 'glow' as const, icon: null } }]
    expect(stylesFromRows(rows)).toEqual({ 'Very rare': { color: '#123', border: 'glow', icon: null } })
  })
})
