import { useState } from 'react'
import { uploadImage } from '@/features/admin/api/uploads'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminUiCopy } from './adminUiCopy'
import { validateImageFile, type ImageValidationErrorCode } from './imageUploadValidation'

/** Why the upload failed, or `null` while it hasn't. Kept as a CODE in state and turned into a
 * sentence at render time, so a visible error re-reads in the new language when the interface
 * language is switched instead of staying frozen in the one it was raised in. */
type UploadErrorCode = ImageValidationErrorCode | 'failed'

/** Upload state + action for one image field/row. `onUploaded` fires with the server URL on
 * success — the caller decides what to do with it (same setter as manual URL typing). */
export function useImageUpload(onUploaded: (url: string) => void): {
  isUploading: boolean
  error: string | null
  upload: (file: File) => Promise<void>
} {
  const copy = useCopy(adminUiCopy).images
  const [isUploading, setIsUploading] = useState(false)
  const [errorCode, setErrorCode] = useState<UploadErrorCode | null>(null)

  async function upload(file: File) {
    const clientError = validateImageFile(file)
    if (clientError) {
      setErrorCode(clientError)
      return
    }

    setErrorCode(null)
    setIsUploading(true)
    try {
      const { url } = await uploadImage(file)
      onUploaded(url)
    } catch {
      setErrorCode('failed')
    } finally {
      setIsUploading(false)
    }
  }

  const errorMessage: Record<UploadErrorCode, string> = {
    type: copy.errorFileType,
    size: copy.errorFileSize,
    failed: copy.errorUploadFailed,
  }

  return { isUploading, error: errorCode === null ? null : errorMessage[errorCode], upload }
}
