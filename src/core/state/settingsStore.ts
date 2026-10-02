import { create } from 'zustand'
import { getFs } from '../fs'
import { readVersioned, writeVersioned } from '../project'

/** Spell check languages that ship with the app (src-tauri/dictionaries). */
export const SPELL_LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'de', name: 'German' },
] as const

/** App-wide settings for this computer (not part of any project), in the app data folder. */
export interface AppSettings {
  spellCheck: boolean
  spellLanguages: string[]
  /** "Add to dictionary" words, e.g. made-up names. Compared case-insensitively. */
  personalWords: string[]
  /** Use the downloaded AI helper for suggestions when it is installed. */
  aiHelper: boolean
}

const defaults = (): AppSettings => ({ spellCheck: true, spellLanguages: ['en', 'de'], personalWords: [], aiHelper: true })

async function settingsPath() {
  const fs = getFs()
  return fs.join(await fs.appDataDir(), 'settings.json')
}

interface SettingsState extends AppSettings {
  loaded: boolean
  load(): Promise<void>
  update(patch: Partial<AppSettings>): void
  addWord(word: string): void
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...defaults(),
  loaded: false,
  async load() {
    if (get().loaded) return
    const saved = await readVersioned<Partial<AppSettings>>(await settingsPath(), defaults).catch(defaults)
    set({ ...defaults(), ...saved, loaded: true })
  },
  update(patch) {
    set(patch)
    const { spellCheck, spellLanguages, personalWords, aiHelper } = get()
    void settingsPath().then((p) => writeVersioned(p, { spellCheck, spellLanguages, personalWords, aiHelper }))
  },
  addWord(word) {
    const words = get().personalWords
    if (!words.some((w) => w.toLowerCase() === word.toLowerCase())) get().update({ personalWords: [...words, word].sort() })
  },
}))
