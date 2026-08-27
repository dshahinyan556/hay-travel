import { EditorContent } from '@tiptap/react'
import { useRichTextEditorInstance } from './useRichTextEditorInstance'
import { RichTextToolbar } from './RichTextToolbar'
import { RICH_TEXT_TOOLSETS } from './types'
import type { RichTextEditorProps } from './types'

const MIN_HEIGHT_CLASS: Record<NonNullable<RichTextEditorProps['minHeight']>, string> = {
  sm: 'min-h-24',
  md: 'min-h-32',
  lg: 'min-h-64',
}

/**
 * Shared admin rich-text editor (spec 011, ADR 023) — container: owns the Tiptap instance via
 * `useRichTextEditorInstance`, renders the toolbar + editable area, and the empty-state hint.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  toolset = RICH_TEXT_TOOLSETS.minimal,
  placeholders,
  image,
  placeholder,
  minHeight = 'md',
  invalid = false,
  'aria-label': ariaLabel,
  id,
  className = '',
}: RichTextEditorProps) {
  const hasPlaceholders = Boolean(placeholders && placeholders.length > 0)
  const editor = useRichTextEditorInstance({
    value,
    onChange,
    disabled,
    toolset,
    hasPlaceholders,
    ariaLabel,
  })

  const borderClass = disabled
    ? 'border-neutral-200 bg-neutral-50'
    : // Dark border, not red: this project has had no red anywhere since the order-details
      // redesign (2026-08-22, see `Button.tsx`'s `danger` variant) — same "invalid" contract
      // `Input`/`Select` already use with their own `error` prop.
      invalid
      ? 'border-neutral-900 bg-white'
      : 'border-neutral-300 bg-white'

  return (
    <div id={id} className={`overflow-hidden rounded-lg border ${borderClass} ${className}`}>
      {editor && (
        <RichTextToolbar
          editor={editor}
          toolset={toolset}
          disabled={disabled}
          placeholders={placeholders}
          image={image}
        />
      )}

      {/* Same frame is drawn even before the editor mounts (`editor === null` on first render
          when a caller passes `immediatelyRender: false`-style SSR guards upstream — this app is
          pure CSR so that window is effectively zero, but the frame must not skip a beat either
          way) — this is what keeps the field from jumping in height once the editor appears. */}
      <div className={`relative max-w-full overflow-auto ${MIN_HEIGHT_CLASS[minHeight]}`}>
        {editor && (
          <>
            <EditorContent editor={editor} />
            {editor.isEmpty && placeholder && (
              <p
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 select-none px-3 py-2.5 text-sm text-neutral-400"
              >
                {placeholder}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
