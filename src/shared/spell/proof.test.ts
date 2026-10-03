import { describe, expect, it } from 'vitest'
import { diffEdits } from './proof'

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
