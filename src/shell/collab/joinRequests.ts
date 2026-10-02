import { useEffect } from 'react'
import { setJoinRequestHandler } from '@/core/collab'
import { useProjectStore } from '@/core/state'
import { confirmDialog } from '@/shared/dialogs'

/** Installs the "let them in?" question for the project owner. */
export function useJoinRequests() {
  useEffect(() => {
    setJoinRequestHandler(({ name }) => {
      const project = useProjectStore.getState().meta?.name ?? 'this project'
      return confirmDialog({
        title: `Let ${name} join?`,
        message: `${name} wants to join "${project}". They will get a copy and can see and change everything in it.`,
        confirmLabel: 'Let them in',
      })
    })
  }, [])
}
