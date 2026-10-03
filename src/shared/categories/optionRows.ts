import { newId, type OptionStyle } from '@/core/model'

/** One editable option row. `original` remembers the saved text so renames can update stored values. */
export interface OptionRow {
  key: string
  original: string | null
  value: string
  /** Color, border and icon when the category has styles (v0.6). */
  style?: OptionStyle
}

export const NEW_STYLE: OptionStyle = { color: '#9aa0a6', border: 'solid', icon: null }

export const rowsFromOptions = (options: string[], styles?: Record<string, OptionStyle>): OptionRow[] =>
  options.map((o) => ({ key: newId(), original: o, value: o, style: styles?.[o] }))

/** The styles to store for these rows, keyed by the (new) option text. */
export function stylesFromRows(rows: OptionRow[]): Record<string, OptionStyle> {
  const out: Record<string, OptionStyle> = {}
  for (const r of rows) {
    const v = r.value.trim()
    if (v && !(v in out)) out[v] = r.style ?? NEW_STYLE
  }
  return out
}

/** `{ old: new }` for options whose text changed. */
export function renamesFromRows(rows: OptionRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const v = r.value.trim()
    if (r.original !== null && v && v !== r.original) out[r.original] = v
  }
  return out
}
