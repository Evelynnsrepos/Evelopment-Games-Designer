import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { useSettings } from '@/core/state'
import { useAiHelper } from './ai'
import { findIssues, onAiResult, type Issue } from './proof'
import { spellAvailable } from './spell'
import type { ProofHit } from './SpellMenu'

interface SpellOptions {
  /** Right-click on underlined text; positions are document positions. */
  onMisspelling: (hit: ProofHit) => void
}

const key = new PluginKey<DecorationSet>('spell')
const DELAY_MS = 400

interface Paragraph {
  text: string
  /** Document position of each character. */
  pos: number[]
  /** Characters inside code, links or `[[` chips: never underlined. */
  skip: boolean[]
}

/** The text of every paragraph and heading, with document positions. */
function docParagraphs(doc: PMNode): Paragraph[] {
  const out: Paragraph[] = []
  doc.descendants((block, start) => {
    if (!block.isTextblock) return true
    const p: Paragraph = { text: '', pos: [], skip: [] }
    block.forEach((node, offset) => {
      const at = start + 1 + offset
      const text = node.isText ? node.text! : ' '
      const skip = !node.isText || node.marks.some((m) => m.type.name === 'code' || m.type.name === 'link')
      for (let i = 0; i < text.length; i++) {
        p.pos.push(at + (node.isText ? i : 0))
        p.skip.push(skip)
      }
      p.text += text
    })
    out.push(p)
    return false
  })
  return out
}

const spec = (p: Paragraph, issue: Issue) => ({ ...issue, bad: p.text.slice(issue.from, issue.to) })

/** Underlines misspelled words (wavy red) and AI grammar suggestions (wavy blue), and reports right-clicks on them. */
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
        const paragraphs = docParagraphs(doc)
        // ponytail: whole-document rescan per pause; check only changed paragraphs if long chapters lag.
        const issues = await findIssues(paragraphs.map((p) => p.text))
        if (mine !== run || view.isDestroyed || view.state.doc !== doc) return
        const decos = paragraphs.flatMap((p, i) =>
          issues[i]
            .filter((x) => !p.skip.slice(x.from, x.to).some(Boolean))
            .map((x) => Decoration.inline(p.pos[x.from], p.pos[x.to - 1] + 1, { class: x.fix === undefined ? 'spell-error' : 'grammar-error' }, spec(p, x))),
        )
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
              const found = key.getState(view.state)?.find(at.pos, at.pos) ?? []
              if (!found.length) return false
              event.preventDefault()
              const hit: ProofHit = { x: event.clientX, y: event.clientY }
              for (const d of found) {
                const s = d.spec as Issue & { bad: string }
                if (s.fix !== undefined) hit.ai = { from: d.from, to: d.to, bad: s.bad, fix: s.fix }
                else hit.spell = { from: d.from, to: d.to, word: s.word! }
              }
              options.onMisspelling(hit)
              return true
            },
          },
        },
        view: (view) => {
          recheck(view)
          // New personal words, languages, AI results or the AI helper finishing its download: check again.
          const offSettings = useSettings.subscribe(() => recheck(view))
          const offHelper = useAiHelper.subscribe((s, prev) => s.installed !== prev.installed && recheck(view))
          const offAi = onAiResult(() => recheck(view))
          return {
            update: (v, prev) => {
              if (!v.state.doc.eq(prev.doc)) recheck(v)
            },
            destroy: () => {
              clearTimeout(timer)
              offSettings()
              offHelper()
              offAi()
            },
          }
        },
      }),
    ]
  },
})
