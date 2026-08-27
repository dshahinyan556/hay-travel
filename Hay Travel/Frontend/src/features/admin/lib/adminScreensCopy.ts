/**
 * Captions for the permission-matrix rows (screens) and for the access levels they can be set to.
 *
 * Cross-module on purpose, like `adminEnumsCopy.ts`: both the role editor and the per-user override
 * block on the user card render the same matrix.
 *
 * The backend also sends a `displayName` with every screen, but it is only ever used as a FALLBACK
 * (`screenLabel`): an admin panel that renders `catalog.tags` as a raw key the day a new screen
 * ships on the backend would look broken, while a Russian caption from the server looks finished.
 * Adding the key here afterwards is a one-line change and needs no backend deploy — and it is what
 * makes an ENGLISH caption possible at all, since the server has only the Russian one.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { AdminScreen, type ScreenKey } from '@/shared/auth'
// The dropdown's own union, not the wire enum — `AccessLevelSelect` takes its captions keyed by it.
import type { AccessLevel as AccessLevelName } from '@/shared/ui'

const ru = {
  /** Keyed by screen key, not by `AdminScreen` member: a key the backend added after this build
   * shipped is simply missing here and falls back to the server's caption. */
  screens: {
    [AdminScreen.Dashboard]: 'Дашборд',
    [AdminScreen.Products]: 'Туры и экскурсии',
    [AdminScreen.Calendar]: 'Календарь и блокировки',
    [AdminScreen.Orders]: 'Заказы',
    [AdminScreen.CatalogPlaces]: 'Справочник: точки маршрута',
    [AdminScreen.CatalogExpenseTemplates]: 'Справочник: доп. расходы',
    [AdminScreen.CatalogNoteTemplates]: 'Справочник: заметки',
    [AdminScreen.CatalogRegions]: 'Справочник: регионы',
    [AdminScreen.CatalogTags]: 'Справочник: теги',
    [AdminScreen.Users]: 'Пользователи',
    [AdminScreen.Settings]: 'Настройки сайта',
  } as Record<ScreenKey, string>,

  /** Chrome of the grid itself. Lives here rather than in `rolesCopy` so `features/admin/ui/`
   * never has to import a sibling module's copy — the dependency would point the wrong way. */
  matrix: {
    columnScreen: 'Экран',
    columnLevel: 'Уровень доступа',
    /**
     * The five levels of `AccessLevel`, keyed by `AccessLevelSelect`'s own string union (that
     * component takes captions as a plain record and bakes in no business copy of its own).
     *
     * Each caption names the level's own action, and the level INCLUDES everything below it —
     * «Изменение» also grants viewing and creating. That is spelled out once, in
     * `rolesCopy.matrixLevelExplain` above the grid, instead of being repeated inside all five
     * captions, which would make the dropdown unreadable.
     */
    levels: {
      None: 'Нет доступа',
      View: 'Просмотр',
      Create: 'Создание',
      Update: 'Изменение',
      Delete: 'Удаление',
    } as Record<AccessLevelName, string>,
    notApplicable: 'Права к этому экрану неприменимы',
    /** Ghost text of an override row left on "наследовать": what the ROLE resolves to. */
    inheritedLevel: (level: string) => `По роли: ${level}`,
    resetToInherited: 'Вернуть наследование от роли',
  },
}

const en: { [K in keyof typeof ru]: (typeof ru)[K] } = {
  screens: {
    [AdminScreen.Dashboard]: 'Dashboard',
    [AdminScreen.Products]: 'Tours & excursions',
    [AdminScreen.Calendar]: 'Calendar & closures',
    [AdminScreen.Orders]: 'Orders',
    [AdminScreen.CatalogPlaces]: 'Reference: route points',
    [AdminScreen.CatalogExpenseTemplates]: 'Reference: extra costs',
    [AdminScreen.CatalogNoteTemplates]: 'Reference: notes',
    [AdminScreen.CatalogRegions]: 'Reference: regions',
    [AdminScreen.CatalogTags]: 'Reference: tags',
    [AdminScreen.Users]: 'Users',
    [AdminScreen.Settings]: 'Site settings',
  },

  matrix: {
    columnScreen: 'Screen',
    columnLevel: 'Access level',
    levels: {
      None: 'No access',
      View: 'View',
      Create: 'Create',
      Update: 'Update',
      Delete: 'Delete',
    },
    notApplicable: 'Permissions do not apply to this screen',
    inheritedLevel: (level: string) => `From the role: ${level}`,
    resetToInherited: 'Back to inheriting from the role',
  },
}

export const adminScreensCopy = defineCopy(ru, en)
export type AdminScreensCopy = ReturnType<typeof adminScreensCopy>

/**
 * @param copy     resolved `adminScreensCopy` for the current locale
 * @param key      screen key exactly as it came from `GET api/Screens`
 * @param fallback that screen's `displayName` — used for keys this build does not know yet
 */
export function screenLabel(copy: AdminScreensCopy, key: ScreenKey, fallback: string): string {
  return copy.screens[key] ?? fallback
}
