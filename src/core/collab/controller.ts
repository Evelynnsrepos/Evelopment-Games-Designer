import * as Y from 'yjs'
import { create } from 'zustand'
import { getFs, isTauri, safeFolderName } from '../fs'
import { ENTITY_TYPES, type Category, type Entity, type EntityType, type ProjectMeta } from '../model'
import {
  defaultProjectsDir,
  projectPaths,
  saveCategories,
  saveCollection,
  saveMeta,
  writeDocument,
} from '../project'
import {
  addProjectLifecycleHook,
  collabNames,
  flushAll,
  parseDocumentName,
  setCollabBinding,
  sharedMeta,
  useProjectStore,
  type SharedMeta,
} from '../state'
import { AssetSync } from './assetSync'
import { attachPresence } from './presence'
import { invalidate, readTop } from './bridge'
import { BrowserTransport } from './browserTransport'
import { CollabNetwork, type JoinRequest, type Peer, type Profile } from './network'
import { decodeInvite, encodeInvite, newSecret, type Invite, type Reject } from './protocol'
import { CollabSession, type Member } from './session'
import { TauriTransport } from './tauriTransport'
import type { CollabTransport } from './transport'

/**
 * Starts and stops collaboration with the open project, and offers the
 * actions the UI needs: share, invite, join, stop sharing.
 */

export interface ConnectedPeer {
  id: string
  name: string
  color: string
}

interface CollabState {
  /** The open project is shared. */
  shared: boolean
  /** Networking is running for it. */
  online: boolean
  selfId: string
  peers: ConnectedPeer[]
  members: Member[]
  /** Last problem worth showing, in plain words. */
  error: string | null
  profile: Profile
  /** This device shared the project: only the host can remove people, and closing the project ends it for everyone. */
  isHost: boolean
  hostId: string
  /** The host ended the shared project; the shell asks whether to keep this computer's copy. */
  ended: { root: string; projectName: string; host: string } | null
}

const PROFILE_KEY = 'egd.collab.profile'
const COLORS = ['#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#e03131', '#0c8599', '#f08c00', '#c2255c']

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>
      if (typeof p.name === 'string' && typeof p.color === 'string') return { name: p.name, color: p.color }
    }
  } catch {
    // No storage (tests, private mode): use a fresh profile.
  }
  return { name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] }
}

export const useCollab = create<CollabState>()(() => ({
  shared: false,
  online: false,
  selfId: '',
  peers: [],
  members: [],
  error: null,
  profile: loadProfile(),
  isHost: false,
  hostId: '',
  ended: null,
}))

function updateRoles(session: CollabSession, selfId = useCollab.getState().selfId) {
  const hostId = session.hostId ?? ''
  useCollab.setState({ hostId, isHost: !!selfId && hostId === selfId })
}

export const PROFILE_COLORS = COLORS

/** Your name and color as others see them. */
export function setProfile(profile: Profile) {
  useCollab.setState({ profile })
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // Not saved, still used for this session.
  }
  active?.network.setProfile(profile)
}

// ---- transports ---------------------------------------------------------------

let makeTransport: () => CollabTransport = () => (isTauri() ? new TauriTransport() : new BrowserTransport())

/** Tests use an in-memory transport. */
export function setTransportFactory(factory: () => CollabTransport) {
  makeTransport = factory
}

// ---- asking the owner -----------------------------------------------------------

let askToJoin: (request: JoinRequest) => Promise<boolean> = async () => false

/** The shell shows a dialog: "Mia wants to join this project". */
export function setJoinRequestHandler(handler: (request: JoinRequest) => Promise<boolean>) {
  askToJoin = handler
}

// ---- the running session --------------------------------------------------------

interface Active {
  session: CollabSession
  network: CollabNetwork
  assets: AssetSync
  unsubscribe: () => void
}
let active: Active | null = null

export function activeSession(): CollabSession | null {
  return active?.session ?? null
}

/** Awareness of the running session, for presence (cursors, who is where). */
export function activeAwareness() {
  return active?.network.awareness ?? null
}

/**
 * Live rich text for a document field of the open shared project, or null
 * when the project is not shared. See `CollabSession.richText`.
 */
export function sharedRichText(name: string, seedKey: string, seed: (fragment: Y.XmlFragment) => void) {
  const a = active
  if (!a) return null
  return { fragment: a.session.richText(name, seedKey, seed), awareness: a.network.awareness }
}

async function goOnline(session: CollabSession) {
  const network = new CollabNetwork(
    makeTransport(),
    session.doc,
    { kind: 'member', session, onJoinRequest: (r) => askToJoin(r) },
    useCollab.getState().profile,
    {
      peers: (peers) => {
        useCollab.setState({ peers: peers.map(describe) })
        active?.assets.scanSoon()
      },
      rejected: (reason, peer, byUs) => {
        if (!byUs) useCollab.setState({ error: rejectMessage(reason, peer) })
      },
      closed: (message, peer) => {
        // Only the host can end the project for everyone.
        if (message.reason !== 'host-closed' || peer.remoteId !== session.hostId || useCollab.getState().isHost) return
        const projectName = useProjectStore.getState().meta?.name ?? ''
        const host = peer.name || session.members.find((m) => m.id === peer.remoteId)?.name || 'The host'
        void goOffline().then(() => useCollab.setState({ ended: { root: session.root, projectName, host } }))
      },
    },
  )
  const assets = new AssetSync(network, session.doc, session.root)
  const unsubscribe = session.onChange((names) => {
    if (!names.has('members') && !names.has('share')) return
    useCollab.setState({ members: session.members })
    updateRoles(session)
    network.dropNonMembers()
  })
  active = { session, network, assets, unsubscribe }
  useCollab.setState({ shared: true, members: session.members, error: null })
  try {
    await network.start()
    attachPresence(network.awareness)
    useCollab.setState({ online: true, selfId: network.selfId })
    updateRoles(session, network.selfId)
  } catch (error) {
    console.error('Collaboration could not start', error)
    useCollab.setState({ online: false, error: 'Could not start the connection. Your changes are saved and will sync later.' })
  }
}

async function goOffline() {
  const a = active
  active = null
  setCollabBinding(null)
  useCollab.setState({ shared: false, online: false, peers: [], members: [], error: null, isHost: false, hostId: '' })
  attachPresence(null)
  if (!a) return
  a.unsubscribe()
  a.assets.stop()
  await a.network.stop()
  await a.session.close()
}

function describe(p: Peer): ConnectedPeer {
  return { id: p.remoteId, name: p.name || 'Someone', color: p.color }
}

let installed = false

/** Called once at startup: shared projects go online when they open. */
export function installCollaboration() {
  if (installed) return
  installed = true
  addProjectLifecycleHook({
    async opened(root) {
      if (!(await CollabSession.isShared(root))) return
      const session = await CollabSession.load(root)
      const restored = await projectPaths.collabRestored(root)
      if (await getFs().exists(restored)) {
        const { meta, entities, categories } = useProjectStore.getState()
        if (meta) await session.replaceWithFiles({ meta, entities, categories })
        await getFs().remove(restored)
      }
      setCollabBinding(session)
      session.pullAll()
      void goOnline(session)
    },
    async closing() {
      // The host closing the project ends it for everyone who is connected.
      if (useCollab.getState().isHost) await active?.network.sayGoodbye('host-closed')
      await goOffline()
    },
  })
}

// ---- actions for the UI ------------------------------------------------------------

/** Share the open project (if it is not yet) and return an invite code. */
export async function shareProject(): Promise<string> {
  if (!active) {
    const { root, meta, entities, categories } = useProjectStore.getState()
    if (!root || !meta) throw new Error('No project is open')
    // Everything on disk is copied into the shared state, so write pending edits first.
    await flushAll(root)
    const session = await CollabSession.create(root, { meta, entities, categories }, { projectId: meta.id, secret: newSecret() }, null)
    setCollabBinding(session)
    await goOnline(session)
    const { selfId, profile } = useCollab.getState()
    if (selfId) {
      session.setShareInfo({ ...session.shareInfo!, hostId: selfId })
      session.setMembers([{ id: selfId, name: profile.name, color: profile.color, joinedAt: new Date().toISOString() }])
      updateRoles(session, selfId)
    }
  }
  return inviteCode()
}

/** An invite code for the shared project, made from this device's address. */
export async function inviteCode(): Promise<string> {
  const a = active
  if (!a) throw new Error('This project is not shared')
  const info = a.session.shareInfo!
  const meta = useProjectStore.getState().meta
  const address = await a.network.address()
  return encodeInvite({ projectId: info.projectId, projectName: meta?.name ?? '', address, secret: info.secret })
}

/** Make a new invite code; codes given out before stop working. */
export async function newInviteCode(): Promise<string> {
  const a = active
  if (!a) throw new Error('This project is not shared')
  a.session.setShareInfo({ ...a.session.shareInfo!, secret: newSecret() })
  return inviteCode()
}

/** Remove a device: it can no longer connect (it keeps its own copy). Only the host can, and never the host. */
export function removeMember(id: string) {
  const a = active
  if (!a || !useCollab.getState().isHost || id === a.session.hostId) return
  a.session.setMembers(a.session.members.filter((m) => m.id !== id))
  a.network.dropDevice(id)
}

/**
 * Stop sharing on this computer; the project stays here as a normal project.
 * The host ends the shared project for everyone; anyone else leaves it.
 */
export async function stopSharingHere() {
  const a = active
  const root = a?.session.root
  if (a) {
    if (useCollab.getState().isHost) await a.network.sayGoodbye('host-closed')
    else {
      // Leave for good: off the member list, so nobody keeps trying to reach this computer.
      const self = useCollab.getState().selfId
      a.session.setMembers(a.session.members.filter((m) => m.id !== self))
      await a.network.sayGoodbye('left')
    }
  }
  await goOffline()
  if (root) await forgetSharing(root)
}

/** Turn a formerly shared project folder into a normal one (after the host ended it, or after leaving). */
export async function forgetSharing(root: string) {
  const dir = await projectPaths.collabDir(root)
  if (await getFs().exists(dir)) await getFs().remove(dir)
  useCollab.setState({ ended: null })
}

/** Dismiss the "host ended the project" question without deciding (e.g. the dialog closed). */
export function clearEnded() {
  useCollab.setState({ ended: null })
}

// ---- joining -------------------------------------------------------------------------

export interface JoinHandle {
  /** Resolves with the new project's folder once everything arrived. */
  done: Promise<string>
  cancel(): void
}

export function parseInvite(code: string): Invite | null {
  return decodeInvite(code)
}

/**
 * Join a shared project from an invite code. Waits until the owner allows it
 * and the project arrived, writes it into a new folder under `parentDir` and
 * returns that folder (open it with `useProjectStore.getState().open`).
 */
export function joinProject(code: string, parentDir?: string, onWaiting?: () => void): JoinHandle {
  const invite = decodeInvite(code)
  if (!invite) return { done: Promise.reject(new Error('That is not a valid invite code.')), cancel() {} }
  const doc = new Y.Doc()
  doc.on('afterTransaction', invalidate)
  let cancelled = false
  let network: CollabNetwork | null = null
  let settle: { resolve: (root: string) => void; reject: (e: Error) => void } | null = null

  const done = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject }
    network = new CollabNetwork(makeTransport(), doc, { kind: 'join', invite }, useCollab.getState().profile, {
      peers: () => onWaiting?.(),
      rejected: (reason, peer, byUs) => reject(new Error(rejectMessage(reason, peer, byUs))),
      synced: () => {
        if (cancelled) return
        void writeJoinedProject(doc, invite, parentDir).then(resolve, reject)
      },
    })
    network.start().catch((error) => {
      console.error(error)
      reject(new Error('Could not reach the person who invited you. Check that they have the project open.'))
    })
  })
  const finished = done.finally(() => network?.stop())
  finished.catch(() => {})
  return {
    done: finished,
    cancel() {
      cancelled = true
      settle?.reject(new Error('Cancelled'))
    },
  }
}

async function writeJoinedProject(doc: Y.Doc, invite: Invite, parentDir?: string): Promise<string> {
  const shared = readTop(doc, collabNames.meta) as SharedMeta | undefined
  if (!shared) throw new Error('The project did not arrive completely. Please try again.')
  const fs = getFs()
  const parent = parentDir ?? (await defaultProjectsDir())
  await fs.mkdir(parent)
  const base = safeFolderName(shared.name || invite.projectName)
  let root = await fs.join(parent, base)
  for (let n = 2; await fs.exists(root); n++) root = await fs.join(parent, `${base} (${n})`)

  await fs.mkdir(root)
  await fs.mkdir(await projectPaths.entitiesDir(root))
  await fs.mkdir(await projectPaths.imagesDir(root))
  await fs.mkdir(await projectPaths.audioDir(root))
  const meta: ProjectMeta = { ...shared, layout: null, sidebarCollapsed: false }
  await saveMeta(root, meta)
  for (const type of ENTITY_TYPES) {
    await saveCollection(root, type as EntityType, ((readTop(doc, collabNames.entities(type)) as Entity[]) ?? []) as never)
  }
  await saveCategories(root, (readTop(doc, collabNames.categories) as Category[]) ?? [])
  for (const name of doc.share.keys()) {
    const parsed = parseDocumentName(name)
    const value = parsed && readTop(doc, name)
    if (parsed && value !== undefined) await writeDocument(root, parsed.type, parsed.id, value)
  }
  const session = new CollabSession(root, doc)
  await session.saveNow()
  return root
}

export function rejectMessage(reason: Reject, peer?: Peer, byUs = false): string {
  const who = peer?.name || 'The other person'
  switch (reason.reason) {
    case 'version':
      return byUs
        ? `${who} uses a different version of the app. Both of you need the same version to work together.`
        : `${who} uses a different version of the app. Please both update to the latest version.`
    case 'project':
      return 'That invite is for a different project.'
    case 'not-member':
      return `${who} does not have you in this project any more. Ask for a new invite code.`
    case 'denied':
      return `${who} did not let you in.`
    case 'bad-invite':
      return 'This invite code is no longer valid. Ask for a new one.'
    case 'duplicate':
      return 'Already connected.'
  }
}

/** For tests: the shared meta of the open project. */
export function sharedMetaOfOpenProject(): SharedMeta | null {
  const meta = useProjectStore.getState().meta
  return meta ? sharedMeta(meta) : null
}
