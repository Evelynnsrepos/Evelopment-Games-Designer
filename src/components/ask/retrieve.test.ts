import { describe, expect, it } from 'vitest'
import { asksToWrite, notesText, pick, terms, type Note } from './retrieve'

const n = (title: string, text: string): Note => ({ title, text, ref: { kind: 'x', id: title } })

describe('ask your project', () => {
  const notes = [n('Character: Mira', 'Queen of Ashvale. Sister of Doran.'), n('Town: Ashvale', 'Capital in the north, ruled by Mira.'), n('Item: Sword', 'A rusty blade.')]

  it('ignores filler words and ranks by matches, titles first', () => {
    expect(terms('Who is the queen of Ashvale?')).toEqual(['queen', 'ashvale'])
    expect(pick(notes, 'Who rules Ashvale?').map((x) => x.title)).toEqual(['Town: Ashvale', 'Character: Mira'])
    expect(pick(notes, 'dragons?')).toEqual([])
  })

  it('stays within the size budget', () => {
    const many = Array.from({ length: 50 }, (_, i) => n(`Note ${i}`, 'ashvale '.repeat(200)))
    const chosen = pick(many, 'ashvale', 6000)
    expect(notesText(chosen).length).toBeLessThanOrEqual(6100)
    expect(chosen.length).toBeGreaterThan(1)
  })

  it('turns away requests to write or invent things', () => {
    expect(asksToWrite('Write a story about Mira')).toBe(true)
    expect(asksToWrite('Can you come up with a name for the dragon?')).toBe(true)
    expect(asksToWrite('Schreib mir eine Szene')).toBe(true)
    expect(asksToWrite('Erfinde einen Namen')).toBe(true)
    expect(asksToWrite('Who rules Ashvale?')).toBe(false)
    expect(asksToWrite('Does anything contradict the Moon Gem article?')).toBe(false)
  })
})
