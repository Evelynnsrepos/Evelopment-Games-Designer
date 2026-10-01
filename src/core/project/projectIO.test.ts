import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryFs, safeFolderName, setFs } from '../fs'
import { createEntity } from '../model'
import { computeStats, countWords, createProject, loadProject, saveCollection, writeDocument } from '.'

describe('project storage', () => {
  beforeEach(() => setFs(new MemoryFs()))

  it('creates the spec 2.1 folder layout and loads it back', async () => {
    const p = await createProject({ name: 'Test', description: 'A game', components: ['wiki', 'item-list'] })
    expect(p.root).toBe('/Documents/Evelopment Games Designer/Test')
    const loaded = await loadProject(p.root)
    expect(loaded.meta.name).toBe('Test')
    expect(loaded.meta.enabledComponents).toEqual(['wiki', 'item-list'])
    expect(loaded.categories.find((c) => c.name === 'Nation')?.appliesTo.town).toEqual({ mode: 'all' })
  })

  it('does not overwrite an existing folder with the same name', async () => {
    const a = await createProject({ name: 'Dup', description: '', components: [] })
    const b = await createProject({ name: 'Dup', description: '', components: [] })
    expect(b.root).not.toBe(a.root)
  })

  it('rejects an empty name', async () => {
    await expect(createProject({ name: '  ', description: '', components: [] })).rejects.toThrow()
  })

  it('counts words in entities and documents', async () => {
    const p = await createProject({ name: 'Words', description: '', components: ['wiki'] })
    const item = createEntity('item', 'Sword')
    item.description = 'A sharp blade'
    await saveCollection(p.root, 'item', [item])
    await writeDocument(p.root, 'wiki', 'a1', { id: 'a1', title: 'Ironhold', body: '<p>Dwarven city of stone</p>', color: 'red' })
    expect(await computeStats(p.root)).toEqual({ words: 3 + 1 + 4, images: 0 })
  })
})

describe('helpers', () => {
  it('counts words', () => {
    expect(countWords("The dwarf's well-made axe, 2 times!")).toBe(6)
  })
  it('makes folder names Windows-safe', () => {
    expect(safeFolderName('My: Game?')).toBe('My Game')
    expect(safeFolderName('???')).toBe('Untitled Project')
  })
})
