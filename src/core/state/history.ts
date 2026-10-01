/** Per-component undo/redo stack of whole-state snapshots (spec 3.5). */
export class History<T> {
  private past: T[] = []
  private future: T[] = []
  private readonly limit: number

  constructor(limit = 100) {
    this.limit = limit
  }

  /** Record the state *before* a change. */
  record(previous: T) {
    this.past.push(previous)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
  }

  undo(current: T): T | undefined {
    const prev = this.past.pop()
    if (prev !== undefined) this.future.push(current)
    return prev
  }

  redo(current: T): T | undefined {
    const next = this.future.pop()
    if (next !== undefined) this.past.push(current)
    return next
  }

  get canUndo() {
    return this.past.length > 0
  }
  get canRedo() {
    return this.future.length > 0
  }
}
