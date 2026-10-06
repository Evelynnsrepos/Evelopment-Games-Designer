import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { exportBrushes, importBrushFile, mapBrushArchive, zipIsEncrypted } from './brushFiles'
import { newBrush } from './brushes'
import { parsePlist, parseXmlPlist, Uid, unarchive, type PlistValue } from './plist'

/** A tiny binary plist writer, enough to build test files (1-byte refs and offsets as needed). */
function bplist(root: PlistValue): Uint8Array {
  const objects: number[][] = []
  const add = (v: PlistValue): number => {
    const i = objects.length
    objects.push([])
    const len = (hi: number, n: number) => (n < 15 ? [(hi << 4) | n] : [(hi << 4) | 0xf, 0x10, n])
    let out: number[]
    if (v === null) out = [0x00]
    else if (v === false) out = [0x08]
    else if (v === true) out = [0x09]
    else if (v instanceof Uid) out = [0x80, v.uid]
    else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 256) out = [0x10, v]
    else if (typeof v === 'number') {
      const b = new Uint8Array(8)
      new DataView(b.buffer).setFloat64(0, v)
      out = [0x23, ...b]
    } else if (typeof v === 'string') out = [...len(5, v.length), ...[...v].map((c) => c.charCodeAt(0))]
    else if (v instanceof Uint8Array) out = [...len(4, v.length), ...v]
    else if (Array.isArray(v)) {
      const refs = v.map(add)
      out = [...len(0xa, refs.length), ...refs]
    } else {
      const o = v as Record<string, PlistValue>
      const keys = Object.keys(o).map(add)
      const vals = Object.values(o).map(add)
      out = [...len(0xd, keys.length), ...keys, ...vals]
    }
    objects[i] = out
    return i
  }
  add(root)
  const head = [...'bplist00'].map((c) => c.charCodeAt(0))
  const offsets: number[] = []
  const body: number[] = []
  for (const o of objects) {
    offsets.push(head.length + body.length)
    body.push(...o)
  }
  const tableAt = head.length + body.length
  const table = offsets.flatMap((o) => [o >> 8, o & 255])
  const trailer = new Uint8Array(32)
  const dv = new DataView(trailer.buffer)
  trailer[6] = 2
  trailer[7] = 1
  dv.setBigUint64(8, BigInt(objects.length))
  dv.setBigUint64(16, 0n)
  dv.setBigUint64(24, BigInt(tableAt))
  return new Uint8Array([...head, ...body, ...table, ...trailer])
}

/** A keyed archive holding one object with these properties. */
function archive(props: Record<string, PlistValue>): Uint8Array {
  const objects: PlistValue[] = ['$null']
  const root: Record<string, PlistValue> = { $class: new Uid(0) }
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string') {
      objects.push(v)
      root[k] = new Uid(objects.length - 1)
    } else root[k] = v
  }
  objects.push(root)
  const rootId = objects.length - 1
  return bplist({ $archiver: 'NSKeyedArchiver', $version: 100000, $top: { root: new Uid(rootId) }, $objects: objects })
}

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])

describe('plist reader', () => {
  it('reads binary plists with every basic type', () => {
    const v = parsePlist(bplist({ a: 1, b: 2.5, c: 'hi', d: [true, false, null], e: new Uint8Array([9, 8]) })) as Record<string, PlistValue>
    expect(v.a).toBe(1)
    expect(v.b).toBe(2.5)
    expect(v.c).toBe('hi')
    expect(v.d).toEqual([true, false, null])
    expect([...(v.e as Uint8Array)]).toEqual([9, 8])
  })

  it('reads XML plists', () => {
    const v = parseXmlPlist(
      '<?xml version="1.0"?><plist version="1.0"><dict><key>name</key><string>My &amp; set</string><key>brushes</key><array><string>A</string><string>B</string></array><key>n</key><integer>3</integer><key>ok</key><true/></dict></plist>',
    )
    expect(v).toEqual({ name: 'My & set', brushes: ['A', 'B'], n: 3, ok: true })
  })

  it('resolves keyed archives', () => {
    const v = unarchive(parsePlist(archive({ name: 'Ink', plotSpacing: 0.2 }))) as Record<string, PlistValue>
    expect(v.name).toBe('Ink')
    expect(v.plotSpacing).toBe(0.2)
    expect('$class' in v).toBe(false)
  })
})

describe('brush files', () => {
  it('maps known .brush settings and lists the rest', () => {
    const m = mapBrushArchive({ name: 'Ink', plotSpacing: 0.3, dynamicsPressureSize: 0.8, shapeRandomise: true, taperStartLength: 0.1, somethingNew: 0.5, otherThing: 'x' })
    expect(m.name).toBe('Ink')
    expect(m.settings.spacing).toBe(0.3)
    expect(m.settings.pressureSize).toBe(0.8)
    expect(m.settings.randomize).toBe(true)
    expect(m.settings.taperStart).toBeCloseTo(40)
    expect(m.unmapped).toEqual(['otherThing', 'somethingNew'])
  })

  it('imports a .brush file with its shape image and a .brushset in order', () => {
    const one = zipSync({ 'Brush.archive': archive({ name: 'Pencil', plotJitter: 0.4, mysteryKnob: 0.1 }), 'Shape.png': PNG })
    const [set] = importBrushFile('Pencil.brush', one)
    expect(set.brushes).toHaveLength(1)
    expect(set.brushes[0].name).toBe('Pencil')
    expect(set.brushes[0].scatter).toBe(0.4)
    expect(set.brushes[0].shapeImage?.startsWith('data:image/png;base64,')).toBe(true)
    expect(set.unmapped).toEqual([{ brush: 'Pencil', keys: ['mysteryKnob'] }])

    const many = zipSync({
      'brushset.plist': strToU8('<plist><dict><key>name</key><string>Nice set</string><key>brushes</key><array><string>B</string><string>A</string></array></dict></plist>'),
      'A/Brush.archive': archive({ name: 'First' }),
      'B/Brush.archive': archive({ name: 'Second' }),
      'B/Grain.png': PNG,
    })
    const [s2] = importBrushFile('x.brushset', many)
    expect(s2.name).toBe('Nice set')
    expect(s2.brushes.map((b) => b.name)).toEqual(['Second', 'First'])
    expect(s2.brushes[0].grainImage).toBeTruthy()
  })

  it('skips reset copies, adds a second brush as dual, turns oriented shapes with the stroke and replaces missing library shapes', () => {
    const z = zipSync({
      'A/Brush.archive': archive({ name: 'Hair', oriented: true, shapeRotation: 0 }),
      'A/Shape.png': PNG,
      'A/Reset/Brush.archive': archive({ name: 'Hair' }),
      'A/Reset/Shape.png': PNG,
      'B/Brush.archive': archive({ name: 'Short Hair', bundledShapePath: 'Brush-Artery-Short-Hair.jpg', bundledGrainPath: 'Brush-Preset-Blank.png' }),
      'B/Sub01/Brush.archive': archive({ name: 'Inner', plotJitter: 0.2 }),
    })
    const [set] = importBrushFile('pack.brushset', z)
    expect(set.brushes.map((b) => b.name)).toEqual(['Hair', 'Short Hair'])
    expect(set.brushes[0].rotation).toBe('follow')
    expect(set.brushes[1].shape).toBe('hair')
    expect(set.brushes[1].shapeImage).toBeNull()
    expect(set.brushes[1].dual?.scatter).toBe(0.2)
    expect(set.notes?.[0]).toMatchObject({ brush: 'Short Hair' })
  })

  it('refuses files that are not plain zips, or are locked', () => {
    expect(() => importBrushFile('a.brush', new Uint8Array([1, 2, 3]))).toThrow(/not a plain zip/)
    const z = zipSync({ 'Brush.archive': archive({}) })
    // Set the "encrypted" flag in the central directory entry.
    const cd = z.findIndex((_, i) => z[i] === 0x50 && z[i + 1] === 0x4b && z[i + 2] === 1 && z[i + 3] === 2)
    z[cd + 8] |= 1
    expect(zipIsEncrypted(z)).toBe(true)
    expect(() => importBrushFile('a.brush', z)).toThrow(/locked/)
  })

  it('exports and imports our own files with new ids', () => {
    const b = { ...newBrush('Mine'), spacing: 0.33 }
    const [set] = importBrushFile('mine.egdbrush', exportBrushes([{ name: 'Set', icon: 'leaf', brushes: [b] }]))
    expect(set.name).toBe('Set')
    expect(set.icon).toBe('leaf')
    expect(set.brushes[0].spacing).toBe(0.33)
    expect(set.brushes[0].id).not.toBe(b.id)
  })
})
