import { newId, type Id } from '@/core/model'
import { SEED } from './seed'

/** Writing Principles (v0.9): rules for good stories and story structures, as a list the user owns. */

export interface PrincipleCategory {
  id: Id
  name: string
  kind: 'rules' | 'structure'
  about: string
  /** The built-in category it came from, if any. */
  seed?: string
}

export interface Principle {
  id: Id
  categoryId: Id
  title: string
  text: string
  example: string
  pinned: boolean
  /** "<seed category>:<index>" for built-in entries, so they can be restored. */
  seed?: string
}

export type SortMode = 'custom' | 'az' | 'pinned'

export interface PrinciplesDoc {
  categories: PrincipleCategory[]
  principles: Principle[]
  sort: SortMode
}

export function createPrinciplesDoc(): PrinciplesDoc {
  return restoreBuiltIns({ categories: [], principles: [], sort: 'custom' })
}

/** Add back built-in categories and entries that were deleted. Edited ones stay as they are. */
export function restoreBuiltIns(doc: PrinciplesDoc): PrinciplesDoc {
  const categories = [...doc.categories]
  const principles = [...doc.principles]
  for (const c of SEED) {
    let cat = categories.find((x) => x.seed === c.id)
    if (!cat) {
      cat = { id: newId(), name: c.name, kind: c.kind, about: c.about, seed: c.id }
      categories.push(cat)
    }
    c.items.forEach((item, i) => {
      const seed = `${c.id}:${i}`
      if (principles.some((p) => p.seed === seed)) return
      const entry: Principle = { id: newId(), categoryId: cat.id, title: item.title, text: item.text, example: item.example ?? '', pinned: false, seed }
      // Back in its old place: before the next built-in entry of the same category that still exists.
      const next = principles.findIndex((p) => p.seed?.startsWith(`${c.id}:`) && Number(p.seed.split(':')[1]) > i)
      if (next < 0) principles.push(entry)
      else principles.splice(next, 0, entry)
    })
  }
  return { ...doc, categories, principles }
}

export const missingBuiltIns = (doc: PrinciplesDoc) =>
  SEED.reduce((n, c) => n + c.items.filter((_, i) => !doc.principles.some((p) => p.seed === `${c.id}:${i}`)).length, 0)

export const newPrinciple = (categoryId: Id): Principle => ({ id: newId(), categoryId, title: 'New principle', text: '', example: '', pinned: false })

/** Entries to show: filtered by category and search, in the chosen order. */
export function visiblePrinciples(doc: PrinciplesDoc, categoryId: Id | null, query: string): Principle[] {
  const q = query.trim().toLowerCase()
  const list = doc.principles.filter(
    (p) => (!categoryId || p.categoryId === categoryId) && (!q || `${p.title} ${p.text} ${p.example}`.toLowerCase().includes(q)),
  )
  if (doc.sort === 'az') return [...list].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
  if (doc.sort === 'pinned') return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  return list
}

/** Move an entry up or down among the ones of its category (custom order). */
export function movePrinciple(doc: PrinciplesDoc, id: Id, by: -1 | 1): PrinciplesDoc {
  const list = [...doc.principles]
  const i = list.findIndex((p) => p.id === id)
  if (i < 0) return doc
  const cat = list[i].categoryId
  let j = i + by
  while (j >= 0 && j < list.length && list[j].categoryId !== cat) j += by
  if (j < 0 || j >= list.length) return doc
  ;[list[i], list[j]] = [list[j], list[i]]
  return { ...doc, principles: list }
}
