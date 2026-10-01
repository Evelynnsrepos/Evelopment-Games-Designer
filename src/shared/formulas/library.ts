/**
 * Built-in formula library (CA-1, CA-3), grouped by the kind of game that uses it.
 *
 * Variable naming convention, so calculators can wire stats between formulas (LV-4):
 *   ATK, DEF, HP, Level, EnemyLevel, EM (elemental mastery), Damage (damage before this step),
 *   CritRate / CritDMG (percent), RES (resistance percent). Values with unit '%' are typed as percent (15 = 15%).
 *
 * Formula and group ids are stable: presets store them, so never rename an id. Add new entries instead.
 */

export type CalculatorKind = 'damage' | 'level'

export interface FormulaGroup {
  id: string
  calculator: CalculatorKind
  name: string
  /** Which games use these formulas, shown under the group name. */
  gameTypes: string
}

export interface FormulaVariable {
  name: string
  label: string
  defaultValue: number
  unit?: string
  /** One line shown as a hint next to the input. */
  help?: string
  min?: number
  max?: number
}

export interface LibraryFormula {
  id: string
  groupId: string
  name: string
  /** Machine form in the safe expression language. */
  expression: string
  /** Human form shown to the user (CA-3). */
  writtenForm: string
  /** One-line explanation (CA-3). */
  description: string
  resultLabel: string
  resultUnit?: string
  variables: FormulaVariable[]
}

export const FORMULA_GROUPS: readonly FormulaGroup[] = [
  { id: 'elemental', calculator: 'damage', name: 'Elemental reactions', gameTypes: 'Action RPGs with elements, like Genshin Impact' },
  { id: 'armor', calculator: 'damage', name: 'Raw damage with armor', gameTypes: 'Strategy, MOBA, fighting games and classic RPGs' },
  { id: 'critical', calculator: 'damage', name: 'Critical hits', gameTypes: 'Almost every RPG, shooter and action game' },
  { id: 'dot-multihit', calculator: 'damage', name: 'Damage over time and multi-hit', gameTypes: 'MMOs, ARPGs, roguelikes and auto-battlers' },
  { id: 'resistance', calculator: 'damage', name: 'Resistances and weaknesses', gameTypes: 'Monster-catching games, JRPGs and elemental RPGs' },
  { id: 'xp-curve', calculator: 'level', name: 'XP curves', gameTypes: 'RPGs, MMOs, idle and progression games' },
  { id: 'stat-growth', calculator: 'level', name: 'Stat growth', gameTypes: 'Any game where characters, enemies or items level up' },
]

const v = (name: string, label: string, defaultValue: number, extra: Partial<FormulaVariable> = {}): FormulaVariable => ({
  name,
  label,
  defaultValue,
  ...extra,
})
const pct = (name: string, label: string, defaultValue: number, help?: string) => v(name, label, defaultValue, { unit: '%', help })
const DAMAGE = v('Damage', 'Damage before this step', 1000, { min: 0 })
const ATK = v('ATK', 'Attack', 100, { min: 0 })
const DEF = v('DEF', 'Defense', 50, { min: 0 })
const EM = v('EM', 'Elemental mastery', 200, { min: 0 })
const LEVEL = v('Level', 'Level', 1, { min: 1 })

export const FORMULA_LIBRARY: readonly LibraryFormula[] = [
  // Elemental reactions
  {
    id: 'amplifying-reaction',
    groupId: 'elemental',
    name: 'Amplifying reaction',
    expression: 'Damage * ReactionMult * (1 + 2.78 * EM / (EM + 1400) + ReactionBonus / 100)',
    writtenForm: 'Damage = Damage × ReactionMult × (1 + 2.78 × EM ÷ (EM + 1400) + ReactionBonus%)',
    description: 'Vaporize or melt style: the hit is multiplied, and mastery raises the multiplier with diminishing returns.',
    resultLabel: 'Damage',
    variables: [DAMAGE, v('ReactionMult', 'Reaction multiplier', 1.5, { help: 'For example 1.5 or 2' }), EM, pct('ReactionBonus', 'Reaction bonus', 0)],
  },
  {
    id: 'transformative-reaction',
    groupId: 'elemental',
    name: 'Transformative reaction',
    expression: 'LevelBase * ReactionMult * (1 + 16 * EM / (EM + 2000) + ReactionBonus / 100)',
    writtenForm: 'Damage = LevelBase × ReactionMult × (1 + 16 × EM ÷ (EM + 2000) + ReactionBonus%)',
    description: 'Overload or swirl style: damage comes from character level and mastery, not attack.',
    resultLabel: 'Damage',
    variables: [
      v('LevelBase', 'Level base value', 1446.85, { help: 'Grows with level; 1446.85 at level 90 in Genshin Impact', min: 0 }),
      v('ReactionMult', 'Reaction multiplier', 2, { help: 'For example 0.6 for swirl, 2 for overload' }),
      EM,
      pct('ReactionBonus', 'Reaction bonus', 0),
    ],
  },
  {
    id: 'additive-reaction',
    groupId: 'elemental',
    name: 'Additive reaction',
    expression: 'Damage + LevelBase * ReactionMult * (1 + 5 * EM / (EM + 1200) + ReactionBonus / 100)',
    writtenForm: 'Damage = Damage + LevelBase × ReactionMult × (1 + 5 × EM ÷ (EM + 1200) + ReactionBonus%)',
    description: 'Aggravate or spread style: a flat amount based on level and mastery is added to the hit.',
    resultLabel: 'Damage',
    variables: [DAMAGE, v('LevelBase', 'Level base value', 1446.85, { min: 0 }), v('ReactionMult', 'Reaction multiplier', 1.15), EM, pct('ReactionBonus', 'Reaction bonus', 0)],
  },

  // Raw damage with armor
  {
    id: 'flat-armor',
    groupId: 'armor',
    name: 'Flat armor',
    expression: 'max(MinDamage, ATK - DEF)',
    writtenForm: 'Damage = max(MinDamage, ATK − DEF)',
    description: 'Defense is subtracted from attack; a minimum keeps strong armor from making hits do nothing.',
    resultLabel: 'Damage',
    variables: [ATK, DEF, v('MinDamage', 'Minimum damage', 1, { min: 0 })],
  },
  {
    id: 'percentage-armor',
    groupId: 'armor',
    name: 'Percentage armor',
    expression: 'ATK * (1 - DEF / (DEF + K))',
    writtenForm: 'Damage = ATK × (1 − DEF ÷ (DEF + K))',
    description: 'Defense blocks a percentage that grows with diminishing returns; at DEF = K half the damage is blocked.',
    resultLabel: 'Damage',
    variables: [ATK, DEF, v('K', 'Armor constant', 100, { help: 'Defense needed to block 50%', min: 0 })],
  },
  {
    id: 'armor-penetration',
    groupId: 'armor',
    name: 'Armor penetration',
    expression: 'ATK * (1 - max(0, DEF * (1 - PenPct / 100) - FlatPen) / (max(0, DEF * (1 - PenPct / 100) - FlatPen) + K))',
    writtenForm: 'EffectiveDEF = max(0, DEF × (1 − Pen%) − FlatPen);  Damage = ATK × (1 − EffectiveDEF ÷ (EffectiveDEF + K))',
    description: 'Percentage armor where the attacker ignores part of the defense, first as a percentage, then a flat amount.',
    resultLabel: 'Damage',
    variables: [ATK, DEF, v('K', 'Armor constant', 100, { min: 0 }), pct('PenPct', 'Armor penetration', 20), v('FlatPen', 'Flat penetration', 0, { min: 0 })],
  },
  {
    id: 'skill-multiplier',
    groupId: 'armor',
    name: 'Skill multiplier with damage reduction',
    expression: 'ATK * Multiplier * (1 - DEFPct / 100)',
    writtenForm: 'Damage = ATK × Multiplier × (1 − DEF%)',
    description: 'A skill hits for a multiple of attack, then the target removes a fixed percentage.',
    resultLabel: 'Damage',
    variables: [ATK, v('Multiplier', 'Skill multiplier', 1.5), pct('DEFPct', 'Damage reduction', 30)],
  },
  {
    id: 'level-defense',
    groupId: 'armor',
    name: 'Level-based defense',
    expression: 'Damage * (Level + 100) / ((Level + 100) + (EnemyLevel + 100) * (1 - DefReduction / 100))',
    writtenForm: 'Damage = Damage × (Level + 100) ÷ ((Level + 100) + (EnemyLevel + 100) × (1 − DefReduction%))',
    description: 'Defense comes from the level gap between attacker and target, as in Genshin Impact.',
    resultLabel: 'Damage',
    variables: [DAMAGE, v('Level', 'Attacker level', 90, { min: 1 }), v('EnemyLevel', 'Enemy level', 90, { min: 1 }), pct('DefReduction', 'Defense reduction', 0)],
  },

  // Critical hits
  {
    id: 'crit-hit',
    groupId: 'critical',
    name: 'Critical hit',
    expression: 'Damage * (1 + CritDMG / 100)',
    writtenForm: 'Damage = Damage × (1 + CritDMG%)',
    description: 'Damage of a hit that lands as a critical.',
    resultLabel: 'Damage',
    variables: [DAMAGE, pct('CritDMG', 'Crit damage', 50)],
  },
  {
    id: 'crit-average',
    groupId: 'critical',
    name: 'Expected average damage',
    expression: 'Damage * (1 + clamp(CritRate, 0, 100) / 100 * CritDMG / 100)',
    writtenForm: 'Average = Damage × (1 + CritRate% × CritDMG%)',
    description: 'Average damage per hit over many hits, counting how often crits happen.',
    resultLabel: 'Average damage',
    variables: [DAMAGE, pct('CritRate', 'Crit rate', 5, 'Capped at 100%'), pct('CritDMG', 'Crit damage', 50)],
  },
  {
    id: 'crit-value',
    groupId: 'critical',
    name: 'Crit value',
    expression: 'CritRate * 2 + CritDMG',
    writtenForm: 'CritValue = CritRate% × 2 + CritDMG%',
    description: 'A quick score for gear: crit rate counts double because it is usually half as common.',
    resultLabel: 'Crit value',
    variables: [pct('CritRate', 'Crit rate', 10), pct('CritDMG', 'Crit damage', 20)],
  },

  // Damage over time and multi-hit
  {
    id: 'dot-total',
    groupId: 'dot-multihit',
    name: 'Damage over time (total)',
    expression: 'TickDamage * floor(Duration / TickInterval)',
    writtenForm: 'Total = TickDamage × floor(Duration ÷ TickInterval)',
    description: 'Total damage of a burn or poison that ticks at a fixed interval.',
    resultLabel: 'Total damage',
    variables: [v('TickDamage', 'Damage per tick', 50, { min: 0 }), v('Duration', 'Duration', 10, { unit: 's', min: 0 }), v('TickInterval', 'Time between ticks', 1, { unit: 's' })],
  },
  {
    id: 'dot-dps',
    groupId: 'dot-multihit',
    name: 'Damage over time (per second)',
    expression: 'TickDamage / TickInterval',
    writtenForm: 'DPS = TickDamage ÷ TickInterval',
    description: 'How much a ticking effect deals each second.',
    resultLabel: 'Damage per second',
    variables: [v('TickDamage', 'Damage per tick', 50, { min: 0 }), v('TickInterval', 'Time between ticks', 1, { unit: 's' })],
  },
  {
    id: 'multi-hit',
    groupId: 'dot-multihit',
    name: 'Multi-hit attack',
    expression: 'HitDamage * Hits',
    writtenForm: 'Total = HitDamage × Hits',
    description: 'Total damage of an attack that hits several times.',
    resultLabel: 'Total damage',
    variables: [v('HitDamage', 'Damage per hit', 120, { min: 0 }), v('Hits', 'Number of hits', 3, { min: 0 })],
  },
  {
    id: 'dps',
    groupId: 'dot-multihit',
    name: 'Damage per second',
    expression: 'Damage * AttacksPerSecond',
    writtenForm: 'DPS = Damage × AttacksPerSecond',
    description: 'Sustained damage from attack damage and attack speed.',
    resultLabel: 'Damage per second',
    variables: [DAMAGE, v('AttacksPerSecond', 'Attacks per second', 1.2, { min: 0 })],
  },
  {
    id: 'hits-to-defeat',
    groupId: 'dot-multihit',
    name: 'Hits to defeat',
    expression: 'ceil(HP / Damage)',
    writtenForm: 'Hits = ceil(HP ÷ Damage)',
    description: 'How many hits it takes to bring a target from full health to zero.',
    resultLabel: 'Hits',
    variables: [v('HP', 'Target HP', 5000, { min: 0 }), DAMAGE],
  },
  {
    id: 'time-to-defeat',
    groupId: 'dot-multihit',
    name: 'Time to defeat',
    expression: 'HP / (Damage * AttacksPerSecond)',
    writtenForm: 'Time = HP ÷ (Damage × AttacksPerSecond)',
    description: 'Seconds of sustained attacking needed to defeat a target.',
    resultLabel: 'Time',
    resultUnit: 's',
    variables: [v('HP', 'Target HP', 5000, { min: 0 }), DAMAGE, v('AttacksPerSecond', 'Attacks per second', 1.2, { min: 0 })],
  },

  // Resistances and weaknesses
  {
    id: 'type-multiplier',
    groupId: 'resistance',
    name: 'Type or element multiplier',
    expression: 'Damage * TypeMult * (1 + DMGBonus / 100)',
    writtenForm: 'Damage = Damage × TypeMult × (1 + DMGBonus%)',
    description: 'Weaknesses multiply damage (2 = super effective, 0.5 = resisted, 0 = immune), plus any damage bonus.',
    resultLabel: 'Damage',
    variables: [DAMAGE, v('TypeMult', 'Type multiplier', 2), pct('DMGBonus', 'Damage bonus', 0)],
  },
  {
    id: 'resistance-percent',
    groupId: 'resistance',
    name: 'Resistance percentage',
    expression: 'Damage * if(RES < 0, 1 - RES / 200, if(RES < 75, 1 - RES / 100, 1 / (1 + 4 * RES / 100)))',
    writtenForm: 'Damage = Damage × (1 − RES% ÷ 2 if RES < 0;  1 − RES% if RES < 75%;  1 ÷ (1 + 4 × RES%) otherwise)',
    description: 'Resistance removes a percentage; negative resistance helps at half rate and very high resistance has diminishing returns.',
    resultLabel: 'Damage',
    variables: [DAMAGE, pct('RES', 'Resistance', 10, 'Can be negative after shred')],
  },
  {
    id: 'monster-type-damage',
    groupId: 'resistance',
    name: 'Monster battle damage',
    expression: '((2 * Level / 5 + 2) * Power * ATK / DEF / 50 + 2) * STAB * TypeMult',
    writtenForm: 'Damage = ((2 × Level ÷ 5 + 2) × Power × ATK ÷ DEF ÷ 50 + 2) × STAB × TypeMult',
    description: 'The classic monster-catching formula: level, move power and the attack/defense ratio, then same-type bonus and type effectiveness.',
    resultLabel: 'Damage',
    variables: [
      v('Level', 'Level', 50, { min: 1 }),
      v('Power', 'Move power', 80, { min: 0 }),
      v('ATK', 'Attack', 120, { min: 0 }),
      v('DEF', 'Defense', 100, { min: 1 }),
      v('STAB', 'Same-type bonus', 1.5, { help: '1.5 if the move matches the user type, else 1' }),
      v('TypeMult', 'Type multiplier', 2),
    ],
  },

  // XP curves (LV-1)
  {
    id: 'xp-linear',
    groupId: 'xp-curve',
    name: 'Linear XP curve',
    expression: 'Base + Increase * (Level - 1)',
    writtenForm: 'XP = Base + Increase × (Level − 1)',
    description: 'Each level needs a fixed amount more XP than the one before.',
    resultLabel: 'XP to next level',
    variables: [v('Base', 'XP for level 1', 100, { min: 0 }), v('Increase', 'Extra XP per level', 50), LEVEL],
  },
  {
    id: 'xp-polynomial',
    groupId: 'xp-curve',
    name: 'Polynomial XP curve',
    expression: 'Base * Level ^ Exponent',
    writtenForm: 'XP = Base × Level ^ Exponent',
    description: 'XP grows faster each level; exponent 1.5 to 3 is common.',
    resultLabel: 'XP to next level',
    variables: [v('Base', 'Base XP', 100, { min: 0 }), v('Exponent', 'Exponent', 1.5), LEVEL],
  },
  {
    id: 'xp-exponential',
    groupId: 'xp-curve',
    name: 'Exponential XP curve',
    expression: 'Base * Growth ^ (Level - 1)',
    writtenForm: 'XP = Base × Growth ^ (Level − 1)',
    description: 'Each level needs a fixed percentage more XP; gets steep quickly, common in idle games.',
    resultLabel: 'XP to next level',
    variables: [v('Base', 'XP for level 1', 100, { min: 0 }), v('Growth', 'Growth per level', 1.1, { help: '1.1 = 10% more each level' }), LEVEL],
  },

  // Stat growth (LV-3)
  {
    id: 'stat-flat',
    groupId: 'stat-growth',
    name: 'Flat stat growth',
    expression: 'Base + PerLevel * (Level - 1)',
    writtenForm: 'Stat = Base + PerLevel × (Level − 1)',
    description: 'The stat goes up by the same amount every level.',
    resultLabel: 'Stat',
    variables: [v('Base', 'Stat at level 1', 100), v('PerLevel', 'Gain per level', 10), LEVEL],
  },
  {
    id: 'stat-percent',
    groupId: 'stat-growth',
    name: 'Percentage stat growth (compounding)',
    expression: 'Base * (1 + Growth / 100) ^ (Level - 1)',
    writtenForm: 'Stat = Base × (1 + Growth%) ^ (Level − 1)',
    description: 'The stat goes up by a percentage of its current value every level.',
    resultLabel: 'Stat',
    variables: [v('Base', 'Stat at level 1', 100), pct('Growth', 'Growth per level', 5), LEVEL],
  },
  {
    id: 'stat-percent-of-base',
    groupId: 'stat-growth',
    name: 'Percentage of base stat growth',
    expression: 'Base * (1 + Growth / 100 * (Level - 1))',
    writtenForm: 'Stat = Base × (1 + Growth% × (Level − 1))',
    description: 'The stat goes up by a percentage of its level 1 value every level, so growth stays steady.',
    resultLabel: 'Stat',
    variables: [v('Base', 'Stat at level 1', 100), pct('Growth', 'Growth per level', 5), LEVEL],
  },
]

const byId = new Map(FORMULA_LIBRARY.map((f) => [f.id, f]))

export function getFormula(id: string): LibraryFormula | undefined {
  return byId.get(id)
}

/** Groups for one calculator with their formulas, in display order (CA-1). */
export function libraryFor(calculator: CalculatorKind): Array<FormulaGroup & { formulas: LibraryFormula[] }> {
  return FORMULA_GROUPS.filter((g) => g.calculator === calculator).map((g) => ({
    ...g,
    formulas: FORMULA_LIBRARY.filter((f) => f.groupId === g.id),
  }))
}

/** The default input values of a library formula, ready to evaluate. */
export function defaultValues(formula: LibraryFormula): Record<string, number> {
  return Object.fromEntries(formula.variables.map((x) => [x.name, x.defaultValue]))
}
