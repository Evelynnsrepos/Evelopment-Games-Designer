import { Redo2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { Id } from '@/core/model'
import { useProjectStore } from '@/core/state'
import './calculators.css'

/**
 * A number field that lets the user type freely ("-", "1.", empty) and only reports valid numbers.
 * The shown text follows `value` again when it changes from outside (undo, picking a preset).
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className = 'input calc-number',
  'aria-label': ariaLabel,
  id,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  'aria-label'?: string
  id?: string
}) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    // Follow outside changes, but keep what the user typed if it already means this value ("1." for 1).
    setShown(value)
    if (Number(text) !== value || text.trim() === '') setText(String(value))
  }
  return (
    <input
      id={id}
      className={className}
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step ?? 'any'}
      aria-label={ariaLabel}
      onChange={(e) => {
        setText(e.target.value)
        const n = e.target.valueAsNumber
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

const T = {
  name: 'Preset name',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
}

/** Title row of a calculator document: the preset name (= sidebar title) and undo/redo (CA-4). */
export function PresetHeader({
  documentId,
  kind,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  documentId: Id
  kind: string
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  const title = useProjectStore((s) => s.meta?.documents.find((d) => d.id === documentId)?.title ?? '')
  const rename = useProjectStore((s) => s.renameDocument)
  const [text, setText] = useState(title)
  const [shown, setShown] = useState(title)
  if (shown !== title) {
    setShown(title)
    setText(title)
  }
  const commit = () => {
    const t = text.trim()
    if (t && t !== title) rename(documentId, t)
    else setText(title)
  }
  return (
    <div className="calc-header">
      <span className="calc-header-kind">{kind}</span>
      <input
        className="calc-header-title"
        aria-label={T.name}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      <button className="icon-btn" title={T.undo} aria-label={T.undo} disabled={!canUndo} onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button className="icon-btn" title={T.redo} aria-label={T.redo} disabled={!canRedo} onClick={redo}>
        <Redo2 size={16} />
      </button>
    </div>
  )
}
