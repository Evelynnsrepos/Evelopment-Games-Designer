/**
 * Safe expression language for calculator formulas (spec CA-5).
 *
 * Grammar (lowest to highest precedence):
 *   expr        = comparison
 *   comparison  = additive (("<" | "<=" | ">" | ">=" | "==" | "!=") additive)?
 *   additive    = term (("+" | "-") term)*
 *   term        = unary (("*" | "/" | "%") unary)*
 *   unary       = ("-" | "+") unary | power
 *   power       = primary ("^" unary)?          right-associative, so 2^3^2 = 2^9 and -2^2 = -4
 *   primary     = number | name | name "(" args ")" | "(" expr ")"
 *
 * Also accepts the written symbols × · ÷ − ≤ ≥ ≠. The parser builds a small AST; nothing is ever
 * passed to `eval` or `Function`, so formulas cannot run arbitrary code.
 */

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^' | '<' | '<=' | '>' | '>=' | '==' | '!='

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string; pos: number }
  | { kind: 'neg'; arg: Node }
  | { kind: 'bin'; op: BinaryOp; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[]; pos: number }

/** A user-facing error. `pos` is the character offset in the source, for highlighting. */
export class FormulaError extends Error {
  readonly pos: number
  constructor(message: string, pos: number) {
    super(message)
    this.name = 'FormulaError'
    this.pos = pos
  }
}

export const MAX_FORMULA_LENGTH = 2000
const MAX_DEPTH = 100

type Token =
  | { t: 'num'; value: number; raw: string; pos: number }
  | { t: 'name'; value: string; pos: number }
  | { t: 'op'; value: string; pos: number }
  | { t: 'end'; pos: number }

const SYMBOL_ALIASES: Record<string, string> = { '×': '*', '·': '*', '÷': '/', '−': '-', '≤': '<=', '≥': '>=', '≠': '!=' }
const TWO_CHAR_OPS = ['<=', '>=', '==', '!=']
const ONE_CHAR_OPS = '+-*/%^()<>,'

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i))
      if (!m) throw new FormulaError(`Unexpected "${ch}"`, i)
      tokens.push({ t: 'num', value: Number(m[0]), raw: m[0], pos: i })
      i += m[0].length
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!
      tokens.push({ t: 'name', value: m[0], pos: i })
      i += m[0].length
      continue
    }
    const two = src.slice(i, i + 2)
    if (TWO_CHAR_OPS.includes(two)) {
      tokens.push({ t: 'op', value: two, pos: i })
      i += 2
      continue
    }
    const op = SYMBOL_ALIASES[ch] ?? ch
    if (ONE_CHAR_OPS.includes(op) || op.length === 2) {
      tokens.push({ t: 'op', value: op, pos: i })
      i++
      continue
    }
    throw new FormulaError(`Unexpected "${ch}"`, i)
  }
  tokens.push({ t: 'end', pos: src.length })
  return tokens
}

const COMPARISON_OPS = ['<', '<=', '>', '>=', '==', '!=']

/** Parses a formula into an AST. Throws `FormulaError` with a position on bad input. */
export function parse(src: string): Node {
  if (src.length > MAX_FORMULA_LENGTH) throw new FormulaError(`Formula is longer than ${MAX_FORMULA_LENGTH} characters`, 0)
  const tokens = tokenize(src)
  let i = 0
  let depth = 0

  const peek = () => tokens[i]
  const isOp = (value: string) => {
    const tok = tokens[i]
    return tok.t === 'op' && tok.value === value
  }
  const describe = (tok: Token) => (tok.t === 'end' ? 'end of formula' : `"${tok.t === 'num' ? tok.raw : tok.value}"`)
  const expectOp = (value: string) => {
    if (!isOp(value)) throw new FormulaError(`Expected "${value}" but found ${describe(peek())}`, peek().pos)
    i++
  }
  const enter = () => {
    if (++depth > MAX_DEPTH) throw new FormulaError('Formula is nested too deeply', peek().pos)
  }

  function expr(): Node {
    enter()
    const left = additive()
    const tok = peek()
    let node = left
    if (tok.t === 'op' && COMPARISON_OPS.includes(tok.value)) {
      i++
      node = { kind: 'bin', op: tok.value as BinaryOp, left, right: additive() }
      const next = peek()
      if (next.t === 'op' && COMPARISON_OPS.includes(next.value)) {
        throw new FormulaError('Chain comparisons with and(...) instead, e.g. and(a < b, b < c)', next.pos)
      }
    }
    depth--
    return node
  }

  function additive(): Node {
    let node = term()
    while (isOp('+') || isOp('-')) {
      const op = (peek() as { value: BinaryOp }).value
      i++
      node = { kind: 'bin', op, left: node, right: term() }
    }
    return node
  }

  function term(): Node {
    let node = unary()
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = (peek() as { value: BinaryOp }).value
      i++
      node = { kind: 'bin', op, left: node, right: unary() }
    }
    return node
  }

  function unary(): Node {
    enter()
    let node: Node
    if (isOp('-')) {
      i++
      node = { kind: 'neg', arg: unary() }
    } else if (isOp('+')) {
      i++
      node = unary()
    } else {
      node = power()
    }
    depth--
    return node
  }

  function power(): Node {
    const base = primary()
    if (isOp('^')) {
      i++
      return { kind: 'bin', op: '^', left: base, right: unary() }
    }
    return base
  }

  function primary(): Node {
    const tok = peek()
    if (tok.t === 'num') {
      i++
      return { kind: 'num', value: tok.value }
    }
    if (tok.t === 'name') {
      i++
      if (isOp('(')) {
        i++
        const args: Node[] = []
        if (!isOp(')')) {
          args.push(expr())
          while (isOp(',')) {
            i++
            args.push(expr())
          }
        }
        expectOp(')')
        return { kind: 'call', name: tok.value, args, pos: tok.pos }
      }
      return { kind: 'var', name: tok.value, pos: tok.pos }
    }
    if (isOp('(')) {
      i++
      const inner = expr()
      expectOp(')')
      return inner
    }
    if (tok.t === 'end') throw new FormulaError(i === 0 ? 'Formula is empty' : 'Formula ends too early', tok.pos)
    throw new FormulaError(`Unexpected ${describe(tok)}`, tok.pos)
  }

  const root = expr()
  if (peek().t !== 'end') throw new FormulaError(`Unexpected ${describe(peek())}`, peek().pos)
  return root
}
