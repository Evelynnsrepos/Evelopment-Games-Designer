import type * as Y from 'yjs'
import { bumpAssets, resolveAssetPath } from '../assets'
import { getFs } from '../fs'
import { readTop } from './bridge'
import type { CollabNetwork, Peer } from './network'
import { ASSET_PATH, decodeAssetChunk, decodeJson, encodeAssetChunk, encodeJson, MSG, type AssetRequest } from './protocol'

/** Images and audio are files, not Yjs data: fetch the ones documents mention but this device lacks. */
export const CHUNK_BYTES = 512 * 1024
export const MAX_ASSET_BYTES = 200 * 1024 * 1024
const SCAN_DELAY_MS = 1500
const PARALLEL = 3

interface Incoming {
  buffer: Uint8Array
  received: number
  from: Peer
}

export class AssetSync {
  private readonly incoming = new Map<string, Incoming>()
  /** Peers that said they don't have a file, so we ask someone else. */
  private readonly lacking = new Map<string, Set<string>>()
  private scanTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private readonly network: CollabNetwork
  private readonly doc: Y.Doc
  private readonly root: string
  /** Paths written by this sync, for tests and the status line. */
  readonly received: string[] = []

  constructor(network: CollabNetwork, doc: Y.Doc, root: string) {
    this.network = network
    this.doc = doc
    this.root = root
    network.on(MSG.assetRequest, (peer, payload) => void this.serve(peer, decodeJson<AssetRequest>(payload).path).catch((e) => console.error('Asset transfer failed', e)))
    network.on(MSG.assetChunk, (peer, payload) => void this.receive(peer, payload).catch((e) => console.error('Asset transfer failed', e)))
    doc.on('update', this.scanSoon)
  }

  stop() {
    this.stopped = true
    this.doc.off('update', this.scanSoon)
    if (this.scanTimer) clearTimeout(this.scanTimer)
  }

  /** Look for missing files soon (after edits settle, or when a peer connects). */
  readonly scanSoon = () => {
    if (this.stopped) return
    if (this.scanTimer) clearTimeout(this.scanTimer)
    this.scanTimer = setTimeout(() => void this.scan(), SCAN_DELAY_MS)
  }

  async scan() {
    if (this.stopped) return
    const peers = this.network.readyPeers()
    if (peers.length === 0) return
    const fs = getFs()
    let active = this.incoming.size
    for (const path of referencedAssets(this.doc)) {
      if (active >= PARALLEL) break
      if (this.incoming.has(path)) continue
      if (await fs.exists(await resolveAssetPath(this.root, path))) continue
      const lacking = this.lacking.get(path)
      const peer = peers.find((p) => !lacking?.has(p.remoteId))
      if (!peer) continue
      this.incoming.set(path, { buffer: new Uint8Array(0), received: 0, from: peer })
      this.network.send(peer, encodeJson(MSG.assetRequest, { path } satisfies AssetRequest))
      active++
    }
  }

  private async serve(peer: Peer, path: unknown) {
    if (typeof path !== 'string' || !ASSET_PATH.test(path)) return
    const fs = getFs()
    const abs = await resolveAssetPath(this.root, path)
    if (!(await fs.exists(abs))) {
      this.network.send(peer, encodeAssetChunk({ path, offset: 0, total: 0, missing: true }, new Uint8Array(0)))
      return
    }
    const bytes = await fs.readBinary(abs)
    if (bytes.length > MAX_ASSET_BYTES) return
    for (let offset = 0; offset < bytes.length || offset === 0; offset += CHUNK_BYTES) {
      const chunk = bytes.subarray(offset, offset + CHUNK_BYTES)
      this.network.send(peer, encodeAssetChunk({ path, offset, total: bytes.length }, chunk))
      if (bytes.length === 0) break
    }
  }

  private async receive(peer: Peer, payload: Uint8Array) {
    const { header, bytes } = decodeAssetChunk(payload)
    const { path, offset, total } = header
    const job = this.incoming.get(path)
    if (!job || job.from !== peer || !ASSET_PATH.test(path)) return
    if (header.missing) {
      this.incoming.delete(path)
      if (!this.lacking.has(path)) this.lacking.set(path, new Set())
      this.lacking.get(path)!.add(peer.remoteId)
      this.scanSoon()
      return
    }
    if (total > MAX_ASSET_BYTES || offset + bytes.length > total) {
      this.incoming.delete(path)
      return
    }
    if (job.buffer.length !== total) job.buffer = new Uint8Array(total)
    job.buffer.set(bytes, offset)
    job.received += bytes.length
    if (job.received < total) return
    this.incoming.delete(path)
    const fs = getFs()
    const abs = await resolveAssetPath(this.root, path)
    await fs.mkdir(await fs.join(this.root, 'assets', path.split('/')[1]))
    await fs.writeBinaryAtomic(abs, job.buffer)
    this.received.push(path)
    bumpAssets()
    this.scanSoon()
  }
}

/** Every asset path any shared document mentions. */
export function referencedAssets(doc: Y.Doc): Set<string> {
  const out = new Set<string>()
  const visit = (v: unknown) => {
    if (typeof v === 'string') {
      if (ASSET_PATH.test(v)) out.add(v)
    } else if (Array.isArray(v)) v.forEach(visit)
    else if (v && typeof v === 'object') Object.values(v).forEach(visit)
  }
  for (const name of doc.share.keys()) visit(readTop(doc, name))
  return out
}
