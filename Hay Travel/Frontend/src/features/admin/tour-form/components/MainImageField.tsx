import { useEffect, useState } from 'react'
import { Field, Input } from '@/shared/ui'

interface MainImageFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
}

/**
 * URL input for the tour's cover image with a live preview beside it. The preview falls back
 * to a neutral placeholder when the URL is empty or the image fails to load, so a broken link
 * never leaves a torn image in the form.
 */
export function MainImageField({ value, onChange, required = false, error }: MainImageFieldProps) {
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
          label="Главная картинка — URL"
          htmlFor="main-image-url"
          required={required}
          error={error}
          hint={error ? undefined : 'Вставьте ссылку на изображение — превью обновится справа.'}
        >
          <Input
            id="main-image-url"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={Boolean(error)}
          />
        </Field>
      </div>

      <div className="h-20 w-full shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-gradient-to-br from-neutral-100 to-neutral-200 sm:w-32">
        {showImage ? (
          <img
            src={trimmed}
            alt="Превью главной картинки"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-neutral-400">
            превью по URL
          </span>
        )}
      </div>
    </div>
  )
}
