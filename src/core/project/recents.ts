import { getFs } from '../fs'
import type { RecentProject } from '../model'
import { readVersioned, writeVersioned } from './versioned'

/** App-level list of known projects, kept in the app data folder (PM-1, PM-6). */
async function recentsPath() {
  const fs = getFs()
  return fs.join(await fs.appDataDir(), 'recent-projects.json')
}

export async function readRecents(): Promise<RecentProject[]> {
  const list = await readVersioned<RecentProject[]>(await recentsPath(), () => [])
  return [...list].sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
}

export async function upsertRecent(entry: RecentProject) {
  const list = (await readRecents()).filter((r) => r.path !== entry.path)
  list.unshift(entry)
  await writeVersioned(await recentsPath(), list)
}

export async function removeRecent(path: string) {
  const list = (await readRecents()).filter((r) => r.path !== path)
  await writeVersioned(await recentsPath(), list)
}
