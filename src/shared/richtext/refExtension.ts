import { InputRule, mergeAttributes, Node } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { MISSING_REF_LABEL, REF_NODE } from './doc'
import type { RefMenuEntry } from './RefMenu'
import { refMenuRenderer } from './refMenuRenderer'
import { findRefByLabel } from './refs'
import type { RefItem, RefProvider, RefTarget } from './types'

export interface RefOptions {
  /** Read lazily so the editor never has to be recreated when entities change. */
  getProvider: () => RefProvider | null
}

export interface RefStorage {
  /** Called by the editor component when names may have changed, so links repaint. */
  repaint: Set<() => void>
}

declare module '@tiptap/core' {
  interface Storage {
    ref: RefStorage
  }
}

const refKey = new PluginKey('richtext-ref-suggestion')

const refContent = (target: RefTarget) => [{ type: REF_NODE, attrs: { kind: target.kind, id: target.id } }, { type: 'text', text: ' ' }]

/** Query typed after `[[`, without any closing brackets the user already typed. */
const cleanQuery = (query: string) => query.replace(/\]+$/, '')

/**
 * Inline `[[` link to an entity, wiki article, or anything a RefProvider offers (WK-4).
 * Stored as `{ type: 'ref', attrs: { kind, id } }`; the name is looked up on every
 * render, so renaming the target updates every link (spec 3.3).
 */
export const RefExtension = Node.create<RefOptions, RefStorage>({
  name: REF_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { getProvider: () => null }
  },

  addStorage() {
    return { repaint: new Set() }
  },

  addAttributes() {
    return {
      kind: { default: null, parseHTML: (el) => el.getAttribute('data-ref-kind'), renderHTML: (a) => ({ 'data-ref-kind': a.kind }) },
      id: { default: null, parseHTML: (el) => el.getAttribute('data-ref-id'), renderHTML: (a) => ({ 'data-ref-id': a.id }) },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-ref-id]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const item = this.options.getProvider()?.resolve(node.attrs as RefTarget)
    return ['span', mergeAttributes({ class: 'richtext-ref' }, HTMLAttributes), item?.label ?? MISSING_REF_LABEL]
  },

  renderText({ node }) {
    return this.options.getProvider()?.resolve(node.attrs as RefTarget)?.label ?? MISSING_REF_LABEL
  },

  addNodeView() {
    const getProvider = this.options.getProvider
    const repaints = this.storage.repaint
    return ({ node: initial }) => {
      let node = initial
      const dom = document.createElement('span')
      dom.className = 'richtext-ref'
      dom.setAttribute('role', 'link')
      const target = () => node.attrs as RefTarget
      const paint = () => {
        const item = getProvider()?.resolve(target())
        dom.textContent = item?.label ?? MISSING_REF_LABEL
        dom.title = item ? `${item.hint ? item.hint + ': ' : ''}${item.label} (click to open)` : 'The linked record was deleted'
        dom.classList.toggle('richtext-ref-missing', !item)
        dom.style.color = item?.color ?? ''
      }
      dom.addEventListener('click', (e) => {
        e.preventDefault()
        if (getProvider()?.resolve(target())) getProvider()?.open?.(target())
      })
      paint()
      repaints.add(paint)
      return {
        dom,
        update(next) {
          if (next.type !== node.type) return false
          node = next
          paint()
          return true
        },
        ignoreMutation: () => true,
        destroy: () => repaints.delete(paint),
      }
    }
  },

  addInputRules() {
    const getProvider = this.options.getProvider
    const type = this.type
    // Typing `[[Ironhold]]` in full turns into a link when a record with that exact name exists.
    return [
      new InputRule({
        find: /\[\[([^[\]\n]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const provider = getProvider()
          const hit = provider && findRefByLabel(provider, match[1])
          if (!hit) return null
          state.tr.replaceWith(range.from, range.to, type.create({ kind: hit.kind, id: hit.id }))
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Backspace right after a link turns it back into `[[Name` so the user can pick another.
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          const { selection } = state
          if (!selection.empty) return false
          const before = selection.$from.nodeBefore
          if (before?.type.name !== REF_NODE) return false
          const label = this.options.getProvider()?.resolve(before.attrs as RefTarget)?.label ?? ''
          tr.insertText(`[[${label}`, selection.from - before.nodeSize, selection.from)
          return true
        }),
    }
  },

  addProseMirrorPlugins() {
    const getProvider = this.options.getProvider
    return [
      Suggestion<RefMenuEntry, RefMenuEntry>({
        editor: this.editor,
        pluginKey: refKey,
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        items: ({ query }) => {
          const provider = getProvider()
          if (!provider) return []
          const q = cleanQuery(query).trim()
          const entries: RefMenuEntry[] = provider.search(q).map((item) => ({ type: 'ref', item }))
          const exact = entries.some((e) => e.type === 'ref' && e.item.label.toLowerCase() === q.toLowerCase())
          if (provider.create && q && !exact) {
            entries.push({ type: 'create', label: q, text: provider.createLabel?.(q) ?? `Create "${q}"` })
          }
          return entries
        },
        command: ({ editor, range, props: entry }) => {
          const insert = (item: RefItem | null | undefined) => {
            if (item) editor.chain().focus().insertContentAt(range, refContent(item)).run()
          }
          if (entry.type === 'ref') return insert(entry.item)
          void Promise.resolve(getProvider()?.create?.(entry.label)).then(insert)
        },
        render: refMenuRenderer,
      }),
    ]
  },
})
