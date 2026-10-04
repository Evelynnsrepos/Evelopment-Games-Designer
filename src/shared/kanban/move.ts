/** Reorder helper: move `id` into `column`, before `beforeId` or at the end of the list. */
export function moveCard<T extends { id: string }>(list: T[], id: string, beforeId: string | null, set: (card: T) => T): T[] {
  const card = list.find((c) => c.id === id)
  if (!card) return list
  const rest = list.filter((c) => c.id !== id)
  const moved = set(card)
  const at = beforeId ? rest.findIndex((c) => c.id === beforeId) : -1
  if (at < 0) return [...rest, moved]
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}
