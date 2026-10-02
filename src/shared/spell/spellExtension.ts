import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useSettings } from '@/core/state'
import { findMisspelled, spellAvailable, tokenize, type WordRange } from './spell'

export interface MisspellingHit extends WordRange {
  x: number
  y: number
}

interface SpellOptions {
  /** Right-click on an underlined word. */
  onMisspelling: (hit: MisspellingHit) => void
}

const key = new PluginKey<DecorationSet>('spell')
const DELAY_MS = 400

/** Every word in the document with document positions. Code and link chips are skipped. */
function docWords(doc: PMNode): WordRange[] {
  const out: WordRange[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (node.marks.some((m) => m.type.name === 'code' || m.type.name === 'link')) return
    for (const w of tokenize(node.text)) out.push({ word: w.word, from: pos + w.from, to: pos + w.to })
  })
  return out
}

/** Underlines misspelled words (wavy red) and reports right-clicks on them. */
export const SpellCheck = Extension.create<SpellOptions>({
  name: 'spellCheck',
  addOptions: () => ({ onMisspelling: () => {} }),

  addProseMirrorPlugins() {
    const options = this.options
    let timer: ReturnType<typeof setTimeout> | undefined
    let run = 0

    const recheck = (view: EditorView) => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        const mine = ++run
        const doc = view.state.doc
        const words = docWords(doc)
        const bad = useSettings.getState().spellCheck
          ? await findMisspelled(words.map((w) => w.word)).catch(() => new Set<string>())
          : new Set<string>()
        // ponytail: whole-document rescan per pause; check only changed paragraphs if long chapters lag.
        if (mine !== run || view.isDestroyed || view.state.doc !== doc) return
        const decos = words.filter((w) => bad.has(w.word)).map((w) => Decoration.inline(w.from, w.to, { class: 'spell-error' }, w))
        view.dispatch(view.state.tr.setMeta(key, DecorationSet.create(view.state.doc, decos)))
      }, DELAY_MS)
    }

    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => tr.getMeta(key) ?? set.map(tr.mapping, tr.doc),
        },
        props: {
          decorations: (state) => key.getState(state),
          attributes: (): Record<string, string> => (spellAvailable() ? { spellcheck: 'false' } : {}),
          handleDOMEvents: {
            contextmenu: (view, event) => {
              const at = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!at) return false
              const [hit] = key.getState(view.state)?.find(at.pos, at.pos) ?? []
              if (!hit) return false
              event.preventDefault()
              const w = hit.spec as WordRange
              options.onMisspelling({ word: w.word, from: hit.from, to: hit.to, x: event.clientX, y: event.clientY })
              return true
            },
          },
        },
        view: (view) => {
          recheck(view)
          // New personal words or languages: check again.
          const unsubscribe = useSettings.subscribe(() => recheck(view))
          return {
            update: (v, prev) => {
              if (!v.state.doc.eq(prev.doc)) recheck(v)
            },
            destroy: () => {
              clearTimeout(timer)
              unsubscribe()
            },
          }
        },
      }),
    ]
  },
})
