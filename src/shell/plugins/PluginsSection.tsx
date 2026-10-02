import { useState } from 'react'
import { getFs } from '@/core/fs'
import { confirmDialog } from '@/shared/dialogs'
import { downloadFromGitHub, installPlugin, readPluginZip, uninstallPlugin, usePlugins, type PluginPackage } from './plugins'
import { PluginWarningDialog } from './PluginWarningDialog'
import './plugins.css'

const UI = {
  title: 'Plugins',
  about: 'Plugins add new tools. Paste the link of a plugin on GitHub, or pick a plugin zip. See docs/PLUGINS.md to make your own.',
  none: 'No plugins installed.',
  url: 'https://github.com/name/plugin',
  install: 'Install',
  fromZip: 'Install from zip…',
  working: 'Downloading…',
  remove: 'Remove',
  removeTitle: (name: string) => `Remove ${name}?`,
  removeText: 'The plugin is deleted from this computer. What you made with it stays in your projects and comes back if you install it again.',
}

/** Settings → Plugins: list, install from GitHub or a zip (always behind the warning), remove. */
export function PluginsSection() {
  const installed = usePlugins((s) => s.installed)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PluginPackage | null>(null)

  const prepare = async (load: () => Promise<PluginPackage>) => {
    setError(null)
    setBusy(true)
    try {
      setPending(await load())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const fromZip = async () => {
    const [file] = await getFs().pickFiles('Install a plugin zip', ['zip'])
    if (file) await prepare(async () => readPluginZip(await getFs().readBinary(file), file))
  }

  const finish = async (ok: boolean) => {
    const pkg = pending
    setPending(null)
    if (!ok || !pkg) return
    try {
      await installPlugin(pkg)
      setUrl('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (id: string, name: string) => {
    if (await confirmDialog({ title: UI.removeTitle(name), message: UI.removeText, confirmLabel: UI.remove, danger: true })) await uninstallPlugin(id)
  }

  return (
    <section>
      <h3>{UI.title}</h3>
      <p className="muted settings-hint">{UI.about}</p>
      <div className="plugin-list">
        {installed.length === 0 && <span className="muted">{UI.none}</span>}
        {installed.map((p) => (
          <div key={p.info.id} className="plugin-row">
            <div className="plugin-row-main">
              <div>
                {p.info.name} <span className="muted">{p.info.version}</span>
              </div>
              {p.info.source && <div className="muted settings-hint">{p.info.source}</div>}
              {p.error && <div className="plugin-row-error">{p.error}</div>}
            </div>
            <button className="btn" onClick={() => void remove(p.info.id, p.info.name)}>
              {UI.remove}
            </button>
          </div>
        ))}
      </div>
      <form
        className="plugin-install"
        onSubmit={(e) => {
          e.preventDefault()
          if (url.trim()) void prepare(() => downloadFromGitHub(url))
        }}
      >
        <input className="input" placeholder={UI.url} value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} />
        <button className="btn" type="submit" disabled={busy || !url.trim()}>
          {busy ? UI.working : UI.install}
        </button>
        <button className="btn" type="button" disabled={busy} onClick={() => void fromZip()}>
          {UI.fromZip}
        </button>
      </form>
      {error && <p className="settings-error">{error}</p>}
      {pending && <PluginWarningDialog info={pending.info} onDone={(ok) => void finish(ok)} />}
    </section>
  )
}
