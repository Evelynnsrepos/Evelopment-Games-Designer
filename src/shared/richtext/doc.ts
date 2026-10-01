import { countWords } from '@/core/project/stats'
import type { RefTarget, RichTextDoc } from './types'

/** Pure helpers for stored rich text. They need no DOM, so writers, exporters and tests can run anywhere. */

export const REF_NODE = 'ref'

export function emptyRichText(): RichTextDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Accept a stored doc, a plain string (e.g. an old `notes` field), or nothing, and return a valid doc. */
export function normalizeRichText(value: unknown): RichTextDoc {
  if (value && typeof value === 'object' && (value as RichTextDoc).type === 'doc') return value as RichTextDoc
  if (typeof value === 'string' && value.length > 0) {
    return {
      type: 'doc',
      content: value
        .split(/\r?\n/)
        .map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
    }
  }
  return emptyRichText()
}

function walk(node: RichTextDoc, visit: (n: RichTextDoc) => void) {
  visit(node)
  node.content?.forEach((child) => walk(child, visit))
}

/** Every `[[` link in the document, each target once, in reading order. For backlinks and the connection map. */
export function extractRefs(doc: RichTextDoc): RefTarget[] {
  const seen = new Set<string>()
  const refs: RefTarget[] = []
  walk(doc, (n) => {
    if (n.type !== REF_NODE || !n.attrs?.id || !n.attrs?.kind) return
    const key = `${n.attrs.kind}:${n.attrs.id}`
    if (seen.has(key)) return
    seen.add(key)
    refs.push({ kind: n.attrs.kind, id: n.attrs.id })
  })
  return refs
}

/** True when the document has no text, images or links. */
export function isRichTextEmpty(doc: RichTextDoc): boolean {
  let empty = true
  walk(doc, (n) => {
    if ((n.type === 'text' && n.text?.trim()) || n.type === 'image' || n.type === REF_NODE) empty = false
  })
  return empty
}

/** Returns the current name of a link target, or undefined when it no longer exists. */
export type LabelResolver = (target: RefTarget) => string | undefined

export const MISSING_REF_LABEL = 'missing link'

const refLabel = (n: RichTextDoc, resolve?: LabelResolver) =>
  resolve?.({ kind: n.attrs?.kind, id: n.attrs?.id }) ?? MISSING_REF_LABEL

/** Words as the writer sees them, links counted by their current names (live word count, spec 8.6). */
export function countRichTextWords(doc: RichTextDoc, resolve?: LabelResolver): number {
  return countWords(richTextToPlainText(doc, resolve))
}

function inlineText(n: RichTextDoc, resolve?: LabelResolver): string {
  if (n.type === 'text') return n.text ?? ''
  if (n.type === REF_NODE) return refLabel(n, resolve)
  if (n.type === 'hardBreak') return '\n'
  return (n.content ?? []).map((c) => inlineText(c, resolve)).join('')
}

const isList = (n: RichTextDoc) => n.type === 'bulletList' || n.type === 'orderedList'
const bulletFor = (list: RichTextDoc, i: number) => (list.type === 'bulletList' ? '- ' : `${(list.attrs?.start ?? 1) + i}. `)

/** Plain text export: one line per block, links as their names. */
export function richTextToPlainText(doc: RichTextDoc, resolve?: LabelResolver): string {
  const lines: string[] = []
  const block = (n: RichTextDoc, indent: string) => {
    if (n.type === 'doc' || n.type === 'blockquote') {
      n.content?.forEach((c) => block(c, indent))
    } else if (isList(n)) {
      n.content?.forEach((item, i) =>
        item.content?.forEach((c, j) => {
          if (isList(c)) block(c, indent + '   ')
          else lines.push(indent + (j === 0 ? bulletFor(n, i) : '   ') + inlineText(c, resolve))
        }),
      )
    } else if (n.type === 'horizontalRule') {
      lines.push('---')
    } else if (n.type === 'image') {
      if (n.attrs?.alt) lines.push(indent + n.attrs.alt)
    } else {
      lines.push(indent + inlineText(n, resolve))
    }
  }
  block(doc, '')
  return lines.join('\n').trim()
}

function escapeMarkdown(text: string) {
  return text.replace(/([\\`*_[\]#<>~])/g, '\\$1')
}

function inlineMarkdown(nodes: RichTextDoc[] | undefined, resolve?: LabelResolver): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === REF_NODE) return `[[${refLabel(n, resolve)}]]`
      if (n.type === 'hardBreak') return '  \n'
      if (n.type !== 'text') return inlineMarkdown(n.content, resolve)
      const marks = n.marks ?? []
      const has = (type: string) => marks.some((m) => m.type === type)
      let text = has('code') ? '`' + (n.text ?? '') + '`' : escapeMarkdown(n.text ?? '')
      if (has('bold')) text = `**${text}**`
      if (has('italic')) text = `*${text}*`
      if (has('underline')) text = `<u>${text}</u>`
      if (has('strike')) text = `~~${text}~~`
      const link = marks.find((m) => m.type === 'link')
      if (link?.attrs?.href) text = `[${text}](${link.attrs.href})`
      return text
    })
    .join('')
}

/** Markdown export (spec 8.6). Links become `[[Name]]`, which Obsidian-style tools understand. */
export function richTextToMarkdown(doc: RichTextDoc, resolve?: LabelResolver): string {
  const render = (n: RichTextDoc, indent: string, quote: string): string[] => {
    const lead = quote + indent
    switch (n.type) {
      case 'doc':
        return (n.content ?? []).flatMap((c) => render(c, indent, quote))
      case 'blockquote':
        return (n.content ?? []).flatMap((c) => render(c, indent, quote + '> '))
      case 'heading':
        return [`${lead}${'#'.repeat(n.attrs?.level ?? 1)} ${inlineMarkdown(n.content, resolve)}`]
      case 'bulletList':
      case 'orderedList': {
        const lines = (n.content ?? []).flatMap((item, i) =>
          (item.content ?? []).flatMap((c, j) =>
            isList(c) ? render(c, indent + '   ', quote) : [lead + (j === 0 ? bulletFor(n, i) : '   ') + inlineMarkdown(c.content, resolve)],
          ),
        )
        return [lines.join('\n')]
      }
      case 'codeBlock':
        return [`${lead}\`\`\`\n${inlineText(n)}\n\`\`\``]
      case 'horizontalRule':
        return [`${lead}---`]
      case 'image':
        return [`${lead}![${escapeMarkdown(n.attrs?.alt ?? '')}](${n.attrs?.src ?? ''})`]
      default:
        return [lead + inlineMarkdown(n.content, resolve)]
    }
  }
  return render(doc, '', '').join('\n\n').trim() + '\n'
}
