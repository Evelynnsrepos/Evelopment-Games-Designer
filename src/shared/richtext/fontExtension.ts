import { Mark } from '@tiptap/core'
import { fontStyle } from './styles'

/** Font and size for a stretch of text (v0.12). Stored as a mark, so it follows the text when edited or shared. */
export const FontMark = Mark.create({
  name: 'font',
  addAttributes() {
    return {
      family: { default: null, parseHTML: (el) => el.style.fontFamily || null },
      size: { default: null, parseHTML: (el) => parseFloat(el.style.fontSize) || null },
    }
  },
  parseHTML: () => [{ tag: 'span[style]', getAttrs: (el) => (el.style.fontFamily || el.style.fontSize ? {} : false) }],
  renderHTML: ({ HTMLAttributes: a }) => ['span', { style: fontStyle(a.family, a.size) }, 0],
})

