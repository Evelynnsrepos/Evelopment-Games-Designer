import { useAssetUrl } from '@/core/assets'
import type { AssetPath } from '@/core/model'
import { PlaceholderImage } from './ui'

/** A stored project image (`assets/images/...`), or the checkerboard placeholder if unset or missing (IT-2). */
export function AssetImage({ path, alt, size = 64 }: { path: AssetPath | null | undefined; alt: string; size?: number }) {
  const url = useAssetUrl(path)
  return <PlaceholderImage src={url} alt={alt} size={size} />
}
