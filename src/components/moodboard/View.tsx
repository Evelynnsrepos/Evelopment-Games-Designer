import type { PanelProps } from '@/core/registry'
import { MoodboardBoard } from '@/shared/moodboard'

/** Moodboard (spec 8.7). Intents: `add-image` ({ path, name }) places a picture. */
export default function View(props: PanelProps) {
  return <MoodboardBoard {...props} type="moodboard" label="Moodboard" />
}
