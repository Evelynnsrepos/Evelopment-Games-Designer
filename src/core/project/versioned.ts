import { SCHEMA_VERSION, type Versioned } from '../model'
import { getFs } from '../fs'

/**
 * Upgrade old file contents to the current schema. Add a case per version bump:
 *   if (version < 2) data = migrateV1toV2(data)
 */
function migrate(data: unknown, version: number): unknown {
  if (version > SCHEMA_VERSION) {
    throw new Error(`This project was saved by a newer version of the app (schema ${version}).`)
  }
  return data
}

export async function readVersioned<T>(path: string, fallback?: () => T): Promise<T> {
  const fs = getFs()
  if (!(await fs.exists(path))) {
    if (fallback) return fallback()
    throw new Error(`Missing file: ${path}`)
  }
  const parsed = JSON.parse(await fs.readText(path)) as Versioned<T>
  return migrate(parsed.data, parsed.schemaVersion ?? 0) as T
}

export async function writeVersioned<T>(path: string, data: T): Promise<void> {
  const file: Versioned<T> = { schemaVersion: SCHEMA_VERSION, data }
  await getFs().writeTextAtomic(path, JSON.stringify(file, null, 2))
}
