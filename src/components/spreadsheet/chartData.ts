export interface ChartData {
  labels: string[]
  series: { name: string; values: number[] }[]
}

export const CHART_COLORS = ['#3e8ef7', '#f08c00', '#2f9e44', '#e03131', '#9c36b5', '#0c8599', '#f5a623', '#c2255c']

/**
 * Chart data from a block of values: a text first row becomes series names,
 * a text first column becomes labels, every other column is a series.
 */
export function chartData(grid: unknown[][]): ChartData {
  const isText = (v: unknown) => v !== null && v !== undefined && v !== '' && typeof v !== 'number'
  const header = grid.length > 1 && grid[0].some(isText)
  const rows = header ? grid.slice(1) : grid
  const labelCol = rows.some((r) => isText(r[0]))
  const first = labelCol ? 1 : 0
  const width = grid[0]?.length ?? 0
  const series = []
  for (let c = first; c < width; c++) {
    series.push({ name: header ? String(grid[0][c] ?? `Series ${c + 1 - first}`) : `Series ${c + 1 - first}`, values: rows.map((r) => (typeof r[c] === 'number' ? (r[c] as number) : 0)) })
  }
  return { labels: rows.map((r, i) => (labelCol ? String(r[0] ?? '') : String(i + 1))), series }
}
