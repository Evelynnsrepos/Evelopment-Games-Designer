import { useCallback, useEffect, useState } from 'react'
import type { AssetPath } from '../model'
import { useProjectStore } from '../state'
import { assetUrl, useAssetsVersion } from './assets'

/**
 * Synchronous resolver for many stored asset paths at once, for canvases
 * (`<CanvasEditor resolveImageSrc={...}>`) that draw images by path.
 * Paths not yet loaded, or missing on disk, resolve to '' so the canvas shows
 * the placeholder. Plain URLs (`http:`, `data:`, `blob:`) pass through unchanged.
 */
export function useAssetUrls(paths: readonly (AssetPath | null | undefined)[]): (path: AssetPath) => string {
  const root = useProjectStore((s) => s.root)
  const assetsVersion = useAssetsVersion((s) => s.version)
  const [urls, setUrls] = useState<{ root: string | null; map: Map<string, string> }>({ root: null, map: new Map() })
  const wanted = [...new Set(paths.filter((p): p is AssetPath => !!p && !isUrl(p)))].sort().join('\n')

  useEffect(() => {
    if (!root || !wanted) return
    let cancelled = false
    void Promise.all(wanted.split('\n').map(async (p) => [p, (await assetUrl(root, p).catch(() => null)) ?? ''] as const)).then((pairs) => {
      if (cancelled) return
      setUrls((cur) => {
        const map = new Map(cur.root === root ? cur.map : [])
        let changed = cur.root !== root
        for (const [p, url] of pairs) {
          if (map.get(p) !== url) {
            map.set(p, url)
            changed = true
          }
        }
        return changed ? { root, map } : cur
      })
    })
    return () => {
      cancelled = true
    }
  }, [root, wanted, assetsVersion])

  const map = urls.root === root ? urls.map : null
  return useCallback((path: AssetPath) => (isUrl(path) ? path : (map?.get(path) ?? '')), [map])
}

function isUrl(path: string) {
  return /^(https?|data|blob|asset):/i.test(path)
}
