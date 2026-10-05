/** Copied pixels (a layer or a selection) for pasting as a new layer; also put on the system clipboard as PNG when allowed. */
let copied: HTMLCanvasElement | null = null

export function copyPixels(canvas: HTMLCanvasElement) {
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = canvas.height
  c.getContext('2d')!.drawImage(canvas, 0, 0)
  copied = c
  try {
    c.toBlob((b) => {
      if (b && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') void navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {})
    }, 'image/png')
  } catch {
    // The system clipboard is optional.
  }
}

/** What was copied in this editor, or null. */
export const copiedPixels = () => copied
