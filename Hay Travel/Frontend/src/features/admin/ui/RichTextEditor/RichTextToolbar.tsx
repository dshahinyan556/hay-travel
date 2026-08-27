import { useRef, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { Select } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from '../adminUiCopy'
import { ColorPicker } from './ColorPicker'
import { LinkDialog } from './LinkDialog'
import { ImageDialog } from './ImageDialog'
import { PlaceholderMenu } from './PlaceholderMenu'
import { toolbarButtonClass } from './toolbarButtonClass'
import type { RichTextImageOptions, RichTextPlaceholder, RichTextTool } from './types'

interface RichTextToolbarProps {
  editor: Editor
  toolset: readonly RichTextTool[]
  disabled: boolean
  placeholders?: readonly RichTextPlaceholder[]
  image?: RichTextImageOptions
}

const HEADING_LEVELS = [1, 2, 3] as const
const FONT_SIZES = ['12px', '20px', '28px'] as const

function Separator() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-neutral-200" />
}

/* ── Small local icon set, matching `shared/ui/icons.tsx`'s geometry (24×24, 1.5 stroke, round
   caps) so the toolbar reads as part of the same visual family. Kept local rather than added to
   the shared set — these are toolbar-specific glyphs (list/align/undo/link/image) that no other
   admin screen needs. ── */
function ToolbarIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}
function BulletListIcon() {
  return (
    <ToolbarIcon>
      <circle cx="5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.5 6h10M9.5 12h10M9.5 18h10" />
    </ToolbarIcon>
  )
}
function OrderedListIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" focusable="false">
      <text x="2" y="8.5" fontSize="7" fill="currentColor" fontFamily="inherit">1</text>
      <text x="2" y="14.5" fontSize="7" fill="currentColor" fontFamily="inherit">2</text>
      <text x="2" y="20.5" fontSize="7" fill="currentColor" fontFamily="inherit">3</text>
      <path d="M9.5 6h10M9.5 12h10M9.5 18h10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function BlockquoteIcon() {
  return (
    <ToolbarIcon>
      <path d="M6 4v16" />
      <path d="M10 8h9M10 12h9M10 16h6" />
    </ToolbarIcon>
  )
}
function AlignLeftIcon() {
  return (
    <ToolbarIcon>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </ToolbarIcon>
  )
}
function AlignCenterIcon() {
  return (
    <ToolbarIcon>
      <path d="M4 6h16M7 12h10M5.5 18h13" />
    </ToolbarIcon>
  )
}
function AlignRightIcon() {
  return (
    <ToolbarIcon>
      <path d="M4 6h16M10 12h10M7 18h13" />
    </ToolbarIcon>
  )
}
function LinkIcon() {
  return (
    <ToolbarIcon>
      <path d="M10 14a4 4 0 0 0 6 0l2-2a4 4 0 0 0-6-6l-1 1" />
      <path d="M14 10a4 4 0 0 0-6 0l-2 2a4 4 0 0 0 6 6l1-1" />
    </ToolbarIcon>
  )
}
function ImageGlyphIcon() {
  return (
    <ToolbarIcon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M5 17l4.5-4.5 3 3 3.5-4.5L20 17" />
    </ToolbarIcon>
  )
}
function UndoIcon() {
  return (
    <ToolbarIcon>
      <path d="M7 7 3 11l4 4" />
      <path d="M3 11h10a6 6 0 0 1 0 12H9" />
    </ToolbarIcon>
  )
}
function RedoIcon() {
  return (
    <ToolbarIcon>
      <path d="M17 7l4 4-4 4" />
      <path d="M21 11H11a6 6 0 0 0 0 12h4" />
    </ToolbarIcon>
  )
}

/**
 * Presentational toolbar (spec 011 §3.3) — knows `editor`, knows nothing about email or tours.
 * Twelve possible instruments, grouped by separators: text marks · block structure · size/colour ·
 * link/image · undo/redo · placeholders (pinned to the right).
 */
export function RichTextToolbar({ editor, toolset, disabled, placeholders, image }: RichTextToolbarProps) {
  const copy = useCopy(adminUiCopy).richText
  const has = (tool: RichTextTool) => toolset.includes(tool)
  const hasPlaceholders = Boolean(placeholders && placeholders.length > 0)

  const linkButtonRef = useRef<HTMLButtonElement>(null)
  const imageButtonRef = useRef<HTMLButtonElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)

  // One subscription for every "is this active" flag the buttons below read — re-renders the
  // toolbar (not the editor) on each selection/transaction change, which is what keeps e.g. the
  // bold button's highlight in sync as the cursor moves (spec 011 §3.3).
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      underline: instance.isActive('underline'),
      strike: instance.isActive('strike'),
      bulletList: instance.isActive('bulletList'),
      orderedList: instance.isActive('orderedList'),
      blockquote: instance.isActive('blockquote'),
      alignLeft: instance.isActive({ textAlign: 'left' }),
      alignCenter: instance.isActive({ textAlign: 'center' }),
      alignRight: instance.isActive({ textAlign: 'right' }),
      headingLevel: (instance.getAttributes('heading').level as number | undefined) ?? 0,
      fontSize: (instance.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      link: instance.isActive('link'),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  })

  function insertPlaceholder(token: string) {
    // An object, not a raw string — Tiptap would parse a string as HTML, which a bare `{{Token}}`
    // is not meant to survive as (spec 011 §3.6).
    editor.chain().focus().insertContent({ type: 'text', text: token }).run()
  }

  const headingOptions = [
    { value: '', label: copy.headingNormal },
    ...HEADING_LEVELS.map((level) => ({ value: String(level), label: copy.headingLevel(level) })),
  ]
  const fontSizeOptions = [
    { value: '', label: copy.fontSizeNormal },
    { value: FONT_SIZES[0], label: copy.fontSizeSmall },
    { value: FONT_SIZES[1], label: copy.fontSizeLarge },
    { value: FONT_SIZES[2], label: copy.fontSizeXLarge },
  ]

  const textGroup = (has('bold') || has('italic') || has('underline') || has('strike')) && (
    <div className="flex shrink-0 items-center gap-1.5">
      {has('bold') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()} title={copy.boldTitle} aria-label={copy.boldTitle} aria-pressed={state.bold} className={toolbarButtonClass(state.bold)}>
          <span className="font-bold">{copy.boldGlyph}</span>
        </button>
      )}
      {has('italic') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()} title={copy.italicTitle} aria-label={copy.italicTitle} aria-pressed={state.italic} className={toolbarButtonClass(state.italic)}>
          <span className="italic">{copy.italicGlyph}</span>
        </button>
      )}
      {has('underline') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()} title={copy.underlineTitle} aria-label={copy.underlineTitle} aria-pressed={state.underline} className={toolbarButtonClass(state.underline)}>
          <span className="underline">{copy.underlineGlyph}</span>
        </button>
      )}
      {has('strike') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()} title={copy.strikeTitle} aria-label={copy.strikeTitle} aria-pressed={state.strike} className={toolbarButtonClass(state.strike)}>
          <span className="line-through">{copy.strikeGlyph}</span>
        </button>
      )}
    </div>
  )

  const blockGroup = (has('heading') || has('align') || has('bulletList') || has('orderedList') || has('blockquote')) && (
    <div className="flex shrink-0 items-center gap-1.5">
      {has('heading') && (
        <Select
          surface="admin"
          className="w-36 shrink-0"
          value={state.headingLevel ? String(state.headingLevel) : ''}
          onChange={(value) => {
            if (value === '') editor.chain().focus().setParagraph().run()
            else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 | 3 }).run()
          }}
          options={headingOptions}
          disabled={disabled}
          aria-label={copy.headingLabel}
        />
      )}
      {has('bulletList') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()} title={copy.bulletListTitle} aria-label={copy.bulletListTitle} aria-pressed={state.bulletList} className={toolbarButtonClass(state.bulletList)}>
          <BulletListIcon />
        </button>
      )}
      {has('orderedList') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={copy.orderedListTitle} aria-label={copy.orderedListTitle} aria-pressed={state.orderedList} className={toolbarButtonClass(state.orderedList)}>
          <OrderedListIcon />
        </button>
      )}
      {has('blockquote') && (
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={copy.blockquoteTitle} aria-label={copy.blockquoteTitle} aria-pressed={state.blockquote} className={toolbarButtonClass(state.blockquote)}>
          <BlockquoteIcon />
        </button>
      )}
      {has('align') && (
        <>
          <button type="button" disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('left').run()} title={copy.alignLeftTitle} aria-label={copy.alignLeftTitle} aria-pressed={state.alignLeft} className={toolbarButtonClass(state.alignLeft)}>
            <AlignLeftIcon />
          </button>
          <button type="button" disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('center').run()} title={copy.alignCenterTitle} aria-label={copy.alignCenterTitle} aria-pressed={state.alignCenter} className={toolbarButtonClass(state.alignCenter)}>
            <AlignCenterIcon />
          </button>
          <button type="button" disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('right').run()} title={copy.alignRightTitle} aria-label={copy.alignRightTitle} aria-pressed={state.alignRight} className={toolbarButtonClass(state.alignRight)}>
            <AlignRightIcon />
          </button>
        </>
      )}
    </div>
  )

  const styleGroup = (has('fontSize') || has('color')) && (
    <div className="flex shrink-0 items-center gap-1.5">
      {has('fontSize') && (
        <Select
          surface="admin"
          className="w-32 shrink-0"
          value={state.fontSize}
          onChange={(value) => {
            if (value === '') editor.chain().focus().unsetFontSize().run()
            else editor.chain().focus().setFontSize(value).run()
          }}
          options={fontSizeOptions}
          disabled={disabled}
          aria-label={copy.fontSizeLabel}
        />
      )}
      {has('color') && <ColorPicker editor={editor} disabled={disabled} />}
    </div>
  )

  const insertGroup = (has('link') || has('image')) && (
    <div className="flex shrink-0 items-center gap-1.5">
      {has('link') && (
        <>
          <button ref={linkButtonRef} type="button" disabled={disabled} onClick={() => setLinkOpen((v) => !v)} title={copy.linkTitle} aria-label={copy.linkTitle} aria-haspopup="dialog" aria-expanded={linkOpen} aria-pressed={state.link} className={toolbarButtonClass(state.link)}>
            <LinkIcon />
          </button>
          <LinkDialog editor={editor} open={linkOpen} onClose={() => setLinkOpen(false)} anchorRef={linkButtonRef} />
        </>
      )}
      {has('image') && (
        <>
          <button ref={imageButtonRef} type="button" disabled={disabled} onClick={() => setImageOpen((v) => !v)} title={copy.imageTitle} aria-label={copy.imageTitle} aria-haspopup="dialog" aria-expanded={imageOpen} className={toolbarButtonClass(false)}>
            <ImageGlyphIcon />
          </button>
          <ImageDialog editor={editor} open={imageOpen} onClose={() => setImageOpen(false)} anchorRef={imageButtonRef} options={image ?? {}} />
        </>
      )}
    </div>
  )

  const undoGroup = has('undo') && (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" disabled={disabled || !state.canUndo} onClick={() => editor.chain().focus().undo().run()} title={copy.undoTitle} aria-label={copy.undoTitle} className={toolbarButtonClass(false)}>
        <UndoIcon />
      </button>
      <button type="button" disabled={disabled || !state.canRedo} onClick={() => editor.chain().focus().redo().run()} title={copy.redoTitle} aria-label={copy.redoTitle} className={toolbarButtonClass(false)}>
        <RedoIcon />
      </button>
    </div>
  )

  const groups = [textGroup, blockGroup, styleGroup, insertGroup, undoGroup].filter(Boolean)

  return (
    <div
      // Stops the mousedown from blurring the editor before a click handler runs — without this,
      // every toolbar click would first collapse the selection it is meant to act on. Cosmetic
      // insurance now that Tiptap owns selection state, not the load-bearing fix it was in the old
      // `execCommand` editor (ADR 023).
      onMouseDown={(event) => event.preventDefault()}
      className="flex items-stretch border-b border-neutral-200"
    >
      <div className="relative min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 max-sm:flex-nowrap max-sm:overflow-x-auto">
          {groups.map((group, index) => (
            <div key={index} className="flex shrink-0 items-center">
              {index > 0 && <Separator />}
              {group}
            </div>
          ))}
        </div>
        {/* Scroll hint, mobile only (desktop wraps instead of scrolling): fades the trailing edge
            of the scrollable ribbon so it reads as "more instruments this way", right where the
            lane runs under the pinned "Вставить поле" island. */}
        {hasPlaceholders && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-r from-transparent to-white sm:hidden" />
        )}
      </div>

      {hasPlaceholders && (
        <div className="flex shrink-0 items-center border-l border-neutral-200 bg-white p-1.5">
          <PlaceholderMenu items={placeholders!} disabled={disabled} onInsert={insertPlaceholder} />
        </div>
      )}
    </div>
  )
}
