import type { DamagePresetDoc } from '@/shared/calculators'
import { defaultValues, evaluateRange, getFormula, tryCompile, tryEvaluate, type FormulaVariable, type RangeRow, type Result } from '@/shared/formulas'

/** Value given to a custom formula's variable that has none yet; 1 avoids dividing by zero. */
export const CUSTOM_DEFAULT = 1

export interface ActiveFormula {
  isCustom: boolean
  name: string
  writtenForm: string
  description: string
  resultLabel: string
  resultUnit?: string
  expression: string
  variables: FormulaVariable[]
  /** Why the custom formula cannot be used, or null. */
  error: string | null
}

const CUSTOM_TEXT = {
  name: 'Custom formula',
  description: 'Your own formula. Use + − × ÷ ^, functions like min, max, floor, round, and any variable names.',
  result: 'Result',
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g

/** The formula a document shows: its library formula, or the custom formula with variables read from it (CA-5). */
export function activeFormula(doc: DamagePresetDoc): ActiveFormula {
  const lib = doc.formulaId === null ? undefined : getFormula(doc.formulaId)
  if (lib) return { ...lib, isCustom: false, error: null }
  const compiled = tryCompile(doc.expression)
  // While the formula has a typo, keep showing inputs for the names already typed so they do not jump around.
  const names = compiled.ok ? compiled.value.variables : [...new Set(doc.expression.match(IDENT) ?? [])].filter((n) => n in doc.values)
  return {
    isCustom: true,
    name: CUSTOM_TEXT.name,
    writtenForm: doc.expression,
    description: CUSTOM_TEXT.description,
    resultLabel: CUSTOM_TEXT.result,
    expression: doc.expression,
    variables: names.map((name) => ({ name, label: name, defaultValue: CUSTOM_DEFAULT })),
    error: doc.expression.trim() === '' ? null : compiled.ok ? null : compiled.error.message,
  }
}

/** Input values for every variable of the active formula, filling gaps with defaults. */
export function filledValues(doc: DamagePresetDoc, f = activeFormula(doc)): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of f.variables) out[v.name] = doc.values[v.name] ?? v.defaultValue
  return out
}

/** The live result (CA-2). */
export function evaluateDoc(doc: DamagePresetDoc): Result<number> | null {
  const f = activeFormula(doc)
  if (f.expression.trim() === '') return null
  const c = tryCompile(f.expression)
  if (!c.ok) return c
  return tryEvaluate(c.value, filledValues(doc, f))
}

/**
 * Switches to another library formula, or to a custom formula (`null`). Values the user already typed for
 * variables with the same name (ATK, DEF, ...) are kept; new variables get the formula's defaults.
 * An empty custom formula starts as a copy of the formula being left, so it can be tweaked.
 */
export function switchFormula(doc: DamagePresetDoc, formulaId: string | null): DamagePresetDoc {
  if (formulaId === doc.formulaId) return doc
  const leaving = activeFormula(doc)
  const kept = filledValues(doc, leaving)
  if (formulaId === null) {
    const expression = doc.expression.trim() === '' ? leaving.expression : doc.expression
    const next: DamagePresetDoc = { ...doc, formulaId: null, expression, values: { ...doc.values, ...kept } }
    return withRangeVariable(next)
  }
  const f = getFormula(formulaId)
  if (!f) return doc
  const values = { ...defaultValues(f) }
  for (const v of f.variables) if (v.name in kept) values[v.name] = kept[v.name]
  return withRangeVariable({ ...doc, formulaId, values })
}

/** Keeps the swept variable valid for the active formula (CA-6). */
export function withRangeVariable(doc: DamagePresetDoc): DamagePresetDoc {
  const names = activeFormula(doc).variables.map((v) => v.name)
  if (names.length === 0 || names.includes(doc.range.variable)) return doc
  const variable = names.includes('Level') ? 'Level' : names.includes('ATK') ? 'ATK' : names[0]
  const base = doc.values[variable] ?? CUSTOM_DEFAULT
  const span = variable === 'Level' ? { from: 1, to: 90, step: 1 } : { from: base, to: base * 2 || 10, step: Math.max(1, Math.abs(base) / 10) || 1 }
  return { ...doc, range: { ...doc.range, variable, ...span } }
}

/** The preset across a range of one variable (CA-6). */
export function rangeRows(doc: DamagePresetDoc): RangeRow[] {
  const f = activeFormula(doc)
  const c = tryCompile(f.expression)
  if (!c.ok || !f.variables.some((v) => v.name === doc.range.variable)) return []
  return evaluateRange(c.value, filledValues(doc, f), { ...doc.range, maxRows: 1000 })
}
