import { newId } from '@/core/model'

/** One editable option row. `original` remembers the saved text so renames can update stored values. */
export interface OptionRow {
  key: string
  original: string | null
  value: string
}

export const rowsFromOptions = (options: string[]): OptionRow[] => options.map((o) => ({ key: newId(), original: o, value: o }))

/** `{ old: new }` for options whose text changed. */
export function renamesFromRows(rows: OptionRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const v = r.value.trim()
    if (r.original !== null && v && v !== r.original) out[r.original] = v
  }
  return out
}
