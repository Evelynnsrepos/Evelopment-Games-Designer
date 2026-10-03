import { invoke } from '@tauri-apps/api/core'
import { useSettings } from '@/core/state'
import { useAiHelper } from './ai'
import { findMisspelled, knownWords, tokenize } from './spell'

/**
 * Spelling and AI grammar issues for plain paragraphs, shared by the rich text
 * editor and ProofTextarea. The AI helper rewrites a paragraph correctly and
 * the differences become blue underlines, like Grammarly.
 */
export interface Issue {
  from: number
  to: number
  /** Spelling: the misspelled word. */
  word?: string
  /** AI: what to write instead of text[from..to]. */
  fix?: string
}

export interface Edit {
  from: number
  to: number
  fix: string
}

const TOKEN = /\s+|[\p{L}\p{M}\p{N}'’-]+|[^\s\p{L}\p{M}\p{N}]/gu

/**
 * The changes that turn `text` into `fixed`, word by word. A pure insertion (a missing comma)
 * is attached to the word before it so there is something to underline.
 */
export function diffEdits(text: string, fixed: string): Edit[] {
  const a = [...text.matchAll(TOKEN)].map((m) => ({ s: m[0], at: m.index }))
  const b = [...fixed.matchAll(TOKEN)].map((m) => m[0])
  // ponytail: O(n·m) LCS per paragraph; fine for paragraphs, split sentences if huge ones lag.
  const n = a.length
  const m = b.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i].s === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const changed = n + m - 2 * lcs[0][0]
  // A rewrite of most of the paragraph is a translation or a ramble, not a correction.
  if (changed > Math.max(4, (n + m) * 0.4)) return []

  const edits: Edit[] = []
  const end = (i: number) => (i < n ? a[i].at : text.length)
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i].s === b[j]) {
      i++
      j++
      continue
    }
    // Walk the LCS through one run of changes until the texts agree again.
    const i0 = i
    const j0 = j
    while ((i < n || j < m) && !(i < n && j < m && a[i].s === b[j])) {
      if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) j++
      else i++
    }
    let from = end(i0)
    let to = end(i)
    let fix = b.slice(j0, j).join('')
    if (!text.slice(from, to).trim() && !fix.trim()) continue
    if (from === to || !text.slice(from, to).trim()) {
      // Insertion: grow it over the word before (or after, at the start).
      const k = i0 - 1 >= 0 && a[i0 - 1].s.trim() ? i0 - 1 : i0 - 2
      if (k >= 0) {
        fix = text.slice(a[k].at, from) + fix
        from = a[k].at
      } else if (i < n) {
        fix += a[i].s
        to = end(i + 1)
      }
    }
    // Underline words, not the spaces around them.
    while (from < to && text[from] === ' ' && fix.startsWith(' ')) {
      from++
      fix = fix.slice(1)
    }
    while (to > from && text[to - 1] === ' ' && fix.endsWith(' ')) {
      to--
      fix = fix.slice(0, -1)
    }
    if (to > from) edits.push({ from, to, fix })
  }
  return edits
}

const GERMAN = new Set('der die das und ist nicht ein eine einen sie wir ich hat sind mit von zu den dem auf für auch es sich war'.split(' '))
const ENGLISH = new Set('the and is not a an of to in it was he she they we with for on are that this you'.split(' '))

/** "de" or "en", from common words; limited to the spell check languages the user picked. */
export function guessLang(text: string): 'de' | 'en' {
  const langs = useSettings.getState().spellLanguages
  if (!langs.includes('de')) return 'en'
  if (!langs.includes('en')) return 'de'
  let score = 0
  for (const w of text.toLowerCase().split(/[^\p{L}]+/u)) score += Number(GERMAN.has(w)) - Number(ENGLISH.has(w))
  return score > 0 ? 'de' : 'en'
}

const fixes = new Map<string, Edit[]>()
const listeners = new Set<() => void>()
let queue: string[] = []
let busy = false

export function aiReady(): boolean {
  const s = useSettings.getState()
  return s.spellCheck && s.aiHelper && useAiHelper.getState().installed === true
}

/** Called whenever the AI helper finished a paragraph, so editors can underline it. */
export function onAiResult(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Queue paragraphs for the AI helper; the newest request goes first. One paragraph at a time. */
function want(texts: string[]) {
  const fresh = texts.filter((t) => !fixes.has(t) && t.split(/\s+/).length >= 3)
  queue = [...new Set([...fresh, ...queue])]
  void pump()
}

async function pump() {
  if (busy) return
  busy = true
  try {
    while (queue.length && aiReady()) {
      const text = queue.shift()!
      if (fixes.has(text)) continue
      try {
        fixes.set(text, diffEdits(text, await invoke<string>('llm_check', { text, lang: guessLang(text) })))
      } catch (e) {
        // Do not hammer a broken helper; show why in Settings and try again on the next edit.
        useAiHelper.setState({ error: String(e) })
        queue = []
        break
      }
      listeners.forEach((l) => l())
    }
  } finally {
    busy = false
  }
}

/** "Ignore" in the menu: this exact suggestion stays hidden until the app restarts. */
const ignored = new Set<string>()
export function ignoreFix(bad: string, fix: string) {
  ignored.add(`${bad}\u0000${fix}`)
  listeners.forEach((l) => l())
}

/** Spelling and grammar issues for each paragraph. AI results arrive later through `onAiResult`. */
export async function findIssues(paragraphs: string[]): Promise<Issue[][]> {
  const words = paragraphs.map(tokenize)
  const bad = useSettings.getState().spellCheck
    ? await findMisspelled(words.flat().map((w) => w.word)).catch(() => new Set<string>())
    : new Set<string>()
  const ai = aiReady()
  if (ai) want(paragraphs)
  const known = knownWords()
  return paragraphs.map((text, p) => {
    const out: Issue[] = words[p].filter((w) => bad.has(w.word)).map((w) => ({ from: w.from, to: w.to, word: w.word }))
    for (const e of (ai && fixes.get(text)) || []) {
      const was = text.slice(e.from, e.to)
      // Made-up names the user taught the app stay as they are.
      if (ignored.has(`${was}\u0000${e.fix}`) || (tokenize(was).length > 0 && tokenize(was).every((w) => known.has(w.word.toLowerCase())))) continue
      out.push({ ...e })
    }
    return out
  })
}
