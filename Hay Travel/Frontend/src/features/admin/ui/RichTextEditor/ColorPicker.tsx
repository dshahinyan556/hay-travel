import { useRef, useState } from 'react'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { useIsCompactViewport } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from '../adminUiCopy'
import { normalizeHexInput } from './lib/color'
import { PALETTE_ROWS } from './lib/palette'
import { toolbarButtonClass } from './toolbarButtonClass'

const DEFAULT_SWATCH_COLOR = '#0a0a0a'

interface ColorPickerProps {
  /** Current colour, `#rrggbb`, or `null` when unset. */
  value: string | null
  onChange: (hex: string) => void
  onReset: () => void
  disabled: boolean
  /** Button title/aria-label — differs for text colour vs highlight. */
  title: string
  /** `'text'` draws the swatch as a coloured "A"-style circle; `'fill'` as a filled square —
   * visually tells the two colour buttons apart in the toolbar. */
  variant: 'text' | 'fill'
}

/**
 * Free-form colour picker: grid palette (`PALETTE_ROWS`) + native `<input type="color">` for
 * anything outside the grid + a hex text field for pasting a brand colour. Shared by text colour
 * and highlight (Notification Templates, 2026-08-31) — the caller supplies `value`/`onChange`/
 * `onReset`, this component owns no editor-specific command names.
 */
export function ColorPicker({ value, onChange, onReset, disabled, title, variant }: ColorPickerProps) {
  const copy = useCopy(adminUiCopy).richText
  const isCompact = useIsCompactViewport()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState('')
  const [hexError, setHexError] = useState(false)

  const swatchColor = value ?? DEFAULT_SWATCH_COLOR

  function close() {
    setOpen(false)
    setHexDraft('')
    setHexError(false)
  }

  function apply(hex: string) {
    onChange(hex)
  }

  function reset() {
    onReset()
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
    apply(normalized)
  }

  const panel = (
    <div className="flex w-64 flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        {PALETTE_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-1.5">
            {row.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                aria-label={hex}
                onClick={() => apply(hex)}
                className={`h-5 w-5 shrink-0 rounded-sm border transition-transform hover:scale-110 ${
                  value === hex ? 'border-neutral-900 ring-2 ring-neutral-900/20' : 'border-neutral-300'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-neutral-200 pt-2.5">
        <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-neutral-300">
          {/* Native picker fires `input`/`change` per interaction step (dragging inside the OS
              picker), not per pixel — each call is one `apply` at the same selection, which
              Tiptap's history collapses into a single undo step, same as consecutive keystrokes. */}
          <input
            type="color"
            value={swatchColor}
            onChange={(e) => apply(e.currentTarget.value)}
            className="absolute -inset-2 cursor-pointer"
            aria-label={title}
          />
        </label>
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
          className={`h-8 min-w-0 flex-1 rounded-md border px-2 text-sm text-neutral-900 outline-none ${
            hexError ? 'border-neutral-900' : 'border-neutral-300 focus:border-neutral-900'
          }`}
        />
      </div>
      {hexError && <span className="text-xs font-semibold text-neutral-900">{copy.colorHexInvalid}</span>}

      <button
        type="button"
        onClick={reset}
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
        onClick={() => setOpen((v) => !v)}
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
        className={toolbarButtonClass(false)}
      >
        <span
          aria-hidden="true"
          className={`h-4 w-4 border border-neutral-300 ${variant === 'text' ? 'rounded-full' : 'rounded-sm'}`}
          style={{ backgroundColor: value ? swatchColor : 'transparent' }}
        />
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={close} ariaLabel={title} detents={SHEET_SINGLE_DETENT}>
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
