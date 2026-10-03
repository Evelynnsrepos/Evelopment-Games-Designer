import { useEffect, useState } from 'react'
import { useSettings } from '@/core/state'
import { ignoreFix } from './proof'
import { suggest } from './spell'

/** A right-click on underlined text: a misspelled word, an AI suggestion, or both. Positions are the caller's own. */
export interface ProofHit {
  x: number
  y: number
  spell?: { from: number; to: number; word: string }
  ai?: { from: number; to: number; bad: string; fix: string }
}

const UI = {
  loading: 'Looking for suggestions…',
  none: 'No suggestions',
  add: 'Add to dictionary',
  aiPicks: 'AI helper suggests',
  ignore: 'Ignore',
}

/** Right-click menu on underlined text: the AI fix, dictionary suggestions and "Add to dictionary". */
export function SpellMenu({ hit, replace, onClose }: { hit: ProofHit; replace: (from: number, to: number, text: string) => void; onClose: () => void }) {
  const [options, setOptions] = useState<string[] | null>(hit.spell ? null : [])
  const { spell, ai } = hit

  useEffect(() => {
    let live = true
    if (spell) void suggest(spell.word).then((s) => live && setOptions(s))
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
  }, [spell, onClose])

  const pick = (from: number, to: number, text: string) => {
    replace(from, to, text)
    onClose()
  }

  return (
    <div className="menu spell-menu" style={{ position: 'fixed', left: hit.x, top: hit.y }} role="menu">
      {ai && (
        <>
          <div className="spell-menu-note">{UI.aiPicks}</div>
          <button role="menuitem" className="spell-menu-suggestion" onClick={() => pick(ai.from, ai.to, ai.fix)}>
            <s className="spell-menu-bad">{ai.bad}</s> {ai.fix}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              ignoreFix(ai.bad, ai.fix)
              onClose()
            }}
          >
            {UI.ignore}
          </button>
        </>
      )}
      {ai && spell && <hr className="spell-menu-sep" />}
      {spell && (
        <>
          {options === null && <div className="spell-menu-note">{UI.loading}</div>}
          {options?.length === 0 && <div className="spell-menu-note">{UI.none}</div>}
          {options?.map((o) => (
            <button key={o} role="menuitem" className="spell-menu-suggestion" onClick={() => pick(spell.from, spell.to, o)}>
              {o}
            </button>
          ))}
          <hr className="spell-menu-sep" />
          <button
            role="menuitem"
            onClick={() => {
              useSettings.getState().addWord(spell.word)
              onClose()
            }}
          >
            {UI.add}
          </button>
        </>
      )}
    </div>
  )
}
