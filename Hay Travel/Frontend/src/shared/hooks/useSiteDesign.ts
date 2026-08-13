import { useEffect, useLayoutEffect } from 'react'
import { getThemeSettings } from '@/shared/api/siteSettings'
import {
  applyPalette,
  cachePalette,
  DEFAULT_PALETTE,
  isPaletteId,
  readCachedPalette,
} from '@/shared/lib/palette'
import { applyTheme, cacheDefaultMode, readStoredTheme, THEME_SYNC_EVENT } from '@/shared/lib/theme'

/**
 * Применяет дизайн-настройки сайта (`theme.activePalette`, `theme.defaultMode`) к документу.
 * Монтируется РОВНО ОДИН РАЗ — из `RootLayout`. В `/admin` не монтируется никогда.
 */
export function useSiteDesign(): void {
  /**
   * Клиентский переход `/admin` → публичный сайт: `AdminLayout` снял `data-preset`, pre-paint
   * скрипт уже не выполнится (он работает один раз на загрузку документа), и без этого
   * посетитель увидел бы обсидиан до ответа сервера. `useLayoutEffect`, а не `useEffect`, по той
   * же причине, что и в `AdminLayout` — чтобы успеть до кадра.
   */
  useLayoutEffect(() => {
    applyPalette(readCachedPalette())
  }, [])

  useEffect(() => {
    let cancelled = false
    // Без `.catch`: `getThemeSettings` уже проглатывает ошибку и отдаёт пустые строки, что для
    // нас означает «оставить закэшированное» — сеть легла, сайт не перекрашивается в дефолт.
    getThemeSettings().then(({ activePalette, defaultMode }) => {
      if (cancelled) return

      // 1. Мягкий дефолт темы — только в свой ключ, НИКОГДА в ключ выбора посетителя.
      if (defaultMode === 'dark' || defaultMode === 'light') cacheDefaultMode(defaultMode)

      // 2. Палитра. Неизвестный с сервера id деградирует в дефолт, а не оставляет сайт без цветов.
      const palette = isPaletteId(activePalette) ? activePalette : DEFAULT_PALETTE
      applyPalette(palette)
      cachePalette(palette)

      // 3. Перерисовать `meta[theme-color]` под новую палитру: сама ТЕМА могла не измениться,
      //    поэтому полагаться только на событие ниже нельзя — `useTheme` бы не перерендерился.
      //    Это единственный разрешённый вызов `applyTheme` вне `useTheme` (ADR 018, вопрос 3c),
      //    и он передаёт результат того же `readStoredTheme()`, а не своё мнение о теме.
      applyTheme(readStoredTheme())

      // 4. Сказать `useTheme` перечитать состояние — случай «посетитель без своего выбора,
      //    сервер задал defaultMode, отличный от текущего».
      window.dispatchEvent(new Event(THEME_SYNC_EVENT))
    })
    return () => {
      cancelled = true
    }
  }, [])
}
