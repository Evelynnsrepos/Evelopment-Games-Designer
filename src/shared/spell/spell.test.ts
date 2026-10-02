import { describe, expect, it } from 'vitest'
import { tokenize } from './spell'

describe('tokenize', () => {
  it('finds words with umlauts and apostrophes, skips numbers and single letters', () => {
    expect(tokenize("Die Brücke don't a 3rd x2 Welt-Karte").map((w) => w.word)).toEqual(['Die', 'Brücke', "don't", 'Welt-Karte'])
    expect(tokenize('  Burg')).toEqual([{ word: 'Burg', from: 2, to: 6 }])
  })
})
