import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { readTop } from '@/core/collab/bridge'
import { CollabSession } from '@/core/collab/session'
import { collabNames } from '@/core/state'

const schema = getSchema([StarterKit])
const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Once upon a time' }] }] }
const name = collabNames.text(collabNames.document('writer', 'd1'), 'body')
const seed = (body: object) => (fragment: Y.XmlFragment) => prosemirrorJSONToYXmlFragment(schema, body, fragment)
const text = (doc: Y.Doc) => JSON.stringify(yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(name)))

describe('live rich text', () => {
  it('two devices seeding the same text apart end up with one copy', () => {
    const a = new CollabSession('/a')
    const b = new CollabSession('/b')
    a.richText(name, JSON.stringify(content), seed(content))
    b.richText(name, JSON.stringify(content), seed(content))
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc))
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc))
    expect(text(a.doc)).toBe(text(b.doc))
    expect(text(a.doc).match(/Once upon a time/g)).toHaveLength(1)
  })

  it('keeps existing text instead of seeding again', () => {
    const a = new CollabSession('/a')
    a.richText(name, 'x', seed(content))
    const other = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Other' }] }] }
    a.richText(name, 'y', seed(other))
    expect(text(a.doc)).toContain('Once upon a time')
    expect(text(a.doc)).not.toContain('Other')
  })

  it('is never read as a JSON value, even before it is typed', () => {
    const a = new CollabSession('/a')
    a.richText(name, 'x', seed(content))
    const b = new Y.Doc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a.doc))
    expect(readTop(b, name)).toBeUndefined()
    expect(() => b.getXmlFragment(name)).not.toThrow()
  })
})
