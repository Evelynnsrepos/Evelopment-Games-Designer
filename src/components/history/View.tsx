import { ExternalLink, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import type { Entity, EntityType, Id } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useDocument, useProjectStore } from '@/core/state'
import { ENTITY_LABELS } from '@/shared/categories'
import { confirmDialog } from '@/shared/dialogs'
import { openEntity } from '@/shared/entityList'
import { createHistoryDoc, diff, HISTORY_DOC, type HistoryDoc } from '@/shared/history'
import { ListDetail } from '@/shared/listDetail'
import './history.css'

/** History & compare (v0.10): earlier versions of entries, what changed, and restore. */
export default function View(_props: PanelProps) {
  const doc = useDocument<HistoryDoc>(HISTORY_DOC.type, HISTORY_DOC.id, createHistoryDoc)
  const entities = useProjectStore((s) => s.entities)
  const categories = useProjectStore((s) => s.categories)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compare, setCompare] = useState<{ a: number; b: number | 'now' } | null>(null)
  const h = doc.data?.entries ?? {}
  const current = (id: Id) => (Object.values(entities).flat() as Entity[]).find((e) => e.id === id)
  const ids = Object.keys(h).sort((x, y) => (h[y].at(-1)?.at ?? '').localeCompare(h[x].at(-1)?.at ?? ''))
  const versions = selectedId ? (h[selectedId] ?? []) : []
  const now = selectedId ? current(selectedId) : undefined
  const catName = (id: Id) => categories.find((c) => c.id === id)?.name ?? 'category'
  const pick = compare ?? (versions.length ? { a: Math.max(0, versions.length - 2), b: 'now' as const } : null)
  const left = pick ? versions[pick.a]?.data : undefined
  const right = pick ? (pick.b === 'now' ? now : versions[pick.b]?.data) : undefined
  const changes = left && right ? diff(left, right, catName) : []
  const when = (iso: string) => new Date(iso).toLocaleString()

  const restore = async (i: number) => {
    const v = versions[i]
    if (!v || !now) return
    if (!(await confirmDialog({ title: `Go back to the version of ${when(v.at)}?`, message: 'The entry gets its old name, text and numbers back. You can undo this in its list.', confirmLabel: 'Restore' }))) return
    const { id: _id, type, createdAt: _c, ...rest } = v.data
    useProjectStore.getState().updateEntity(type as EntityType, now.id, rest)
  }

  return (
    <ListDetail
      rows={ids.map((id) => {
        const e = current(id) ?? h[id].at(-1)!.data
        return { id, label: e.name || 'Untitled', sub: `${ENTITY_LABELS[e.type].one} · ${h[id].length} versions · ${when(h[id].at(-1)!.at)}${current(id) ? '' : ' · deleted'}` }
      })}
      selectedId={selectedId}
      onSelect={(id) => {
        setSelectedId(id)
        setCompare(null)
      }}
      empty="No history yet. Edit an item, character, town or enemy and its versions show up here."
    >
      {selectedId && versions.length > 0 && pick && (
        <div className="hi">
          <div className="ld-inline">
            <h3 style={{ margin: 0 }}>{(now ?? versions.at(-1)!.data).name}</h3>
            {now && (
              <button className="btn btn-ghost" onClick={() => openEntity(now.type, now.id)}>
                <ExternalLink size={13} /> Open
              </button>
            )}
          </div>
          <div className="ld-inline">
            Compare
            <select className="input" value={pick.a} onChange={(e) => setCompare({ a: Number(e.target.value), b: pick.b })}>
              {versions.map((v, i) => (
                <option key={v.at} value={i}>
                  {when(v.at)}
                </option>
              ))}
            </select>
            with
            <select className="input" value={String(pick.b)} onChange={(e) => setCompare({ a: pick.a, b: e.target.value === 'now' ? 'now' : Number(e.target.value) })}>
              {now && <option value="now">now</option>}
              {versions.map((v, i) => (
                <option key={v.at} value={i}>
                  {when(v.at)}
                </option>
              ))}
            </select>
          </div>
          {changes.length === 0 ? (
            <p className="muted">No differences.</p>
          ) : (
            <table className="calc-table hi-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.field}>
                    <td>{c.field}</td>
                    <td className="hi-old">{c.before}</td>
                    <td className="hi-new">{c.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h4>All versions</h4>
          {[...versions].reverse().map((v, ri) => {
            const i = versions.length - 1 - ri
            return (
              <div key={v.at} className="ld-inline hi-version">
                <span>{when(v.at)}</span>
                <span className="muted">{v.data.name}</span>
                {now && (
                  <button className="btn btn-ghost" onClick={() => void restore(i)}>
                    <RotateCcw size={13} /> Restore
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </ListDetail>
  )
}
