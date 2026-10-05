import type { BrushDef, BrushSettings } from './brushes'

/**
 * Brush images are stored inside the brush library file. Imported brush packs
 * can carry huge shape and grain images, which made the library hundreds of MB
 * and every save slow. Brushes never use more than 512 px (see loadImageMask),
 * so images are scaled down to that once, as PNG.
 */

export const MAX_IMAGE_SIDE = 512
/** Data URLs shorter than this are left as they are. */
const SMALL = 96 * 1024

function shrinkDataUrl(src: string): Promise<string> {
  if (src.length < SMALL || typeof document === 'undefined') return Promise.resolve(src)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.naturalWidth * s))
      c.height = Math.max(1, Math.round(img.naturalHeight * s))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      const out = c.toDataURL('image/png')
      resolve(out.length < src.length ? out : src)
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

async function shrinkSettings<T extends BrushSettings>(b: T): Promise<T> {
  const shapeImage = b.shapeImage ? await shrinkDataUrl(b.shapeImage) : b.shapeImage
  const grainImage = b.grainImage ? await shrinkDataUrl(b.grainImage) : b.grainImage
  const dual = b.dual ? await shrinkSettings(b.dual) : b.dual
  return shapeImage === b.shapeImage && grainImage === b.grainImage && dual === b.dual ? b : { ...b, shapeImage, grainImage, dual }
}

/** The brushes with oversized images scaled down; unchanged brushes are returned as they were. */
export async function shrinkBrushImages(brushes: BrushDef[]): Promise<BrushDef[]> {
  const out: BrushDef[] = []
  for (const b of brushes) out.push(await shrinkSettings(b))
  return out
}

/** True when any brush carries an image big enough to be worth shrinking. */
export function hasBigImages(brushes: BrushSettings[]): boolean {
  return brushes.some((b) => (b.shapeImage?.length ?? 0) >= SMALL || (b.grainImage?.length ?? 0) >= SMALL || (b.dual ? hasBigImages([b.dual]) : false))
}

/**
 * Brushes in the same set that are exact copies of an earlier one (same name and
 * settings). An older importer added each brush of a pack twice.
 */
export function duplicateIds(sets: { brushIds: string[] }[], brushes: BrushDef[]): Set<string> {
  const byId = new Map(brushes.map((b) => [b.id, b]))
  const drop = new Set<string>()
  for (const set of sets) {
    const seen = new Set<string>()
    for (const id of set.brushIds) {
      const b = byId.get(id)
      if (!b) continue
      const { id: _id, createdAt: _c, ...rest } = b as BrushDef & { createdAt?: number }
      const key = JSON.stringify(rest)
      if (seen.has(key)) drop.add(id)
      else seen.add(key)
    }
  }
  return drop
}
