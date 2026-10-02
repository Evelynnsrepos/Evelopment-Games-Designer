import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { useSettings } from '@/core/state'
import { aiSuggest, useAiHelper } from './ai'
import { suggest } from './spell'
import type { MisspellingHit } from './spellExtension'

const UI = {
  loading: 'Looking for suggestions…',
  none: 'No suggestions',
  add: 'Add to dictionary',
  ai: 'Ask the AI helper',
  aiThinking: 'AI helper is thinking…',
  aiFailed: 'The AI helper could not answer.',
}

/** Right-click menu on a misspelled word: suggestions and "Add to dictionary". */
export function SpellMenu({ editor, hit, onClose }: { editor: Editor; hit: MisspellingHit; onClose: () => void }) {
  const [options, setOptions] = useState<string[] | null>(null)
  const [ai, setAi] = useState<'idle' | 'busy' | 'failed' | string[]>('idle')
  const aiOn = useSettings((s) => s.aiHelper)
  const aiInstalled = useAiHelper((s) => s.installed)
  const aiReady = aiOn && aiInstalled

  const askAi = async () => {
    setAi('busy')
    const context = editor.state.doc.resolve(hit.from).parent.textContent.slice(0, 600)
    const found = await aiSuggest(hit.word, context).catch(() => null)
    setAi(found ? found.filter((f) => !options?.includes(f)) : 'failed')
  }

  useEffect(() => {
    let live = true
    void suggest(hit.word).then((s) => live && setOptions(s))
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as Element).closest?.('.spell-menu')) onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => {
      live = false
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
    }
  }, [hit, onClose])

  const replace = (text: string) => {
    editor.chain().focus().insertContentAt({ from: hit.from, to: hit.to }, text).run()
    onClose()
  }

  return (
    <div className="menu spell-menu" style={{ position: 'fixed', left: hit.x, top: hit.y }} role="menu">
      {options === null && <div className="spell-menu-note">{UI.loading}</div>}
      {options?.length === 0 && <div className="spell-menu-note">{UI.none}</div>}
      {options?.map((o) => (
        <button key={o} role="menuitem" className="spell-menu-suggestion" onClick={() => replace(o)}>
          {o}
        </button>
      ))}
      {aiReady && ai === 'idle' && (
        <button role="menuitem" onClick={() => void askAi()}>
          {UI.ai}
        </button>
      )}
      {ai === 'busy' && <div className="spell-menu-note">{UI.aiThinking}</div>}
      {ai === 'failed' && <div className="spell-menu-note">{UI.aiFailed}</div>}
      {Array.isArray(ai) &&
        ai.map((o) => (
          <button key={`ai-${o}`} role="menuitem" className="spell-menu-suggestion" onClick={() => replace(o)}>
            {o}
          </button>
        ))}
      <hr className="spell-menu-sep" />
      <button
        role="menuitem"
        onClick={() => {
          useSettings.getState().addWord(hit.word)
          onClose()
        }}
      >
        {UI.add}
      </button>
    </div>
  )
}
