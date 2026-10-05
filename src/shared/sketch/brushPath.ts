/**
 * Per-brush stroke smoothing, applied on top of the editor's StreamLine:
 * - Stabilization averages the last few points (steadier, slightly behind the pen).
 * - Motion filtering removes small shakes sideways to the stroke direction;
 *   expression brings part of them back so lines keep some life.
 * Both catch up with the pen when the stroke ends (`flush`).
 */

interface Pt {
  x: number
  y: number
  pressure: number
}

export class PathSmoother<P extends Pt> {
  private window: P[] = []
  private last: P | null = null
  private dir: { x: number; y: number } | null = null
  private size: number
  private filter: number
  private expression: number

  constructor(stabilization: number, motionFilter: number, expression: number) {
    this.size = 1 + Math.round(Math.max(0, stabilization) * 24)
    this.filter = Math.max(0, motionFilter)
    this.expression = Math.max(0, Math.min(1, expression))
  }

  get active() {
    return this.size > 1 || this.filter > 0
  }

  /** The smoothed point for a new pen point. */
  push(p: P): P {
    if (!this.active) return p
    let q = p
    if (this.filter > 0 && this.last && this.dir) {
      // Sideways offset from the current direction, damped up to `filter * 6` px.
      const dx = p.x - this.last.x
      const dy = p.y - this.last.y
      const along = dx * this.dir.x + dy * this.dir.y
      const side = { x: dx - this.dir.x * along, y: dy - this.dir.y * along }
      const sideLen = Math.hypot(side.x, side.y)
      const limit = this.filter * 6
      const keep = sideLen > limit ? 1 - limit / sideLen : 0
      const k = keep + (1 - keep) * this.expression
      q = { ...p, x: this.last.x + this.dir.x * along + side.x * k, y: this.last.y + this.dir.y * along + side.y * k }
    }
    if (this.last) {
      const dx = q.x - this.last.x
      const dy = q.y - this.last.y
      const len = Math.hypot(dx, dy)
      if (len > 0.5) {
        const nx = dx / len
        const ny = dy / len
        // Direction follows slowly so one shaky point can't turn it.
        const d = this.dir ? { x: this.dir.x * 0.7 + nx * 0.3, y: this.dir.y * 0.7 + ny * 0.3 } : { x: nx, y: ny }
        const dl = Math.hypot(d.x, d.y) || 1
        this.dir = { x: d.x / dl, y: d.y / dl }
      }
    }
    this.last = q
    this.window.push(q)
    if (this.window.length > this.size) this.window.shift()
    return this.average()
  }

  /** Points that walk from the smoothed position to the pen's last point. */
  flush(): P[] {
    const out: P[] = []
    if (!this.last || this.size <= 1) return out
    while (this.window.length > 1) {
      this.window.shift()
      out.push(this.average())
    }
    return out
  }

  private average(): P {
    const w = this.window
    let x = 0
    let y = 0
    let pressure = 0
    for (const p of w) {
      x += p.x
      y += p.y
      pressure += p.pressure
    }
    return { ...w[w.length - 1], x: x / w.length, y: y / w.length, pressure: pressure / w.length }
  }
}
