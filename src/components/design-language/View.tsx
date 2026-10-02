import type { PanelProps } from '@/core/registry'
import { MoodboardBoard } from '@/shared/moodboard'

/**
 * Design Language (v0.5): the same board as the Moodboard (images, cutouts,
 * drawings as stickers), used to pin down the look of the game.
 * Intents: `add-image` ({ path, name }) places a picture.
 */
export default function View(props: PanelProps) {
  return <MoodboardBoard {...props} type="design-language" label="Design language" />
}
