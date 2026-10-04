import { Plus, X } from 'lucide-react'
import { LineChart, NumberInput } from '@/shared/calculators'
import '@/shared/listDetail/listDetail.css'
import { newResource, simulate, type LoopDoc, type LoopResource } from './model'

/** Gameplay loop simulation (v0.10): what each step gains and spends, played over many loops. */
export function SimPanel({ d, set }: { d: LoopDoc; set(fn: (d: LoopDoc) => LoopDoc): void }) {
  const res = d.resources ?? []
  const loops = d.simLoops ?? 20
  const r = simulate(d, loops)
  const editRes = (id: string, patch: Partial<LoopResource>) => set((x) => ({ ...x, resources: (x.resources ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
  const effect = (nodeId: string, resourceId: string) => d.nodes.find((n) => n.id === nodeId)?.effects?.find((e) => e.resourceId === resourceId)?.amount ?? 0
  const setEffect = (nodeId: string, resourceId: string, amount: number) =>
    set((x) => ({
      ...x,
      nodes: x.nodes.map((n) => (n.id !== nodeId ? n : { ...n, effects: [...(n.effects ?? []).filter((e) => e.resourceId !== resourceId), ...(amount ? [{ resourceId, amount }] : [])] })),
    }))
  const perLoop = (id: string) => d.nodes.reduce((s, n) => s + effect(n.id, id), 0)
  const fmtTime = (min: number) => (min >= 120 ? `${Math.round((min / 60) * 10) / 10} h` : `${Math.round(min)} min`)

  return (
    <div className="gl-sim">
      <section>
        <h3>Resources</h3>
        <p className="muted">What the loop produces or uses up. Gains can grow every loop, for example because later areas pay more.</p>
        <table className="calc-table gl-simtable">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Start</th>
              <th>Gains grow % per loop</th>
              <th>Goal</th>
              <th>Net per loop</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {res.map((x) => (
              <tr key={x.id}>
                <td>
                  <input className="input" value={x.name} onChange={(e) => editRes(x.id, { name: e.target.value })} />
                </td>
                <td>
                  <NumberInput value={x.start} onChange={(start) => editRes(x.id, { start })} />
                </td>
                <td>
                  <NumberInput value={x.growth} onChange={(growth) => editRes(x.id, { growth })} />
                </td>
                <td>
                  <NumberInput value={x.goal} min={0} onChange={(goal) => editRes(x.id, { goal })} />
                </td>
                <td>{perLoop(x.id)}</td>
                <td>
                  <button
                    className="icon-btn"
                    aria-label="Remove"
                    onClick={() => set((y) => ({ ...y, resources: (y.resources ?? []).filter((o) => o.id !== x.id), nodes: y.nodes.map((n) => ({ ...n, effects: n.effects?.filter((e) => e.resourceId !== x.id) })) }))}
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-ghost" onClick={() => set((x) => ({ ...x, resources: [...(x.resources ?? []), newResource(res.length ? 'Resource' : 'Gold')] }))}>
          <Plus size={14} /> Add resource
        </button>
      </section>

      {res.length > 0 && (
        <section>
          <h3>Per step</h3>
          <p className="muted">How much each step gains (positive) or spends (negative) every time it is played.</p>
          <table className="calc-table gl-simtable">
            <thead>
              <tr>
                <th>Step</th>
                {res.map((x) => (
                  <th key={x.id}>{x.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.nodes.map((n) => (
                <tr key={n.id}>
                  <td>{n.title}</td>
                  {res.map((x) => (
                    <td key={x.id}>
                      <NumberInput value={effect(n.id, x.id)} onChange={(v) => setEffect(n.id, x.id, v)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {res.length > 0 && (
        <section>
          <h3>
            Simulate
            <label className="gl-check">
              <NumberInput value={loops} min={1} max={10000} onChange={(v) => set((x) => ({ ...x, simLoops: Math.max(1, Math.round(v)) }))} /> loops ({fmtTime(r.minutes[r.minutes.length - 1])})
            </label>
          </h3>
          <LineChart xs={r.minutes.map((_, i) => i)} series={res.map((x) => ({ name: x.name, values: r.history[x.id] }))} xLabel="Loop" />
          <div className="ld-result">
            {res.map((x) => (
              <div key={x.id} className="ld-stat">
                <span>{x.name} after {loops} loops</span>
                <strong>{r.history[x.id][r.history[x.id].length - 1]}</strong>
                {x.goal > 0 && (
                  <span>{r.goals[x.id] === null ? `goal of ${x.goal} not reached` : `goal of ${x.goal} after loop ${r.goals[x.id]} (${fmtTime(r.minutes[r.goals[x.id]!])})`}</span>
                )}
              </div>
            ))}
          </div>
          {r.shortfalls.map((s) => (
            <p key={s.resourceId} className="gl-warn">
              {res.find((x) => x.id === s.resourceId)?.name} runs out in loop {s.loop} at {s.step}: the loop spends more than it gains.
            </p>
          ))}
        </section>
      )}
    </div>
  )
}
