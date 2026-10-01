import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFs, MemoryFs, setFs } from '../fs'
import { createEntity } from '../model'
import { createProject, loadProject, saveCollection, writeDocument } from '../project'
import { flushAll, useProjectStore } from '../state'
import { collectProjectFiles, createBackup, installAutoBackup, listBackups, MAX_BACKUPS, restoreBackup, waitForBackups } from '.'

describe('backups', () => {
  beforeEach(() => setFs(new MemoryFs()))

  it('snapshots every JSON file except assets and old backups', async () => {
    const p = await createProject({ name: 'B', description: '', components: ['wiki'] })
    await writeDocument(p.root, 'wiki', 'index', { articles: [] })
    await getFs().writeBinaryAtomic(await getFs().join(p.root, 'assets', 'images', 'x.png'), new Uint8Array([1]))
    await createBackup(p.root, 'open')
    const files = Object.keys(await collectProjectFiles(p.root)).sort()
    expect(files).toEqual([
      'components/wiki/index.json',
      'entities/categories.json',
      'entities/characters.json',
      'entities/enemies.json',
      'entities/items.json',
      'entities/towns.json',
      'project.json',
    ])
  })

  it('skips a snapshot identical to the newest one', async () => {
    const p = await createProject({ name: 'B', description: '', components: [] })
    expect(await createBackup(p.root, 'open')).not.toBeNull()
    expect(await createBackup(p.root, 'close')).toBeNull()
    expect(await listBackups(p.root)).toHaveLength(1)
  })

  it(`keeps only the newest ${MAX_BACKUPS}`, async () => {
    const p = await createProject({ name: 'B', description: '', components: [] })
    const start = Date.parse('2026-10-01T12:00:00Z')
    for (let i = 0; i < 14; i++) {
      await saveCollection(p.root, 'item', [createEntity('item', `Item ${i}`)])
      await createBackup(p.root, 'autosave', new Date(start + i * 1000))
    }
    const list = await listBackups(p.root)
    expect(list).toHaveLength(MAX_BACKUPS)
    expect(list[0].createdAt).toBe('2026-10-01T12:00:13.000Z')
    expect(list.at(-1)!.createdAt).toBe('2026-10-01T12:00:04.000Z')
  })

  it('restores a backup, removes files created later, and backs up the current state first', async () => {
    const p = await createProject({ name: 'B', description: '', components: [] })
    await saveCollection(p.root, 'item', [createEntity('item', 'Sword')])
    const good = await createBackup(p.root, 'open', new Date('2026-10-01T12:00:00Z'))

    await saveCollection(p.root, 'item', [])
    await writeDocument(p.root, 'timeline', 't1', { lines: [] })

    await restoreBackup(p.root, good!.id)
    const loaded = await loadProject(p.root)
    expect(loaded.entities.item.map((i) => i.name)).toEqual(['Sword'])
    expect(await getFs().exists(await getFs().join(p.root, 'components', 'timeline', 't1.json'))).toBe(false)
    expect((await listBackups(p.root)).map((b) => b.reason)).toEqual(['before-restore', 'open'])
  })
})

describe('automatic backups', () => {
  let uninstall: () => void
  beforeEach(() => {
    setFs(new MemoryFs())
    uninstall = installAutoBackup()
  })
  afterEach(() => uninstall())

  it('backs up when a project opens and when it closes after edits', async () => {
    await useProjectStore.getState().create({ name: 'Auto', description: '', components: [] })
    const root = useProjectStore.getState().root!
    await waitForBackups()
    expect((await listBackups(root)).map((b) => b.reason)).toEqual(['open'])

    useProjectStore.getState().addEntity('town', 'Ironhold')
    await flushAll(root)
    await useProjectStore.getState().close()
    await waitForBackups()
    expect((await listBackups(root)).map((b) => b.reason)).toEqual(['close', 'open'])
  })

  it('takes an autosave backup once the interval has passed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      await useProjectStore.getState().create({ name: 'Timed', description: '', components: [] })
      const root = useProjectStore.getState().root!
      await waitForBackups()

      vi.advanceTimersByTime(6 * 60 * 1000)
      useProjectStore.getState().addEntity('item', 'Shield')
      await vi.advanceTimersByTimeAsync(1000) // autosave writes
      await vi.advanceTimersByTimeAsync(2000) // backup settles
      await waitForBackups()
      expect((await listBackups(root)).map((b) => b.reason)).toEqual(['autosave', 'open'])
      await useProjectStore.getState().close()
      await waitForBackups()
    } finally {
      vi.useRealTimers()
    }
  })
})
