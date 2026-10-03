import { describe, expect, it } from 'vitest'
import { buildBookHtml } from './book'

describe('design book', () => {
  it('has a cover, contents with anchors, escapes text and skips empty chapters', () => {
    const html = buildBookHtml({
      title: 'Moon <Game>',
      subtitle: '',
      date: '1.1.2026',
      chapters: [
        { title: 'Items', entries: [{ title: 'Sword', info: [{ label: 'Rarity', value: 'Epic' }], stats: [['ATK', 5]] }] },
        { title: 'Empty', entries: [] },
      ],
    })
    expect(html).toContain('<title>Moon &lt;Game&gt;</title>')
    expect(html).toContain('<a href="#c0-0">Sword</a>')
    expect(html).toContain('id="c0-0"')
    expect(html).toContain('<dt>ATK</dt><dd>5</dd>')
    expect(html).not.toContain('Empty')
  })
})
