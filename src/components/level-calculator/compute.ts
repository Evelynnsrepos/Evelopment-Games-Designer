import type { Enemy, Id } from '@/core/model'
import {
  costAtLevel,
  enemyTargetValues,
  levelRange,
  statsAtLevel,
  TARGET_VARIABLES,
  toFormulaPreset,
  xpTable,
  type DamagePresetDoc,
  type LevelPresetDoc,
} from '@/shared/calculators'
import { getFormula, presetExpression, tryCompile, type CompiledFormula } from '@/shared/formulas'

/** The damage formula a Level preset uses (LV-4), resolved from a Damage preset or a library formula. */
export interface DamageSource {
  expression: string
  /** Values typed in the preset or formula; stats, level and target replace them per level. */
  values: Record<string, number>
  resultLabel: string
}

export function damageSource(doc: LevelPresetDoc, preset: { id: Id; name: string; data: DamagePresetDoc } | null): DamageSource | null {
  if (doc.damage.source === 'preset') {
    if (!preset) return null
    let expression = ''
    try {
      expression = presetExpression(toFormulaPreset(preset.id, preset.name, preset.data))
    } catch {
      expression = ''
    }
    const label = preset.data.formulaId ? (getFormula(preset.data.formulaId)?.resultLabel ?? 'Damage') : 'Damage'
    return { expression, values: preset.data.values, resultLabel: label }
  }
  if (doc.damage.source === 'formula') {
    const f = getFormula(doc.damage.formulaId)
    if (!f) return null
    return { expression: f.expression, values: doc.damage.values, resultLabel: f.resultLabel }
  }
  return null
}

/** Where each variable of the damage formula gets its value at a level, for the inputs list. */
export type VariableOrigin = 'level' | 'stat' | 'target' | 'input'

export function variableOrigins(variables: readonly string[], doc: LevelPresetDoc): Record<string, VariableOrigin> {
  const statNames = new Set(doc.stats.map((s) => s.stat.trim()).filter(Boolean))
  const targetNames = new Set(doc.target.mode === 'none' ? [] : TARGET_VARIABLES)
  const out: Record<string, VariableOrigin> = {}
  for (const v of variables) {
    if (targetNames.has(v) && (doc.target.mode === 'enemy' || v in doc.target.values)) out[v] = 'target'
    else if (statNames.has(v)) out[v] = 'stat'
    else if (v === 'Level') out[v] = 'level'
    else out[v] = 'input'
  }
  return out
}

export interface LevelRow {
  level: number
  toNext: number | null
  totalXp: number | null
  stats: Record<string, number>
  damage: number | null
  damageError?: string
  /** The target's HP at this level, when known (LV-5). */
  targetHp: number | null
  /** Hits needed to defeat the target. */
  hits: number | null
  /** Level-up cost per cost row id: materials to go from this level to the next (LV-6). */
  costs: Record<Id, number | null>
}

/** Fixed target values the user typed (LV-5), limited to target variables. */
function fixedTarget(doc: LevelPresetDoc): Record<string, number> {
  return Object.fromEntries(Object.entries(doc.target.values).filter(([k]) => TARGET_VARIABLES.includes(k)))
}

/**
 * The whole Level Calculator table: XP (LV-2), grown stats (LV-3), damage per level (LV-4) against a target
 * (LV-5), hits to defeat it and level-up costs (LV-6). Later values win: formula inputs < Level < stats < target.
 */
export function computeLevels(doc: LevelPresetDoc, source: DamageSource | null, enemy: Enemy | null): { rows: LevelRow[]; damageError: string | null } {
  const levels = levelRange(doc)
  const xp = doc.xp.enabled ? xpTable(doc) : []
  let compiled: CompiledFormula | null = null
  let damageError: string | null = null
  if (source) {
    const c = tryCompile(source.expression)
    if (c.ok) compiled = c.value
    else damageError = c.error.message
  }
  const fixed = fixedTarget(doc)
  const rows = levels.map((level, i): LevelRow => {
    const stats = statsAtLevel(doc.stats, level)
    let target: Record<string, number> = {}
    if (doc.target.mode === 'fixed') target = fixed
    else if (doc.target.mode === 'enemy' && enemy) target = enemyTargetValues(enemy, doc.target.enemyLevel ?? level)
    let damage: number | null = null
    let error: string | undefined
    if (compiled && source) {
      try {
        damage = compiled.evaluate({ ...source.values, Level: level, ...stats, ...target })
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
    }
    const targetHp = doc.target.mode === 'none' ? null : (target.HP ?? null)
    const hits = targetHp !== null && damage !== null && damage > 0 ? Math.ceil(targetHp / damage - 1e-9) : null
    const costs: Record<Id, number | null> = {}
    for (const c of doc.costs) costs[c.id] = costAtLevel(c, level)
    return {
      level,
      toNext: xp[i]?.toNext ?? null,
      totalXp: xp[i]?.total ?? null,
      stats,
      damage,
      damageError: error,
      targetHp,
      hits,
      costs,
    }
  })
  return { rows, damageError }
}

/** Per-character number categories as stats, so a character can be a stat source (LV-3). */
export function numericCategoryStats(values: Record<Id, unknown>, categories: ReadonlyArray<{ id: Id; name: string; kind: string }>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of categories) {
    const v = values[c.id]
    if (c.kind === 'number' && typeof v === 'number' && Number.isFinite(v)) out[c.name] = v
  }
  return out
}
