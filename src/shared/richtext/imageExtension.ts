import Image, { type ImageOptions } from '@tiptap/extension-image'

export interface RichImageOptions {
  /** Turns a stored path (e.g. `assets/images/<id>.png`) into something an <img> can show. */
  getResolveSrc: () => ((src: string) => string) | undefined
}

/**
 * Block image that stores the project-relative path and resolves it only for
 * display. A missing or broken image shows the pink/black placeholder (spec 10.6).
 */
export const RichImage = Image.extend<ImageOptions & RichImageOptions>({
  addOptions() {
    return { ...this.parent!(), getResolveSrc: () => undefined }
  },

  addNodeView() {
    const getResolveSrc = this.options.getResolveSrc
    return ({ node: initial }) => {
      let node = initial
      const dom = document.createElement('div')
      dom.className = 'richtext-image'
      const img = document.createElement('img')
      img.draggable = false
      const placeholder = document.createElement('div')
      placeholder.className = 'richtext-image-missing'
      placeholder.setAttribute('role', 'img')

      const show = (ok: boolean) => {
        dom.replaceChildren(ok ? img : placeholder)
      }
      img.addEventListener('error', () => show(false))
      img.addEventListener('load', () => show(true))

      const paint = () => {
        const src: string | null = node.attrs.src
        const alt: string = node.attrs.alt ?? ''
        img.alt = alt
        placeholder.setAttribute('aria-label', `${alt || 'Image'} (missing)`)
        if (!src) return show(false)
        const resolved = getResolveSrc()?.(src) ?? src
        if (img.getAttribute('src') !== resolved) img.src = resolved
        show(true)
      }
      paint()

      return {
        dom,
        update(next) {
          if (next.type !== node.type) return false
          node = next
          paint()
          return true
        },
      }
    }
  },
})
