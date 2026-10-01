/**
 * Display size for a newly placed image: its natural size, scaled down so the
 * longer side is at most `max` world units. Missing or broken images get a
 * `max` x 3/4 `max` box (they show the placeholder).
 */
export function loadImageSize(url: string | null | undefined, max = 360): Promise<{ width: number; height: number }> {
  const fallback = { width: max, height: Math.round(max * 0.75) }
  if (!url) return Promise.resolve(fallback)
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve(fitWithin(img.naturalWidth, img.naturalHeight, max) ?? fallback)
    img.onerror = () => resolve(fallback)
    img.src = url
  })
}

/** Scale (w, h) down to fit `max` on the longer side; null for empty sizes. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } | null {
  if (!(width > 0 && height > 0)) return null
  const k = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * k), height: Math.round(height * k) }
}
