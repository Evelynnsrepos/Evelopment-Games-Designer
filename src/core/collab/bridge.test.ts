import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { invalidate, isKeyedList, readTop, writeTop } from './bridge'

/** Two docs that exchange updates when `sync()` is called, like two peers. */
function pair() {
  const a = new Y.Doc()
  const b = new Y.Doc()
  for (const d of [a, b]) d.on('afterTransaction', invalidate)
  const sync = () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)))
  }
  return { a, b, sync }
}

const write = (doc: Y.Doc, name: string, next: unknown) => doc.transact(() => writeTop(doc, name, readTop(doc, name), next))

describe('collab bridge', () => {
  it('round-trips nested documents', () => {
    const doc = new Y.Doc()
    doc.on('afterTransaction', invalidate)
    const value = {
      title: 'Board',
      count: 3,
      flag: false,
      empty: null,
      tags: ['a', 'b'],
      layers: [{ id: 'l1', name: 'Layer' }],
      nodes: [
        { id: 'n1', kind: 'rect', x: 1, y: 2, points: [0, 0, 5, 5] },
        { id: 'n2', kind: 'text', x: 3, y: 4, style: { bold: true } },
      ],
      rows: [],
    }
    write(doc, 'doc:brainstorm/1', value)
    expect(readTop(doc, 'doc:brainstorm/1')).toEqual(value)
  })

  it('returns undefined for documents nobody wrote', () => {
    expect(readTop(new Y.Doc(), 'doc:x/1')).toBeUndefined()
  })

  it('keeps unchanged parts identical between reads', () => {
    const doc = new Y.Doc()
    doc.on('afterTransaction', invalidate)
    write(doc, 'd', { a: { x: 1 }, b: { y: 2 } })
    const first = readTop(doc, 'd') as { a: unknown; b: unknown }
    write(doc, 'd', { ...first, b: { y: 3 } })
    const second = readTop(doc, 'd') as { a: unknown; b: unknown }
    expect(second.a).toBe(first.a)
    expect(second.b).toEqual({ y: 3 })
  })

  it('merges edits to different fields of the same item', () => {
    const { a, b, sync } = pair()
    write(a, 'd', { nodes: [{ id: 'n1', x: 0, y: 0, text: 'hi' }] })
    sync()
    const base = readTop(b, 'd') as { nodes: { id: string; x: number; y: number; text: string }[] }
    write(a, 'd', { nodes: [{ ...base.nodes[0], x: 10 }] })
    write(b, 'd', { nodes: [{ ...base.nodes[0], text: 'hello' }] })
    sync()
    const want = { nodes: [{ id: 'n1', x: 10, y: 0, text: 'hello' }] }
    expect(readTop(a, 'd')).toEqual(want)
    expect(readTop(b, 'd')).toEqual(want)
  })

  it('keeps items both peers added offline, even to an empty list', () => {
    const { a, b, sync } = pair()
    write(a, 'd', { nodes: [] })
    sync()
    write(a, 'd', { nodes: [{ id: 'from-a' }] })
    write(b, 'd', { nodes: [{ id: 'from-b' }] })
    sync()
    const ids = (readTop(a, 'd') as { nodes: { id: string }[] }).nodes.map((n) => n.id).sort()
    expect(ids).toEqual(['from-a', 'from-b'])
    expect(readTop(a, 'd')).toEqual(readTop(b, 'd'))
  })

  it('merges two peers creating the same top-level document offline', () => {
    const { a, b, sync } = pair()
    write(a, 'entities:item', [{ id: 'sword', name: 'Sword' }])
    write(b, 'entities:item', [{ id: 'shield', name: 'Shield' }])
    sync()
    const names = (readTop(a, 'entities:item') as { name: string }[]).map((e) => e.name).sort()
    expect(names).toEqual(['Shield', 'Sword'])
  })

  it('lets a delete win over a concurrent edit', () => {
    const { a, b, sync } = pair()
    write(a, 'd', { nodes: [{ id: 'n1', x: 0 }, { id: 'n2', x: 0 }] })
    sync()
    write(a, 'd', { nodes: [{ id: 'n2', x: 0 }] })
    write(b, 'd', { nodes: [{ id: 'n1', x: 5 }, { id: 'n2', x: 0 }] })
    sync()
    expect(readTop(a, 'd')).toEqual({ nodes: [{ id: 'n2', x: 0 }] })
    expect(readTop(b, 'd')).toEqual({ nodes: [{ id: 'n2', x: 0 }] })
  })

  it('reorders without rewriting every item and merges concurrent reorders', () => {
    const { a, b, sync } = pair()
    const ids = ['1', '2', '3', '4', '5']
    write(a, 'd', { nodes: ids.map((id) => ({ id })) })
    sync()
    // a brings 1 to the front (end of draw order), b moves 5 to the back.
    write(a, 'd', { nodes: ['2', '3', '4', '5', '1'].map((id) => ({ id })) })
    write(b, 'd', { nodes: ['5', '1', '2', '3', '4'].map((id) => ({ id })) })
    sync()
    const order = (d: Y.Doc) => (readTop(d, 'd') as { nodes: { id: string }[] }).nodes.map((n) => n.id)
    expect(order(a)).toEqual(order(b))
    expect(order(a)).toEqual(['5', '2', '3', '4', '1'])
  })

  it('merges concurrent inserts at the same position deterministically', () => {
    const { a, b, sync } = pair()
    write(a, 'd', { list: [{ id: 'x' }, { id: 'z' }] })
    sync()
    write(a, 'd', { list: [{ id: 'x' }, { id: 'a' }, { id: 'z' }] })
    write(b, 'd', { list: [{ id: 'x' }, { id: 'b' }, { id: 'z' }] })
    sync()
    const order = (d: Y.Doc) => (readTop(d, 'd') as { list: { id: string }[] }).list.map((n) => n.id)
    expect(order(a)).toEqual(order(b))
    expect(order(a)[0]).toBe('x')
    expect(order(a)[3]).toBe('z')
    // Inserting between the two equal keys afterwards still works.
    const current = readTop(a, 'd') as { list: { id: string }[] }
    write(a, 'd', { list: [current.list[0], current.list[1], { id: 'm' }, current.list[2], current.list[3]] })
    expect(order(a)).toEqual([current.list[0].id, current.list[1].id, 'm', current.list[2].id, 'z'])
  })

  it('switches a field between kinds', () => {
    const doc = new Y.Doc()
    doc.on('afterTransaction', invalidate)
    write(doc, 'd', { v: [] })
    write(doc, 'd', { v: ['tag'] })
    expect(readTop(doc, 'd')).toEqual({ v: ['tag'] })
    write(doc, 'd', { v: { a: 1 } })
    expect(readTop(doc, 'd')).toEqual({ v: { a: 1 } })
    write(doc, 'd', { v: 'text' })
    expect(readTop(doc, 'd')).toEqual({ v: 'text' })
    write(doc, 'd', { other: 1 })
    expect(readTop(doc, 'd')).toEqual({ other: 1 })
  })

  it('does not create Yjs changes for unchanged values', () => {
    const doc = new Y.Doc()
    doc.on('afterTransaction', invalidate)
    write(doc, 'd', { points: [1, 2, 3], nodes: [{ id: 'n', x: 1 }] })
    let updates = 0
    doc.on('update', () => updates++)
    write(doc, 'd', { points: [1, 2, 3], nodes: [{ id: 'n', x: 1 }] })
    expect(updates).toBe(0)
  })

  it('detects keyed lists', () => {
    expect(isKeyedList([])).toBe(true)
    expect(isKeyedList([{ id: 'a' }, { id: 'b' }])).toBe(true)
    expect(isKeyedList([{ id: 'a' }, { id: 'a' }])).toBe(false)
    expect(isKeyedList([1, 2])).toBe(false)
    expect(isKeyedList([{ id: 1 }])).toBe(false)
  })
})
