import { Channel, invoke } from '@tauri-apps/api/core'
import type { CollabTransport, ConnId, TransportEvent } from './transport'

/**
 * Desktop transport: iroh in the Rust shell (`src-tauri/src/collab.rs`).
 * Events arrive as binary frames `[kind][conn u32 BE][payload]`.
 */
const KIND_CONNECTED = 1
const KIND_MESSAGE = 2
const KIND_CLOSED = 3

export class TauriTransport implements CollabTransport {
  readonly kind = 'iroh' as const

  async start(onEvent: (e: TransportEvent) => void) {
    const channel = new Channel<ArrayBuffer>()
    const decoder = new TextDecoder()
    channel.onmessage = (raw) => {
      const bytes = new Uint8Array(raw)
      if (bytes.length < 5) return
      const conn = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1)
      const payload = bytes.subarray(5)
      if (bytes[0] === KIND_CONNECTED) onEvent({ type: 'connected', conn, remoteId: decoder.decode(payload) })
      else if (bytes[0] === KIND_MESSAGE) onEvent({ type: 'message', conn, data: payload.slice() })
      else if (bytes[0] === KIND_CLOSED) onEvent({ type: 'closed', conn, reason: decoder.decode(payload) || undefined })
    }
    return invoke<string>('collab_start', { onEvent: channel })
  }

  address() {
    return invoke<string>('collab_addr')
  }

  connect(address: string) {
    return invoke<ConnId>('collab_connect', { addr: address })
  }

  async send(conn: ConnId, data: Uint8Array) {
    await invoke('collab_send', data, { headers: { 'x-conn': String(conn) } })
  }

  async disconnect(conn: ConnId) {
    await invoke('collab_disconnect', { conn })
  }

  async stop() {
    await invoke('collab_stop')
  }
}
