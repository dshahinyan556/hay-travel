import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Popover } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from '../adminUiCopy'
import { normalizeLinkHref } from './lib/richTextHtml'

interface LinkDialogProps {
  editor: Editor
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

/**
 * Insert/edit-link popover (spec 011 §3.5). Built on `Popover` — it does not take focus itself
 * (see its doc comment), which is what lets the editor's selection survive the popover opening;
 * this dialog moves focus into its own input on open instead, since — unlike `Select`'s combobox
 * pattern — there is a real text field here to type into.
 */
export function LinkDialog({ editor, open, onClose, anchorRef }: LinkDialogProps) {
  const copy = useCopy(adminUiCopy).richText
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const existingHref = editor.getAttributes('link').href as string | undefined
  const isEditingLink = Boolean(existingHref)

  useEffect(() => {
    if (!open) return
    setValue(existingHref ?? '')
    setError(false)
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function apply() {
    const href = normalizeLinkHref(value)
    if (!href) {
      setError(true)
      return
    }
    if (editor.state.selection.empty) {
      // A collapsed cursor has nothing to turn into a link — insert the URL itself as the link
      // text instead of silently doing nothing (ADR 023, the old "нечего выделять" dead end).
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
        .run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    onClose()
  }

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose()
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      className="w-72 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          {copy.linkUrlLabel}
          <input
            ref={inputRef}
            type="text"
            placeholder={copy.linkUrlPlaceholder}
            value={value}
            onChange={(e) => {
              setValue(e.currentTarget.value)
              setError(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              }
            }}
            className={`h-9 rounded-md border px-2 text-sm text-neutral-900 outline-none ${
              error ? 'border-neutral-900' : 'border-neutral-300 focus:border-neutral-900'
            }`}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs font-semibold text-neutral-900">
            {copy.linkInvalid}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            className="flex-1 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            {copy.linkApply}
          </button>
          {isEditingLink && (
            <button
              type="button"
              onClick={remove}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
            >
              {copy.linkRemove}
            </button>
          )}
        </div>
      </div>
    </Popover>
  )
}
