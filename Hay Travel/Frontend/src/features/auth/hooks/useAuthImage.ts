import { useEffect, useState } from 'react'
import { getAuthImageUrl } from '@/shared/api/siteSettings'

/** Заглушка, когда админ не задал фото. Тот же файл, что у hero. */
export const AUTH_IMAGE_FALLBACK = '/placeholders/tatev.svg'

/**
 * URL фотографии левой колонки `/auth` (Spec 005).
 *
 * Возвращает '' пока настройка не приехала — колонка в этот момент показывает тёмный фон и
 * затемнение, без «дыры» и без сдвига макета (высота колонки фиксирована классами).
 * После ответа: URL из админки либо `AUTH_IMAGE_FALLBACK`. Никогда не бросает.
 *
 * Хук, а не route loader: у `/auth` уже есть `authPageLoader`, который решает, пускать ли
 * посетителя на экран. Добавить туда запрос настроек — значит задержать показ формы входа ради
 * декоративной картинки. Форма важнее фотографии.
 */
export function useAuthImage(): string {
  const [url, setUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    // Без `.catch` намеренно: `getAuthImageUrl` уже проглатывает ошибку и отдаёт ''.
    getAuthImageUrl().then((value) => {
      if (cancelled) return
      setUrl(value || AUTH_IMAGE_FALLBACK)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return url
}
