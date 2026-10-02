import { Copy, Link2, RefreshCw, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  inviteCode,
  joinProject,
  newInviteCode,
  parseInvite,
  PROFILE_COLORS,
  removeMember,
  setProfile,
  shareProject,
  stopSharingHere,
  useCollab,
  useTeammatesAt,
  type JoinHandle,
} from '@/core/collab'
import { getFs } from '@/core/fs'
import { defaultProjectsDir } from '@/core/project'
import { confirmDialog } from '@/shared/dialogs'
import { Modal } from '@/shared/ui'
import './collab.css'

/** Text shown to users, kept together for translation later. */
const T = {
  shareTitle: 'Work together',
  shareIntro:
    'Share this project so others can edit it live from their own computer (Windows, Mac or Linux). Everyone keeps a full copy, and changes made offline merge when you reconnect. No account or server needed.',
  yourName: 'Your name',
  namePlaceholder: 'How others see you',
  startSharing: 'Share project',
  inviteLabel: 'Invite code',
  inviteHelp: 'Send this code to a teammate. They choose "Join project" on the start screen and paste it. You will be asked to let them in.',
  copy: 'Copy',
  copied: 'Copied',
  newCode: 'New invite code',
  newCodeHelp: 'Codes you already sent stop working.',
  people: 'People in this project',
  you: '(you)',
  online: 'Online',
  offline: 'Offline',
  remove: 'Remove from project',
  stopSharing: 'Stop sharing on this computer',
  close: 'Close',
  joinTitle: 'Join a shared project',
  joinIntro: 'Paste the invite code someone sent you. The project is copied to this computer and stays in sync while you are both online.',
  codePlaceholder: 'EGD1-...',
  saveIn: 'Save in',
  change: 'Change…',
  join: 'Join',
  cancel: 'Cancel',
  connecting: 'Connecting…',
  waiting: (project: string) => `Waiting to be let in to "${project}"…`,
  invalidCode: 'That is not a valid invite code.',
  needName: 'Please enter your name so the others know who you are.',
}

function ProfileFields() {
  const profile = useCollab((s) => s.profile)
  return (
    <div className="collab-profile">
      <label className="collab-field">
        <span>{T.yourName}</span>
        <input className="input" value={profile.name} placeholder={T.namePlaceholder} maxLength={40} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
      </label>
      <div className="collab-colors" role="radiogroup" aria-label="Your color">
        {PROFILE_COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={profile.color === c}
            className={`collab-color${profile.color === c ? ' selected' : ''}`}
            style={{ background: c }}
            title={c}
            onClick={() => setProfile({ ...profile, color: c })}
          />
        ))}
      </div>
    </div>
  )
}

/** Sidebar dialog: start sharing, invite code, people. */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const { shared, online, peers, members, selfId, error, profile } = useCollab()
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!shared || code) return
    let cancelled = false
    inviteCode()
      .then((c) => !cancelled && setCode(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [shared, online, code])

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fn()
      if (typeof result === 'string') setCode(result)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onlineIds = new Set(peers.map((p) => p.id))

  return (
    <Modal onClose={onClose}>
      <h3 className="collab-title">
        <Users size={18} /> {T.shareTitle}
      </h3>
      {!shared && <p className="muted">{T.shareIntro}</p>}
      <ProfileFields />

      {!shared ? (
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            {T.cancel}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              if (!profile.name.trim()) return setMessage(T.needName)
              void run(shareProject)
            }}
          >
            <Link2 size={15} /> {T.startSharing}
          </button>
        </div>
      ) : (
        <>
          <div className="collab-field">
            <span>{T.inviteLabel}</span>
            <div className="collab-code-row">
              <input className="input collab-code" readOnly value={code ?? T.connecting} onFocus={(e) => e.target.select()} />
              <button className="btn" disabled={!code} onClick={() => void copy()}>
                <Copy size={14} /> {copied ? T.copied : T.copy}
              </button>
            </div>
            <span className="muted collab-small">{T.inviteHelp}</span>
            <button className="btn btn-ghost collab-small" title={T.newCodeHelp} disabled={busy} onClick={() => void run(newInviteCode)}>
              <RefreshCw size={13} /> {T.newCode}
            </button>
          </div>

          <div className="collab-field">
            <span>{T.people}</span>
            <ul className="collab-people">
              {members.map((m) => {
                const isSelf = m.id === selfId
                const isOnline = isSelf ? online : onlineIds.has(m.id)
                const live = peers.find((p) => p.id === m.id)
                return (
                  <li key={m.id}>
                    <span className="collab-dot" style={{ background: (isSelf ? profile.color : live?.color) || m.color || 'var(--text-muted)' }} />
                    <span className="collab-person">
                      {(isSelf ? profile.name : live?.name) || m.name || 'Someone'} {isSelf && <span className="muted">{T.you}</span>}
                    </span>
                    <span className={`collab-state${isOnline ? ' online' : ''}`}>{isOnline ? T.online : T.offline}</span>
                    {!isSelf && (
                      <button
                        className="icon-btn"
                        title={T.remove}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: `Remove ${m.name || 'this person'}?`,
                            message: 'They keep their own copy but can no longer connect. Consider making a new invite code too.',
                            confirmLabel: 'Remove',
                            danger: true,
                          })
                          if (ok) removeMember(m.id)
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="modal-actions collab-actions">
            <button
              className="btn btn-ghost collab-danger"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Stop sharing on this computer?',
                  message: 'The project stays here with everything in it, but stops syncing with the others. To work together again you need a new invite.',
                  confirmLabel: 'Stop sharing',
                  danger: true,
                })
                if (ok) {
                  await stopSharingHere()
                  onClose()
                }
              }}
            >
              {T.stopSharing}
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              {T.close}
            </button>
          </div>
        </>
      )}
      {(message || error) && <div className="collab-error">{message ?? error}</div>}
    </Modal>
  )
}

/** Launcher dialog: paste an invite code and join. */
export function JoinDialog({ onClose, onJoined }: { onClose: () => void; onJoined: (root: string) => void }) {
  const profile = useCollab((s) => s.profile)
  const [code, setCode] = useState('')
  const [folder, setFolder] = useState<string | null>(null)
  const [handle, setHandle] = useState<JoinHandle | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void defaultProjectsDir().then((d) => setFolder((f) => f ?? d))
  }, [])

  const invite = parseInvite(code)

  const start = () => {
    setError(null)
    if (!profile.name.trim()) return setError(T.needName)
    if (!invite) return setError(T.invalidCode)
    setStatus(T.connecting)
    const h = joinProject(code, folder ?? undefined, () => setStatus(T.waiting(invite.projectName)))
    setHandle(h)
    setStatus(T.waiting(invite.projectName))
    h.done.then(
      (root) => {
        setHandle(null)
        onJoined(root)
      },
      (e: Error) => {
        setHandle(null)
        setStatus(null)
        if (e.message !== 'Cancelled') setError(e.message)
      },
    )
  }

  const cancel = () => {
    handle?.cancel()
    onClose()
  }

  return (
    <Modal onClose={cancel}>
      <h3 className="collab-title">
        <Users size={18} /> {T.joinTitle}
      </h3>
      <p className="muted">{T.joinIntro}</p>
      <ProfileFields />
      <label className="collab-field">
        <span>{T.inviteLabel}</span>
        <textarea className="input collab-code" rows={3} placeholder={T.codePlaceholder} value={code} onChange={(e) => setCode(e.target.value)} disabled={!!handle} />
      </label>
      <div className="collab-field">
        <span>{T.saveIn}</span>
        <div className="collab-code-row">
          <input className="input" readOnly value={folder ?? ''} />
          <button
            className="btn"
            disabled={!!handle}
            onClick={async () => {
              const picked = await getFs().pickFolder(T.saveIn)
              if (picked) setFolder(picked)
            }}
          >
            {T.change}
          </button>
        </div>
      </div>
      {status && <div className="collab-status">{status}</div>}
      {error && <div className="collab-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn" onClick={cancel}>
          {T.cancel}
        </button>
        <button className="btn btn-primary" disabled={!!handle || !code.trim()} onClick={start}>
          {T.join}
        </button>
      </div>
    </Modal>
  )
}

/** Small sidebar indicator: colored dots for who is online. */
export function PresenceDots() {
  const peers = useCollab((s) => s.peers)
  if (peers.length === 0) return null
  return (
    <span className="collab-dots" title={peers.map((p) => p.name).join(', ')}>
      {peers.slice(0, 4).map((p) => (
        <span key={p.id} className="collab-dot" style={{ background: p.color || 'var(--accent)' }} />
      ))}
    </span>
  )
}

/** Dots for teammates working in a tool or document right now (sidebar rows). */
export function TeammateDots({ at, wholeType = false }: { at: string; wholeType?: boolean }) {
  const here = useTeammatesAt(at, wholeType)
  if (here.length === 0) return null
  return (
    <span className="collab-dots" title={`${here.map((r) => r.name).join(', ')} ${here.length === 1 ? 'is' : 'are'} here`}>
      {here.slice(0, 3).map((r) => (
        <span key={r.clientId} className="collab-dot" style={{ background: r.color }} />
      ))}
    </span>
  )
}
