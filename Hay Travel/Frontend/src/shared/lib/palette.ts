/**
 * Palette presets — the ADMIN-chosen axis of the site's colour system (ADR 018).
 *
 * Twin of `shared/lib/theme.ts`, which owns the VISITOR-chosen dark/light axis. Same shape: a
 * read, a persist, and an apply, each tolerant of `localStorage` being unavailable.
 *
 * `erasableSyntaxOnly` in tsconfig forbids TS `enum`, so this is an `as const` array plus a
 * derived union — the same pattern as `features/admin/lib/enums.ts`.
 */

/**
 * Известные фронту id пресетов. Должны совпадать с `ThemePaletteCatalog` на бэкенде.
 */
export const PALETTE_IDS = ['obsidian', 'basalt'] as const

export type PaletteId = (typeof PALETTE_IDS)[number]

/** Дефолт сайта. Обсидиан — это ОТСУТСТВИЕ атрибута `data-preset`, а не отдельный блок CSS. */
export const DEFAULT_PALETTE: PaletteId = 'obsidian'

export const PALETTE_STORAGE_KEY = 'hay-travel-palette'

/** Сужение неизвестной строки (значение с сервера / из localStorage) до известного id. */
export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value)
}

/**
 * Последний известный пресет. Неизвестное/битое/отсутствующее значение → `DEFAULT_PALETTE`.
 *
 * Это же значение читает pre-paint скрипт в `index.html` — палитра должна быть на `<html>` до
 * первого кадра, иначе посетитель видит вспышку дефолта на каждом заходе (ADR 018, вопрос 3).
 */
export function readCachedPalette(): PaletteId {
  try {
    const cached = localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPaletteId(cached) ? cached : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

/** Кэширует пресет для pre-paint скрипта. Молча ничего не делает, если storage недоступен. */
export function cachePalette(id: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id)
  } catch {
    // Приватный режим / заблокированное хранилище — пресет всё равно применён к этой вкладке.
  }
}

/**
 * Навешивает пресет на <html>. Для `obsidian` атрибут УДАЛЯЕТСЯ, а не выставляется:
 * дефолт — это отсутствие атрибута (ADR 018), и «пустой» блок `[data-preset='obsidian']`,
 * который пришлось бы держать синхронным с `:root`, не существует.
 */
export function applyPalette(id: PaletteId): void {
  const root = document.documentElement
  if (id === DEFAULT_PALETTE) delete root.dataset.preset
  else root.dataset.preset = id
}
