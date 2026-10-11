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

/**
 * Закэшированный `theme.activePalette` — то, что выбрал АДМИН. Пишет только `useSiteDesign`.
 *
 * Имя ключа не меняется (`hay-travel-palette`): его читает pre-paint скрипт в `index.html`, и
 * переименование стоило бы всем существующим посетителям одной вспышки дефолтной палитры.
 */
export const PALETTE_STORAGE_KEY = 'hay-travel-palette'

/**
 * Личный выбор палитры залогиненного (`preferredPalette` в предпочтениях аккаунта), зеркалом в
 * `localStorage`.
 *
 * ОТДЕЛЬНЫЙ ключ, а не запись в `PALETTE_STORAGE_KEY`, ровно по тому же доводу, по которому
 * `THEME_STORAGE_KEY` и `THEME_DEFAULT_STORAGE_KEY` разведены в `theme.ts` (ADR 018, вопрос 3b).
 * Смешай их — и `useSiteDesign`, приняв ответ `GetPublic`, затрёт личный выбор админским
 * дефолтом на каждой загрузке; человек увидит свою палитру ровно до ответа сервера, а потом
 * чужую. Порядок «личный выбор → админский дефолт → обсидиан» задан один раз, в
 * `readCachedPalette()` ниже, и продублирован в pre-paint скрипте `index.html`.
 *
 * Зеркало нужно именно в `localStorage`, а не только в памяти: pre-paint скрипт выполняется до
 * любого модуля и до любого запроса, и другого источника у него нет.
 */
export const PALETTE_CHOICE_STORAGE_KEY = 'hay-travel-palette-choice'

/** «Личный выбор палитры изменился, перечитай» — слушает `useSiteDesign`, единственный владелец
 *  `data-preset` на публичном сайте. */
export const PALETTE_CHOICE_EVENT = 'hay-travel-palette-choice-sync'

/** Сужение неизвестной строки (значение с сервера / из localStorage) до известного id. */
export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value)
}

/**
 * Личный выбор палитры, если он вообще был сделан. `null` — «выбора нет, следуй сайту».
 * Двойник `readThemeChoice()` в `theme.ts` и с тем же контрактом.
 */
export function readPaletteChoice(): PaletteId | null {
  try {
    const chosen = localStorage.getItem(PALETTE_CHOICE_STORAGE_KEY)
    return isPaletteId(chosen) ? chosen : null
  } catch {
    return null
  }
}

/** Последний известный АДМИНСКИЙ пресет (`theme.activePalette`), без учёта личного выбора. */
export function readSitePalette(): PaletteId {
  try {
    const cached = localStorage.getItem(PALETTE_STORAGE_KEY)
    return isPaletteId(cached) ? cached : DEFAULT_PALETTE
  } catch {
    return DEFAULT_PALETTE
  }
}

/**
 * Пресет, который должен быть на экране: личный выбор → админский дефолт → `DEFAULT_PALETTE`.
 *
 * Этот же порядок читает pre-paint скрипт в `index.html` — палитра должна быть на `<html>` до
 * первого кадра, иначе посетитель видит вспышку дефолта на каждом заходе (ADR 018, вопрос 3).
 * Меняете порядок здесь — меняйте и там.
 */
export function readCachedPalette(): PaletteId {
  return readPaletteChoice() ?? readSitePalette()
}

/** Кэширует АДМИНСКИЙ пресет для pre-paint скрипта. Ключ личного выбора не трогает — иначе
 *  дефолт сайта стал бы личным выбором навсегда. Молча ничего не делает, если storage недоступен. */
export function cachePalette(id: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, id)
  } catch {
    // Приватный режим / заблокированное хранилище — пресет всё равно применён к этой вкладке.
  }
}

/**
 * Записывает личный выбор палитры (`null` — снять выбор и снова следовать сайту) и будит
 * `useSiteDesign`, чтобы тот перекрасил `<html>`.
 *
 * Сам `data-preset` здесь НЕ трогается специально: владелец атрибута на публичном сайте один —
 * `useSiteDesign` (ADR 018, вопрос 3c). В `/admin` он не смонтирован, и это ровно то поведение,
 * которое нужно: панель не носит пресет никогда, а запись в хранилище всё равно происходит,
 * поэтому переход из панели на публичный сайт сразу отдаёт правильную палитру.
 *
 * Вызывать из обработчика события/эффекта — см. `notifyThemeChanged()` о том же ограничении.
 */
export function persistPaletteChoice(id: PaletteId | null): void {
  try {
    if (id === null) localStorage.removeItem(PALETTE_CHOICE_STORAGE_KEY)
    else localStorage.setItem(PALETTE_CHOICE_STORAGE_KEY, id)
  } catch {
    // Хранилище заблокировано — выбор не переживёт перезагрузку, но событие ниже всё равно
    // перекрасит текущую вкладку.
  }
  window.dispatchEvent(new Event(PALETTE_CHOICE_EVENT))
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
