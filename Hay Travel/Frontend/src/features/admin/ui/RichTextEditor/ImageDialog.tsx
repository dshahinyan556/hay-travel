import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Popover, Spinner } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from '../adminUiCopy'
import { uploadImage } from '@/features/admin/api/uploads'
import { validateImageFile } from '../imageUploadValidation'
import { normalizeImageSrc } from './lib/richTextHtml'
import type { RichTextImageOptions } from './types'

interface ImageDialogProps {
  editor: Editor
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  options: RichTextImageOptions
}

type Mode = 'upload' | 'url'

/** Width of a typical email body — the ceiling `naturalWidth` is clamped to (spec 011 §3.11). */
const MAX_EMAIL_IMAGE_WIDTH_PX = 600
const IMAGE_PROBE_TIMEOUT_MS = 4000

/** Loads `src` off-DOM to read its natural width, capped at `MAX_EMAIL_IMAGE_WIDTH_PX`. Resolves
 * `undefined` (never rejects) on a load failure or a timeout — the insert must never be blocked
 * by this, it just proceeds without a `width` attribute. */
function probeImageWidth(src: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const probe = new window.Image()
    let settled = false
    const finish = (value: number | undefined) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(undefined), IMAGE_PROBE_TIMEOUT_MS)
    probe.onload = () => {
      window.clearTimeout(timer)
      finish(probe.naturalWidth > 0 ? Math.min(probe.naturalWidth, MAX_EMAIL_IMAGE_WIDTH_PX) : undefined)
    }
    probe.onerror = () => {
      window.clearTimeout(timer)
      finish(undefined)
    }
    probe.src = src
  })
}

/**
 * Insert-image panel (spec 011 §3.11): upload a file OR paste an external URL — same duality
 * `ImageUrlField` already has (ADR 2026-08-15). Uploading reuses `api/Upload/Image` via
 * `uploadImage`/`validateImageFile` rather than reimplementing either.
 */
export function ImageDialog({ editor, open, onClose, anchorRef, options }: ImageDialogProps) {
  const copy = useCopy(adminUiCopy)
  const t = copy.richText
  const allowExternalUrl = options.allowExternalUrl ?? true
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('upload')
  const [urlValue, setUrlValue] = useState('')
  const [altValue, setAltValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode('upload')
    setUrlValue('')
    setAltValue('')
    setUploading(false)
    setError(null)
  }, [open])

  async function insert(src: string) {
    const width = await probeImageWidth(src)
    editor
      .chain()
      .focus()
      .setImage({ src, alt: altValue, ...(width ? { width } : {}) })
      .run()
    onClose()
  }

  async function handleFile(file: File) {
    const validationCode = validateImageFile(file)
    if (validationCode) {
      setError(validationCode === 'type' ? copy.images.errorFileType : copy.images.errorFileSize)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const url = options.upload ? await options.upload(file) : (await uploadImage(file)).url
      await insert(url)
    } catch {
      setError(copy.images.errorUploadFailed)
    } finally {
      setUploading(false)
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset immediately so picking the exact same file again still fires onChange.
    event.target.value = ''
    if (file) void handleFile(file)
  }

  async function handleUrlSubmit() {
    const src = normalizeImageSrc(urlValue)
    if (!src) {
      setError(t.imageUrlInvalid)
      return
    }
    setError(null)
    await insert(src)
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchorRef={anchorRef}
      className="w-80 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg"
    >
      <div className="flex flex-col gap-3">
        {allowExternalUrl && (
          <div className="flex gap-1.5 rounded-lg bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setMode('upload')}
              aria-pressed={mode === 'upload'}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'upload' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.imageTabUpload}
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              aria-pressed={mode === 'url'}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'url' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.imageTabUrl}
            </button>
          </div>
        )}

        {mode === 'upload' ? (
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading && <Spinner size="sm" />}
              {uploading ? copy.images.uploading : copy.images.upload}
            </button>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            {t.imageTabUrl}
            <input
              type="text"
              placeholder={t.imageUrlPlaceholder}
              value={urlValue}
              onChange={(e) => {
                setUrlValue(e.currentTarget.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleUrlSubmit()
                }
              }}
              className="h-9 rounded-md border border-neutral-300 px-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          {t.imageAltLabel}
          <input
            type="text"
            value={altValue}
            onChange={(e) => setAltValue(e.currentTarget.value)}
            className="h-9 rounded-md border border-neutral-300 px-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
          />
          <span className="text-[11px] text-neutral-400">{t.imageAltHint}</span>
        </label>

        {error && (
          <p role="alert" className="text-xs font-semibold text-neutral-900">
            {error}
          </p>
        )}

        {mode === 'url' && (
          <button
            type="button"
            onClick={() => void handleUrlSubmit()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            {t.imageInsert}
          </button>
        )}
      </div>
    </Popover>
  )
}
