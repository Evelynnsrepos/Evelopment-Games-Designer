import { create } from 'zustand'
import { useProjectStore } from '@/core/state'
import { dropPanel, zoneFromPoint, type DropSide } from './layoutTree'

/** A panel being dragged in Layout Mode, and where it would land. */
export const useLayoutDrag = create<{ from: string | null; over: string | null; zone: DropSide | 'center' | null; x: number; y: number }>(() => ({
  from: null,
  over: null,
  zone: null,
  x: 0,
  y: 0,
}))

/** Hold and drag a panel in Layout Mode (Esc) to move it, like moving windows in a tiling window manager. */
export function startLayoutDrag(e: React.PointerEvent<HTMLElement>, panelId: string) {
  if (e.button !== 0 || e.target !== e.currentTarget) return
  e.preventDefault()
  const at = (ev: PointerEvent) => {
    const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x instanceof HTMLElement && x.dataset.panelId)
    if (!(el instanceof HTMLElement)) return { over: null, zone: null }
    const box = el.getBoundingClientRect()
    return { over: el.dataset.panelId ?? null, zone: zoneFromPoint((ev.clientX - box.left) / box.width, (ev.clientY - box.top) / box.height) }
  }
  useLayoutDrag.setState({ from: panelId, over: null, zone: null, x: e.clientX, y: e.clientY })
  const onMove = (ev: PointerEvent) => {
    const hit = at(ev)
    useLayoutDrag.setState({ ...(hit.over === panelId ? { over: null, zone: null } : hit), x: ev.clientX, y: ev.clientY })
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    const { over, zone } = useLayoutDrag.getState()
    useLayoutDrag.setState({ from: null, over: null, zone: null })
    const { meta, setLayout } = useProjectStore.getState()
    if (meta?.layout && over && zone) setLayout(dropPanel(meta.layout, panelId, over, zone))
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
