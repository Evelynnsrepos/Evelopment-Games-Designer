/** CSS for image placement and font marks: pure, shared by the editor and the HTML export. */
import { cssFamily } from '../fontList'

/** Inline style for an image block, also used by the HTML export. */
export function imageStyle(width: number | null | undefined, align: string | null | undefined): string {
  // Without a width the block hugs the picture, so left, center and right still apply.
  const w = width ? `width:${width}%;` : 'width:fit-content;max-width:100%;'
  switch (align) {
    case 'left':
      return `${w}margin-right:auto;`
    case 'right':
      return `${w}margin-left:auto;`
    case 'wrap-left':
      return `${w}float:left;margin:0 1em 0.5em 0;`
    case 'wrap-right':
      return `${w}float:right;margin:0 0 0.5em 1em;`
    default:
      return width ? `${w}margin-left:auto;margin-right:auto;` : ''
  }
}

/** CSS for a font mark; `size` is in pt, like word processors. */
export function fontStyle(family: string | null | undefined, size: number | null | undefined): string {
  return `${family ? `font-family:${cssFamily(family)};` : ''}${size ? `font-size:${size}pt;` : ''}`
}


/** Sizes offered in the toolbar (pt). */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48]
