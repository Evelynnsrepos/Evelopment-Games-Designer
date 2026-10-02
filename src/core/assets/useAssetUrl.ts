import { useEffect, useState } from 'react'
import type { AssetPath } from '../model'
import { useProjectStore } from '../state'
import { assetUrl, useAssetsVersion } from './assets'

/** URL for a stored asset path in the open project; null while loading or if missing. */
export function useAssetUrl(path: AssetPath | null | undefined): string | null {
  const root = useProjectStore((s) => s.root)
  const assetsVersion = useAssetsVersion((s) => s.version)
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null)
  const key = `${root}|${path ?? ''}`

  useEffect(() => {
    if (!root || !path) return
    let cancelled = false
    assetUrl(root, path)
      .catch(() => null)
      .then((url) => {
        if (!cancelled) setResolved({ key, url })
      })
    return () => {
      cancelled = true
    }
  }, [root, path, key, assetsVersion])

  return resolved?.key === key ? resolved.url : null
}
