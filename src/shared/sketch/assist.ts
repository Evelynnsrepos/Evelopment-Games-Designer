import type { Id } from '@/core/model'
import { layerTree } from './layers'
import type { SketchLayer } from './model'

/**
 * Animation Assist and Page Assist (Sketch Pro). Both treat every top-level
 * layer or group as one frame (or page), bottom to top, and show only the
 * current one in the editor. Everything here is pure.
 */

export type PlayMode = 'loop' | 'pingpong' | 'once'

export interface AnimationSettings {
  on: boolean
  /** Frames per second, 1..60. */
  fps: number
  mode: PlayMode
  /** Onion skin frames on each side, 0..12. */
  onion: number
  /** Opacity of the nearest onion skin frame, 0..1. */
  onionOpacity: number
  /** Tint of the frames before and after the current one. */
  onionBefore: string
  onionAfter: string
  /** The first frame is a background shown under every frame. */
  background: boolean
  /** The last frame is a foreground shown over every frame. */
  foreground: boolean
  /** Extra frames a frame is held for, by its layer id. */
  holds: Record<Id, number>
}

export interface PageSettings {
  on: boolean
  /** The first page is a background shown under every page. */
  background: boolean
}

export const DEFAULT_ANIMATION: AnimationSettings = {
  on: false,
  fps: 12,
  mode: 'loop',
  onion: 2,
  onionOpacity: 0.4,
  onionBefore: '#e5484d',
  onionAfter: '#30a46c',
  background: false,
  foreground: false,
  holds: {},
}

export const DEFAULT_PAGES: PageSettings = { on: false, background: false }

const clamp = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def)

export function normalizeAnimation(a: Partial<AnimationSettings> | undefined): AnimationSettings {
  const d = DEFAULT_ANIMATION
  if (!a) return d
  return {
    ...d,
    ...a,
    fps: Math.round(clamp(a.fps, 1, 60, d.fps)),
    onion: Math.round(clamp(a.onion, 0, 12, d.onion)),
    onionOpacity: clamp(a.onionOpacity, 0, 1, d.onionOpacity),
    mode: a.mode === 'pingpong' || a.mode === 'once' ? a.mode : 'loop',
    holds: a.holds && typeof a.holds === 'object' ? a.holds : {},
  }
}

export const normalizePages = (p: Partial<PageSettings> | undefined): PageSettings => ({ ...DEFAULT_PAGES, ...p })

/** Ids of the frames (top-level layers and groups), bottom to top. */
export const frameIds = (layers: SketchLayer[]): Id[] => layerTree(layers).map((n) => n.layer.id)

/** The frame a layer belongs to (its top-level ancestor), or -1. */
export function frameOf(layers: SketchLayer[], id: Id | undefined): number {
  const byId = new Map(layers.map((l) => [l.id, l]))
  let l = id ? byId.get(id) : undefined
  for (let n = 0; l?.parent && byId.get(l.parent) && n < 100; n++) l = byId.get(l.parent)
  // A mask sits on the layer below it, which is the frame.
  const ids = frameIds(layers)
  const i = l ? ids.indexOf(l.id) : -1
  if (i >= 0 || !l) return i
  const flat = layers.filter((x) => !x.parent || !byId.has(x.parent))
  const k = flat.indexOf(l)
  for (let j = k - 1; j >= 0; j--) if (ids.includes(flat[j].id)) return ids.indexOf(flat[j].id)
  return -1
}

/** The frames that play, as indexes (the background and foreground frames stay put). */
export function playable(count: number, s: Pick<AnimationSettings, 'background' | 'foreground'>): number[] {
  const first = s.background && count > 1 ? 1 : 0
  const last = s.foreground && count - first > 1 ? count - 1 : count
  return Array.from({ length: last - first }, (_, i) => first + i)
}

/** The frame shown on each tick of one pass: holds repeat a frame, ping-pong comes back. */
export function sequence(ids: Id[], frames: number[], holds: Record<Id, number>, mode: PlayMode): number[] {
  const back = mode === 'pingpong' ? frames.slice(1, -1).reverse() : []
  return [...frames, ...back].flatMap((f) => Array<number>(1 + Math.max(0, Math.round(holds[ids[f]] ?? 0))).fill(f))
}

/** The layer list with only these frames visible (the others hidden at the top level). */
export function showFrames(layers: SketchLayer[], ids: Id[], shown: number[]): SketchLayer[] {
  const keep = new Set(shown.map((i) => ids[i]))
  const hide = new Set(ids.filter((id) => !keep.has(id)))
  return layers.map((l) => (hide.has(l.id) && l.visible ? { ...l, visible: false } : l))
}

/** Onion skin frames around `current` among the playing frames, nearest first, with their opacity and side. */
export function onionSkins(current: number, frames: number[], s: Pick<AnimationSettings, 'onion' | 'onionOpacity' | 'mode'>): { frame: number; opacity: number; before: boolean }[] {
  const at = frames.indexOf(current)
  if (at < 0 || !s.onion) return []
  const out: { frame: number; opacity: number; before: boolean }[] = []
  for (let d = 1; d <= s.onion; d++) {
    // Each step out is a bit fainter.
    const opacity = s.onionOpacity * (1 - (d - 1) / (s.onion + 1))
    for (const [k, before] of [[at - d, true], [at + d, false]] as const) {
      // A looping animation wraps around, so the first frame sees the last one.
      const j = s.mode === 'loop' ? (k + frames.length) % frames.length : k
      if (j >= 0 && j < frames.length && j !== at && !out.some((o) => o.frame === frames[j])) out.push({ frame: frames[j], opacity, before })
    }
  }
  return out
}
