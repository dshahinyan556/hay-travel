import { useState } from 'react'
import { uploadImage } from '@/features/admin/api/uploads'

// Клиентская копия дефолтов backend `UploadSettings` (appsettings.json "Upload") — сверять
// вручную при их смене там, отдельного эндпоинта под эти лимиты нет. Проверка здесь только
// ради быстрой обратной связи до отправки; окончательное решение всегда за бэком.
const MAX_FILE_SIZE_BYTES = 8_000_000
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function validationError(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Только JPEG, PNG или WebP.'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'Файл больше 8 МБ.'
  return null
}

/** Upload state + action for one image field/row. `onUploaded` fires with the server URL on
 * success — the caller decides what to do with it (same setter as manual URL typing). */
export function useImageUpload(onUploaded: (url: string) => void) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    const clientError = validationError(file)
    if (clientError) {
      setError(clientError)
      return
    }

    setError(null)
    setIsUploading(true)
    try {
      const { url } = await uploadImage(file)
      onUploaded(url)
    } catch {
      setError('Не удалось загрузить файл.')
    } finally {
      setIsUploading(false)
    }
  }

  return { isUploading, error, upload }
}
