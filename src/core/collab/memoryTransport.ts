import type { CollabTransport, ConnId, TransportEvent } from './transport'

/** Connects MemoryTransports in one process, for tests. */
export class MemoryHub {
  readonly nodes = new Map<string, MemoryTransport>()
  /** Messages are delivered on a later tick, like a real network. */
  deliver(fn: () => void) {
    setTimeout(fn, 0)
  }
}

interface Link {
  remote: MemoryTransport
  remoteConn: ConnId
}

export class MemoryTransport implements CollabTransport {
  readonly kind = 'memory' as const
  private onEvent: ((e: TransportEvent) => void) | null = null
  private readonly links = new Map<ConnId, Link>()
  private nextConn = 1
  readonly hub: MemoryHub
  readonly id: string

  constructor(hub: MemoryHub, id: string) {
    this.hub = hub
    this.id = id
  }

  async start(onEvent: (e: TransportEvent) => void) {
    this.onEvent = onEvent
    this.hub.nodes.set(this.id, this)
    return this.id
  }

  async address() {
    return this.id
  }

  async connect(address: string): Promise<ConnId> {
    const remote = this.hub.nodes.get(address)
    if (!remote || !remote.onEvent) throw new Error('unreachable')
    const mine = this.nextConn++
    const theirs = remote.nextConn++
    this.links.set(mine, { remote, remoteConn: theirs })
    remote.links.set(theirs, { remote: this, remoteConn: mine })
    this.hub.deliver(() => this.emit({ type: 'connected', conn: mine, remoteId: remote.id }))
    this.hub.deliver(() => remote.emit({ type: 'connected', conn: theirs, remoteId: this.id }))
    return mine
  }

  async send(conn: ConnId, data: Uint8Array) {
    const link = this.links.get(conn)
    if (!link) throw new Error('not connected')
    const copy = data.slice()
    this.hub.deliver(() => link.remote.emit({ type: 'message', conn: link.remoteConn, data: copy }))
  }

  async disconnect(conn: ConnId) {
    const link = this.links.get(conn)
    if (!link) return
    this.links.delete(conn)
    link.remote.links.delete(link.remoteConn)
    this.hub.deliver(() => this.emit({ type: 'closed', conn }))
    this.hub.deliver(() => link.remote.emit({ type: 'closed', conn: link.remoteConn }))
  }

  async stop() {
    for (const conn of [...this.links.keys()]) await this.disconnect(conn)
    this.hub.nodes.delete(this.id)
    this.onEvent = null
  }

  private emit(e: TransportEvent) {
    this.onEvent?.(e)
  }
}
