import { countWordsInValue } from '@/core/project/projectIO'
import {
  countRichTextWords,
  emptyRichText,
  extractRefs,
  isRichTextEmpty,
  normalizeRichText,
  richTextToMarkdown,
  richTextToPlainText,
} from './doc'
import { combineRefProviders, findRefByLabel, rankRefItems } from './refs'
import type { RefItem, RefProvider, RichTextDoc } from './types'

const text = (t: string, marks?: string[]): RichTextDoc => ({ type: 'text', text: t, ...(marks && { marks: marks.map((type) => ({ type })) }) })
const ref = (kind: string, id: string): RichTextDoc => ({ type: 'ref', attrs: { kind, id } })
const p = (...content: RichTextDoc[]): RichTextDoc => ({ type: 'paragraph', content })

const names: Record<string, string> = { 'town:t1': 'Ironhold', 'character:c1': 'Aria' }
const resolve = ({ kind, id }: { kind: string; id: string }) => names[`${kind}:${id}`]

const sample: RichTextDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [text('The North')] },
    p(text('Aria', ['bold']), text(' was born in '), ref('town', 't1'), text('.')),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(text('Cold'))] },
        { type: 'listItem', content: [p(text('Far from '), ref('character', 'c1'), text(' and '), ref('town', 't1'))] },
      ],
    },
    { type: 'blockquote', content: [p(text('Winter is long', ['italic']))] },
    { type: 'image', attrs: { src: 'assets/images/abc.png', alt: 'Map' } },
    p(ref('town', 'deleted')),
  ],
}

describe('rich text documents', () => {
  it('extracts each link once, in reading order', () => {
    expect(extractRefs(sample)).toEqual([
      { kind: 'town', id: 't1' },
      { kind: 'character', id: 'c1' },
      { kind: 'town', id: 'deleted' },
    ])
  })

  it('exports Markdown with [[Name]] links and resolves names at export time', () => {
    expect(richTextToMarkdown(sample, resolve)).toBe(
      [
        '## The North',
        '**Aria** was born in [[Ironhold]].',
        '- Cold\n- Far from [[Aria]] and [[Ironhold]]',
        '> *Winter is long*',
        '![Map](assets/images/abc.png)',
        '[[missing link]]',
      ].join('\n\n') + '\n',
    )
  })

  it('escapes Markdown characters typed as text', () => {
    expect(richTextToMarkdown({ type: 'doc', content: [p(text('a *b* [c] #1'))] })).toBe('a \\*b\\* \\[c\\] \\#1\n')
  })

  it('numbers ordered lists from their start attribute', () => {
    const list: RichTextDoc = {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [{ type: 'listItem', content: [p(text('a'))] }, { type: 'listItem', content: [p(text('b'))] }],
    }
    expect(richTextToMarkdown({ type: 'doc', content: [list] })).toBe('3. a\n4. b\n')
  })

  it('exports plain text with names for links', () => {
    expect(richTextToPlainText(sample, resolve)).toBe(
      'The North\nAria was born in Ironhold.\n- Cold\n- Far from Aria and Ironhold\nWinter is long\nMap\nmissing link',
    )
  })

  it('counts words like the writer sees them', () => {
    expect(countRichTextWords({ type: 'doc', content: [p(text('Aria was born in '), ref('town', 't1'))] }, resolve)).toBe(5)
    expect(countRichTextWords(emptyRichText())).toBe(0)
  })

  it('stores links without names, so the project word counter skips ids and kinds', () => {
    // Names are never copied into documents (spec 3.3); only the prose is counted.
    expect(countWordsInValue({ body: { type: 'doc', content: [p(text('born in '), ref('town', 't1'))] } })).toBe(2)
  })

  it('detects empty documents', () => {
    expect(isRichTextEmpty(emptyRichText())).toBe(true)
    expect(isRichTextEmpty({ type: 'doc', content: [p(text('  '))] })).toBe(true)
    expect(isRichTextEmpty({ type: 'doc', content: [p(ref('town', 't1'))] })).toBe(false)
  })

  it('normalizes plain strings and garbage into documents', () => {
    expect(normalizeRichText(undefined)).toEqual(emptyRichText())
    expect(normalizeRichText(42)).toEqual(emptyRichText())
    expect(normalizeRichText('one\n\ntwo')).toEqual({ type: 'doc', content: [p(text('one')), { type: 'paragraph' }, p(text('two'))] })
    expect(normalizeRichText(sample)).toBe(sample)
  })
})

describe('link search', () => {
  const items: RefItem[] = [
    { kind: 'town', id: '1', label: 'Ironhold' },
    { kind: 'character', id: '2', label: 'Aria' },
    { kind: 'item', id: '3', label: 'Iron Sword' },
    { kind: 'enemy', id: '4', label: 'Lion' },
  ]
  const provider = (list: RefItem[], extra?: Partial<RefProvider>): RefProvider => ({
    search: (q) => rankRefItems(list, q),
    resolve: (t) => list.find((i) => i.kind === t.kind && i.id === t.id),
    ...extra,
  })

  it('ranks prefix matches before substring matches, case-insensitively', () => {
    expect(rankRefItems(items, 'IRON').map((i) => i.label)).toEqual(['Iron Sword', 'Ironhold'])
    expect(rankRefItems(items, 'on').map((i) => i.label)).toEqual(['Iron Sword', 'Ironhold', 'Lion'])
  })

  it('lists everything alphabetically for an empty query, up to the limit', () => {
    expect(rankRefItems(items, '', 2).map((i) => i.label)).toEqual(['Aria', 'Iron Sword'])
  })

  it('finds an exact name for typed-out [[Name]] links', () => {
    expect(findRefByLabel(provider(items), 'ironhold')?.id).toBe('1')
    expect(findRefByLabel(provider(items), 'Iron')).toBeUndefined()
  })

  it('combines providers for search, resolve, open and create', () => {
    const opened: string[] = []
    const articles = provider([{ kind: 'article', id: 'a1', label: 'Iron Age' }], {
      open: (t) => opened.push(t.id),
      create: (label) => ({ kind: 'article', id: 'new', label }),
    })
    const combined = combineRefProviders(provider(items), articles)
    expect(combined.search('iron').map((i) => i.label)).toEqual(['Iron Age', 'Iron Sword', 'Ironhold'])
    expect(combined.resolve({ kind: 'article', id: 'a1' })?.label).toBe('Iron Age')
    combined.open?.({ kind: 'article', id: 'a1' })
    expect(opened).toEqual(['a1'])
    expect(combined.create?.('Copper')).toEqual({ kind: 'article', id: 'new', label: 'Copper' })
  })
})
