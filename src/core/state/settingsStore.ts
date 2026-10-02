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
  /** Pen tool on every canvas: line width in pixels and stabilizer strength 0..1. */
  penSize: number
  penSmoothing: number
  /** 0.1..1 */
  penOpacity: number
}

const defaults = (): AppSettings => ({ spellCheck: true, spellLanguages: ['en', 'de'], personalWords: [], aiHelper: true, penSize: 3, penSmoothing: 0.5, penOpacity: 1 })

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

let saveTimer: ReturnType<typeof setTimeout> | undefined

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
    // Sliders call this many times a second; write once they settle.
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { spellCheck, spellLanguages, personalWords, aiHelper, penSize, penSmoothing, penOpacity } = get()
      void settingsPath().then((p) => writeVersioned(p, { spellCheck, spellLanguages, personalWords, aiHelper, penSize, penSmoothing, penOpacity }))
    }, 400)
  },
  addWord(word) {
    const words = get().personalWords
    if (!words.some((w) => w.toLowerCase() === word.toLowerCase())) get().update({ personalWords: [...words, word].sort() })
  },
}))
