import { Channel, invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { isTauri } from '@/core/fs'

/** Optional local AI helper (src-tauri/src/llm.rs): downloaded from Settings, never bundled. */
export const AI_DOWNLOAD_SIZE = '1.1 GB'

export interface AiProgress {
  stage: 'program' | 'model'
  done: number
  total: number
}

interface AiState {
  /** null until checked. */
  installed: boolean | null
  progress: AiProgress | null
  error: string | null
  check(): Promise<void>
  install(): Promise<void>
  remove(): Promise<void>
}

export const useAiHelper = create<AiState>()((set, get) => ({
  installed: null,
  progress: null,
  error: null,
  async check() {
    set({ installed: isTauri() ? await invoke<boolean>('llm_status') : false })
  },
  async install() {
    if (get().progress) return
    const channel = new Channel<AiProgress>()
    channel.onmessage = (progress) => set({ progress })
    set({ error: null, progress: { stage: 'program', done: 0, total: 0 } })
    try {
      await invoke('llm_install', { progress: channel })
      set({ installed: true })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ progress: null })
    }
  },
  async remove() {
    await invoke('llm_remove')
    set({ installed: false })
  },
}))

/** Best words for `word` in `context`; `candidates` are the dictionary's suggestions for the model to choose from. */
export function aiSuggest(word: string, context: string, candidates: string[]): Promise<string[]> {
  return invoke<string[]>('llm_suggest', { word, context, candidates })
}
