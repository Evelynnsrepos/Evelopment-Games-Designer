/**
 * Property list reader (Apple's documented plist formats): binary "bplist00"
 * and XML, plus resolving keyed archives ($objects / $top with UID links).
 * Used to read brush files from other apps. Read-only, no dependencies.
 */

export type PlistValue = null | boolean | number | bigint | string | Date | Uint8Array | PlistValue[] | { [k: string]: PlistValue } | Uid

/** A reference to an object in a keyed archive. */
export class Uid {
  readonly uid: number
  constructor(uid: number) {
    this.uid = uid
  }
}

const text = (b: Uint8Array) => String.fromCharCode(...b)

export function parsePlist(bytes: Uint8Array): PlistValue {
  if (text(bytes.subarray(0, 6)) === 'bplist') return parseBinaryPlist(bytes)
  return parseXmlPlist(new TextDecoder().decode(bytes))
}

export function parseBinaryPlist(bytes: Uint8Array): PlistValue {
  if (text(bytes.subarray(0, 8)) !== 'bplist00') throw new Error('Not a binary plist')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const t = bytes.length - 32
  if (t < 8) throw new Error('Plist too short')
  const offsetSize = bytes[t + 6]
  const refSize = bytes[t + 7]
  const count = Number(view.getBigUint64(t + 8))
  const top = Number(view.getBigUint64(t + 16))
  const tableAt = Number(view.getBigUint64(t + 24))
  const uint = (at: number, size: number) => {
    let v = 0
    for (let i = 0; i < size; i++) v = v * 256 + bytes[at + i]
    return v
  }
  const offset = (i: number) => uint(tableAt + i * offsetSize, offsetSize)
  const depth = new Set<number>()

  const read = (ref: number): PlistValue => {
    if (ref >= count) throw new Error('Bad plist reference')
    if (depth.has(ref)) throw new Error('Plist loops back on itself')
    depth.add(ref)
    try {
      return readAt(offset(ref))
    } finally {
      depth.delete(ref)
    }
  }
  // Length of an object: the low nibble, or a following int when it is 0xF.
  const lengthAt = (at: number, nib: number): [number, number] => {
    if (nib !== 0xf) return [nib, at + 1]
    const m = bytes[at + 1]
    const size = 1 << (m & 0xf)
    return [uint(at + 2, size), at + 2 + size]
  }
  const readAt = (at: number): PlistValue => {
    const marker = bytes[at]
    const hi = marker >> 4
    const lo = marker & 0xf
    switch (hi) {
      case 0x0:
        return lo === 0x8 ? false : lo === 0x9 ? true : null
      case 0x1: {
        const size = 1 << lo
        if (size === 8) {
          const v = view.getBigInt64(at + 1)
          return v >= Number.MIN_SAFE_INTEGER && v <= Number.MAX_SAFE_INTEGER ? Number(v) : v
        }
        if (size === 16) return view.getBigInt64(at + 9)
        return uint(at + 1, size)
      }
      case 0x2:
        return lo === 2 ? view.getFloat32(at + 1) : view.getFloat64(at + 1)
      case 0x3:
        // Seconds since 2001-01-01.
        return new Date((view.getFloat64(at + 1) + 978307200) * 1000)
      case 0x4: {
        const [n, start] = lengthAt(at, lo)
        return bytes.slice(start, start + n)
      }
      case 0x5: {
        const [n, start] = lengthAt(at, lo)
        return text(bytes.subarray(start, start + n))
      }
      case 0x6: {
        const [n, start] = lengthAt(at, lo)
        let s = ''
        for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint16(start + i * 2))
        return s
      }
      case 0x8:
        return new Uid(uint(at + 1, lo + 1))
      case 0xa:
      case 0xc: {
        const [n, start] = lengthAt(at, lo)
        const out: PlistValue[] = []
        for (let i = 0; i < n; i++) out.push(read(uint(start + i * refSize, refSize)))
        return out
      }
      case 0xd: {
        const [n, start] = lengthAt(at, lo)
        const out: { [k: string]: PlistValue } = {}
        for (let i = 0; i < n; i++) {
          const key = read(uint(start + i * refSize, refSize))
          out[String(key)] = read(uint(start + (n + i) * refSize, refSize))
        }
        return out
      }
      default:
        throw new Error(`Unknown plist object type ${marker.toString(16)}`)
    }
  }
  return read(top)
}

/** A small XML plist reader (dict, array, string, integer, real, true/false, data, date). */
export function parseXmlPlist(xml: string): PlistValue {
  const tokens = xml.replace(/<\?[^>]*\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/g, '').match(/<[^>]+>|[^<]+/g) ?? []
  let i = 0
  const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  const skip = () => {
    while (i < tokens.length && !tokens[i].startsWith('<')) i++
  }
  const textUntil = (close: string) => {
    let s = ''
    while (i < tokens.length && tokens[i] !== close) s += tokens[i++]
    i++
    return decode(s)
  }
  const value = (): PlistValue => {
    skip()
    const tag = tokens[i++]
    if (!tag) throw new Error('Plist ended early')
    const name = tag.replace(/[</>]/g, '').trim().split(/\s/)[0]
    if (tag.endsWith('/>')) return name === 'true' ? true : name === 'false' ? false : name === 'dict' ? {} : name === 'array' ? [] : name === 'string' ? '' : null
    switch (name) {
      case 'plist':
        return value()
      case 'string':
      case 'key':
        return textUntil(`</${name}>`)
      case 'integer':
      case 'real':
        return Number(textUntil(`</${name}>`))
      case 'date':
        return new Date(textUntil('</date>'))
      case 'data':
        return Uint8Array.from(atob(textUntil('</data>').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
      case 'array': {
        const out: PlistValue[] = []
        for (;;) {
          skip()
          if (tokens[i] === '</array>') return i++, out
          out.push(value())
        }
      }
      case 'dict': {
        const out: { [k: string]: PlistValue } = {}
        for (;;) {
          skip()
          if (tokens[i] === '</dict>') return i++, out
          const key = String(value())
          out[key] = value()
        }
      }
      default:
        throw new Error(`Unknown plist tag ${name}`)
    }
  }
  return value()
}

/**
 * Resolve a keyed archive into plain values: UID links are followed, NSArray
 * and NSDictionary become arrays and objects, other objects become objects
 * with their keys ($class dropped). Loops resolve to null.
 */
export function unarchive(archive: PlistValue): PlistValue {
  if (!archive || typeof archive !== 'object' || !('$objects' in archive)) return archive
  const a = archive as { $objects: PlistValue[]; $top: { [k: string]: PlistValue } }
  const objects = a.$objects
  const seen = new Set<number>()
  const resolve = (v: PlistValue): PlistValue => {
    if (v instanceof Uid) {
      if (seen.has(v.uid)) return null
      const o = objects[v.uid]
      if (o === '$null') return null
      seen.add(v.uid)
      try {
        return resolve(o)
      } finally {
        seen.delete(v.uid)
      }
    }
    if (Array.isArray(v)) return v.map(resolve)
    if (v && typeof v === 'object' && !(v instanceof Uint8Array) && !(v instanceof Date)) {
      const o = v as { [k: string]: PlistValue }
      if ('NS.keys' in o && 'NS.objects' in o) {
        const keys = (o['NS.keys'] as PlistValue[]).map(resolve)
        const vals = (o['NS.objects'] as PlistValue[]).map(resolve)
        return Object.fromEntries(keys.map((k, i) => [String(k), vals[i]]))
      }
      if ('NS.objects' in o) return (o['NS.objects'] as PlistValue[]).map(resolve)
      if ('NS.string' in o) return resolve(o['NS.string'])
      if ('NS.bytes' in o) return resolve(o['NS.bytes'])
      if ('NS.data' in o) return resolve(o['NS.data'])
      const out: { [k: string]: PlistValue } = {}
      for (const [k, val] of Object.entries(o)) if (k !== '$class') out[k] = resolve(val)
      return out
    }
    return v
  }
  const top = a.$top ?? {}
  const root = 'root' in top ? top.root : Object.values(top)[0]
  return resolve(root ?? null)
}
