import { describe, expect, it } from 'vitest'
import { cleanOptions, diffEdits, fixTitle, markedSentence } from './proof'

const apply = (text: string, fixed: string) => {
  let out = text
  for (const e of diffEdits(text, fixed).reverse()) out = out.slice(0, e.from) + e.fix + out.slice(e.to)
  return out
}

describe('diffEdits', () => {
  it('turns a corrected paragraph into word edits', () => {
    expect(diffEdits('The hero walk into the castel.', 'The hero walks into the castle.')).toEqual([
      { from: 9, to: 13, fix: 'walks' },
      { from: 23, to: 29, fix: 'castle' },
    ])
    expect(diffEdits('Fine text.', 'Fine text.')).toEqual([])
  })
  it('attaches an inserted comma to the word before it', () => {
    expect(diffEdits('Ich habe keine Zeit gehabt weil er kam.', 'Ich habe keine Zeit gehabt, weil er kam.')).toEqual([{ from: 20, to: 26, fix: 'gehabt,' }])
  })
  it('applying the edits gives the corrected text', () => {
    const cases = [
      ['Their is to many goblin in the castel.', 'There are too many goblins in the castle.'],
      ['Die Prinzessin hat ein schwert, dass sie bekam.', 'Die Prinzessin hat ein Schwert, das sie bekam.'],
      ['She went home', 'She went home.'],
    ]
    for (const [t, f] of cases) expect(apply(t, f)).toBe(f)
  })
  it('ignores translations and rewrites', () => {
    expect(diffEdits('Der Ritter gehen in die Burg.', 'The knight goes to the castle.')).toEqual([])
  })
})

describe('fix options', () => {
  it('marks the sentence around the spot', () => {
    expect(markedSentence('It rained. The hero walk in. Then he sat.', 20, 24)).toBe('It rained. The hero [[walk]] in. Then he sat.')
    expect(markedSentence('A. B. The hero walk in. C. D.', 15, 19)).toBe('B. The hero [[walk]] in. C.')
    expect(markedSentence('No end walk here', 7, 11)).toBe('No end [[walk]] here')
  })
  it('cleans model lines', () => {
    expect(cleanOptions(['1. walked', '"walks"', 'walk', 'walked', 'The hero walked into the old tavern today.', '[[x]]', ''], 'walk')).toEqual(['walked', 'walks'])
  })
  it('titles fixes', () => {
    expect(fixTitle('gehabt', 'gehabt,', false)).toBe('Fix the punctuation')
    expect(fixTitle('walk', 'walked', false)).toBe('Change the word form')
    expect(fixTitle('there', 'their', false)).toBe('Change the wording')
    expect(fixTitle('castel', 'castle', true)).toBe('Correct the spelling')
    expect(fixTitle('schwert', 'Schwert', false)).toBe('Fix the capitalization')
  })
})
