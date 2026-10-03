import { Puzzle } from 'lucide-react'
import { useState } from 'react'
import { downloadServerPlugin, useCollab, type ServerPlugin } from '@/core/collab'
import { installPlugin, readPluginZip, usePlugins, type PluginPackage } from './plugins'
import { PluginWarningDialog } from './PluginWarningDialog'
import './plugins.css'

const UI = {
  offer: (server: string, names: string) => `${server} offers plugins: ${names}`,
  review: 'Review',
  later: 'Not now',
  note: 'This plugin comes from the server you work on: its admin chose to offer it. Nobody else checked it.',
}

/** Where a plugin came from; the fingerprint makes a changed plugin on the server show up as new. */
const sourceFor = (server: string, p: ServerPlugin) => `Server “${server}” · ${p.sha256.slice(0, 16)}`

/**
 * A server can offer plugins (0.8). Nothing is installed by itself: each one goes
 * through the same plugin warning as any other install, and a changed plugin asks again.
 */
export function ServerPluginOffer() {
  const server = useCollab((s) => s.server)
  const offered = useCollab((s) => s.serverPlugins)
  const installed = usePlugins((s) => s.installed)
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  const [pending, setPending] = useState<PluginPackage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!server) return null
  const missing = offered.filter(
    (p) => !skipped.has(p.sha256) && !installed.some((i) => i.info.id === p.id && i.info.source === sourceFor(server.name, p)),
  )
  if (missing.length === 0 && !pending) return null

  const review = async () => {
    const p = missing[0]
    setBusy(true)
    setError(null)
    try {
      setPending(readPluginZip(await downloadServerPlugin(p), sourceFor(server.name, p)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const finish = async (ok: boolean) => {
    const pkg = pending
    setPending(null)
    if (!pkg) return
    const p = missing.find((m) => m.id === pkg.info.id)
    if (!ok) {
      if (p) setSkipped((s) => new Set(s).add(p.sha256))
      return
    }
    try {
      await installPlugin(pkg)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      {missing.length > 0 && !pending && (
        <div className="server-plugin-offer" role="status">
          <Puzzle size={16} />
          <span>{UI.offer(server.name, missing.map((p) => p.name).join(', '))}</span>
          {error && <span className="plugin-row-error">{error}</span>}
          <button className="btn btn-primary" disabled={busy} onClick={() => void review()}>
            {UI.review}
          </button>
          <button className="btn" onClick={() => setSkipped((s) => new Set([...s, ...missing.map((p) => p.sha256)]))}>
            {UI.later}
          </button>
        </div>
      )}
      {pending && <PluginWarningDialog info={pending.info} note={UI.note} onDone={(ok) => void finish(ok)} />}
    </>
  )
}
