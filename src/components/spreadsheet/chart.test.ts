import { describe, expect, it } from 'vitest'
import { chartData } from './chartData'

describe('chart data', () => {
  it('uses a text header row and label column', () => {
    expect(chartData([['', 'HP', 'ATK'], ['Slime', 10, 2], ['Bat', 6, 3]])).toEqual({
      labels: ['Slime', 'Bat'],
      series: [
        { name: 'HP', values: [10, 6] },
        { name: 'ATK', values: [2, 3] },
      ],
    })
    expect(chartData([[1], [2]])).toEqual({ labels: ['1', '2'], series: [{ name: 'Series 1', values: [1, 2] }] })
  })
})
