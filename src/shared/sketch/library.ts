import { create } from 'zustand'
import { getFs } from '@/core/fs'
import type { Id } from '@/core/model'
import { readVersioned, writeVersioned } from '@/core/project'
import {
  builtInBrush,
  DEFAULT_BRUSH_ID,
  DEFAULT_ERASER_ID,
  defaultLibrary,
  newBrush,
  newSet,
  normalizeBrush,
  type BrushDef,
  type BrushLibrary,
  type BrushSettings,
} from './brushes'

/**
 * The brush library (v0.5) belongs to this computer, not a project:
 * the same brushes in every project. Saved in the app data folder.
 */
interface LibraryState extends BrushLibrary {
  loaded: boolean
  brushId: Id
  eraserId: Id
  load(): Promise<void>
  select(id: Id, as: 'brush' | 'eraser'): void
  updateBrush(id: Id, patch: Partial<BrushSettings & { name: string }>): void
  resetBrush(id: Id): void
  createBrush(setId: Id): Id
  duplicateBrush(id: Id, setId: Id): Id
  deleteBrush(id: Id): void
  /** Move a brush into a set (removing it from the others), optionally before another brush. */
  moveBrush(id: Id, setId: Id, beforeId?: Id): void
  createSet(name: string): Id
  renameSet(id: Id, name: string): void
  deleteSet(id: Id): void
}

async function libraryPath() {
  const fs = getFs()
  return fs.join(await fs.appDataDir(), 'brushes.json')
}

const MAX_RECENT = 8

export const useBrushLibrary = create<LibraryState>()((set, get) => {
  // Sliders change brushes many times a second; write once things settle (one write at a time).
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const { sets, brushes, recent, brushId, eraserId } = get()
      void libraryPath().then((p) => writeVersioned(p, { sets, brushes, recent, brushId, eraserId }))
    }, 400)
  }
  const change = (fn: (s: LibraryState) => Partial<LibraryState>) => {
    set(fn)
    save()
  }
  return {
    ...defaultLibrary(),
    loaded: false,
    brushId: DEFAULT_BRUSH_ID,
    eraserId: DEFAULT_ERASER_ID,
    async load() {
      if (get().loaded) return
      const saved = await readVersioned<Partial<BrushLibrary & { brushId: Id; eraserId: Id }> | null>(await libraryPath(), () => null).catch(() => null)
      if (saved?.brushes && saved.sets) {
        const brushes = saved.brushes.map(normalizeBrush)
        // Built-in sets added in later versions appear for existing users too.
        const known = new Set(saved.sets.map((s) => s.id))
        const fresh = defaultLibrary()
        const extraSets = fresh.sets.filter((s) => s.builtIn && !known.has(s.id))
        const extraBrushes = fresh.brushes.filter((b) => extraSets.some((s) => s.brushIds.includes(b.id)) && !brushes.some((x) => x.id === b.id))
        set({
          sets: [...saved.sets, ...extraSets],
          brushes: [...brushes, ...extraBrushes],
          recent: saved.recent ?? [],
          brushId: saved.brushId ?? DEFAULT_BRUSH_ID,
          eraserId: saved.eraserId ?? DEFAULT_ERASER_ID,
        })
      }
      set({ loaded: true })
    },
    select(id, as) {
      change((s) => ({ [as === 'brush' ? 'brushId' : 'eraserId']: id, recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, MAX_RECENT) }))
    },
    updateBrush(id, patch) {
      change((s) => ({ brushes: s.brushes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
    },
    resetBrush(id) {
      const orig = builtInBrush(id)
      if (orig) change((s) => ({ brushes: s.brushes.map((b) => (b.id === id ? orig : b)) }))
    },
    createBrush(setId) {
      const b = newBrush()
      change((s) => ({ brushes: [...s.brushes, b], sets: s.sets.map((x) => (x.id === setId ? { ...x, brushIds: [...x.brushIds, b.id] } : x)) }))
      return b.id
    },
    duplicateBrush(id, setId) {
      const src = get().brushes.find((b) => b.id === id)
      const copy: BrushDef = { ...(src ?? newBrush()), id: newBrush().id, name: `${src?.name ?? 'Brush'} copy`, builtIn: false }
      change((s) => ({
        brushes: [...s.brushes, copy],
        sets: s.sets.map((x) => {
          if (x.id !== setId) return x
          const i = x.brushIds.indexOf(id)
          const ids = [...x.brushIds]
          ids.splice(i < 0 ? ids.length : i + 1, 0, copy.id)
          return { ...x, brushIds: ids }
        }),
      }))
      return copy.id
    },
    deleteBrush(id) {
      change((s) => ({
        brushes: s.brushes.filter((b) => b.id !== id),
        sets: s.sets.map((x) => ({ ...x, brushIds: x.brushIds.filter((b) => b !== id) })),
        recent: s.recent.filter((r) => r !== id),
        brushId: s.brushId === id ? DEFAULT_BRUSH_ID : s.brushId,
        eraserId: s.eraserId === id ? DEFAULT_ERASER_ID : s.eraserId,
      }))
    },
    moveBrush(id, setId, beforeId) {
      change((s) => ({
        sets: s.sets.map((x) => {
          const ids = x.brushIds.filter((b) => b !== id)
          if (x.id !== setId) return { ...x, brushIds: ids }
          const i = beforeId ? ids.indexOf(beforeId) : -1
          ids.splice(i < 0 ? ids.length : i, 0, id)
          return { ...x, brushIds: ids }
        }),
      }))
    },
    createSet(name) {
      const s = newSet(name)
      change((st) => ({ sets: [s, ...st.sets] }))
      return s.id
    },
    renameSet(id, name) {
      change((s) => ({ sets: s.sets.map((x) => (x.id === id ? { ...x, name } : x)) }))
    },
    deleteSet(id) {
      change((s) => {
        const gone = s.sets.find((x) => x.id === id)?.brushIds ?? []
        // Brushes that live only in this set go with it.
        const elsewhere = new Set(s.sets.filter((x) => x.id !== id).flatMap((x) => x.brushIds))
        const drop = new Set(gone.filter((b) => !elsewhere.has(b)))
        return {
          sets: s.sets.filter((x) => x.id !== id),
          brushes: s.brushes.filter((b) => !drop.has(b.id)),
          recent: s.recent.filter((r) => !drop.has(r)),
          brushId: drop.has(s.brushId) ? DEFAULT_BRUSH_ID : s.brushId,
          eraserId: drop.has(s.eraserId) ? DEFAULT_ERASER_ID : s.eraserId,
        }
      })
    },
  }
})

export function useBrush(id: Id): BrushDef {
  const brushes = useBrushLibrary((s) => s.brushes)
  return brushes.find((b) => b.id === id) ?? brushes[0]
}
