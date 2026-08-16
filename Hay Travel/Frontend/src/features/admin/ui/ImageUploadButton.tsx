import { useId, useRef } from 'react'
import { Spinner } from '@/shared/ui'
import { useImageUpload } from './useImageUpload'

interface ImageUploadButtonProps {
  onUploaded: (url: string) => void
  /** Icon-only square button for list rows (matches `RemoveButton`/`DragHandle` sizing) instead
   * of the labelled version used beside a single `ImageUrlField`. */
  compact?: boolean
  label?: string
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

/** File picker disguised as a button: a hidden `<input type="file">` triggered by a visible
 * button, wired to `useImageUpload`. Used by both `ImageUrlField` (single image) and
 * `ImageListEditor` (repeater row, `compact`) so the two share one upload implementation. */
export function ImageUploadButton({ onUploaded, compact = false, label = 'Загрузить файл' }: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const { isUploading, error, upload } = useImageUpload(onUploaded)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset immediately so picking the exact same file again still fires onChange.
    e.target.value = ''
    if (file) void upload(file)
  }

  return (
    <div className={compact ? 'shrink-0' : 'flex flex-col gap-1'}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        aria-label={label}
        title={label}
        className={
          compact
            ? 'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40'
            : 'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40'
        }
      >
        {isUploading ? <Spinner size="sm" /> : <UploadIcon />}
        {!compact && <span>{isUploading ? 'Загрузка…' : label}</span>}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}
