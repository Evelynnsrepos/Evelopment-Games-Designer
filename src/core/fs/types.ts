export interface DirEntry {
  name: string
  isDirectory: boolean
}

/**
 * The only way app code touches the disk. Paths are absolute and must be
 * built with `join` (never by concatenating `/` or `\`) so they work on
 * Windows and Linux (spec 2, platform rules).
 */
export interface FileSystem {
  readonly kind: 'tauri' | 'browser' | 'memory'
  join(...parts: string[]): Promise<string>
  documentDir(): Promise<string>
  appDataDir(): Promise<string>
  exists(path: string): Promise<boolean>
  readText(path: string): Promise<string>
  /** Writes to `<path>.tmp` and renames over the target, so a crash never leaves half a file (spec 11). */
  writeTextAtomic(path: string, text: string): Promise<void>
  mkdir(path: string): Promise<void>
  list(path: string): Promise<DirEntry[]>
  remove(path: string): Promise<void>
  copyFile(from: string, to: string): Promise<void>
  /** Ask the user to choose a folder; null if cancelled. */
  pickFolder(title: string): Promise<string | null>
  /** Ask the user to choose files to import (images, audio). */
  pickFiles(title: string, extensions: string[]): Promise<string[]>
}
