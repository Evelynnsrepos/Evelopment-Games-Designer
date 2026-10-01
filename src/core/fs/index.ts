import { BrowserFs, MemoryFs } from './memoryFs'
import { TauriFs } from './tauriFs'
import type { FileSystem } from './types'

export type { DirEntry, FileSystem } from './types'
export { MemoryFs, BrowserFs }

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

let current: FileSystem | null = null

/** The active file system: Tauri on desktop, localStorage-backed in a plain browser. */
export function getFs(): FileSystem {
  if (!current) current = isTauri() ? new TauriFs() : new BrowserFs()
  return current
}

/** Tests swap in a MemoryFs. */
export function setFs(fs: FileSystem) {
  current = fs
}

/** Strip characters Windows forbids in folder names (spec 2, platform rules). */
export function safeFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/[. ]+$/, '')
    .trim()
  return cleaned || 'Untitled Project'
}
