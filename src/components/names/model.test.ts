import { describe, expect, it } from 'vitest'
import { createLanguageDoc, makeWord, names, newWord, PRESETS, rng, translate } from './model'

describe('names and conlang', () => {
  it('builds names from the sounds and avoids forbidden letters', () => {
    const lang = { ...createLanguageDoc(), ...PRESETS['Japanese-like'] }
    const list = names(lang, 30, 42)
    expect(list.length).toBe(30)
    for (const n of list) {
      expect(n[0]).toBe(n[0].toUpperCase())
      expect(n.toLowerCase()).not.toMatch(/yi|ye|wu|wi|we/)
    }
    expect(makeWord({ ...lang, vowels: '' }, rng(1))).toBeNull()
  })

  it('translates consistently and uses the dictionary', () => {
    const lang = { ...createLanguageDoc(), dictionary: [newWord('king', 'aranel')] }
    const a = translate(lang, 'The King returns')
    expect(a.split(' ')[1]).toBe('Aranel')
    expect(translate(lang, 'The King returns')).toBe(a)
    expect(translate(lang, 'returns')).toBe(a.split(' ')[2].toLowerCase())
  })
})
