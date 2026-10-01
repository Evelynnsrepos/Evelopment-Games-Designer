/**
 * Formula engine and built-in library for the calculators (spec 8.3, CA-1..CA-6).
 *
 *   import { compile, libraryFor, getFormula, defaultValues, evaluateRange, formatNumber } from '@/shared/formulas'
 *
 *   const f = getFormula('percentage-armor')!
 *   compile(f.expression).evaluate({ ATK: 100, DEF: 50, K: 100 })        // 66.666...
 *   evaluateRange(f.expression, { DEF: 50, K: 100, ATK: 0 }, { variable: 'ATK', from: 100, to: 200, step: 10 })
 */
export { FormulaError, MAX_FORMULA_LENGTH, parse, type Node } from './parser'
export {
  CONSTANTS,
  FUNCTION_HELP,
  compile,
  evaluateRange,
  formatNumber,
  tryCompile,
  tryEvaluate,
  type CompiledFormula,
  type RangeRow,
  type Result,
  type Variables,
} from './evaluate'
export {
  FORMULA_GROUPS,
  FORMULA_LIBRARY,
  defaultValues,
  getFormula,
  libraryFor,
  type CalculatorKind,
  type FormulaGroup,
  type FormulaVariable,
  type LibraryFormula,
} from './library'
export { compilePreset, evaluatePreset, presetExpression, type FormulaPreset } from './presets'
