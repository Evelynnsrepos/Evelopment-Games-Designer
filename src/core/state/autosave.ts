/**
 * Debounced auto-save (spec 3.5). Each file gets a key; scheduling the same
 * key again restarts its timer. `flush` writes immediately, used when a
 * component closes (ED-8) or the project/app closes.
 */
export const AUTOSAVE_DELAY_MS = 1000

type Job = { timer: ReturnType<typeof setTimeout>; run: () => Promise<void> }

const pending = new Map<string, Job>()
const listeners = new Set<(saving: boolean, error: unknown) => void>()
const savedListeners = new Set<(key: string) => void>()

export function scheduleSave(key: string, run: () => Promise<void>, delay = AUTOSAVE_DELAY_MS) {
  const existing = pending.get(key)
  if (existing) clearTimeout(existing.timer)
  const timer = setTimeout(() => void flush(key), delay)
  pending.set(key, { timer, run })
  notify(true, null)
}

export async function flush(key: string): Promise<void> {
  const job = pending.get(key)
  if (!job) return
  clearTimeout(job.timer)
  pending.delete(key)
  try {
    await job.run()
    notify(pending.size > 0, null)
    for (const fn of savedListeners) fn(key)
  } catch (error) {
    console.error(`Auto-save failed for ${key}`, error)
    notify(pending.size > 0, error)
  }
}

/** Flush every key that starts with `prefix` (or all keys), including saves those saves schedule. */
export async function flushAll(prefix = ''): Promise<void> {
  // A save can schedule another (a drawing's pixels, then its document); a few rounds catch those.
  for (let round = 0; round < 4; round++) {
    const keys = [...pending.keys()].filter((k) => k.startsWith(prefix))
    if (!keys.length) return
    await Promise.all(keys.map(flush))
  }
}

export function hasPendingSaves() {
  return pending.size > 0
}

/** Subscribe to save state for a status indicator. */
export function onSaveState(fn: (saving: boolean, error: unknown) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Called with the key after each successful write (keys start with `<project root>|`). Used by backups. */
export function onSaved(fn: (key: string) => void) {
  savedListeners.add(fn)
  return () => void savedListeners.delete(fn)
}

function notify(saving: boolean, error: unknown) {
  for (const fn of listeners) fn(saving, error)
}
