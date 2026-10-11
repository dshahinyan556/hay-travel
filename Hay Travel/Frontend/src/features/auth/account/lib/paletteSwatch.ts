/**
 * Как выглядит пресет палитры на кнопке выбора.
 *
 * Название пресета («Базальт и медь») человеку ничего не говорит, пока он его не увидел, поэтому
 * рядом с подписью стоит пятно из двух цветов пресета — фона страницы и акцента.
 *
 * ── Почему это не CSS-переменные ──────────────────────────────────────────────────────────────
 * Пятно обязано показывать ЧУЖУЮ палитру — ту, которая сейчас НЕ применена к документу. Все токены
 * `--surface-page`/`--gold-ink` в этот момент принадлежат активному пресету, поэтому оба образца
 * получились бы одного цвета. Значения приходится взять литералами.
 *
 * ── Почему здесь, а не в `shared/lib/palette.ts` ──────────────────────────────────────────────
 * Это презентационная подробность одного экрана. К тому же цвет фона зависит и от темы, а тип
 * `Theme` живёт в `theme.ts`, который сам импортирует `palette.ts`: карта «пресет × тема» в
 * `palette.ts` замкнула бы их в цикл.
 *
 * Источник значений — `src/styles/palettes.css` и `:root`/`[data-theme='light']` в `index.css`
 * (`--surface-page` и `--gold-ink`). Новый пресет — новая строка здесь, вслед за `PALETTE_IDS`.
 */

import type { PaletteId } from '@/shared/lib/palette'
import type { Theme } from '@/shared/lib/theme'
import type { TranslationKey } from '@/shared/i18n/dictionary'

export interface PaletteSwatch {
  /** Фон страницы пресета — `--surface-page`. */
  surface: string
  /** Акцент пресета — `--gold-ink` (золото у обсидиана, медь у базальта). */
  accent: string
}

const SWATCHES: Record<PaletteId, Record<Theme, PaletteSwatch>> = {
  obsidian: {
    dark: { surface: '#0f0c08', accent: '#d9b45a' },
    light: { surface: '#f4ede0', accent: '#6b4a15' },
  },
  basalt: {
    dark: { surface: '#0e1214', accent: '#de8f5f' },
    light: { surface: '#edeeec', accent: '#94491f' },
  },
}

export function paletteSwatch(id: PaletteId, theme: Theme): PaletteSwatch {
  return SWATCHES[id][theme]
}

/** Подпись пресета. Ключи словаря, а не строки с сервера: `GetPublic` отдаёт `theme.activePalette`
 *  одним id, без каталога названий. */
export const PALETTE_LABEL_KEY: Record<PaletteId, TranslationKey> = {
  obsidian: 'account.pref.paletteObsidian',
  basalt: 'account.pref.paletteBasalt',
}
