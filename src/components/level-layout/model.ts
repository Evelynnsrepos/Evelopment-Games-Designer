import { newId, type Id } from '@/core/model'

/** Level / dungeon layout (v0.10): a tile grid with rooms, doors, spawns, loot and numbered notes. */

export const TILES = [
  { id: 'floor', label: 'Floor', color: '#c9b79c' },
  { id: 'wall', label: 'Wall', color: '#4a4a55' },
  { id: 'door', label: 'Door', color: '#a0522d' },
  { id: 'water', label: 'Water', color: '#3e8ef7' },
  { id: 'lava', label: 'Lava', color: '#e8590c' },
  { id: 'grass', label: 'Grass', color: '#5c940d' },
  { id: 'pit', label: 'Pit', color: '#111114' },
  { id: 'stairs', label: 'Stairs', color: '#adb5bd' },
  { id: 'spawn', label: 'Player start', color: '#2f9e44' },
  { id: 'exit', label: 'Exit', color: '#9c36b5' },
  { id: 'enemy', label: 'Enemy', color: '#e03131' },
  { id: 'boss', label: 'Boss', color: '#a61e4d' },
  { id: 'chest', label: 'Chest', color: '#f5a623' },
  { id: 'key', label: 'Key', color: '#fab005' },
  { id: 'trap', label: 'Trap', color: '#f76707' },
  { id: 'npc', label: 'NPC', color: '#0c8599' },
] as const
export type TileId = (typeof TILES)[number]['id']

/** Tiles drawn on top of the floor as a symbol instead of a full square. */
export const MARKERS: Partial<Record<TileId, string>> = { spawn: 'S', exit: 'E', enemy: '!', boss: 'B', chest: '$', key: 'K', trap: '^', npc: '?' }

export interface Note {
  id: Id
  x: number
  y: number
  text: string
}

export interface LevelDoc {
  width: number
  height: number
  /** "x,y" → tile. */
  tiles: Record<string, TileId>
  notes: Note[]
}

export const createLevelDoc = (): LevelDoc => ({ width: 40, height: 28, tiles: {}, notes: [] })
export const cellKey = (x: number, y: number) => `${x},${y}`
export const tileColor = (t: TileId) => TILES.find((x) => x.id === t)?.color ?? '#888'
export const newNote = (x: number, y: number): Note => ({ id: newId(), x, y, text: '' })

/** A room: floor inside, walls around it; existing doors in the wall line stay. */
export function room(d: LevelDoc, x1: number, y1: number, x2: number, y2: number): Record<string, TileId> {
  const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)]
  const [ay, by] = [Math.min(y1, y2), Math.max(y1, y2)]
  const tiles = { ...d.tiles }
  for (let y = ay; y <= by; y++)
    for (let x = ax; x <= bx; x++) {
      const edge = x === ax || x === bx || y === ay || y === by
      const k = cellKey(x, y)
      if (edge) tiles[k] = tiles[k] === 'door' ? 'door' : 'wall'
      else tiles[k] = 'floor'
    }
  return tiles
}

/** Fill the connected area of the same tile (or empty) starting at x,y. */
export function bucket(d: LevelDoc, x: number, y: number, tile: TileId | null): Record<string, TileId> {
  const tiles = { ...d.tiles }
  const from = tiles[cellKey(x, y)] ?? null
  if (from === tile) return tiles
  const stack = [[x, y]]
  let n = 0
  while (stack.length && n < 20000) {
    const [cx, cy] = stack.pop()!
    if (cx < 0 || cy < 0 || cx >= d.width || cy >= d.height) continue
    const k = cellKey(cx, cy)
    if ((tiles[k] ?? null) !== from) continue
    if (tile) tiles[k] = tile
    else delete tiles[k]
    n++
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }
  return tiles
}

/** How many of each tile there are, e.g. to count enemies and chests. */
export function counts(d: LevelDoc): Partial<Record<TileId, number>> {
  const out: Partial<Record<TileId, number>> = {}
  for (const t of Object.values(d.tiles)) out[t] = (out[t] ?? 0) + 1
  return out
}
