import { Redo2, Scan, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CanvasTool } from './types'

export const TOOLBAR_LABELS = {
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  zoomIn: 'Zoom in (+)',
  zoomOut: 'Zoom out (-)',
  zoomReset: 'Reset zoom to 100% (0)',
  fit: 'Fit to content (Shift+1)',
  toolbar: 'Canvas tools',
}

export interface CanvasToolbarProps {
  tools: CanvasTool<any>[]
  toolId: string
  onTool(id: string): void
  onUndo?(): void
  onRedo?(): void
  canUndo?: boolean
  canRedo?: boolean
  scale: number
  onZoomIn(): void
  onZoomOut(): void
  onZoomReset(): void
  onFit(): void
  /** Component-specific controls (color picker, options), shown after the tools. */
  children?: ReactNode
}

/** The slim bottom toolbar shared by all canvas components (spec 10.3). */
export function CanvasToolbar(p: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar" role="toolbar" aria-label={TOOLBAR_LABELS.toolbar} onPointerDown={(e) => e.stopPropagation()}>
      {p.tools.map((t) => {
        const Icon = t.icon
        const title = t.shortcut ? `${t.label} (${t.shortcut.toUpperCase()})` : t.label
        return (
          <button
            key={t.id}
            className={'canvas-toolbar-btn' + (t.id === p.toolId ? ' is-active' : '')}
            title={title}
            aria-label={title}
            aria-pressed={t.id === p.toolId}
            onClick={() => p.onTool(t.id)}
          >
            {Icon ? <Icon size={17} strokeWidth={1.8} /> : <span className="canvas-toolbar-text">{t.label}</span>}
          </button>
        )
      })}
      {p.children ? (
        <>
          <span className="canvas-toolbar-sep" />
          {p.children}
        </>
      ) : null}
      {p.onUndo || p.onRedo ? (
        <>
          <span className="canvas-toolbar-sep" />
          <button className="canvas-toolbar-btn" title={TOOLBAR_LABELS.undo} aria-label={TOOLBAR_LABELS.undo} disabled={p.canUndo === false} onClick={p.onUndo}>
            <Undo2 size={17} strokeWidth={1.8} />
          </button>
          <button className="canvas-toolbar-btn" title={TOOLBAR_LABELS.redo} aria-label={TOOLBAR_LABELS.redo} disabled={p.canRedo === false} onClick={p.onRedo}>
            <Redo2 size={17} strokeWidth={1.8} />
          </button>
        </>
      ) : null}
      <span className="canvas-toolbar-sep" />
      <button className="canvas-toolbar-btn" title={TOOLBAR_LABELS.zoomOut} aria-label={TOOLBAR_LABELS.zoomOut} onClick={p.onZoomOut}>
        <ZoomOut size={17} strokeWidth={1.8} />
      </button>
      <button className="canvas-toolbar-zoom" title={TOOLBAR_LABELS.zoomReset} aria-label={TOOLBAR_LABELS.zoomReset} onClick={p.onZoomReset}>
        {Math.round(p.scale * 100)}%
      </button>
      <button className="canvas-toolbar-btn" title={TOOLBAR_LABELS.zoomIn} aria-label={TOOLBAR_LABELS.zoomIn} onClick={p.onZoomIn}>
        <ZoomIn size={17} strokeWidth={1.8} />
      </button>
      <button className="canvas-toolbar-btn" title={TOOLBAR_LABELS.fit} aria-label={TOOLBAR_LABELS.fit} onClick={p.onFit}>
        <Scan size={17} strokeWidth={1.8} />
      </button>
    </div>
  )
}
