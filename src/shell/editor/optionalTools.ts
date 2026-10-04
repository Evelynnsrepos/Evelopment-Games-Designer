import type { ComponentType } from '@/core/model'
import { useSettings } from '@/core/state'

/** Tools that only show up when turned on in Settings (v0.10): Ask your project. */
export const shownTool = (type: ComponentType, askProject = useSettings.getState().askProject) => type !== 'ask' || askProject
