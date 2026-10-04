import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from 'lucide-react'
import { Component, Suspense, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import type { Panel } from '@/core/model'
import { getManifest } from '@/core/registry'
import { PanelContext, useAppStore, useProjectStore } from '@/core/state'
import { ReviewButton } from '@/shared/reviews'
import { closePanel, DRAG_MIME, movePanel, openComponent, type DragPayload } from '../editor/actions'
import { dropPanel, neighbor, sideFromPoint, zoneFromPoint, type Direction, type DropSide } from './layoutTree'

/** A panel being dragged in Layout Mode, and where it would land. */
const useLayoutDrag = create<{ from: string | null; over: string | null; zone: DropSide | 'center' | null }>(() => ({ from: null, over: null, zone: null }))

/** Hold and drag a panel in Layout Mode (Esc) to move it, like moving windows in a tiling window manager. */
function startLayoutDrag(e: React.PointerEvent<HTMLElement>, panelId: string) {
  if (e.button !== 0 || e.target !== e.currentTarget) return
  e.preventDefault()
  const at = (ev: PointerEvent) => {
    const el = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x instanceof HTMLElement && x.dataset.panelId)
    if (!(el instanceof HTMLElement)) return { over: null, zone: null }
    const box = el.getBoundingClientRect()
    return { over: el.dataset.panelId ?? null, zone: zoneFromPoint((ev.clientX - box.left) / box.width, (ev.clientY - box.top) / box.height) }
  }
  useLayoutDrag.setState({ from: panelId, over: null, zone: null })
  const onMove = (ev: PointerEvent) => {
    const hit = at(ev)
    useLayoutDrag.setState(hit.over === panelId ? { over: null, zone: null } : hit)
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

/** One tile: slim "fake" window header (ED-4), the component view, drop zones and Layout Mode overlay. */
export function PanelFrame({ panel }: { panel: Panel }) {
  const manifest = getManifest(panel.type)
  const docTitle = useProjectStore((s) => s.meta?.documents.find((d) => d.id === panel.documentId)?.title)
  const layout = useProjectStore((s) => s.meta?.layout ?? null)
  const layoutMode = useAppStore((s) => s.layoutMode)
  const active = useAppStore((s) => s.activePanelId === panel.id)
  const [drop, setDrop] = useState<DropSide | null>(null)
  const dragging = useLayoutDrag((s) => s.from === panel.id)
  const layoutDrop = useLayoutDrag((s) => (s.over === panel.id ? s.zone : null))

  const View = manifest?.View
  const title = manifest ? (docTitle ? `${manifest.name} · ${docTitle}` : manifest.name) : panel.type

  return (
    <section
      className={`panel${active ? ' active' : ''}${dragging ? ' layout-dragging' : ''}`}
      data-panel-id={panel.id}
      tabIndex={-1}
      onFocusCapture={() => useAppStore.getState().setActivePanel(panel.id)}
      onMouseDownCapture={() => useAppStore.getState().setActivePanel(panel.id)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return
        e.preventDefault()
        setDrop(dropSide(e))
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null)
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(DRAG_MIME)
        setDrop(null)
        if (!raw) return
        e.preventDefault()
        const p = JSON.parse(raw) as DragPayload
        openComponent(p.type, p.documentId, { targetId: panel.id, side: dropSide(e) })
      }}
    >
      <header className="panel-header">
        {manifest && <manifest.icon size={13} />}
        <span className="panel-title">{title}</span>
        {manifest && panel.type !== 'reviews' && <ReviewButton target={{ kind: 'doc', type: panel.type, id: panel.documentId }} title={title} />}
      </header>
      <div className="panel-body">
        <PanelErrorBoundary name={title}>
          <Suspense fallback={<div className="panel-loading">Loading…</div>}>
            <PanelContext.Provider value={panel}>
              {View ? <View panel={panel} documentId={panel.documentId} active={active} /> : <div className="panel-loading">Unknown component</div>}
            </PanelContext.Provider>
          </Suspense>
        </PanelErrorBoundary>
      </div>

      {(drop ?? layoutDrop) && <div className={`drop-zone drop-${drop ?? layoutDrop}`} />}

      {layoutMode && (
        <div className="layout-overlay" title="Drag to move this tool" onPointerDown={(e) => startLayoutDrag(e, panel.id)}>
          <button className="layout-close" title="Close" onClick={() => void closePanel(panel.id)}>
            <X size={64} strokeWidth={1.5} />
          </button>
          {(['up', 'down', 'left', 'right'] as Direction[]).map((dir) =>
            neighbor(layout, panel.id, dir) ? (
              <button key={dir} className={`layout-arrow arrow-${dir}`} title={`Move ${dir}`} onClick={() => movePanel(panel.id, dir)}>
                {dir === 'up' ? <ArrowUp /> : dir === 'down' ? <ArrowDown /> : dir === 'left' ? <ArrowLeft /> : <ArrowRight />}
              </button>
            ) : null,
          )}
          <div className="layout-name">{title}</div>
        </div>
      )}
    </section>
  )
}

/** Which half of the panel the pointer is over (ED-3). */
function dropSide(e: React.DragEvent<HTMLElement>): DropSide {
  const box = e.currentTarget.getBoundingClientRect()
  return sideFromPoint((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height)
}

/** A crashing component must not take down the whole editor. */
class PanelErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="panel-loading">
          {this.props.name} crashed: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
