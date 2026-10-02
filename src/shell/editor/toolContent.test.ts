import { beforeEach, describe, expect, it } from 'vitest'
import { getFs, MemoryFs, setFs } from '@/core/fs'
import { projectPaths, writeDocument } from '@/core/project'
import { flushAll, useProjectStore } from '@/core/state'
import { deleteToolContent, hideTool, toolHasContent } from './toolContent'

const store = () => useProjectStore.getState()

describe('closing tools (v0.3)', () => {
  beforeEach(async () => {
    useProjectStore.setState({ root: null, meta: null })
    setFs(new MemoryFs())
    await store().create({ name: 'Space', description: '', components: ['cosmos', 'item-list', 'wiki'] })
  })

  it('hiding keeps the contents, deleting removes them', async () => {
    const doc = store().addDocument('cosmos', 'Milky Way')
    await writeDocument(store().root!, 'cosmos', doc.id, { bodies: [] })
    await hideTool('cosmos')
    expect(store().meta!.enabledComponents).toEqual(['item-list', 'wiki'])
    expect(await toolHasContent('cosmos')).toBe(true)

    await deleteToolContent('cosmos')
    expect(store().meta!.documents).toEqual([])
    expect(await getFs().exists(await projectPaths.document(store().root!, 'cosmos', doc.id))).toBe(false)
    expect(await toolHasContent('cosmos')).toBe(false)
  })

  it('counts list entries and single-document files as contents', async () => {
    expect(await toolHasContent('item-list')).toBe(false)
    store().addEntity('item', 'Sword')
    expect(await toolHasContent('item-list')).toBe(true)
    await deleteToolContent('item-list')
    await flushAll(store().root!)
    expect(store().entities.item).toEqual([])

    expect(await toolHasContent('wiki')).toBe(false)
    await writeDocument(store().root!, 'wiki', 'index', { articles: [] })
    expect(await toolHasContent('wiki')).toBe(true)
    await deleteToolContent('wiki')
    expect(await toolHasContent('wiki')).toBe(false)
  })
})
