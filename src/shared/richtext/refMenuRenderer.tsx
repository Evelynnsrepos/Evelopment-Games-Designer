import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { createRoot, type Root } from 'react-dom/client'
import { RefMenu, type RefMenuEntry } from './RefMenu'

/** Suggestion renderer for the `[[` menu: a small React root positioned by the suggestion plugin. */
export function refMenuRenderer() {
  let root: Root | null = null
  let unmount: (() => void) | null = null
  let props: SuggestionProps<RefMenuEntry, RefMenuEntry> | null = null
  let selected = 0

  const pick = (index: number) => {
    const entry = props?.items[index]
    if (entry) props!.command(entry)
  }
  const draw = () => {
    if (root && props) root.render(<RefMenu entries={props.items} query={props.query} selected={selected} onPick={pick} />)
  }

  return {
    onStart(p: SuggestionProps<RefMenuEntry, RefMenuEntry>) {
      props = p
      selected = 0
      const el = document.createElement('div')
      el.className = 'richtext-refmenu-host'
      root = createRoot(el)
      unmount = p.mount(el)
      draw()
    },
    onUpdate(p: SuggestionProps<RefMenuEntry, RefMenuEntry>) {
      props = p
      selected = Math.min(selected, Math.max(0, p.items.length - 1))
      draw()
    },
    onKeyDown({ event }: SuggestionKeyDownProps) {
      // Esc is handled by the suggestion plugin itself, which prevents the default so the shell ignores it (ED-7).
      const count = props?.items.length ?? 0
      if (!count) return false
      if (event.key === 'ArrowDown') selected = (selected + 1) % count
      else if (event.key === 'ArrowUp') selected = (selected + count - 1) % count
      else if (event.key === 'Enter' || event.key === 'Tab') pick(selected)
      else return false
      draw()
      return true
    },
    onExit() {
      const r = root
      root = null
      props = null
      unmount?.()
      unmount = null
      // Unmount after the current render pass; React warns when a root unmounts synchronously during one.
      queueMicrotask(() => r?.unmount())
    },
  }
}
