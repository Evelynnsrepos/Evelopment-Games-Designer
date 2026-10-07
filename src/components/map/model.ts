import { newId, type Id } from '@/core/model'
import { addNodes, type Layer, type NodeBase, type Scene } from '@/shared/canvas'
import type { JumpTarget } from '@/shared/entityList/navigation'
import type { StampKind } from './stamps'

/**
 * Map Creator data (spec 8.10). One document per map at `components/map/<id>.json`.
 * Cities are towns (MP-5): a city node stores only the town's id, never its name.
 */

/** Fixed layer ids, bottom to top. Each tool draws into its own layer. */
export const MAP_LAYERS = {
  background: 'background',
  terrain: 'terrain',
  zones: 'zones',
  streets: 'streets',
  cities: 'cities',
  labels: 'labels',
} as const
export type MapLayerId = (typeof MAP_LAYERS)[keyof typeof MAP_LAYERS]

export const LAYER_NAMES: Record<MapLayerId, string> = {
  background: 'Background image',
  terrain: 'Terrain',
  zones: 'Zones',
  streets: 'Streets',
  cities: 'Cities',
  labels: 'Labels',
}

export type CitySize = 'village' | 'town' | 'city' | 'capital'
export const CITY_SIZES: { id: CitySize; label: string }[] = [
  { id: 'village', label: 'Village' },
  { id: 'town', label: 'Town' },
  { id: 'city', label: 'City' },
  { id: 'capital', label: 'Capital' },
]

export const MARKER_COLORS = ['#b8323f', '#2f5fa8', '#2f7d46', '#7b4bb0', '#c47a1d', '#2b2b2b']

/** A city marker. Its label is the linked town's name (MP-5, MP-6). */
export interface CityNode extends NodeBase {
  kind: 'city'
  townId: Id
  mode: CitySize
  markerColor: string
}

export type StreetStyle = 'road' | 'path' | 'river' | 'border'
export const STREET_STYLES: { id: StreetStyle; label: string }[] = [
  { id: 'road', label: 'Road' },
  { id: 'path', label: 'Path' },
  { id: 'river', label: 'River' },
  { id: 'border', label: 'Border' },
]

/** A street, path, river or border: a polyline whose points are relative to (x, y) (MP-2). */
export interface StreetNode extends NodeBase {
  kind: 'street'
  points: number[]
  mode: StreetStyle
}

/** A terrain stamp (MP-3), drawn in a 32x32 box centred on (x, y); size comes from scaleX/scaleY. */
export interface StampNode extends NodeBase {
  kind: 'stamp'
  icon: StampKind
}

/** Optional image to trace over (MP-6). */
export interface BackdropNode extends NodeBase {
  kind: 'backdrop'
  src: string
  width: number
  height: number
  /** 0..1 */
  opacity: number
}

export interface MapTextNode extends NodeBase {
  kind: 'text'
  text: string
  fontSize: number
  width: number
  textColor?: string
}

export interface MapLineNode extends NodeBase {
  kind: 'line'
  points: number[]
  strokeColor?: string
  strokeWidth?: number
  arrow?: boolean
  smooth?: boolean
}

/**
 * A zone (v0.12): an area such as a faction's territory, a forest or a kingdom, drawn as a closed shape.
 * It can belong to a faction (and take its color) and link to characters, towns, documents and more.
 */
export interface ZoneNode extends NodeBase {
  kind: 'zone'
  /** Corners relative to (x, y). */
  points: number[]
  name: string
  color: string
  factionId: Id | null
  links: JumpTarget[]
  notes?: string
}

export const ZONE_COLORS = ['#c0392b', '#2f5fa8', '#2f7d46', '#7b4bb0', '#c47a1d', '#0c8599', '#c2255c', '#5c5c5c']

export function makeZone(world: { x: number; y: number }[], color: string): ZoneNode | null {
  if (world.length < 3) return null
  const [o] = world
  return { id: newId(), kind: 'zone', layerId: MAP_LAYERS.zones, x: o.x, y: o.y, points: world.flatMap((p) => [p.x - o.x, p.y - o.y]), name: '', color, factionId: null, links: [] }
}

export const isZone = (n: NodeBase | undefined): n is ZoneNode => n?.kind === 'zone'

/** The middle of a zone's corners (relative), where its name is shown. */
export function zoneCenter(points: number[]): { x: number; y: number } {
  let x = 0
  let y = 0
  const n = points.length / 2
  for (let i = 0; i < points.length; i += 2) {
    x += points[i]
    y += points[i + 1]
  }
  return n ? { x: x / n, y: y / n } : { x: 0, y: 0 }
}

export type MapNode = CityNode | StreetNode | StampNode | BackdropNode | MapTextNode | MapLineNode | ZoneNode

export interface MapDoc {
  scene: Scene<MapNode>
  /** Paper color behind the map, also used for PNG export. */
  paperColor: string
}

export const PAPER_COLORS = ['#efe6cf', '#f7f4ec', '#dfe8d8', '#d9e4ee', '#2a2a2e']
export const DEFAULT_PAPER = PAPER_COLORS[0]
/** Ink for labels and pen strokes on the paper. */
export const INK = '#3b2f22'

export function createMapScene(): Scene<MapNode> {
  const layers: Layer[] = (Object.keys(LAYER_NAMES) as MapLayerId[]).map((id) => ({ id, name: LAYER_NAMES[id] }))
  return { layers, nodes: [] }
}

export const createDefaultMap = (): MapDoc => ({ scene: createMapScene(), paperColor: DEFAULT_PAPER })

/** Older or hand-edited maps may miss a layer; tools need all of them. */
export function ensureMapLayers(scene: Scene<MapNode>): Scene<MapNode> {
  const missing = createMapScene().layers.filter((l) => !scene.layers.some((x) => x.id === l.id))
  if (missing.length === 0) return scene
  const order = Object.keys(LAYER_NAMES)
  const layers = [...scene.layers, ...missing].sort((a, b) => rank(a.id) - rank(b.id))
  return { ...scene, layers }
  function rank(id: string) {
    const i = order.indexOf(id)
    return i < 0 ? order.length : i
  }
}

/** The layer each tool draws into. */
export function layerForTool(toolId: string): MapLayerId | null {
  switch (toolId) {
    case 'stamp':
    case 'pen':
      return MAP_LAYERS.terrain
    case 'street':
      return MAP_LAYERS.streets
    case 'zone':
      return MAP_LAYERS.zones
    case 'city':
      return MAP_LAYERS.cities
    case 'text':
      return MAP_LAYERS.labels
    default:
      return null
  }
}

export const isCity = (n: NodeBase | undefined): n is CityNode => n?.kind === 'city'
export const isStamp = (n: NodeBase | undefined): n is StampNode => n?.kind === 'stamp'

export function cityNodes(scene: Scene<MapNode>): CityNode[] {
  return scene.nodes.filter(isCity)
}

/** Town ids that already have a marker on this map. */
export function townsOnMap(scene: Scene<MapNode>): Set<Id> {
  return new Set(cityNodes(scene).map((c) => c.townId))
}

export function makeCity(townId: Id, at: { x: number; y: number }, mode: CitySize = 'town', markerColor = MARKER_COLORS[0]): CityNode {
  return { id: newId(), kind: 'city', layerId: MAP_LAYERS.cities, x: at.x, y: at.y, townId, mode, markerColor }
}

export function addCity(scene: Scene<MapNode>, city: CityNode): Scene<MapNode> {
  return addNodes(ensureMapLayers(scene), [city])
}

/** Points for a street drawn through world-space `points`, stored relative to the first one. */
export function makeStreet(world: { x: number; y: number }[], mode: StreetStyle): StreetNode | null {
  if (world.length < 2) return null
  const [o] = world
  return {
    id: newId(),
    kind: 'street',
    layerId: MAP_LAYERS.streets,
    x: o.x,
    y: o.y,
    mode,
    points: world.flatMap((p) => [p.x - o.x, p.y - o.y]),
  }
}

/** Removes consecutive duplicate points (a double-click adds the same point twice). */
export function dedupePoints(points: { x: number; y: number }[], minDistance = 0.5): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minDistance) out.push(p)
  }
  return out
}

/** Deterministic pseudo-random number in [0, 1) so tests and repeated paints are stable. */
export function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Stamp positions along a brush stroke: the first point, then one every `spacing`
 * world units of travel, each nudged a little so forests do not look like a grid.
 */
export function brushPositions(path: { x: number; y: number }[], spacing: number, seed = 1): { x: number; y: number; scale: number }[] {
  if (path.length === 0 || spacing <= 0) return []
  const out: { x: number; y: number; scale: number }[] = []
  const place = (p: { x: number; y: number }) => {
    const i = out.length + seed
    out.push({
      x: p.x + (jitter(i) - 0.5) * spacing * 0.5,
      y: p.y + (jitter(i + 0.5) - 0.5) * spacing * 0.5,
      scale: 0.85 + jitter(i + 0.25) * 0.3,
    })
  }
  place(path[0])
  let carried = 0
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]
    const b = path[k]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    let t = spacing - carried
    while (t <= len) {
      place({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len })
      t += spacing
    }
    carried = (carried + len) % spacing
  }
  return out
}

export function makeStamp(icon: StampKind, at: { x: number; y: number }, size: number): StampNode {
  const s = size / 32
  return { id: newId(), kind: 'stamp', layerId: MAP_LAYERS.terrain, x: at.x, y: at.y, icon, scaleX: s, scaleY: s }
}
