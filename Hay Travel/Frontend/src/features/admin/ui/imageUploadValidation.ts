/**
 * Client copy of the backend `UploadSettings` defaults (`appsettings.json` "Upload") — sync by
 * hand when those change, there is no endpoint that exposes them. This check exists only for fast
 * feedback before the request goes out; the backend has the final say.
 */
const MAX_FILE_SIZE_BYTES = 8_000_000
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type ImageValidationErrorCode = 'type' | 'size'

/**
 * `null` = the file is fine to upload. Shared by `useImageUpload` (single-image admin fields) and
 * `RichTextEditor`'s `ImageDialog` (spec 011 §3.11) — the limits must never be defined twice.
 * Returns a CODE, not a rendered message: only the caller knows the current locale.
 */
export function validateImageFile(file: File): ImageValidationErrorCode | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'type'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'size'
  return null
}
