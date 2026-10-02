import type { Editor } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  TextQuote,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { promptDialog } from '../dialogs'
import { SpellCheck, SpellMenu, type MisspellingHit } from '../spell'
import '../spell/spell.css'
import { normalizeRichText } from './doc'
import { RichImage } from './imageExtension'
import { RefExtension } from './refExtension'
import { useEntityRefProvider } from './refs'
import type { ImagePicker, RefProvider, RichTextDoc } from './types'
import './richtext.css'

export interface RichTextEditorProps {
  /** The stored document. Changing it from outside (e.g. after `doc.undo()`) replaces the editor content. */
  value: RichTextDoc | null | undefined
  /** Called on every edit with the new document. Save it with `doc.update(() => next, { undoable: false })`. */
  onChange?: (next: RichTextDoc) => void
  /** Where `[[` links come from. Defaults to the project's entities. */
  refs?: RefProvider
  /** Ask the user for an image. Defaults to a prompt for a path or URL until the asset helper (F2) exists. */
  pickImage?: ImagePicker
  /** Turn a stored image path into a displayable URL (e.g. Tauri `convertFileSrc`). */
  resolveImageSrc?: (src: string) => string
  editable?: boolean
  placeholder?: string
  /** Hide the formatting toolbar, e.g. for small inline fields. */
  toolbar?: boolean
  autoFocus?: boolean
  className?: string
  /** Gives advanced consumers the TipTap editor (exports, custom commands). */
  onEditor?: (editor: Editor | null) => void
}

const UI = {
  placeholder: 'Start writing… Type [[ to link an article or entity.',
  imagePrompt: 'Image path or URL',
  bold: 'Bold (Ctrl+B)',
  italic: 'Italic (Ctrl+I)',
  underline: 'Underline (Ctrl+U)',
  paragraph: 'Normal text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'Bulleted list',
  ordered: 'Numbered list',
  quote: 'Quote',
  image: 'Insert image',
  link: 'Link an article or entity ([[)',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  toolbar: 'Formatting',
}

const defaultPickImage: ImagePicker = async () => {
  const src = (await promptDialog(UI.imagePrompt))?.trim()
  return src ? { src } : null
}

interface LiveProps {
  provider: RefProvider
  resolveImageSrc?: (src: string) => string
  onChange?: (next: RichTextDoc) => void
  placeholder: string
}

function buildExtensions(live: RefObject<LiveProps>, onMisspelling: (hit: MisspellingHit) => void) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true },
    }),
    Placeholder.configure({ placeholder: () => live.current.placeholder }),
    RichImage.configure({ getResolveSrc: () => live.current.resolveImageSrc }),
    RefExtension.configure({ getProvider: () => live.current.provider }),
    SpellCheck.configure({ onMisspelling }),
  ]
}

/**
 * The shared rich text editor (spec 8.6, WK-4, WK-6): headings, bold, italic,
 * underline, lists, quotes, images and `[[` links. Used by the Writer and the Wiki.
 * Undo/redo is handled inside the editor (Ctrl+Z / Ctrl+Y), so callers save with
 * `{ undoable: false }` and do not bind their own Ctrl+Z on top of it.
 */
export function RichTextEditor({
  value,
  onChange,
  refs,
  pickImage = defaultPickImage,
  resolveImageSrc,
  editable = true,
  placeholder = UI.placeholder,
  toolbar = true,
  autoFocus = false,
  className,
  onEditor,
}: RichTextEditorProps) {
  const entityRefs = useEntityRefProvider()
  const provider = refs ?? entityRefs

  // Extensions are built once (rebuilding would reset the content); they read the latest props through `live`.
  const [misspelling, setMisspelling] = useState<MisspellingHit | null>(null)
  const live = useRef<LiveProps>({ provider, resolveImageSrc, onChange, placeholder })
  useEffect(() => {
    live.current = { provider, resolveImageSrc, onChange, placeholder }
  })
  const lastEmitted = useRef<RichTextDoc | null>(null)
  // The extensions only read `live` inside editor callbacks, never during render.
  // oxlint-disable-next-line react/refs
  const [extensions] = useState(() => buildExtensions(live, setMisspelling))

  const editor = useEditor({
    extensions,
    content: normalizeRichText(value),
    editable,
    autofocus: autoFocus ? 'end' : false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      const next = editor.getJSON()
      lastEmitted.current = next
      live.current.onChange?.(next)
    },
  })

  // Outside changes (document undo, another panel showing the same doc) replace the content.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return
    lastEmitted.current = value ?? null
    editor.commands.setContent(normalizeRichText(value), { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(editable, false)
  }, [editor, editable])

  // Renamed or deleted records: repaint every link with its current name.
  useEffect(() => {
    editor?.storage.ref.repaint.forEach((paint) => paint())
  }, [editor, provider])

  useEffect(() => {
    onEditor?.(editor)
    return () => onEditor?.(null)
  }, [editor, onEditor])

  const insertImage = async () => {
    const picked = await pickImage()
    if (picked && editor) editor.chain().focus().setImage({ src: picked.src, alt: picked.alt }).run()
  }

  return (
    <div className={['richtext', className].filter(Boolean).join(' ')}>
      {toolbar && editable && <Toolbar editor={editor} onImage={insertImage} />}
      <EditorContent editor={editor} className="richtext-content" />
      {misspelling && editor && editable && <SpellMenu editor={editor} hit={misspelling} onClose={() => setMisspelling(null)} />}
    </div>
  )
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      paragraph: e.isActive('paragraph'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()

  const button = (Icon: LucideIcon, label: string, run: () => void, active = false, disabled = false) => (
    <button
      type="button"
      className={active ? 'icon-btn richtext-tool is-active' : 'icon-btn richtext-tool'}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown keeps the selection in the editor
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      <Icon size={16} />
    </button>
  )

  return (
    <div className="richtext-toolbar" role="toolbar" aria-label={UI.toolbar}>
      {button(Pilcrow, UI.paragraph, () => chain().setParagraph().run(), state.paragraph)}
      {button(Heading1, UI.h1, () => chain().toggleHeading({ level: 1 }).run(), state.h1)}
      {button(Heading2, UI.h2, () => chain().toggleHeading({ level: 2 }).run(), state.h2)}
      {button(Heading3, UI.h3, () => chain().toggleHeading({ level: 3 }).run(), state.h3)}
      <span className="richtext-toolbar-sep" />
      {button(Bold, UI.bold, () => chain().toggleBold().run(), state.bold)}
      {button(Italic, UI.italic, () => chain().toggleItalic().run(), state.italic)}
      {button(Underline, UI.underline, () => chain().toggleUnderline().run(), state.underline)}
      <span className="richtext-toolbar-sep" />
      {button(List, UI.bullet, () => chain().toggleBulletList().run(), state.bullet)}
      {button(ListOrdered, UI.ordered, () => chain().toggleOrderedList().run(), state.ordered)}
      {button(TextQuote, UI.quote, () => chain().toggleBlockquote().run(), state.quote)}
      <span className="richtext-toolbar-sep" />
      {button(ImagePlus, UI.image, onImage)}
      {button(Link2, UI.link, () => chain().insertContent('[[').run())}
      <span className="richtext-toolbar-spacer" />
      {button(Undo2, UI.undo, () => chain().undo().run(), false, !state.canUndo)}
      {button(Redo2, UI.redo, () => chain().redo().run(), false, !state.canRedo)}
    </div>
  )
}
