import { MessageSquarePlus } from 'lucide-react'
import { create } from 'zustand'
import { newId, type ComponentType, type Id } from '@/core/model'
import { addNodes, type CanvasTool, type CommentPinNode } from '@/shared/canvas'
import type { ReviewTarget } from './reviews'

/** The pin whose comments are open, if any. */
export const usePinThread = create<{ target: ReviewTarget | null }>()(() => ({ target: null }))

/**
 * Comment tool for canvases (v0.7): click to drop a pin and start a comment
 * thread, click a pin to open its thread. Pins show up on the Reviews board.
 */
export function commentTool(type: ComponentType, doc: Id | null): CanvasTool<any> {
  return {
    id: 'comment',
    label: 'Comment',
    icon: MessageSquarePlus,
    cursor: 'crosshair',
    pointerDown(e, api) {
      if (e.button !== 0) return
      const hit = e.targetId ? api.scene.nodes.find((n) => n.id === e.targetId) : undefined
      if (hit?.kind === 'comment-pin') {
        usePinThread.setState({ target: { kind: 'pin', type, doc, id: hit.id } })
        return
      }
      const pin: CommentPinNode = { id: newId(), kind: 'comment-pin', layerId: api.activeLayerId, x: e.world.x, y: e.world.y }
      api.update((scene) => addNodes(scene, [pin]))
      usePinThread.setState({ target: { kind: 'pin', type, doc, id: pin.id } })
    },
  }
}
