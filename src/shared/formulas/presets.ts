import { compile, type CompiledFormula, type Result, type Variables } from './evaluate'
import { FormulaError } from './parser'
import { getFormula } from './library'

/**
 * A formula configured with a game's own numbers (CA-4), e.g. "Sword basic attack".
 * Calculators store presets in their own documents; this is the shared shape other components
 * (Level and Resource Calculator) read, so keep it stable.
 */
export interface FormulaPreset {
  id: string
  name: string
  /** A library formula id, or null for a custom formula. */
  formulaId: string | null
  /** The custom formula (CA-5). Used only when `formulaId` is null. */
  expression?: string
  /** Input values by variable name. */
  values: Record<string, number>
}

/** The expression a preset evaluates. Throws `FormulaError` if it points at an unknown library formula. */
export function presetExpression(preset: Pick<FormulaPreset, 'formulaId' | 'expression'>): string {
  if (preset.formulaId === null) return preset.expression ?? ''
  const f = getFormula(preset.formulaId)
  if (!f) throw new FormulaError(`Unknown formula "${preset.formulaId}"`, 0)
  return f.expression
}

export function compilePreset(preset: Pick<FormulaPreset, 'formulaId' | 'expression'>): CompiledFormula {
  return compile(presetExpression(preset))
}

/**
 * Evaluates a preset. `overrides` replace stored values, e.g. `{ ATK: grownAtk }` from the Level Calculator (LV-4).
 * Returns an error instead of throwing.
 */
export function evaluatePreset(preset: FormulaPreset, overrides: Variables = {}): Result<number> {
  try {
    const extra = overrides instanceof Map ? Object.fromEntries(overrides) : overrides
    return { ok: true, value: compilePreset(preset).evaluate({ ...preset.values, ...extra }) }
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, error: e }
    throw e
  }
}
