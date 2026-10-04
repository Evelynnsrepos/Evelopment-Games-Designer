import { newId, type Id } from '@/core/model'

/**
 * Name generator and small conlang builder (v0.10): a language is a set of
 * sounds and syllable patterns; names and words are built from them, and a
 * dictionary keeps the words you decided on.
 */

export interface Word {
  id: Id
  meaning: string
  word: string
  notes: string
}

export interface LanguageDoc {
  consonants: string
  vowels: string
  /** Syllable shapes, C = consonant, V = vowel, e.g. "CV CVC V". */
  patterns: string
  minSyllables: number
  maxSyllables: number
  /** Letter combinations that never appear, e.g. "qq aa". */
  forbidden: string
  /** Optional endings, e.g. "ion iel or". */
  endings: string
  saved: string[]
  dictionary: Word[]
}

export const PRESETS: Record<string, Partial<LanguageDoc>> = {
  Elvish: { consonants: 'l r n th s v m d f', vowels: 'a e i ae ie ia', patterns: 'CV CVC V', endings: 'iel wen dor ion ith', minSyllables: 2, maxSyllables: 3, forbidden: 'thth' },
  Dwarvish: { consonants: 'k g d r b th z m n dr gr kh', vowels: 'a o u i', patterns: 'CVC CV CVCC', endings: 'in ur ak rim', minSyllables: 1, maxSyllables: 2, forbidden: '' },
  Orcish: { consonants: 'g k r z sh gr kr b d m t', vowels: 'a o u', patterns: 'CVC CV CVCC', endings: 'ak uk ash og', minSyllables: 1, maxSyllables: 3, forbidden: 'zz' },
  'Japanese-like': { consonants: 'k s t n h m y r w g z d b', vowels: 'a i u e o', patterns: 'CV V', endings: 'ko ki ro shi', minSyllables: 2, maxSyllables: 4, forbidden: 'yi ye wu wi we' },
  'Norse-like': { consonants: 'th g r d v s k b h f l n', vowels: 'a e i o u y ei au', patterns: 'CVC CV CVCC', endings: 'heim gard ulf rik', minSyllables: 1, maxSyllables: 3, forbidden: '' },
  Latin: { consonants: 'c t s r n m l v p d', vowels: 'a e i o u', patterns: 'CV CVC V', endings: 'us um ia ius or', minSyllables: 2, maxSyllables: 3, forbidden: '' },
}

export function createLanguageDoc(): LanguageDoc {
  return { consonants: '', vowels: '', patterns: '', minSyllables: 2, maxSyllables: 3, forbidden: '', endings: '', saved: [], dictionary: [], ...PRESETS.Elvish } as LanguageDoc
}

export const newWord = (meaning = '', word = ''): Word => ({ id: newId(), meaning, word, notes: '' })

const list = (s: string) => s.split(/[\s,]+/).filter(Boolean)

/** Seeded random numbers, so the same meaning always gets the same word. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}
export const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

/** One word made of the language's sounds; null when the sounds are not set up. */
export function makeWord(lang: LanguageDoc, random: () => number, ending = true): string | null {
  const cs = list(lang.consonants)
  const vs = list(lang.vowels)
  const pats = list(lang.patterns.toUpperCase()).filter((p) => /^[CV]+$/.test(p))
  if (!vs.length || !pats.length || (!cs.length && pats.some((p) => p.includes('C')))) return null
  const bad = list(lang.forbidden.toLowerCase())
  const pick = <T,>(a: T[]) => a[Math.floor(random() * a.length)]
  const lo = Math.max(1, Math.min(lang.minSyllables, lang.maxSyllables))
  const hi = Math.max(lo, lang.maxSyllables)
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = lo + Math.floor(random() * (hi - lo + 1))
    let w = ''
    for (let i = 0; i < n; i++) for (const ch of pick(pats)) w += ch === 'C' ? pick(cs) : pick(vs)
    const ends = list(lang.endings)
    if (ending && ends.length && random() < 0.4) w += pick(ends)
    if (!bad.some((b) => w.includes(b))) return w
  }
  return null
}

export const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

/** A batch of new names. */
export function names(lang: LanguageDoc, count: number, seed = Date.now()): string[] {
  const random = rng(seed)
  const out = new Set<string>()
  for (let i = 0; i < count * 5 && out.size < count; i++) {
    const w = makeWord(lang, random)
    if (w) out.add(capitalize(w))
  }
  return [...out]
}

/**
 * Translate text word by word: words in the dictionary use their entry, other
 * words get a made-up word that is always the same for the same meaning.
 */
export function translate(lang: LanguageDoc, text: string): string {
  return text.replace(/[\p{L}']+/gu, (m) => {
    const hit = lang.dictionary.find((w) => w.meaning.trim().toLowerCase() === m.toLowerCase())
    const word = hit?.word || makeWord(lang, rng(hash(m.toLowerCase())), false) || m
    return m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? capitalize(word) : word
  })
}
