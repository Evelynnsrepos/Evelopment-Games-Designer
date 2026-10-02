import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/core/fs'
import { useProjectStore, useSettings } from '@/core/state'
import { ENTITY_TYPES } from '@/core/model'

/**
 * Offline spell checking (v0.4). The dictionaries live in the Rust side
 * (src-tauri/src/spell.rs); this module tokenizes text, caches answers and
 * adds the words the app already knows: the personal dictionary and the names
 * of the project's items, characters, towns and enemies.
 */

export interface WordRange {
  word: string
  from: number
  to: number
}

const WORD = /[\p{L}\p{M}][\p{L}\p{M}'’-]*[\p{L}\p{M}]|[\p{L}\p{M}]/gu

/** Words worth checking in a piece of text, with offsets. Skips single letters and words with digits. */
export function tokenize(text: string): WordRange[] {
  const out: WordRange[] = []
  for (const m of text.matchAll(WORD)) {
    const word = m[0]
    if (word.length < 2) continue
    const before = text[m.index - 1]
    const after = text[m.index + word.length]
    if ((before && /\d/.test(before)) || (after && /\d/.test(after))) continue
    out.push({ word, from: m.index, to: m.index + word.length })
  }
  return out
}

export function spellAvailable(): boolean {
  return isTauri()
}

const cache = new Map<string, boolean>()
let cacheLangs = ''

function langs(): string[] {
  const { spellLanguages } = useSettings.getState()
  const key = spellLanguages.join(',')
  if (key !== cacheLangs) {
    cache.clear()
    cacheLangs = key
  }
  return spellLanguages
}

/** Lowercased words the user or the project already defined. */
export function knownWords(): Set<string> {
  const known = new Set(useSettings.getState().personalWords.map((w) => w.toLowerCase()))
  const { entities } = useProjectStore.getState()
  for (const type of ENTITY_TYPES) {
    for (const e of entities[type] ?? []) for (const w of tokenize(e.name)) known.add(w.word.toLowerCase())
  }
  return known
}

/** The words from `words` that are misspelled. Unknown words are checked in one call. */
export async function findMisspelled(words: string[]): Promise<Set<string>> {
  const languages = langs()
  if (!spellAvailable() || languages.length === 0) return new Set()
  const todo = [...new Set(words)].filter((w) => !cache.has(w))
  if (todo.length) {
    const ok = await invoke<boolean[]>('spell_check', { langs: languages, words: todo })
    todo.forEach((w, i) => cache.set(w, ok[i]))
  }
  const known = knownWords()
  return new Set(words.filter((w) => cache.get(w) === false && !known.has(w.toLowerCase())))
}

export async function suggest(word: string, limit = 6): Promise<string[]> {
  const languages = langs()
  if (!spellAvailable() || languages.length === 0) return []
  return invoke<string[]>('spell_suggest', { langs: languages, word, limit })
}
