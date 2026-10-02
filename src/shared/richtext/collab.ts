import { Extension, getSchema, type AnyExtension, type JSONContent } from '@tiptap/core'
import { Collaboration } from '@tiptap/extension-collaboration'
import { prosemirrorJSONToYXmlFragment, yCursorPlugin } from '@tiptap/y-tiptap'
import type { Awareness } from 'y-protocols/awareness'
import type { XmlFragment } from 'yjs'
import { sharedRichText } from '@/core/collab'

/**
 * Live typing in shared projects: the text lives in a Yjs fragment that every
 * device edits character by character, and teammates' carets are shown.
 */
export interface LiveText {
  fragment: XmlFragment
  awareness: Awareness
}

/** The live text for a shared field, filled from `content` the first time. Null when not shared. */
export function openLiveText(name: string, content: JSONContent, extensions: AnyExtension[]): LiveText | null {
  const seedKey = JSON.stringify(content)
  return sharedRichText(name, seedKey, (fragment) => prosemirrorJSONToYXmlFragment(getSchema(extensions), content, fragment))
}

interface CaretUser {
  name?: string
  color?: string
}

const CaretExtension = Extension.create<{ awareness: Awareness | null }>({
  name: 'liveCarets',
  addOptions: () => ({ awareness: null }),
  addProseMirrorPlugins() {
    const awareness = this.options.awareness
    if (!awareness) return []
    return [
      yCursorPlugin(awareness, {
        cursorBuilder: (user: CaretUser) => {
          const caret = document.createElement('span')
          caret.className = 'richtext-caret'
          caret.style.borderColor = user.color || 'var(--accent)'
          const label = document.createElement('span')
          label.className = 'richtext-caret-label'
          label.style.background = user.color || 'var(--accent)'
          label.textContent = user.name || 'Someone'
          caret.append(label)
          return caret
        },
        selectionBuilder: (user: CaretUser) => ({
          class: 'richtext-remote-selection',
          style: `background-color: ${user.color || '#888'}33`,
        }),
      }),
    ]
  },
})

/** Extensions added in shared mode (the base set must have its own undo turned off). */
export function liveTextExtensions(live: LiveText): AnyExtension[] {
  return [Collaboration.configure({ fragment: live.fragment }), CaretExtension.configure({ awareness: live.awareness })]
}
