import { X } from 'lucide-react'
import { useEffect } from 'react'
import { SPELL_LANGUAGES, useSettings } from '@/core/state'
import { confirmDialog } from '@/shared/dialogs'
import { AI_DOWNLOAD_SIZE, spellAvailable, useAiHelper } from '@/shared/spell'
import { Modal } from '@/shared/ui'
import { PluginsSection } from '../plugins/PluginsSection'
import './settings.css'

import { useSettingsDialog } from './open'

const UI = {
  title: 'Settings',
  spell: 'Spell check',
  spellOn: 'Underline misspelled words',
  spellDesktopOnly: 'Spell check works in the desktop app.',
  languages: 'Languages',
  words: 'My dictionary',
  wordsHint: 'Words you added with "Add to dictionary". Names of your items, characters, towns and enemies are always known.',
  noWords: 'No words yet.',
  ai: 'AI helper',
  aiAbout: `A small AI model that runs on this computer and checks your grammar and spelling as you write, like Grammarly. Its suggestions get a blue underline; right-click to fix. Nothing is sent to the internet. Download size: ${AI_DOWNLOAD_SIZE}.`,
  aiDownload: 'Download AI helper',
  aiRemove: 'Remove AI helper',
  aiRemoveAsk: 'Delete the downloaded AI helper from this computer?',
  aiUse: 'Check grammar with the AI helper',
  aiProgram: 'Downloading program',
  aiModel: 'Downloading model',
  close: 'Close',
}

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`

/** App settings (v0.4): spell check and the optional AI helper. */
export function SettingsHost() {
  const open = useSettingsDialog((s) => s.open)
  return open ? <SettingsDialog onClose={() => useSettingsDialog.setState({ open: false })} /> : null
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings()
  const ai = useAiHelper()
  const desktop = spellAvailable()

  useEffect(() => {
    void useAiHelper.getState().check()
  }, [])

  const toggleLang = (id: string, on: boolean) =>
    s.update({ spellLanguages: on ? [...s.spellLanguages, id] : s.spellLanguages.filter((l) => l !== id) })

  const removeAi = async () => {
    if (await confirmDialog({ title: UI.aiRemove, message: UI.aiRemoveAsk, confirmLabel: 'Remove', danger: true })) await ai.remove()
  }

  return (
    <Modal onClose={onClose}>
      <div className="settings">
        <header className="settings-header">
          <h2>{UI.title}</h2>
          <button className="icon-btn" title={UI.close} onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <section>
          <h3>{UI.spell}</h3>
          {!desktop && <p className="muted">{UI.spellDesktopOnly}</p>}
          <label className="settings-check">
            <input type="checkbox" checked={s.spellCheck} onChange={(e) => s.update({ spellCheck: e.target.checked })} />
            {UI.spellOn}
          </label>
          <div className="settings-row">
            <span className="muted">{UI.languages}</span>
            {SPELL_LANGUAGES.map((l) => (
              <label key={l.id} className="settings-check">
                <input type="checkbox" checked={s.spellLanguages.includes(l.id)} onChange={(e) => toggleLang(l.id, e.target.checked)} />
                {l.name}
              </label>
            ))}
          </div>
          <h4>{UI.words}</h4>
          <p className="muted settings-hint">{UI.wordsHint}</p>
          <div className="settings-words">
            {s.personalWords.length === 0 && <span className="muted">{UI.noWords}</span>}
            {s.personalWords.map((w) => (
              <span key={w} className="settings-word">
                {w}
                <button title={`Remove ${w}`} onClick={() => s.update({ personalWords: s.personalWords.filter((x) => x !== w) })}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </section>

        {desktop && (
          <section>
            <h3>{UI.ai}</h3>
            <p className="muted settings-hint">{UI.aiAbout}</p>
            {ai.installed && (
              <label className="settings-check">
                <input type="checkbox" checked={s.aiHelper} onChange={(e) => s.update({ aiHelper: e.target.checked })} />
                {UI.aiUse}
              </label>
            )}
            {ai.progress ? (
              <div className="settings-progress">
                <span>
                  {ai.progress.stage === 'program' ? UI.aiProgram : UI.aiModel}… {mb(ai.progress.done)}
                  {ai.progress.total > 0 && ` / ${mb(ai.progress.total)}`}
                </span>
                <progress value={ai.progress.done} max={ai.progress.total || undefined} />
              </div>
            ) : ai.installed ? (
              <button className="btn" onClick={() => void removeAi()}>
                {UI.aiRemove}
              </button>
            ) : (
              ai.installed === false && (
                <button className="btn btn-primary" onClick={() => void ai.install()}>
                  {UI.aiDownload}
                </button>
              )
            )}
            {ai.error && <p className="settings-error">{ai.error}</p>}
          </section>
        )}
        {desktop && <PluginsSection />}
      </div>
    </Modal>
  )
}
