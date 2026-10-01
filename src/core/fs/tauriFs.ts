import { appDataDir, dirname, documentDir, join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import * as fs from '@tauri-apps/plugin-fs'
import type { DirEntry, FileSystem } from './types'

/** Real disk access through Tauri's fs/dialog plugins (desktop build). */
export class TauriFs implements FileSystem {
  readonly kind = 'tauri' as const

  join(...parts: string[]) {
    return join(...parts)
  }
  documentDir() {
    return documentDir()
  }
  appDataDir() {
    return appDataDir()
  }
  exists(path: string) {
    return fs.exists(path)
  }
  readText(path: string) {
    return fs.readTextFile(path)
  }
  async writeTextAtomic(path: string, text: string) {
    await fs.mkdir(await dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    await fs.writeTextFile(tmp, text)
    await fs.rename(tmp, path)
  }
  mkdir(path: string) {
    return fs.mkdir(path, { recursive: true })
  }
  async list(path: string): Promise<DirEntry[]> {
    const entries = await fs.readDir(path)
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory }))
  }
  async remove(path: string) {
    if (await fs.exists(path)) await fs.remove(path, { recursive: true })
  }
  copyFile(from: string, to: string) {
    return fs.copyFile(from, to)
  }
  async pickFolder(title: string) {
    const result = await open({ directory: true, multiple: false, title })
    return typeof result === 'string' ? result : null
  }
  async pickFiles(title: string, extensions: string[]) {
    const result = await open({ multiple: true, title, filters: [{ name: 'Files', extensions }] })
    if (!result) return []
    return Array.isArray(result) ? result : [result]
  }
}
