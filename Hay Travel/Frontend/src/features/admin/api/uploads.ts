/**
 * Image upload — one endpoint, `api/Upload/Image`. Returns the same kind of relative URL string
 * that `ImageUrlField`/`ImageListEditor` already accept from manual typing (ADR 2026-08-15: URL
 * stays an alternative, upload is a second way to fill the same value).
 */

import { authFetch } from '@/shared/auth'

export interface ImageUploadResult {
  url: string
}

export function uploadImage(file: File): Promise<ImageUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  return authFetch<ImageUploadResult>('api/Upload/Image', {
    method: 'POST',
    body: formData,
  })
}
