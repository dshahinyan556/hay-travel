# Spec 008. Английская версия админки — фундамент (инфраструктура, шасси, `shared/ui`)

- **Дата:** 2026-08-22
- **Автор:** Frontend Architect
- **Исполнитель:** один `frontend-developer` (пачка A)
- **ADR:** [021 — локализация админ-панели](../adr/021-admin-panel-localization.md)
- **Порядок:** **делается первой и в одиночку.** Пачки B–H ([Spec 009](009-admin-i18n-modules.md))
  стартуют только после мержа этой задачи — они импортируют всё, что здесь создаётся.

---

## Что делаем

Инфраструктуру локализации админки + перевод «шасси» панели (layout, сайдбар, общие admin-UI
компоненты, admin-facing дефолты `shared/ui`) и общие словари, на которые опираются все
остальные пачки.

Правило, действующее с этой задачи и дальше: **ни одна строка интерфейса админки не пишется
литералом в JSX** — только через copy-модуль своей фичи. Комментарии в коде НЕ переводятся.

---

## 1. `shared/i18n/defineCopy.ts` — создать

Ядро механизма. Полный контракт:

```ts
import type { Locale } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'

/** Локале-зависимый набор строк одного модуля админки. */
export type Copy<T extends object> = (locale: Locale) => T

/**
 * `ru` — источник истины: тип выводится ТОЛЬКО из него. `en` описан отображённым типом
 * `{ [K in keyof T]: T[K] }`, поэтому не участвует в выводе и проверяется по `ru`: лишний ключ,
 * пропущенный ключ или функция с другой сигнатурой — ошибка сборки. Это тот же контракт
 * «забыл перевод → не собирается», что даёт `Record<TranslationKey, string>` в публичном словаре.
 */
export function defineCopy<T extends object>(ru: T, en: { [K in keyof T]: T[K] }): Copy<T> {
  return (locale) => (locale === 'en' ? (en as T) : ru)
}

/** Хук-обёртка: берёт текущую локаль из `LocaleProvider`. Единственный способ читать copy в компоненте. */
export function useCopy<T extends object>(copy: Copy<T>): T {
  const { locale } = useLocale()
  return copy(locale)
}
```

**Критично для всех пачек (написать это в doc-комментарии файла):**

- объект `ru` в copy-модуле **не помечается `as const`** — иначе тип станет литеральным
  (`title: 'Заказы'`) и `en` перестанет собираться. В публичном `dictionary.ts` `as const` нужен,
  здесь — вреден;
- в `defineCopy` попадает **только переводимое**. Непереводимые экспорты модуля
  (`STATUS_ORDER`, `statusBadgeTone`, `formatOrderMoney`, маппинг кодов ошибок и т.п.) остаются
  обычными экспортами того же файла;
- вне React (лоадер, чистая функция) copy берётся вызовом `ordersCopy(locale)`, где `locale`
  приходит параметром или из `getStoredLocale()`.

## 2. `shared/lib/format.ts` — изменить

Сделать `pluralizeRu` и `pluralizeEn` экспортируемыми (сейчас они приватные, строки 5 и 14).
Логику не трогать. Это единственный разрешённый источник plural-форм для админки — свои
локальные `plural()` в `ordersCopy.ts`/`calendarCopy.ts` пачки B и C удалят в пользу этих.

## 3. `shared/i18n/dictionary.ts` — изменить (только добавление ключей)

Шапка файла уже переписана архитектором — **не трогать её**. Добавить в `ru` и в `en` новую
секцию `ui.*` (собственная копия примитивов `shared/ui`; фича-строки сюда НЕ добавляются):

| Ключ | ru | en |
| --- | --- | --- |
| `ui.select.placeholder` | `Выберите…` | `Select…` |
| `ui.select.searchPlaceholder` | `Поиск…` | `Search…` |
| `ui.select.noResults` | `Ничего не найдено` | `Nothing found` |
| `ui.toolbar.cancel` | `Отмена` | `Cancel` |
| `ui.toolbar.save` | `Сохранить` | `Save` |
| `ui.toolbar.add` | `Добавить` | `Add` |
| `ui.toolbar.delete` | `Удалить` | `Delete` |
| `ui.spinner.loading` | `Загрузка` | `Loading` |
| `ui.help.trigger` | `Справка: {title}` | `Help: {title}` |
| `ui.help.close` | `Закрыть` | `Close` |
| `ui.unsaved.title` | `Уйти без сохранения?` | `Leave without saving?` |
| `ui.unsaved.message` | `Изменения ещё не сохранены. Если уйти со страницы сейчас, они будут потеряны.` | `Your changes are not saved yet. If you leave now, they will be lost.` |
| `ui.unsaved.confirm` | `Уйти` | `Leave` |
| `ui.sortable.itemFallback` | `Элемент` | `Item` |
| `ui.sortable.instructions` | `Чтобы взять элемент для перемещения, нажмите пробел или Enter. Пока элемент взят, перемещайте его стрелками вверх и вниз, затем нажмите пробел или Enter ещё раз, чтобы отпустить на новой позиции, либо Escape, чтобы отменить.` | `To pick up an item, press Space or Enter. While holding, move it with the arrow keys, then press Space or Enter again to drop it in the new position, or Escape to cancel.` |
| `ui.sortable.dragStart` | `Начато перемещение: «{item}», позиция {index} из {total}.` | `Started moving “{item}”, position {index} of {total}.` |
| `ui.sortable.dragOver` | `«{item}» перемещён на позицию {index} из {total}.` | `“{item}” moved to position {index} of {total}.` |
| `ui.sortable.dragEnd` | `Перемещение завершено. «{item}» теперь на позиции {index} из {total}.` | `Move finished. “{item}” is now at position {index} of {total}.` |
| `ui.sortable.dragCancel` | `Перемещение отменено. «{item}» остался на позиции {index} из {total}.` | `Move cancelled. “{item}” stayed at position {index} of {total}.` |

## 4. `shared/ui` — изменить пять файлов

Общий приём для дефолтных значений пропов: значение по умолчанию **нельзя** брать из `t()` в
сигнатуре функции (хук в дефолте параметра). Делать как в `DatePicker` — проп становится
опциональным, а внутри тела: `const resolvedX = x ?? t('ui.…')`.

| Файл | Что менять |
| --- | --- |
| `shared/ui/Select.tsx` | `placeholder`, `searchPlaceholder`, `noResultsText` — убрать русские дефолты из сигнатуры, разрешить через `t()` внутри. |
| `shared/ui/AdminToolbar.tsx` | `DEFAULT_LABELS` (строка 29) удалить; лейблы брать из `t('ui.toolbar.*')` внутри компонента, сохранив существующий приоритет «проп важнее дефолта». |
| `shared/ui/UnsavedChangesModal.tsx` | `title`/`message`/`confirmLabel` — по тому же приёму, ключи `ui.unsaved.*`. |
| `shared/ui/Spinner.tsx` | `aria-label="Загрузка"` → `t('ui.spinner.loading')`. |
| `shared/ui/HelpButton.tsx` | `Справка: ${title}` → `t('ui.help.trigger', { title })`; `aria-label="Закрыть"` → `t('ui.help.close')`. |
| `shared/ui/SortableList.tsx` | `RU_SCREEN_READER_INSTRUCTIONS` и `buildAnnouncements` — добавить параметр `t` (тип `(key: TranslationKey, vars?: Record<string, string \| number>) => string`), строки собирать через ключи `ui.sortable.*`; дефолт `itemLabel` — по приёму с `??`. |

Ничего, кроме текста и способа его получения, в этих компонентах не меняется — ни разметка, ни
классы, ни поведение.

## 5. `features/admin/lib/adminCommonCopy.ts` — создать

Строки, которые нужны больше чем одной пачке. Пачки B–H **только читают** этот файл и не
дописывают в него (иначе конфликты при параллельной работе); если пачке нужна своя формулировка —
она кладёт её в собственный `*Copy.ts`.

```ts
export const adminCommonCopy = defineCopy(
  {
    save: 'Сохранить', saving: 'Сохраняем…', saved: 'Сохранено.',
    cancel: 'Отмена', add: 'Добавить', delete: 'Удалить', edit: 'Изменить', close: 'Закрыть',
    confirm: 'Подтвердить', back: 'Назад', retry: 'Повторить', clear: 'Сбросить',
    search: 'Поиск', searchPlaceholder: 'Поиск…', loading: 'Загрузка…',
    empty: 'Пока пусто.', nothingFound: 'Ничего не найдено.', dash: '—',
    yes: 'Да', no: 'Нет', all: 'Все', required: 'Обязательное поле',
    unknownError: 'Что-то пошло не так. Попробуйте ещё раз.',
    networkError: 'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.',
    forbiddenError: 'Недостаточно прав для этого действия.',
    serverError: (status: number) => `Сервер вернул ошибку (${status}).`,
  },
  {
    save: 'Save', saving: 'Saving…', saved: 'Saved.',
    cancel: 'Cancel', add: 'Add', delete: 'Delete', edit: 'Edit', close: 'Close',
    confirm: 'Confirm', back: 'Back', retry: 'Retry', clear: 'Reset',
    search: 'Search', searchPlaceholder: 'Search…', loading: 'Loading…',
    empty: 'Nothing here yet.', nothingFound: 'Nothing found.', dash: '—',
    yes: 'Yes', no: 'No', all: 'All', required: 'This field is required',
    unknownError: 'Something went wrong. Please try again.',
    networkError: 'No connection to the server. Check your network and try again.',
    forbiddenError: 'You do not have permission for this action.',
    serverError: (status: number) => `The server returned an error (${status}).`,
  },
)
```

## 6. `features/admin/lib/adminEnumsCopy.ts` — создать, `features/admin/lib/enums.ts` — изменить

`enums.ts` — это модуль констант протокола, его импортируют и мапперы, и API-слой. Подписи для
интерфейса оттуда **уезжают**: удалить `tourTypeLabels` (стр. 22), `tagColorLabels` (стр. 55),
`employeeJobRoleLabels` (стр. 188); сами enum'ы и типы остаются нетронутыми.

Новый `adminEnumsCopy.ts` содержит их локале-зависимые версии:

```ts
export const adminEnumsCopy = defineCopy(
  {
    tourType: { [TourType.Tour]: 'Тур', [TourType.Excursion]: 'Экскурсия' } as Record<TourType, string>,
    tagColor: { …Золотой/Бордовый/Зелёный/Красный/Оранжевый } as Record<TagColor, string>,
    employeeJobRole: { …текущие значения из enums.ts:188 } as Record<EmployeeJobRole, string>,
  },
  { tourType: { … Tour / Excursion }, tagColor: { Gold/Wine/Green/Red/Orange }, employeeJobRole: { Driver/Guide/… } },
)
```

Английские подписи ролей и цветов берутся из имён самих enum-членов (`Driver` → `Driver`,
`Gold` → `Gold`) — придумывать синонимы не нужно.

Все текущие импортёры удалённых записей (`ui/EmployeeJobRoleSelect.tsx`, `ui/TourTableParts.tsx`,
`orders/lib/ordersCopy.ts`, `catalog/tags/*`, `tour-form/components/TourTypeToggle.tsx`) —
чинятся владельцами своих пачек; в этой задаче чинятся только те, что лежат в `features/admin/ui`
и `features/admin/layout` (см. §8). Чтобы не сломать сборку остальным, **эта задача обязана
оставить проект компилируемым**: если после удаления подписей ломаются файлы чужих пачек,
исправить в них ровно импорт (`adminEnumsCopy` + `useCopy`), не трогая остальной текст файла.

## 7. `features/admin/layout/AdminLanguageSwitch.tsx` — создать

Ориентир по структуре и a11y — `app/layout/LanguageSwitch.tsx` (`LOCALES.map`, `aria-pressed`,
`aria-label={locale.name}`, невидимый `before:`-расширитель тап-таргета до 44px). Отличие —
палитра: компонент живёт на тёмном шасси `#0b1220`, поэтому вместо винно-золотых токенов —
`bg-white/10 text-white` для активной пилюли и `text-slate-400 hover:text-white` для неактивной,
рамка `ring-1 ring-white/15`. Никаких `wine`/`gold`/`ink` токенов: `AdminLayout` намеренно
изолирован от палитры сайта (см. его `useLayoutEffect`, снимающий `data-preset`).

```ts
interface AdminLanguageSwitchProps {
  /** Доп. классы контейнера — точка монтирования сама решает про отступы/видимость по брейкпоинту. */
  className?: string
}
export function AdminLanguageSwitch({ className }: AdminLanguageSwitchProps)
```

Состояние не своё: `const { locale, setLocale } = useLocale()`.

## 8. Файлы шасси — изменить

**`features/admin/layout/adminLayoutCopy.ts` — создать** (namespace модуля: `layout`). Строки:
`brandSubtitle` («Панель администратора»), `openMenu`, `closeMenu`, `menuLabel`, `backToSite`
(«На сайт»), `logout` («Выйти»), `logoutPending` («Выходим…»), `nav.*` (`Дашборд`, `Продукты`,
`Календарь`, `Заказы`, `Справочники`, `Пользователи`, `Уведомления`, `Настройки`),
`accessDenied.*`, `errorBoundary.*`, `languageLabel` («Язык интерфейса» / «Interface language»).

| Файл | Что делаем |
| --- | --- |
| `layout/AdminLayout.tsx` | Все `aria-label` мобильного топбара/дровера — из copy. В мобильный топбар справа (`ml-auto`) добавить `<AdminLanguageSwitch />`. Логику темы/`data-preset`, дровер, скролл-лок НЕ трогать. |
| `layout/AdminSidebar.tsx` | `navItems[].label` → ключи copy (label вычисляется при рендере, не в module-scope константе). Подпись бренда, «На сайт», «Выйти/Выходим…» — из copy. В нижний блок аккаунта, над «На сайт», добавить `<AdminLanguageSwitch className="hidden md:flex …" />` — на мобиле переключатель уже есть в топбаре, дублировать в дровере не нужно. |
| `layout/AdminAccessDenied.tsx` | Текст отказа — из copy. |
| `layout/AdminErrorBoundary.tsx` | Тексты ошибки/кнопок — из copy. |
| `layout/adminRootLoader.ts` | Проверить: если возвращает текст — брать `adminLayoutCopy(getStoredLocale())`. Если текста нет (только редиректы/флаги) — файл не менять. |

## 9. `features/admin/ui/**` — изменить (общие admin-компоненты)

**`features/admin/ui/adminUiCopy.ts` — создать.** Строки компонентов этой папки: подписи
загрузки/удаления изображений (`ImageListEditor`, `ImageUploadButton`, `ImageUrlField`,
`useImageUpload` — тексты ошибок загрузки), `RepeaterControls` (вверх/вниз/удалить),
`SidePanel` (закрыть), `TranslationGroup` (подписи вкладок RU/EN), `EmployeeJobRoleSelect`
(плейсхолдер + подписи ролей через `adminEnumsCopy`), `TourTableParts` (подписи типа тура через
`adminEnumsCopy`).

Файлы: `EmployeeJobRoleSelect.tsx`, `ImageListEditor.tsx`, `ImageUploadButton.tsx`,
`ImageUrlField.tsx`, `RepeaterControls.tsx`, `SidePanel.tsx`, `TourTableParts.tsx`,
`TranslationGroup.tsx`, `useImageUpload.ts`.

`useImageUpload.ts` — хук, `useCopy` в нём вызывать можно. Если текст ошибки нужен вне React —
принять `copy` параметром.

## 10. `features/admin/index.ts` — изменить

Добавить в барные экспорты `AdminLanguageSwitch` только если он реально нужен снаружи (сейчас —
нет, монтируется внутри `layout`). Скорее всего изменение не потребуется: проверить и не трогать
файл, если нечего добавить.

---

## Состояния и edge-кейсы

- Переключение языка в админке — **чистый ре-рендер**, без сетевых запросов: админские лоадеры
  тянут все переводы сразу. `useRevalidateOnLocaleChange` в админку НЕ добавлять.
- Выбранный язык переживает перезагрузку (`localStorage`, `hay-travel-locale`) и общий с
  публичным сайтом — это ожидаемое поведение, а не баг (ADR 021, решение 1).
- `<html lang>` уже обновляет `LocaleProvider` — ничего дополнительно не делать.
- Мобильная версия обязательна к проверке: переключатель в топбаре не должен ломать высоту
  шапки и наезжать на бренд при узком экране (360px).
- Тап-таргет пилюль ≥44px, `aria-pressed` на активной — как в публичном `LanguageSwitch`.

## Вне скоупа

- Любые файлы `features/admin/{orders,calendar,catalog,tour-form,users,products,dashboard,settings,notifications}`
  — их делают пачки B–H по [Spec 009](009-admin-i18n-modules.md).
- `features/admin/api/**` и `features/admin/types/**` — там русский только в комментариях;
  **не менять**.
- Перевод комментариев в коде.
- Перевод контента, который вводит админ (названия туров, тексты сайта) — он уже RU+EN в данных.
- Публичный сайт, `app/layout/LanguageSwitch.tsx` — не трогать.
- `Hay Travel/CLAUDE.md`, `docs/**` — обновляет отдельная задача (`update-docs`), исполнителю
  пачки A их не править.
