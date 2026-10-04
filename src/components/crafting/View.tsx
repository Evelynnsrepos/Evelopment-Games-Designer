import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Entity } from '@/core/model'
import type { PanelProps } from '@/core/registry'
import { useProjectStore, useUndoRedoKeys } from '@/core/state'
import { NumberInput } from '@/shared/calculators'
import { FlowGraph } from '@/shared/graph'
import { Field, ListDetail, useItems } from '@/shared/listDetail'
import { breakdown, createCraftingDoc, keyOf, newIngredient, newRecipe, tree, type CraftingDoc, type Ingredient, type Recipe } from './model'

/** Crafting & recipes (v0.10). */
export default function View({ active }: PanelProps) {
  const list = useItems<Recipe, CraftingDoc>('crafting', 'crafting', createCraftingDoc)
  useUndoRedoKeys(list.doc, active)
  const items = useProjectStore((s) => s.entities.item) as Entity[]
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const r = list.items.find((x) => x.id === selectedId)
  const label = (i: Ingredient) => (i.itemId ? (items.find((x) => x.id === i.itemId)?.name ?? '(deleted item)') : i.name || '?')

  return (
    <ListDetail
      rows={list.items.map((x) => ({ id: x.id, label: x.name, sub: [x.outputs.map(label).join(', '), x.station].filter(Boolean).join(' · ') }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onAdd={() => {
        const n = newRecipe()
        list.add(n)
        setSelectedId(n.id)
      }}
      addLabel="New recipe"
      empty="No recipes yet. Make one with New recipe: what goes in, what comes out."
    >
      {r && <RecipePage r={r} recipes={list.items} items={items} label={label} edit={(p) => list.edit(r.id, p)} remove={() => (list.remove(r.id), setSelectedId(null))} />}
    </ListDetail>
  )
}

function IngredientRows({ list, items, onChange }: { list: Ingredient[]; items: Entity[]; onChange(next: Ingredient[]): void }) {
  const set = (i: number, patch: Partial<Ingredient>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div className="ld-section">
      {list.map((ing, i) => (
        <div key={i} className="ld-inline">
          <NumberInput value={ing.amount} min={0} onChange={(amount) => set(i, { amount })} />
          <span>×</span>
          <select className="input" value={ing.itemId ?? ''} onChange={(e) => set(i, { itemId: e.target.value || null })}>
            <option value="">Not in the Item List:</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name || 'Untitled'}
              </option>
            ))}
          </select>
          {!ing.itemId && <input className="input" placeholder="Name, e.g. Iron ore" value={ing.name} onChange={(e) => set(i, { name: e.target.value })} />}
          <button className="icon-btn" aria-label="Remove" title="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button className="btn btn-ghost ld-danger" onClick={() => onChange([...list, newIngredient()])}>
        <Plus size={14} /> Add
      </button>
    </div>
  )
}

function RecipePage({ r, recipes, items, label, edit, remove }: { r: Recipe; recipes: Recipe[]; items: Entity[]; label(i: Ingredient): string; edit(p: Partial<Recipe>): void; remove(): void }) {
  const [amount, setAmount] = useState(1)
  const target = r.outputs.find((o) => o.itemId || o.name.trim())
  const key = target ? keyOf(target) : null
  const b = key ? breakdown(recipes, key, amount, label) : null
  const t = key ? tree(recipes, key, label) : null
  const mins = b ? b.seconds / 60 : 0
  return (
    <div className="ld-page">
      <input className="input wide" style={{ fontSize: 18, fontWeight: 600 }} value={r.name} onChange={(e) => edit({ name: e.target.value })} aria-label="Recipe name" />
      <Field label="Station">
        <input className="input" placeholder="e.g. Forge, Alchemy table" value={r.station} onChange={(e) => edit({ station: e.target.value })} />
      </Field>
      <Field label="Crafting time (seconds)">
        <NumberInput value={r.seconds} min={0} onChange={(seconds) => edit({ seconds })} />
      </Field>
      <div className="ld-section">
        <strong>Goes in</strong>
        <IngredientRows list={r.inputs} items={items} onChange={(inputs) => edit({ inputs })} />
      </div>
      <div className="ld-section">
        <strong>Comes out</strong>
        <IngredientRows list={r.outputs} items={items} onChange={(outputs) => edit({ outputs })} />
      </div>
      <Field label="Notes" wide>
        <textarea className="input" rows={2} value={r.notes} onChange={(e) => edit({ notes: e.target.value })} />
      </Field>

      {b && t && target && (
        <div className="ld-section">
          <strong>Crafting tree for {label(target)}</strong>
          <FlowGraph nodes={t.nodes} edges={t.edges} />
          <div className="ld-inline">
            Raw materials for
            <NumberInput value={amount} min={1} onChange={(v) => setAmount(Math.max(1, Math.round(v)))} />× {label(target)}:
          </div>
          <div className="ld-result">
            {[...b.raw.values()].map((m) => (
              <div key={m.label} className="ld-stat">
                <span>{m.label}</span>
                <strong>{Math.round(m.amount * 100) / 100}</strong>
              </div>
            ))}
            <div className="ld-stat">
              <span>Crafting time</span>
              <strong>{mins >= 1 ? `${Math.round(mins * 10) / 10} min` : `${b.seconds} s`}</strong>
            </div>
          </div>
          {b.loops.length > 0 && <p className="muted">Some recipes go in a circle ({[...new Set(b.loops)].join(', ')}); the tree stops there.</p>}
        </div>
      )}
      <button className="btn btn-danger ld-danger" onClick={remove}>
        <Trash2 size={14} /> Delete recipe
      </button>
    </div>
  )
}
