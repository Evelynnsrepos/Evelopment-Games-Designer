/** Count words the way a writer would: runs of letters/digits, apostrophes and hyphens allowed inside. */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0
  const matches = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)
  return matches ? matches.length : 0
}
