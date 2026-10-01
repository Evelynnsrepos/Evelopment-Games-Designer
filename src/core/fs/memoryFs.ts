import type { DirEntry, FileSystem } from './types'

/**
 * In-memory file system used by tests and, persisted to localStorage, by the
 * browser dev build (`npm run dev` without Tauri). Paths use `/`.
 */
export class MemoryFs implements FileSystem {
  readonly kind: FileSystem['kind'] = 'memory'
  protected files = new Map<string, string>()
  protected dirs = new Set<string>(['/'])

  async join(...parts: string[]) {
    const joined = parts.filter(Boolean).join('/').replace(/\/+/g, '/')
    return normalize(joined)
  }
  async documentDir() {
    return '/Documents'
  }
  async appDataDir() {
    return '/AppData/egd'
  }
  async exists(path: string) {
    const p = normalize(path)
    return this.files.has(p) || this.dirs.has(p)
  }
  async readText(path: string) {
    const text = this.files.get(normalize(path))
    if (text === undefined) throw new Error(`File not found: ${path}`)
    return text
  }
  async writeTextAtomic(path: string, text: string) {
    const p = normalize(path)
    await this.mkdir(parent(p))
    this.files.set(p, text)
    this.changed()
  }
  async mkdir(path: string) {
    let p = normalize(path)
    while (p && !this.dirs.has(p)) {
      this.dirs.add(p)
      p = parent(p)
    }
    this.changed()
  }
  async list(path: string): Promise<DirEntry[]> {
    const p = normalize(path)
    const prefix = p === '/' ? '/' : p + '/'
    const out = new Map<string, DirEntry>()
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) {
        out.set(f, { name: f.slice(prefix.length), isDirectory: false })
      }
    }
    for (const d of this.dirs) {
      if (d !== p && d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) {
        out.set(d, { name: d.slice(prefix.length), isDirectory: true })
      }
    }
    return [...out.values()]
  }
  async remove(path: string) {
    const p = normalize(path)
    for (const f of [...this.files.keys()]) if (f === p || f.startsWith(p + '/')) this.files.delete(f)
    for (const d of [...this.dirs]) if (d === p || d.startsWith(p + '/')) this.dirs.delete(d)
    this.changed()
  }
  async copyFile(from: string, to: string) {
    await this.writeTextAtomic(to, await this.readText(from))
  }
  async pickFolder(title: string) {
    return typeof window !== 'undefined' ? window.prompt(`${title}\n(folder path)`) : null
  }
  async pickFiles() {
    return []
  }

  /** Hook for subclasses that persist state. */
  protected changed() {}
}

function normalize(path: string) {
  const p = ('/' + path.replace(/\\/g, '/')).replace(/\/+/g, '/')
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

function parent(path: string) {
  const i = path.lastIndexOf('/')
  return i <= 0 ? '/' : path.slice(0, i)
}

/** MemoryFs that survives page reloads, for running the UI in a normal browser. */
export class BrowserFs extends MemoryFs {
  readonly kind = 'browser' as const
  private static KEY = 'egd-browser-fs'

  constructor() {
    super()
    try {
      const raw = localStorage.getItem(BrowserFs.KEY)
      if (raw) {
        const state = JSON.parse(raw) as { files: [string, string][]; dirs: string[] }
        this.files = new Map(state.files)
        this.dirs = new Set(state.dirs)
      }
    } catch {
      // Storage unavailable or corrupt: start empty.
    }
  }

  protected changed() {
    try {
      localStorage.setItem(BrowserFs.KEY, JSON.stringify({ files: [...this.files], dirs: [...this.dirs] }))
    } catch {
      // Ignore quota errors in dev mode.
    }
  }
}
