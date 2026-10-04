/** Rows of a CSV file. Finds the separator itself (comma, semicolon or tab) and handles quotes. */
export function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch: string) => firstLine.split(ch).length - 1
  const sep = count('\t') > Math.max(count(';'), count(',')) ? '\t' : count(';') > count(',') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  // Semicolon files usually come from a German Excel, where 1,5 means 1.5.
  if (sep === ';') return rows.map((r) => r.map((v) => (/^-?\d+,\d+$/.test(v.trim()) ? v.trim().replace(',', '.') : v)))
  return rows
}

export function toCSV(rows: string[][]): string {
  return rows.map((r) => r.map((v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\r\n') + '\r\n'
}
