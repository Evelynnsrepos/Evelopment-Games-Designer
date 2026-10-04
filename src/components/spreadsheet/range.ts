import { normRange, parseAddr, type Range } from './model'

/** "A1:C6" → the range, or null. */
export function parseRange(ref: string): Range | null {
  const [a, b = a] = ref.toUpperCase().replace(/\$/g, '').split(':')
  const p = parseAddr(a)
  const q = parseAddr(b)
  return p && q ? normRange(p, q) : null
}
