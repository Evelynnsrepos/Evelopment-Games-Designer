import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Image as KonvaImage } from 'react-konva'
import { renderBrushStroke } from '../sketch/brushStroke'
import { preloadBrush, useBrushLibrary } from '../sketch/library'
import type { LineNode } from './types'

/** A pen stroke drawn with its Sketch brush; `fallback` (the plain line) while the brush is missing. */
export function BrushLine({ n, color, fallback }: { n: LineNode; color: string; fallback: ReactNode }) {
  const brush = useBrushLibrary((s) => s.brushes.find((b) => b.id === n.brush))
  const [ready, setReady] = useState(0)
  useEffect(() => {
    void useBrushLibrary.getState().load()
  }, [])
  // Brushes with their own shape or grain images draw again once those are decoded.
  useEffect(() => {
    if (brush) void preloadBrush(brush).then(() => setReady((r) => r + 1))
  }, [brush])
  const img = useMemo(
    () => (brush ? renderBrushStroke(n.points, n.pressures, brush, color, n.strokeWidth ?? 2) : null),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `ready` redraws after the brush images load
    [brush, n.points, n.pressures, color, n.strokeWidth, ready],
  )
  if (!img) return <>{fallback}</>
  return <KonvaImage image={img.canvas} x={img.x} y={img.y} width={img.canvas.width / img.scale} height={img.canvas.height / img.scale} opacity={n.opacity ?? 1} />
}
