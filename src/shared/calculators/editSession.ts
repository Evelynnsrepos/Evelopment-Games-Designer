import { useRef } from 'react'
import type { UseDocumentResult } from '@/core/state'

/**
 * Typing into a field changes the document live (so results update as you type, CA-2) but undoes as one step.
 * Call `begin` on focus, `change` on every keystroke and `end` on blur.
 */
export function useEditSession<T>(doc: Pick<UseDocumentResult<T>, 'data' | 'update'>) {
  const start = useRef<T | undefined>(undefined)
  return {
    begin() {
      start.current = doc.data
    },
    change(recipe: (current: T) => T) {
      doc.update(recipe, { undoable: start.current === undefined })
    },
    end() {
      const before = start.current
      start.current = undefined
      if (before === undefined) return
      let after: T | undefined
      doc.update(
        (cur) => {
          after = cur
          return before
        },
        { undoable: false },
      )
      if (after !== undefined && after !== before) doc.update(() => after!)
    },
  }
}
