import { Group, Path } from 'react-konva'

/**
 * Terrain stamps (MP-3). Each stamp is a few SVG paths in a 32x32 box, so the
 * same data draws on the Konva canvas and in the HTML stamp palette.
 */
export type StampKind = 'tree' | 'pine' | 'mountain' | 'hills' | 'plains' | 'water' | 'shoreline' | 'desert' | 'swamp'

interface StampPath {
  d: string
  fill?: string
  stroke?: string
  width?: number
}

export interface StampDef {
  id: StampKind
  label: string
  paths: StampPath[]
}

const WATER = '#3f7fbf'

export const STAMPS: StampDef[] = [
  {
    id: 'tree',
    label: 'Tree',
    paths: [
      { d: 'M14.5 19 h3 v10 h-3 z', fill: '#7a5230' },
      { d: 'M7 13 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 z', fill: '#4f8a3c', stroke: '#2f5a24', width: 1.5 },
    ],
  },
  {
    id: 'pine',
    label: 'Pine',
    paths: [
      { d: 'M15 24 h2 v6 h-2 z', fill: '#6b4a2b' },
      { d: 'M16 2 L25 14 h-4 L27 24 H5 L11 14 H7 Z', fill: '#2f6b3a', stroke: '#1f4727', width: 1.5 },
    ],
  },
  {
    id: 'mountain',
    label: 'Mountain',
    paths: [
      { d: 'M2 28 L13 7 L18 15 L21 11 L30 28 Z', fill: '#a39a8f', stroke: '#4d4640', width: 1.5 },
      { d: 'M13 7 L18 15 L15 28 L13 28 Z', fill: '#81786e' },
      { d: 'M13 7 L9.6 13.6 L12 12.4 L13.6 14.2 L15.8 11.4 Z', fill: '#ffffff' },
    ],
  },
  {
    id: 'hills',
    label: 'Hills',
    paths: [
      { d: 'M12 26 Q21 12 31 26 Z', fill: '#b6c27a', stroke: '#5f6d33', width: 1.5 },
      { d: 'M1 27 Q9 13 18 27 Z', fill: '#a3b465', stroke: '#5f6d33', width: 1.5 },
    ],
  },
  {
    id: 'plains',
    label: 'Plainland',
    paths: [{ d: 'M6 25 L4 19 M6 25 L6 18 M6 25 L8 19 M18 19 L16 13 M18 19 L18 12 M18 19 L20 13 M26 28 L24 22 M26 28 L26 21 M26 28 L28 22', stroke: '#6f9a3a', width: 1.6 }],
  },
  {
    id: 'water',
    label: 'Water',
    paths: [{ d: 'M3 12 q3 -3 6 0 t6 0 t6 0 t6 0 M3 20 q3 -3 6 0 t6 0 t6 0 t6 0', stroke: WATER, width: 2 }],
  },
  {
    id: 'shoreline',
    label: 'Shoreline',
    paths: [
      { d: 'M0 4 H32 V12 Q24 18 16 13 T0 15 Z', fill: '#dcc893', stroke: '#a88f55', width: 1.2 },
      { d: 'M2 22 q3 -2.5 6 0 t6 0 t6 0 t6 0 M8 28 q3 -2.5 6 0 t6 0', stroke: WATER, width: 1.6 },
    ],
  },
  {
    id: 'desert',
    label: 'Desert',
    paths: [
      { d: 'M1 22 Q8 14 15 22 M14 27 Q22 18 31 27', stroke: '#c49a45', width: 2 },
      { d: 'M7 28 h0.1 M23 11 h0.1 M5 10 h0.1 M14 6 h0.1', stroke: '#c49a45', width: 2.2 },
    ],
  },
  {
    id: 'swamp',
    label: 'Swamp',
    paths: [
      { d: 'M3 24 a13 4 0 1 0 26 0 a13 4 0 1 0 -26 0 z', fill: '#6d8b74', stroke: '#4a6150', width: 1 },
      { d: 'M10 24 V13 M14 24 V9 M18 24 V14 M22 24 V11', stroke: '#4b5f2c', width: 1.6 },
      { d: 'M14 9 v3 M22 11 v3', stroke: '#6b4a2b', width: 2.6 },
    ],
  },
]

export const STAMP_BY_ID = Object.fromEntries(STAMPS.map((s) => [s.id, s])) as Record<StampKind, StampDef>

/** Konva drawing centred on (0, 0). */
export function StampShape({ icon }: { icon: StampKind }) {
  const def = STAMP_BY_ID[icon] ?? STAMP_BY_ID.tree
  return (
    <Group x={-16} y={-16}>
      {def.paths.map((p, i) => (
        <Path
          key={i}
          data={p.d}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.width ?? 0}
          lineCap="round"
          lineJoin="round"
          // Thin strokes (grass, waves) need a bigger hit area to be clickable.
          hitStrokeWidth={p.fill ? undefined : 8}
        />
      ))}
    </Group>
  )
}

/** The same stamp as inline SVG, for the palette. */
export function StampIcon({ icon, size = 26 }: { icon: StampKind; size?: number }) {
  const def = STAMP_BY_ID[icon]
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {def.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke} strokeWidth={p.width ?? 0} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}
