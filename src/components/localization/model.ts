import { newId, type Id } from '@/core/model'
import { parseCSV, toCSV } from '@/shared/csv'

/** Localization string table (v0.10): every player-facing text by key, in every language. */

export interface LocString {
  id: Id
  key: string
  /** Where it is used, a hint for translators. */
  context: string
  values: Record<string, string>
}

export interface LocDoc {
  /** Language codes, the first is the source language. */
  languages: string[]
  items: LocString[]
}

export const createLocDoc = (): LocDoc => ({ languages: ['en', 'de'], items: [] })
export const newString = (key = ''): LocString => ({ id: newId(), key, context: '', values: {} })

/** "The Old King's Crown" → "the_old_kings_crown". */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'text'

/** Share of strings translated per language (0–1). */
export function progress(d: LocDoc): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of d.languages) out[l] = d.items.length ? d.items.filter((s) => s.values[l]?.trim()).length / d.items.length : 1
  return out
}

export interface Found {
  key: string
  context: string
  text: string
}

/** Add texts from the project as source strings; keys that exist keep their translations. Returns the new doc and how many were added. */
export function merge(d: LocDoc, found: Found[]): { doc: LocDoc; added: number; updated: number } {
  const src = d.languages[0]
  let added = 0
  let updated = 0
  const items = [...d.items]
  for (const f of found) {
    if (!f.text.trim()) continue
    const i = items.findIndex((s) => s.key === f.key)
    if (i < 0) {
      items.push({ ...newString(f.key), context: f.context, values: { [src]: f.text } })
      added++
    } else if (items[i].values[src] !== f.text) {
      items[i] = { ...items[i], values: { ...items[i].values, [src]: f.text } }
      updated++
    }
  }
  return { doc: { ...d, items }, added, updated }
}

export const exportCSV = (d: LocDoc) => toCSV([['key', 'context', ...d.languages], ...d.items.map((s) => [s.key, s.context, ...d.languages.map((l) => s.values[l] ?? '')])])

/** Read a CSV with a key column and one column per language; existing keys are updated. */
export function importCSV(d: LocDoc, text: string): LocDoc {
  const rows = parseCSV(text)
  if (rows.length < 2) return d
  const head = rows[0].map((h) => h.trim())
  const ki = head.findIndex((h) => h.toLowerCase() === 'key')
  if (ki < 0) return d
  const ci = head.findIndex((h) => h.toLowerCase() === 'context')
  const langs = head.filter((_, i) => i !== ki && i !== ci && head[i])
  const languages = [...d.languages, ...langs.filter((l) => !d.languages.includes(l))]
  const items = [...d.items]
  for (const r of rows.slice(1)) {
    const key = r[ki]?.trim()
    if (!key) continue
    const values: Record<string, string> = {}
    head.forEach((h, i) => i !== ki && i !== ci && h && r[i] !== undefined && r[i] !== '' && (values[h] = r[i]))
    const at = items.findIndex((s) => s.key === key)
    if (at < 0) items.push({ ...newString(key), context: ci >= 0 ? (r[ci] ?? '') : '', values })
    else items[at] = { ...items[at], values: { ...items[at].values, ...values } }
  }
  return { languages, items }
}
