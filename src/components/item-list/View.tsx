import type { PanelProps } from '@/core/registry'
import { ComingSoon } from '@/shared/ComingSoon'
import { manifest } from './manifest'

/** Placeholder until spec section 8.4 is built. Replace this file's contents freely. */
export default function View(props: PanelProps) {
  return <ComingSoon manifest={manifest} {...props} />
}
