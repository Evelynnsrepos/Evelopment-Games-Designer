import type { CollabTransport, ConnId, TransportEvent } from './transport'

/**
 * Dev-mode transport: browser tabs of `npm run dev` on one computer talk over
 * a BroadcastChannel, so sharing and joining can be tried without the
 * desktop app. Tab ids are not authenticated; this is for testing only.
 */
type Packet =
  | { kind: 'dial'; from: string; to: string; link: string }
  | { kind: 'accept'; from: string; to: string; link: string }
  | { kind: 'msg'; from: string; to: string; link: string; data: Uint8Array }
  | { kind: 'close'; from: string; to: string; link: string }

const CHANNEL = 'egd-collab-dev'
const DIAL_TIMEOUT_MS = 4000

export class BrowserTransport implements CollabTransport {
  readonly kind = 'browser' as const
  private channel: BroadcastChannel | null = null
  private onEvent: ((e: TransportEvent) => void) | null = null
  private readonly id = `tab-${crypto.randomUUID()}`
  private readonly byLink = new Map<string, { conn: ConnId; remote: string }>()
  private readonly byConn = new Map<ConnId, { link: string; remote: string }>()
  private readonly dialing = new Map<string, (conn: ConnId) => void>()
  private nextConn = 1

  async start(onEvent: (e: TransportEvent) => void) {
    this.onEvent = onEvent
    this.channel = new BroadcastChannel(CHANNEL)
    this.channel.onmessage = (e: MessageEvent<Packet>) => this.receive(e.data)
    return this.id
  }

  async address() {
    return this.id
  }

  connect(address: string): Promise<ConnId> {
    const link = crypto.randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.dialing.delete(link)
        reject(new Error('No answer from that device'))
      }, DIAL_TIMEOUT_MS)
      this.dialing.set(link, (conn) => {
        clearTimeout(timer)
        resolve(conn)
      })
      this.post({ kind: 'dial', from: this.id, to: address, link })
    })
  }

  async send(conn: ConnId, data: Uint8Array) {
    const c = this.byConn.get(conn)
    if (!c) throw new Error('not connected')
    this.post({ kind: 'msg', from: this.id, to: c.remote, link: c.link, data })
  }

  async disconnect(conn: ConnId) {
    const c = this.byConn.get(conn)
    if (!c) return
    this.post({ kind: 'close', from: this.id, to: c.remote, link: c.link })
    this.drop(c.link)
  }

  async stop() {
    for (const conn of [...this.byConn.keys()]) await this.disconnect(conn)
    this.channel?.close()
    this.channel = null
    this.onEvent = null
  }

  private post(p: Packet) {
    this.channel?.postMessage(p)
  }

  private open(link: string, remote: string): ConnId {
    const conn = this.nextConn++
    this.byLink.set(link, { conn, remote })
    this.byConn.set(conn, { link, remote })
    this.onEvent?.({ type: 'connected', conn, remoteId: remote })
    return conn
  }

  private drop(link: string) {
    const c = this.byLink.get(link)
    if (!c) return
    this.byLink.delete(link)
    this.byConn.delete(c.conn)
    this.onEvent?.({ type: 'closed', conn: c.conn })
  }

  private receive(p: Packet) {
    if (p.to !== this.id) return
    switch (p.kind) {
      case 'dial':
        this.open(p.link, p.from)
        this.post({ kind: 'accept', from: this.id, to: p.from, link: p.link })
        break
      case 'accept': {
        const done = this.dialing.get(p.link)
        if (!done) return
        this.dialing.delete(p.link)
        done(this.open(p.link, p.from))
        break
      }
      case 'msg': {
        const c = this.byLink.get(p.link)
        if (c) this.onEvent?.({ type: 'message', conn: c.conn, data: new Uint8Array(p.data) })
        break
      }
      case 'close':
        this.drop(p.link)
        break
    }
  }
}
