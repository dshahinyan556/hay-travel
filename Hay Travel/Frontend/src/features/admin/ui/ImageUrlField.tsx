import { useEffect, useId, useState } from 'react'
import { Field, Input } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { ImageUploadButton } from './ImageUploadButton'
import { adminUiCopy } from './adminUiCopy'

interface ImageUrlFieldProps {
  /** Field caption, e.g. "Логотип — URL". */
  label: string
  value: string
  onChange: (value: string) => void
  /** Explanation surfaced through the label's `HelpButton` (via `Field`). Defaults to the
   * localised "вставьте ссылку на изображение" hint. */
  hint?: string
  /** Non-blocking, always-visible notice (e.g. "this URL looks incomplete"). Suppressed while
   * `error` is set. */
  warning?: string
  required?: boolean
  error?: string
}

/**
 * URL input for an image with a live preview beside it. The preview falls back to a neutral
 * placeholder when the URL is empty or the image fails to load, so a broken link never leaves
 * a torn image in the form.
 *
 * Two ways to fill the same URL value: type/paste one, or upload a file via `ImageUploadButton`
 * (`api/Upload/Image`, ADR 2026-08-15) — the button just calls `onChange` with the server's
 * returned URL, same as typing. URL stays the source of truth and the only thing sent to the
 * backend; there is nothing upload-specific in the rest of this component.
 *
 * The control id comes from `useId()`, not a literal: the settings screen renders three of
 * these on one page, and duplicated ids would break every `label`↔`input` association on it.
 */
export function ImageUrlField({
  label,
  value,
  onChange,
  hint,
  warning,
  required = false,
  error,
}: ImageUrlFieldProps) {
  const copy = useCopy(adminUiCopy).images
  const id = useId()
  const trimmed = value.trim()
  const [failed, setFailed] = useState(false)

  // A new URL is worth trying again, so reset the failed flag whenever it changes.
  useEffect(() => {
    setFailed(false)
  }, [trimmed])

  const showImage = trimmed !== '' && !failed

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <Field
          label={label}
          htmlFor={id}
          required={required}
          error={error}
          warning={error ? undefined : warning}
          hint={hint ?? copy.urlHint}
        >
          <div className="flex items-start gap-2">
            <Input
              id={id}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              error={Boolean(error)}
              className="min-w-0 flex-1"
            />
            <ImageUploadButton onUploaded={onChange} />
          </div>
        </Field>
      </div>

      <div className="h-20 w-full shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-neutral-100 to-neutral-200 sm:w-32">
        {showImage ? (
          <img
            src={trimmed}
            alt={copy.previewAlt(label)}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-neutral-400">
            {copy.previewEmpty}
          </span>
        )}
      </div>
    </div>
  )
}
