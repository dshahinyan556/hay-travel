import { useRef, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { useIsCompactViewport } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from '../adminUiCopy'
import { normalizeHexInput } from './lib/color'
import { toolbarButtonClass } from './toolbarButtonClass'

const DEFAULT_SWATCH_COLOR = '#0a0a0a'

/** Five previous fixed swatches, kept as shortcuts inside the panel — not a limit on the palette
 * anymore (spec 011 §3.10), just a fast path for the common cases. */
const QUICK_SWATCHES = [
  { hex: '#0a0a0a', captionKey: 'colorBlack' },
  { hex: '#b91c1c', captionKey: 'colorRed' },
  { hex: '#15803d', captionKey: 'colorGreen' },
  { hex: '#1d4ed8', captionKey: 'colorBlue' },
  { hex: '#a16207', captionKey: 'colorGold' },
] as const

interface ColorPickerProps {
  editor: Editor
  disabled: boolean
}

/**
 * Free-form text colour: native `<input type="color">` (returns strictly `#rrggbb`) plus the five
 * old fixed swatches as shortcuts plus a hex text field for pasting a brand colour. No third-party
 * picker library — spec 011 §3.10.
 */
export function ColorPicker({ editor, disabled }: ColorPickerProps) {
  const copy = useCopy(adminUiCopy).richText
  const isCompact = useIsCompactViewport()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState('')
  const [hexError, setHexError] = useState(false)

  const currentColor = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      (instance.getAttributes('textStyle').color as string | undefined) ?? null,
  })
  const swatchColor = currentColor ?? DEFAULT_SWATCH_COLOR

  function applyColor(hex: string) {
    editor.chain().focus().setTextColor(hex).run()
  }

  function close() {
    setOpen(false)
    setHexDraft('')
    setHexError(false)
  }

  function resetColor() {
    editor.chain().focus().unsetTextColor().run()
    close()
  }

  function commitHexDraft() {
    if (!hexDraft.trim()) return
    const normalized = normalizeHexInput(hexDraft)
    if (!normalized) {
      setHexError(true)
      return
    }
    setHexError(false)
    applyColor(normalized)
  }

  const panel = (
    <div className="flex w-56 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full border border-neutral-300">
          {/* Native picker fires `input`/`change` per interaction step (dragging inside the OS
              picker), not per pixel — each call is one `setTextColor` at the same selection, which
              Tiptap's history collapses into a single undo step, same as consecutive keystrokes. */}
          <input
            type="color"
            value={swatchColor}
            onChange={(e) => applyColor(e.currentTarget.value)}
            className="absolute -inset-2 cursor-pointer"
            aria-label={copy.colorTitle}
          />
        </label>
        <span className="text-xs text-neutral-500">{copy.colorTitle}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {QUICK_SWATCHES.map((swatch) => (
          <button
            key={swatch.hex}
            type="button"
            title={copy[swatch.captionKey]}
            aria-label={copy[swatch.captionKey]}
            onClick={() => applyColor(swatch.hex)}
            className={`h-6 w-6 shrink-0 rounded-full border transition-transform hover:scale-110 ${
              currentColor === swatch.hex ? 'border-neutral-900 ring-2 ring-neutral-900/20' : 'border-neutral-300'
            }`}
            style={{ backgroundColor: swatch.hex }}
          />
        ))}
      </div>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        {copy.colorHexLabel}
        <input
          type="text"
          placeholder="#1d4ed8"
          maxLength={7}
          spellCheck={false}
          value={hexDraft}
          onChange={(e) => {
            setHexDraft(e.currentTarget.value)
            setHexError(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitHexDraft()
            }
          }}
          onBlur={commitHexDraft}
          className={`h-8 rounded-md border px-2 text-sm text-neutral-900 outline-none ${
            hexError ? 'border-neutral-900' : 'border-neutral-300 focus:border-neutral-900'
          }`}
        />
        {hexError && <span className="font-semibold text-neutral-900">{copy.colorHexInvalid}</span>}
      </label>

      <button
        type="button"
        onClick={resetColor}
        className="self-start text-xs font-semibold text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        {copy.colorDefault}
      </button>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-label={copy.colorTitle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={copy.colorTitle}
        className={toolbarButtonClass(false)}
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border border-neutral-300"
          style={{ backgroundColor: swatchColor }}
        />
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={copy.colorTitle} detents={SHEET_SINGLE_DETENT}>
          {panel}
        </Sheet>
      ) : (
        <Popover
          open={open}
          onClose={close}
          anchorRef={triggerRef}
          className="rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {panel}
        </Popover>
      )}
    </>
  )
}
