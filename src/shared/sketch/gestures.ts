/**
 * Touch gestures (Sketch Pro) for touch screens: two fingers pinch to zoom
 * and turn the view, a quick two-finger tap undoes, three fingers redo.
 * One finger is left to the editor (draw or pan). Pure bookkeeping, no DOM.
 */

interface Pt {
  x: number
  y: number
}

/** A tap must be this quick and still (ms, screen px). */
export const TAP_MS = 300
export const TAP_SLOP = 12

export type GestureResult =
  /** Several fingers are down: stop any one-finger stroke. */
  | { kind: 'multi' }
  /**
   * Move the view: two fingers at the start (a0, b0) and now (a1, b1). `epoch`
   * changes when fingers are added or lifted; keep the view from that moment as the start view.
   */
  | { kind: 'pinch'; epoch: number; a0: Pt; b0: Pt; a1: Pt; b1: Pt }
  | { kind: 'tap'; fingers: number }
  | null

export class TouchGestures {
  private fingers = new Map<number, { start: Pt; now: Pt }>()
  private startedAt = 0
  private most = 0
  private moved = false
  /** Pinch reference: restarts whenever fingers are added or lifted, so the view never jumps. */
  private ref: { a: number; b: number; a0: Pt; b0: Pt } | null = null
  private epoch = 0

  /** True while two or more fingers are (or were, in this touch) down. */
  get multi() {
    return this.most >= 2
  }

  get count() {
    return this.fingers.size
  }

  down(id: number, p: Pt, t: number): GestureResult {
    if (!this.fingers.size) {
      this.startedAt = t
      this.most = 0
      this.moved = false
    }
    this.fingers.set(id, { start: p, now: p })
    this.most = Math.max(this.most, this.fingers.size)
    this.rebase()
    return this.fingers.size >= 2 ? { kind: 'multi' } : null
  }

  move(id: number, p: Pt): GestureResult {
    const f = this.fingers.get(id)
    if (!f) return null
    f.now = p
    if (Math.hypot(p.x - f.start.x, p.y - f.start.y) > TAP_SLOP) this.moved = true
    const r = this.ref
    if (!r || this.fingers.size < 2) return null
    return { kind: 'pinch', epoch: this.epoch, a0: r.a0, b0: r.b0, a1: this.fingers.get(r.a)!.now, b1: this.fingers.get(r.b)!.now }
  }

  up(id: number, t: number): GestureResult {
    if (!this.fingers.delete(id)) return null
    this.rebase()
    if (this.fingers.size) return null
    const tap = this.most >= 2 && !this.moved && t - this.startedAt < TAP_MS ? this.most : 0
    this.most = 0
    return tap ? { kind: 'tap', fingers: tap } : null
  }

  /** Forget everything (pointer cancel, leaving the canvas). */
  reset() {
    this.fingers.clear()
    this.most = 0
    this.ref = null
  }

  private rebase() {
    this.epoch++
    const ids = [...this.fingers.keys()]
    if (ids.length < 2) {
      this.ref = null
      return
    }
    const [a, b] = ids
    this.ref = { a, b, a0: this.fingers.get(a)!.now, b0: this.fingers.get(b)!.now }
  }
}
