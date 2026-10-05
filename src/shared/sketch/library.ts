import { create } from 'zustand'
import { duplicateIds, hasBigImages, shrinkBrushImages } from './brushImages'
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
  type BrushSet,
  type BrushSettings,
} from './brushes'
import { V05_BUILTIN_IDS } from './brushDefaults'
import { loadImageMask } from './brushTextures'

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
  /** Move a set before another one (or to the end). */
  moveSet(id: Id, beforeId?: Id): void
  setIcon(id: Id, icon: string): void
  togglePin(id: Id): void
  /** Replace a brush entirely (Brush Studio's Done). */
  replaceBrush(brush: BrushDef): void
  /** Add imported brushes as a new set; returns its id. */
  addSet(name: string, brushes: BrushDef[], icon?: string): Id
}

async function libraryPath() {
  const fs = getFs()
  return fs.join(await fs.appDataDir(), 'brushes.json')
}

const MAX_RECENT = 8
/** Bumped when stored brush images are cleaned up (2: scaled to 512 px, duplicates removed). */
const IMAGES_VERSION = 2

export const useBrushLibrary = create<LibraryState>()((set, get) => {
  // Sliders change brushes many times a second; write once things settle (one write at a time).
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const { sets, brushes, recent, pinned, brushId, eraserId } = get()
      const seenBuiltIns = defaultLibrary().brushes.map((b) => b.id)
      void libraryPath().then((p) => writeVersioned(p, { sets, brushes, recent, pinned, brushId, eraserId, seenBuiltIns, imagesVersion: IMAGES_VERSION }))
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
      const saved = await readVersioned<Partial<BrushLibrary & { brushId: Id; eraserId: Id; seenBuiltIns: Id[]; imagesVersion: number }> | null>(await libraryPath(), () => null).catch(() => null)
      if (saved?.brushes && saved.sets) {
        const { sets, brushes } = mergeBuiltIns(saved.sets, saved.brushes.map(normalizeBrush), saved.seenBuiltIns ?? V05_BUILTIN_IDS)
        set({
          sets,
          brushes,
          recent: saved.recent ?? [],
          pinned: saved.pinned ?? [],
          brushId: saved.brushId ?? DEFAULT_BRUSH_ID,
          eraserId: saved.eraserId ?? DEFAULT_ERASER_ID,
        })
      }
      set({ loaded: true })
      // One-time clean-up of libraries made by the first importer: brushes added twice, and huge images.
      if (saved && saved.imagesVersion !== IMAGES_VERSION) {
        const drop = duplicateIds(get().sets, get().brushes)
        const brushes = hasBigImages(get().brushes) ? await shrinkBrushImages(get().brushes.filter((x) => !drop.has(x.id))) : get().brushes.filter((x) => !drop.has(x.id))
        // Saving writes the new version number, so this runs once.
        change((s) => ({ sets: s.sets.map((x) => ({ ...x, brushIds: x.brushIds.filter((id) => !drop.has(id)) })), brushes }))
      }
    },
    moveSet(id, beforeId) {
      change((s) => {
        const moving = s.sets.find((x) => x.id === id)
        if (!moving || id === beforeId) return {}
        const rest = s.sets.filter((x) => x.id !== id)
        const i = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1
        rest.splice(i < 0 ? rest.length : i, 0, moving)
        return { sets: rest }
      })
    },
    setIcon(id, icon) {
      change((s) => ({ sets: s.sets.map((x) => (x.id === id ? { ...x, icon } : x)) }))
    },
    togglePin(id) {
      change((s) => {
        const pinned = s.pinned ?? []
        return { pinned: pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id] }
      })
    },
    replaceBrush(brush) {
      change((s) => ({ brushes: s.brushes.map((b) => (b.id === brush.id ? brush : b)) }))
    },
    addSet(name, brushes, icon) {
      const s = { ...newSet(name), brushIds: brushes.map((b) => b.id), icon }
      change((st) => ({ sets: [s, ...st.sets], brushes: [...st.brushes, ...brushes] }))
      return s.id
    },
    select(id, as) {
      const b = get().brushes.find((x) => x.id === id)
      if (b) void preloadBrush(b)
      change((s) => ({ [as === 'brush' ? 'brushId' : 'eraserId']: id, recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, MAX_RECENT) }))
    },
    updateBrush(id, patch) {
      change((s) => ({ brushes: s.brushes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
    },
    resetBrush(id) {
      const orig = builtInBrush(id)
      // Reset points the user saved stay.
      if (orig) change((s) => ({ brushes: s.brushes.map((b) => (b.id === id ? { ...orig, resetPoints: b.resetPoints } : b)) }))
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
        pinned: (s.pinned ?? []).filter((r) => r !== id),
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

/**
 * Built-in sets and brushes added in later versions appear for existing users
 * too: new sets at the end, new brushes in their built-in set. Built-ins the
 * user already saw (and maybe deleted) stay as they are.
 */
export function mergeBuiltIns(savedSets: BrushSet[], brushes: BrushDef[], seen: readonly Id[]): { sets: BrushSet[]; brushes: BrushDef[] } {
  const fresh = defaultLibrary()
  const seenIds = new Set(seen)
  const have = new Set(brushes.map((b) => b.id))
  const known = new Set(savedSets.map((s) => s.id))
  const extra = fresh.brushes.filter((b) => !seenIds.has(b.id) && !have.has(b.id))
  const extraIds = new Set(extra.map((b) => b.id))
  const sets = savedSets.map((s) => {
    const f = fresh.sets.find((x) => x.id === s.id && s.builtIn)
    if (!f) return s
    return { ...s, icon: s.icon ?? f.icon, brushIds: [...s.brushIds, ...f.brushIds.filter((id) => extraIds.has(id) && !s.brushIds.includes(id))] }
  })
  for (const f of fresh.sets) if (!known.has(f.id)) sets.push({ ...f, brushIds: f.brushIds.filter((id) => extraIds.has(id) || have.has(id)) })
  const used = new Set(sets.flatMap((s) => s.brushIds))
  return { sets, brushes: [...brushes, ...extra.filter((b) => used.has(b.id))] }
}

/** Decode a brush's custom images ahead of time, so its first stroke has them. */
export function preloadBrush(b: BrushSettings): Promise<unknown> {
  const srcs = [b.shapeImage, b.grainImage, b.dual?.shapeImage, b.dual?.grainImage].filter((s): s is string => !!s)
  return Promise.all(srcs.map(loadImageMask))
}
