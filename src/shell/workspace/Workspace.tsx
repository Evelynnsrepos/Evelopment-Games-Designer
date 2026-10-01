import { useRef, useState } from 'react'
import type { LayoutNode } from '@/core/model'
import { useAppStore, useProjectStore } from '@/core/state'
import { DRAG_MIME, openComponent, type DragPayload } from '../editor/actions'
import { PanelFrame } from './PanelFrame'
import { setRatio, type NodePath } from './layoutTree'
import './workspace.css'

/** The tiling editor area (spec 7). Renders the layout tree from project meta. */
export function Workspace() {
  const layout = useProjectStore((s) => s.meta?.layout ?? null)
  const layoutMode = useAppStore((s) => s.layoutMode)
  const [emptyDrop, setEmptyDrop] = useState(false)

  if (!layout) {
    return (
      <div
        className={`workspace workspace-empty${emptyDrop ? ' drop-target' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) {
            e.preventDefault()
            setEmptyDrop(true)
          }
        }}
        onDragLeave={() => setEmptyDrop(false)}
        onDrop={(e) => {
          setEmptyDrop(false)
          const raw = e.dataTransfer.getData(DRAG_MIME)
          if (!raw) return
          const p = JSON.parse(raw) as DragPayload
          openComponent(p.type, p.documentId)
        }}
      >
        <div>Click a tool in the sidebar, or drag it here.</div>
      </div>
    )
  }

  return (
    <div
      className={`workspace${layoutMode ? ' layout-mode' : ''}`}
      onMouseDown={(e) => {
        // ED-7: clicking empty space (a divider gap) leaves Layout Mode.
        if (layoutMode && e.target === e.currentTarget) useAppStore.getState().setLayoutMode(false)
      }}
    >
      <Node node={layout} path={[]} />
    </div>
  )
}

function Node({ node, path }: { node: LayoutNode; path: NodePath }) {
  if (node.kind === 'panel') return <PanelFrame panel={node.panel} />
  return (
    <div className={`split split-${node.direction}`}>
      <div className="split-child" style={{ flexBasis: `${node.ratio * 100}%` }}>
        <Node node={node.first} path={[...path, 0]} />
      </div>
      <Divider direction={node.direction} path={path} />
      <div className="split-child" style={{ flexBasis: `${(1 - node.ratio) * 100}%` }}>
        <Node node={node.second} path={[...path, 1]} />
      </div>
    </div>
  )
}

/** Drag to resize a split (ED-9). */
function Divider({ direction, path }: { direction: 'row' | 'column'; path: NodePath }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`divider divider-${direction}`}
      onPointerDown={(e) => {
        const container = ref.current?.parentElement
        if (!container) return
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        const box = container.getBoundingClientRect()
        const onMove = (ev: PointerEvent) => {
          const ratio = direction === 'row' ? (ev.clientX - box.left) / box.width : (ev.clientY - box.top) / box.height
          const { meta, setLayout } = useProjectStore.getState()
          if (meta?.layout) setLayout(setRatio(meta.layout, path, ratio))
        }
        const onUp = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }}
    />
  )
}
