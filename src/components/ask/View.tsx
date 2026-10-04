import { invoke } from '@tauri-apps/api/core'
import { MessageCircleQuestion, ScanSearch, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isTauri } from '@/core/fs'
import { newId, type Entity, type EntityType, type Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { loadDocumentNow, useDocument, useProjectStore, useSettings } from '@/core/state'
import { openEntity } from '@/shared/entityList'
import { richTextToPlainText, type RichTextDoc } from '@/shared/richtext'
import { useAiHelper } from '@/shared/spell'
import { Modal } from '@/shared/ui'
import { articleTitle, openWikiArticle, WIKI_INDEX_ID, type WikiArticleDoc, type WikiIndex } from '@/shared/wiki'
import { openComponent } from '@/shell/editor/actions'
import { openSettings } from '@/shell/settings/open'
import { asksToWrite, notesText, pick, type Note } from './retrieve'
import './ask.css'

/**
 * Ask your project (v0.10): look things up in your own notes with the local
 * AI helper. Everything stays on this computer, and it never writes for you.
 */

interface Exchange {
  id: Id
  question: string
  answer: string
  sources: Note[]
  at: string
}

interface AskDoc {
  items: Exchange[]
}

const TYPE: Record<EntityType, string> = { item: 'Item', character: 'Character', town: 'Town', enemy: 'Enemy' }
const SEEN_KEY = 'egd.ask.privacySeen'
const NO_WRITING = 'This tool only looks things up in what you have already written. It does not write stories, scenes, dialogue, names or ideas for you; your ideas stay yours.'

/** Everything in the project that tells something about the world, as short notes. */
async function gatherNotes(root: string): Promise<Note[]> {
  const { entities, categories, meta } = useProjectStore.getState()
  const all = entities as Record<EntityType, Entity[]>
  const name = (t: EntityType, id: Id) => all[t].find((e) => e.id === id)?.name ?? ''
  const notes: Note[] = []
  for (const t of Object.keys(TYPE) as EntityType[]) {
    for (const e of all[t]) {
      const cats = Object.entries(e.categories)
        .filter(([, v]) => v !== null && v !== '')
        .map(([id, v]) => `${categories.find((c) => c.id === id)?.name ?? 'Category'}: ${v}`)
      const links = 'links' in e ? (e.links as { label: string; targetType: EntityType; targetId: Id }[]).map((l) => `${l.label || 'Related'}: ${name(l.targetType, l.targetId)}`) : []
      notes.push({ title: `${TYPE[t]}: ${e.name || 'Untitled'}`, text: [e.description, e.notes, ...cats, ...links].filter(Boolean).join('\n'), ref: { kind: t, id: e.id } })
    }
  }
  const index = await loadDocumentNow<WikiIndex>(root, 'wiki', WIKI_INDEX_ID, () => ({ articles: [] }))
  for (const a of index?.articles ?? []) {
    const doc = await loadDocumentNow<WikiArticleDoc>(root, 'wiki', a.id, () => ({ body: null }))
    const text = doc?.body ? richTextToPlainText(doc.body as RichTextDoc, (t) => (t.kind in TYPE ? name(t.kind as EntityType, t.id) : undefined)) : ''
    notes.push({ title: `Wiki: ${articleTitle(a, all)}`, text, ref: { kind: 'article', id: a.id } })
  }
  for (const d of meta?.documents ?? []) {
    if (d.type === 'writer') {
      const doc = await loadDocumentNow<{ body?: RichTextDoc }>(root, 'writer', d.id, () => ({}))
      if (doc?.body) notes.push({ title: `Writing: ${d.title}`, text: richTextToPlainText(doc.body), ref: { kind: 'doc', id: d.id, type: 'writer' } })
    }
    if (d.type === 'dialogue') {
      const doc = await loadDocumentNow<{ lines?: { speakerName: string; speakerId: Id | null; text: string }[] }>(root, 'dialogue', d.id, () => ({}))
      const lines = (doc?.lines ?? []).map((l) => `${l.speakerId ? name('character', l.speakerId) : l.speakerName}: ${l.text}`)
      if (lines.length) notes.push({ title: `Dialogue: ${d.title}`, text: lines.join('\n'), ref: { kind: 'doc', id: d.id, type: 'dialogue' } })
    }
    if (d.type === 'timeline') {
      const doc = await loadDocumentNow<{ scene?: { nodes: { kind: string; text?: string }[] } }>(root, 'timeline', d.id, () => ({}))
      const events = (doc?.scene?.nodes ?? []).filter((n) => n.kind === 'tl-event' && n.text).map((n) => n.text)
      if (events.length) notes.push({ title: `Timeline: ${d.title}`, text: events.join('\n'), ref: { kind: 'doc', id: d.id, type: 'timeline' } })
    }
  }
  const quests = await loadDocumentNow<{ quests?: { id: Id; name: string; summary: string; objectives: { text: string }[] }[] }>(root, 'quests', 'quests', () => ({ quests: [] }))
  for (const q of quests?.quests ?? []) notes.push({ title: `Quest: ${q.name}`, text: [q.summary, ...q.objectives.map((o) => o.text)].filter(Boolean).join('\n'), ref: { kind: 'doc', id: '', type: 'quests' } })
  return notes
}

const open = (n: Note) => {
  if (n.ref.kind in TYPE) openEntity(n.ref.kind as EntityType, n.ref.id)
  else if (n.ref.kind === 'article') openWikiArticle(n.ref.id)
  else if (n.ref.type) openComponent(n.ref.type as never, n.ref.id || null)
}

const seenPrivacy = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** What this tool is and is not: local, offline, no training, no writing for you. */
function PrivacyWindow({ onClose }: { onClose(): void }) {
  return (
    <Modal onClose={onClose}>
      <div className="ask-privacy">
        <h3>
          <ShieldCheck size={20} /> Your project stays yours
        </h3>
        <ul>
          <li>
            <strong>Everything is local.</strong> The AI helper runs on this computer. Nothing leaves your PC, and nothing from your project is sent anywhere.
          </li>
          <li>
            <strong>It works offline.</strong> Because nothing is sent, you can use it without an internet connection.
          </li>
          <li>
            <strong>No training data is collected.</strong> Your questions, notes and answers are not used to train any AI and are not collected by anyone.
          </li>
          <li>
            <strong>Your ideas stay your ideas.</strong> This is only a tool to help your creative process: it looks things up in what you have already written and points out where your notes
            contradict each other.
          </li>
          <li>
            <strong>It does not write for you.</strong> It cannot generate stories, scenes, dialogue, names or ideas, and it will not write anything for you. Requests like that are turned away.
          </li>
        </ul>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            I understand
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function View(_props: PanelProps) {
  const doc = useDocument<AskDoc>('ask', 'ask', () => ({ items: [] }))
  const root = useProjectStore((s) => s.root)
  const entities = useProjectStore((s) => s.entities)
  const model = useSettings((s) => s.aiModel)
  const ai = useAiHelper()
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkId, setCheckId] = useState('')
  const [privacy, setPrivacy] = useState(() => !seenPrivacy())
  useEffect(() => {
    void useAiHelper.getState().check()
  }, [])
  if (!doc.data) return null
  const items = doc.data.items
  const closePrivacy = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Shown again next time; nothing else depends on it.
    }
    setPrivacy(false)
  }
  const add = (x: Omit<Exchange, 'id' | 'at'>) => doc.update((d) => ({ items: [...d.items, { ...x, id: newId(), at: new Date().toISOString() }] }))

  const ask = async (q: string, focus?: Note) => {
    if (!root || !q.trim() || busy) return
    if (!focus && asksToWrite(q)) {
      add({ question: q, answer: NO_WRITING, sources: [] })
      setQuestion('')
      return
    }
    setBusy(true)
    setError('')
    try {
      const notes = await gatherNotes(root)
      const chosen = pick(notes, focus ? `${focus.title} ${focus.text}` : q, focus ? 5000 : 6000)
      const sources = focus ? [focus, ...chosen.filter((n) => n.title !== focus.title)] : chosen
      if (!sources.length) add({ question: q, answer: 'Nothing in the project mentions this yet.', sources: [] })
      else {
        const answer = await invoke<string>('llm_ask', { question: q, notes: notesText(sources), model })
        add({ question: q, answer, sources: sources.map((s) => ({ ...s, text: '' })) })
      }
      setQuestion('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const checkEntry = async () => {
    if (!root || !checkId) return
    const notes = await gatherNotes(root)
    const focus = notes.find((n) => `${n.ref.kind}:${n.ref.id}` === checkId)
    if (focus) await ask(`Does anything in the other notes contradict "${focus.title}"? List each contradiction or say there is none.`, focus)
  }

  const allEntries = (Object.keys(TYPE) as EntityType[]).flatMap((t) => (entities[t] as Entity[]).map((e) => ({ key: `${t}:${e.id}`, label: `${TYPE[t]}: ${e.name || 'Untitled'}` })))
  const privacyButton = (
    <button className="btn btn-ghost" onClick={() => setPrivacy(true)} title="Everything stays on your computer">
      <ShieldCheck size={14} /> Local and private
    </button>
  )

  if (!isTauri() || ai.installed === false) {
    return (
      <div className="ask ask-empty">
        <MessageCircleQuestion size={36} />
        <h3>Ask your project needs the AI helper</h3>
        <p className="muted">It runs on your computer, so your project never leaves it. Download it once in Settings, then look things up in your own world.</p>
        {isTauri() && (
          <button className="btn btn-primary" onClick={openSettings}>
            Open Settings
          </button>
        )}
        {privacyButton}
        {privacy && <PrivacyWindow onClose={closePrivacy} />}
      </div>
    )
  }

  return (
    <div className="ask">
      <div className="ask-log">
        {items.length === 0 && (
          <div className="ask-intro">
            <h3>Ask your project</h3>
            <p className="muted">
              Look things up in your own world, like “Who rules Ashvale?” or “What do we know about the Moon Gem?”. The AI helper reads the entries that fit the question (items, characters,
              towns, enemies, wiki, writing, quests, dialogue and timelines) and answers only from them, naming what it used.
            </p>
            <p className="muted">Check an entry looks for contradictions between one entry and the rest of the project. {NO_WRITING}</p>
          </div>
        )}
        {items.map((x) => (
          <div key={x.id} className="ask-item">
            <div className="ask-q">{x.question}</div>
            <div className="ask-a">{x.answer}</div>
            {x.sources.length > 0 && (
              <div className="ask-sources">
                From:{' '}
                {x.sources.map((s) => (
                  <button key={s.title} className="ask-src" onClick={() => open(s)}>
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="ask-item ask-busy">Reading your project… the first answer can take a minute while the AI helper starts.</div>}
        {error && <p className="ask-bad">{error}</p>}
      </div>
      <div className="ask-bar">
        <textarea
          className="input"
          rows={2}
          placeholder="Look something up in your world…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(question)
            }
          }}
        />
        <button className="btn btn-primary" disabled={busy || !question.trim()} onClick={() => void ask(question)}>
          <MessageCircleQuestion size={14} /> Ask
        </button>
      </div>
      <div className="ask-check">
        <select className="input" value={checkId} onChange={(e) => setCheckId(e.target.value)}>
          <option value="">Check an entry for contradictions…</option>
          {allEntries.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </select>
        <button className="btn" disabled={busy || !checkId} onClick={() => void checkEntry()}>
          <ScanSearch size={14} /> Check
        </button>
        {items.length > 0 && (
          <button className="btn btn-ghost" onClick={() => doc.update(() => ({ items: [] }))}>
            <Trash2 size={14} /> Clear
          </button>
        )}
        <span style={{ flex: 1 }} />
        {privacyButton}
      </div>
      {privacy && <PrivacyWindow onClose={closePrivacy} />}
    </div>
  )
}
