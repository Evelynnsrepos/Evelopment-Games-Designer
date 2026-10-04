import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { PanelProps } from '@/core/registry'
import { useUndoRedoKeys } from '@/core/state'
import { NumberInput } from '@/shared/calculators'
import { formatYear, fromDayNumber, newEra, toDayNumber, useCalendar, weekdayOf, yearLength, type CalendarDoc, type Era, type Month } from '@/shared/calendar'
import { newId } from '@/core/model'
import '@/shared/listDetail/listDetail.css'
import './calendar.css'

/** Custom calendars and eras (v0.10). */
export default function View({ active }: PanelProps) {
  const doc = useCalendar()
  useUndoRedoKeys(doc, active)
  const [year, setYear] = useState(1)
  const [month, setMonth] = useState(0)
  const [calc, setCalc] = useState({ y: 1, m: 0, d: 1, add: 100 })
  if (!doc.data) return null
  const c = doc.data
  const set = (patch: Partial<CalendarDoc>) => doc.update((x) => ({ ...x, ...patch }))
  const editMonth = (id: string, patch: Partial<Month>) => set({ months: c.months.map((m) => (m.id === id ? { ...m, ...patch } : m)) })
  const editEra = (id: string, patch: Partial<Era>) => set({ eras: c.eras.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  const m = Math.min(month, c.months.length - 1)
  const first = c.months.length ? toDayNumber(c, year, m, 1) : 0
  const lead = weekdayOf(c, first)
  const days = c.months[m]?.days ?? 0
  const later = c.months.length ? fromDayNumber(c, toDayNumber(c, calc.y, Math.min(calc.m, c.months.length - 1), calc.d) + calc.add) : null
  const eras = [...c.eras].sort((a, b) => a.start - b.start)

  return (
    <div className="cal">
      <section className="cal-col">
        <h3>Months</h3>
        {c.months.map((mo) => (
          <div key={mo.id} className="ld-inline">
            <input className="input" value={mo.name} onChange={(e) => editMonth(mo.id, { name: e.target.value })} />
            <NumberInput value={mo.days} min={1} max={400} onChange={(v) => editMonth(mo.id, { days: Math.max(1, Math.round(v)) })} />
            <span className="muted">days</span>
            <button className="icon-btn" aria-label="Remove month" onClick={() => set({ months: c.months.filter((x) => x.id !== mo.id) })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost cal-add" onClick={() => set({ months: [...c.months, { id: newId(), name: 'New month', days: 30 }] })}>
          <Plus size={14} /> Add month
        </button>
        <p className="muted">
          A year has {c.months.length} months and {yearLength(c)} days.
        </p>
        <h3>Weekdays</h3>
        <input className="input" value={c.weekdays.join(', ')} onChange={(e) => set({ weekdays: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) })} />
        <label className="ld-field">
          <span>Year 1 starts on</span>
          <select className="input" value={c.firstWeekday} onChange={(e) => set({ firstWeekday: Number(e.target.value) })}>
            {c.weekdays.map((w, i) => (
              <option key={i} value={i}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="cal-col">
        <h3>Eras</h3>
        <p className="muted">Named ages. Each era counts its own years from 1, starting at an absolute year on your timelines.</p>
        {eras.map((e) => (
          <div key={e.id} className="cal-era">
            <input type="color" value={e.color} onChange={(ev) => editEra(e.id, { color: ev.target.value })} aria-label="Color" />
            <input className="input" value={e.name} onChange={(ev) => editEra(e.id, { name: ev.target.value })} aria-label="Era name" />
            <input className="input cal-abbr" value={e.abbr} onChange={(ev) => editEra(e.id, { abbr: ev.target.value })} aria-label="Short form" />
            <span className="muted">from year</span>
            <NumberInput value={e.start} onChange={(v) => editEra(e.id, { start: Math.round(v) })} />
            <button className="icon-btn" aria-label="Remove era" onClick={() => set({ eras: c.eras.filter((x) => x.id !== e.id) })}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost cal-add" onClick={() => set({ eras: [...c.eras, newEra(eras.length ? eras[eras.length - 1].start + 1000 : 1)] })}>
          <Plus size={14} /> Add era
        </button>
        {eras.length > 0 && (
          <div className="cal-bar">
            {eras.map((e, i) => (
              <div key={e.id} style={{ background: e.color, flex: i < eras.length - 1 ? eras[i + 1].start - e.start : 300 }} title={`${e.name}: from ${e.start}`}>
                {e.abbr}
              </div>
            ))}
          </div>
        )}
        <label className="ld-inline">
          <input type="checkbox" checked={c.useOnTimeline} onChange={(e) => set({ useOnTimeline: e.target.checked })} /> Show era years on timelines
        </label>
      </section>

      <section className="cal-col">
        <h3>Month view</h3>
        <div className="ld-inline">
          <select className="input" value={m} onChange={(e) => setMonth(Number(e.target.value))}>
            {c.months.map((mo, i) => (
              <option key={mo.id} value={i}>
                {mo.name}
              </option>
            ))}
          </select>
          <span>year</span>
          <NumberInput value={year} min={1} onChange={(v) => setYear(Math.max(1, Math.round(v)))} />
          <span className="muted">{formatYear(c, year)}</span>
        </div>
        <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, c.weekdays.length)}, 1fr)` }}>
          {c.weekdays.map((w) => (
            <div key={w} className="cal-wd">
              {w.slice(0, 3)}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => (
            <div key={i} className="cal-day">
              {i + 1}
            </div>
          ))}
        </div>
        <h3>Date calculator</h3>
        <div className="ld-inline">
          Day
          <NumberInput value={calc.d} min={1} onChange={(v) => setCalc({ ...calc, d: Math.max(1, Math.round(v)) })} />
          of
          <select className="input" value={calc.m} onChange={(e) => setCalc({ ...calc, m: Number(e.target.value) })}>
            {c.months.map((mo, i) => (
              <option key={mo.id} value={i}>
                {mo.name}
              </option>
            ))}
          </select>
          year
          <NumberInput value={calc.y} min={1} onChange={(v) => setCalc({ ...calc, y: Math.max(1, Math.round(v)) })} />
        </div>
        <div className="ld-inline">
          plus
          <NumberInput value={calc.add} onChange={(v) => setCalc({ ...calc, add: Math.round(v) })} />
          days is
        </div>
        {later && (
          <p className="cal-result">
            {c.weekdays[weekdayOf(c, toDayNumber(c, later.year, later.month, later.day))]}, {later.day} {c.months[later.month]?.name}, year {formatYear(c, later.year)}
          </p>
        )}
      </section>
    </div>
  )
}
