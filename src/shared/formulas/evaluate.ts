import { FormulaError, parse, type Node } from './parser'

/** Variable values by name. A plain object or a Map both work. */
export type Variables = Readonly<Record<string, number>> | ReadonlyMap<string, number>

interface FunctionDef {
  /** Allowed argument counts: [min, max]; max Infinity for variadic. */
  arity: [number, number]
  /** One-line help shown in the custom formula editor. */
  help: string
  fn: (...args: number[]) => number
}

/** Built-in functions (CA-5). `if`, `and` and `or` are handled separately because they only evaluate what they need. */
export const FUNCTIONS: Readonly<Record<string, FunctionDef>> = {
  min: { arity: [1, Infinity], help: 'min(a, b, ...) smallest value', fn: Math.min },
  max: { arity: [1, Infinity], help: 'max(a, b, ...) largest value', fn: Math.max },
  floor: { arity: [1, 1], help: 'floor(x) round down', fn: Math.floor },
  ceil: { arity: [1, 1], help: 'ceil(x) round up', fn: Math.ceil },
  round: {
    arity: [1, 2],
    help: 'round(x) or round(x, digits) round to nearest',
    fn: (x, digits = 0) => {
      const f = 10 ** Math.trunc(digits)
      return Math.round(x * f) / f
    },
  },
  abs: { arity: [1, 1], help: 'abs(x) absolute value', fn: Math.abs },
  sqrt: { arity: [1, 1], help: 'sqrt(x) square root', fn: Math.sqrt },
  pow: { arity: [2, 2], help: 'pow(x, y) same as x ^ y', fn: Math.pow },
  exp: { arity: [1, 1], help: 'exp(x) e to the power x', fn: Math.exp },
  ln: { arity: [1, 1], help: 'ln(x) natural logarithm', fn: Math.log },
  log: {
    arity: [1, 2],
    help: 'log(x) base 10, or log(x, base)',
    fn: (x, base) => (base === undefined ? Math.log10(x) : Math.log(x) / Math.log(base)),
  },
  clamp: { arity: [3, 3], help: 'clamp(x, low, high) keep x between low and high', fn: (x, lo, hi) => Math.min(hi, Math.max(lo, x)) },
  sign: { arity: [1, 1], help: 'sign(x) -1, 0 or 1', fn: Math.sign },
  not: { arity: [1, 1], help: 'not(x) 1 if x is 0, else 0', fn: (x) => (x === 0 ? 1 : 0) },
}

const LAZY_FUNCTIONS: Readonly<Record<string, Pick<FunctionDef, 'arity' | 'help'>>> = {
  if: { arity: [3, 3], help: 'if(condition, then, else) e.g. if(HP < 0, 0, HP)' },
  and: { arity: [1, Infinity], help: 'and(a, b, ...) 1 if all are non-zero' },
  or: { arity: [1, Infinity], help: 'or(a, b, ...) 1 if any is non-zero' },
}

/** Named constants. These names are reserved and never treated as variables. */
export const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E }

/** Every function name with its help text, for an editor's autocomplete or help panel. */
export const FUNCTION_HELP: ReadonlyArray<{ name: string; help: string }> = [...Object.entries(FUNCTIONS), ...Object.entries(LAZY_FUNCTIONS)]
  .map(([name, def]) => ({ name, help: def.help }))
  .sort((a, b) => a.name.localeCompare(b.name))

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

function lookup(vars: Variables, name: string): number | undefined {
  if (vars instanceof Map) return vars.get(name)
  return has(vars, name) ? (vars as Record<string, number>)[name] : undefined
}

/** Checks function names and argument counts, and collects variable names in order of first use. */
function analyze(node: Node, out: Set<string>) {
  switch (node.kind) {
    case 'num':
      return
    case 'var':
      if (!has(CONSTANTS, node.name)) out.add(node.name)
      return
    case 'neg':
      analyze(node.arg, out)
      return
    case 'bin':
      analyze(node.left, out)
      analyze(node.right, out)
      return
    case 'call': {
      const def = has(FUNCTIONS, node.name) ? FUNCTIONS[node.name] : has(LAZY_FUNCTIONS, node.name) ? LAZY_FUNCTIONS[node.name] : undefined
      if (!def) throw new FormulaError(`Unknown function "${node.name}"`, node.pos)
      const [lo, hi] = def.arity
      if (node.args.length < lo || node.args.length > hi) {
        const expected = lo === hi ? `${lo}` : hi === Infinity ? `at least ${lo}` : `${lo} or ${hi}`
        throw new FormulaError(`${node.name}() takes ${expected} value${lo === 1 && hi === 1 ? '' : 's'}, got ${node.args.length}`, node.pos)
      }
      node.args.forEach((a) => analyze(a, out))
    }
  }
}

function evalNode(node: Node, vars: Variables): number {
  switch (node.kind) {
    case 'num':
      return node.value
    case 'var': {
      const v = lookup(vars, node.name)
      if (v !== undefined) return v
      if (has(CONSTANTS, node.name)) return CONSTANTS[node.name]
      throw new FormulaError(`No value for "${node.name}"`, node.pos)
    }
    case 'neg':
      return -evalNode(node.arg, vars)
    case 'bin': {
      const a = evalNode(node.left, vars)
      const b = evalNode(node.right, vars)
      switch (node.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          if (b === 0) throw new FormulaError('Division by zero', 0)
          return a / b
        case '%':
          if (b === 0) throw new FormulaError('Division by zero', 0)
          return a % b
        case '^':
          return a ** b
        case '<':
          return a < b ? 1 : 0
        case '<=':
          return a <= b ? 1 : 0
        case '>':
          return a > b ? 1 : 0
        case '>=':
          return a >= b ? 1 : 0
        case '==':
          return a === b ? 1 : 0
        case '!=':
          return a !== b ? 1 : 0
      }
      throw new Error('unreachable')
    }
    case 'call': {
      if (node.name === 'if') return evalNode(node.args[0], vars) !== 0 ? evalNode(node.args[1], vars) : evalNode(node.args[2], vars)
      if (node.name === 'and') return node.args.every((a) => evalNode(a, vars) !== 0) ? 1 : 0
      if (node.name === 'or') return node.args.some((a) => evalNode(a, vars) !== 0) ? 1 : 0
      return FUNCTIONS[node.name].fn(...node.args.map((a) => evalNode(a, vars)))
    }
  }
}

/** A parsed, validated formula that can be evaluated many times. */
export interface CompiledFormula {
  readonly source: string
  /** Variable names in order of first appearance (constants like `pi` excluded). */
  readonly variables: readonly string[]
  /** Evaluates with the given values. Throws `FormulaError` if a variable is missing or the result is not a finite number. */
  evaluate(vars: Variables): number
}

/** Parses and validates a formula. Throws `FormulaError` on syntax errors, unknown functions or wrong argument counts. */
export function compile(source: string): CompiledFormula {
  const ast = parse(source)
  const names = new Set<string>()
  analyze(ast, names)
  return {
    source,
    variables: [...names],
    evaluate(vars) {
      const result = evalNode(ast, vars)
      if (!Number.isFinite(result)) throw new FormulaError('Result is not a finite number', 0)
      return result
    },
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: FormulaError }

function wrap<T>(f: () => T): Result<T> {
  try {
    return { ok: true, value: f() }
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, error: e }
    throw e
  }
}

/** `compile` that returns an error instead of throwing. Handy while the user is typing a custom formula. */
export function tryCompile(source: string): Result<CompiledFormula> {
  return wrap(() => compile(source))
}

/** Compiles and evaluates in one step, returning an error instead of throwing. */
export function tryEvaluate(formula: string | CompiledFormula, vars: Variables): Result<number> {
  return wrap(() => (typeof formula === 'string' ? compile(formula) : formula).evaluate(vars))
}

export interface RangeRow {
  /** The value of the swept variable for this row (e.g. the level). */
  x: number
  /** The formula result, or null if it failed for this row. */
  value: number | null
  error?: string
}

/**
 * Evaluates a formula across a range of one variable, e.g. damage at levels 1 to 90 (CA-6, LV-6).
 * `from` and `to` are inclusive; at most `maxRows` rows are produced.
 */
export function evaluateRange(
  formula: string | CompiledFormula,
  vars: Variables,
  sweep: { variable: string; from: number; to: number; step?: number; maxRows?: number },
): RangeRow[] {
  const compiled = typeof formula === 'string' ? compile(formula) : formula
  const step = Math.abs(sweep.step ?? 1) || 1
  const dir = sweep.to >= sweep.from ? 1 : -1
  const maxRows = sweep.maxRows ?? 10000
  const base = vars instanceof Map ? Object.fromEntries(vars) : { ...vars }
  const rows: RangeRow[] = []
  for (let n = 0; rows.length < maxRows; n++) {
    // Multiply instead of accumulating so fractional steps do not drift (0.1 + 0.2 ...).
    const x = sweep.from + dir * step * n
    if (dir > 0 ? x > sweep.to + 1e-9 : x < sweep.to - 1e-9) break
    const r = wrap(() => compiled.evaluate({ ...base, [sweep.variable]: x }))
    rows.push(r.ok ? { x, value: r.value } : { x, value: null, error: r.error.message })
  }
  return rows
}

/** Formats a result for display: up to `digits` decimals, trailing zeros dropped (66.666 -> "66.67", 50 -> "50"). */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const rounded = Number(value.toFixed(digits)) || 0 // `|| 0` turns -0 into 0
  return rounded.toLocaleString('en-US', { maximumFractionDigits: digits, useGrouping: false })
}
