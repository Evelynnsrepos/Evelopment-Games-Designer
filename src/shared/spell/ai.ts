import { Channel, invoke } from '@tauri-apps/api/core'
import { create } from 'zustand'
import { isTauri } from '@/core/fs'
import { useSettings, type AppSettings } from '@/core/state'

type ModelId = AppSettings['aiModel']

/** Optional local AI models (src-tauri/src/llm.rs MODELS): downloaded from Settings, never bundled. */
export const AI_MODELS: { id: ModelId; name: string; size: string; about: string }[] = [
  { id: 'small', name: 'Small', size: '1.1 GB', about: 'Fast, catches the common mistakes.' },
  { id: 'better', name: 'Better', size: '2.5 GB', about: 'Catches more and gives better options. About 2 to 3 times slower.' },
  { id: 'best', name: 'Best', size: '4.7 GB', about: 'The most careful checks and options. Needs about 6 GB of free memory and is slower again.' },
]

export interface AiProgress {
  stage: 'program' | 'model'
  done: number
  total: number
}

interface AiState {
  /** Whether the chosen model (settings `aiModel`) is downloaded; null until checked. */
  installed: boolean | null
  /** Which models are downloaded. */
  models: Record<ModelId, boolean>
  /** The model being downloaded. */
  downloading: ModelId | null
  progress: AiProgress | null
  error: string | null
  check(): Promise<void>
  install(model: ModelId): Promise<void>
  remove(): Promise<void>
}

export const useAiHelper = create<AiState>()((set, get) => ({
  installed: null,
  models: { small: false, better: false, best: false },
  downloading: null,
  progress: null,
  error: null,
  async check() {
    if (!isTauri()) return set({ installed: false })
    const [small, better, best] = await Promise.all(AI_MODELS.map((m) => invoke<boolean>('llm_status', { model: m.id })))
    const models = { small, better, best }
    set({ models, installed: models[useSettings.getState().aiModel] })
  },
  async install(model) {
    if (get().progress) return
    const channel = new Channel<AiProgress>()
    channel.onmessage = (progress) => set({ progress })
    set({ error: null, downloading: model, progress: { stage: 'program', done: 0, total: 0 } })
    try {
      await invoke('llm_install', { model, progress: channel })
      useSettings.getState().update({ aiModel: model })
      await get().check()
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ progress: null, downloading: null })
    }
  },
  async remove() {
    await invoke('llm_remove')
    set({ installed: false, models: { small: false, better: false, best: false } })
  },
}))

// Picking another model in Settings: is that one downloaded?
useSettings.subscribe((s, prev) => {
  if (s.aiModel !== prev.aiModel) useAiHelper.setState({ installed: useAiHelper.getState().models[s.aiModel] })
})
