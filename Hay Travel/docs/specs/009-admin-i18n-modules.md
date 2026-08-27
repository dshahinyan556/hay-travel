# Spec 009. Английская версия админки — перевод модулей (пачки B–H)

- **Дата:** 2026-08-22
- **Автор:** Frontend Architect
- **Исполнители:** 7 `frontend-developer`-агентов параллельно, по одной пачке на агента
- **ADR:** [021 — локализация админ-панели](../adr/021-admin-panel-localization.md)
- **Зависимость:** [Spec 008](008-admin-i18n-foundation.md) должна быть **завершена и смержена**.
  Каждая пачка импортирует `defineCopy`/`useCopy`, `adminCommonCopy`, `adminEnumsCopy` и
  локализованные `shared/ui`-примитивы оттуда.

---

## Общий рецепт (одинаков для всех пачек)

1. **Создать/переписать copy-модуль** своей пачки: `features/admin/<модуль>/lib/<модуль>Copy.ts`.
   ```ts
   import { defineCopy } from '@/shared/i18n/defineCopy'

   const ru = { /* существующий русский текст модуля, БЕЗ `as const` */ }
   export const ordersCopy = defineCopy(ru, { /* английские значения, те же ключи */ })
   export type OrdersCopy = ReturnType<typeof ordersCopy>
   ```
   Ключи не переименовывать без нужды — чем меньше дельта, тем ниже риск. Непереводимое
   (`STATUS_ORDER`, `statusBadgeTone`, порядки, коды ошибок) остаётся обычными экспортами
   того же файла, вне `defineCopy`.
2. **В компонентах**: `const copy = useCopy(ordersCopy)` в начале функции, дальше `copy.x`
   вместо `ordersCopy.x`. Литералы, оставшиеся в JSX (включая `aria-label`, `title`,
   `placeholder`), переносятся в тот же copy-модуль.
3. **В чистых функциях и лоадерах** (`lib/*.ts`, `hooks/*.ts` вне React): copy приходит
   параметром — `export function ordersErrorMessage(copy: OrdersCopy, err: unknown, action: string)`.
   Не звать `getStoredLocale()` внутри чистых функций, если есть вызывающий компонент.
4. **Plural-формы**: локальные `plural()` в модуле удалить, использовать
   `pluralizeRu`/`pluralizeEn` из `@/shared/lib/format` — в `ru`-объекте `pluralizeRu`,
   в `en`-объекте `pluralizeEn(count, ['order', 'orders'])`.
5. **Форматтеры `Intl` с зашитым `'ru'`/`'ru-RU'`** (даты, время, числа, `localeCompare`,
   `DisplayNames`) — параметризовать локалью. Модульную константу заменять на карту:
   ```ts
   const DATE_TIME: Record<Locale, Intl.DateTimeFormat> = {
     ru: new Intl.DateTimeFormat('ru-RU', OPTS),
     en: new Intl.DateTimeFormat('en-GB', OPTS),
   }
   ```
   Английский тег — **`en-GB`** (день-месяц-год, ближе к привычному команде порядку).
6. **Комментарии в коде не переводятся.** Файлы, где кириллица только в комментариях, не
   трогаются вообще.
7. Сборка после пачки должна быть зелёной: `npm run build` в `Hay Travel/Frontend`.

### Что НЕ делаем ни в одной пачке

- Не трогаем `features/admin/api/**` и `features/admin/types/**` (там кириллица только в
  комментариях).
- Не переводим контент, который вводит админ (названия туров, описания, тексты сайта) — он уже
  хранится в RU+EN.
- Не меняем разметку, классы, поведение, состав пропов и структуру компонентов. Задача —
  только источник текста.
- Не дописываем ключи в `features/admin/lib/adminCommonCopy.ts` и в `shared/i18n/dictionary.ts`
  (общие файлы, параллельные конфликты). Нужна своя формулировка — кладём в свой `*Copy.ts`.
- Не трогаем файлы чужих пачек. Единственное исключение — если файл чужой пачки перестал
  компилироваться из-за твоих изменений: чинится ровно импорт, без правки текста.

---

## Пачка B — Заказы (`features/admin/orders`, 14 файлов)

Copy-модуль: `orders/lib/ordersCopy.ts` (уже существует, ~149 строк текста — самая большая пачка).

Файлы: `OrderDetailPage.tsx`, `OrdersPage.tsx`, `components/AddLineModal.tsx`,
`components/AssignAllModal.tsx`, `components/OrderContextActions.tsx`,
`components/OrderFilters.tsx`, `components/OrderFulfillmentTab.tsx`, `components/OrderHeader.tsx`,
`components/OrderHistoryTab.tsx`, `components/OrderLinesGrid.tsx`,
`components/OrderPaymentTab.tsx`, `components/OrderRow.tsx`, `lib/ordersCopy.ts`,
`lib/ordersModel.ts`.

Особенности:
- `statusLabels`, `eventTypeTagLabels` — внутрь `defineCopy`; `statusBadgeTone` и `STATUS_ORDER`
  остаются снаружи.
- `employeeRoleLabel()` переписать на `adminEnumsCopy` (подписи ролей уехали из `enums.ts`).
- `ordersUnit`/`lineUnit` — через `pluralizeRu`/`pluralizeEn` (EN: `order/orders`, `line/lines`).
- `ordersErrorMessage(err, action)` → `ordersErrorMessage(copy, err, action)`; тексты ошибок и
  названия действий (`action`) переехать в `copy.errors.*` / `copy.errorActions.*`, чтобы на
  вызовах не осталось русских литералов. 5 вызовов.
- `formatOrderMoney(amount, currency)` → добавить `locale` (Intl-группировка), см. рецепт §5.
- `OrderHeader`/`OrderHistoryTab`/`OrderPaymentTab` — `toLocaleString('ru-RU')` по рецепту §5.
- `ordersModel.ts` `tourTitleResolver` — брать перевод по текущей локали с фолбэком на RU
  (ADR 021, решение 5); фолбэк-строка `Тур #{id}` тоже в copy. Функция чистая → принимает
  `locale` параметром.

## Пачка C — Календарь (`features/admin/calendar`, 15 файлов)

Copy-модуль: `calendar/lib/calendarCopy.ts` (уже существует, ~127 строк текста).

Файлы: `CalendarPage.tsx`, `components/BulkClosurePanel.tsx`, `components/CalendarDayCell.tsx`,
`components/CalendarMonthGrid.tsx`, `components/CalendarToolbar.tsx`,
`components/ClosureRulesTable.tsx`, `components/DayClosureControls.tsx`,
`components/DayDetailPanel.tsx`, `components/DayOrdersList.tsx`, `hooks/useCalendarMonth.ts`,
`lib/calendarCopy.ts`, `lib/calendarModel.ts`, `lib/closureResolver.ts`,
`lib/closureRuleForm.ts`, `lib/closureToggle.ts`.

Особенности:
- Названия месяцев/дней недели **не изобретать** — `shared/ui/DatePicker.tsx` уже держит
  `Record<Locale, string[]>` (`MONTHS_NOMINATIVE`, `WEEKDAYS_SHORT`). Если календарю нужны те же
  списки — вынести их в `shared/lib/date.ts` и импортировать в обоих местах (это единственное
  разрешённое этой пачке изменение в `shared`).
- `ordersUnit`/`guestsUnit`/`closuresUnit` — plural по рецепту §4 (EN: `order/orders`,
  `guest/guests`, `closure/closures`).
- `lib/closureRuleForm.ts` и `lib/calendarModel.ts` — чистые модули, copy приходит параметром.
- `tourTitleResolver` в `calendarModel.ts` — как в пачке B (локале-зависимый, фолбэк RU).
- `localeCompare(..., 'ru')` в `BulkClosurePanel`/`DayClosureControls`/`calendarModel` —
  на текущую локаль.
- `ClosureRulesTable.toLocaleDateString('ru-RU')`, `DayOrdersList.toLocaleString('ru-RU')` —
  по рецепту §5.

## Пачка D — Форма тура (`features/admin/tour-form`, 20 файлов + `lib/tourMapper.ts`)

Copy-модуль: **создать** `tour-form/lib/tourFormCopy.ts` (сейчас текст размазан по компонентам,
основной объём — `components/TourForm.tsx`, 36 строк).

Файлы: `TourCreatePage.tsx`, `TourEditPage.tsx`, `components/AdditionalExpensesEditor.tsx`,
`components/DayFillTrigger.tsx`, `components/FillDayFromProductModal.tsx`,
`components/FormActions.tsx`, `components/LocalizedListEditor.tsx`, `components/RegionPicker.tsx`,
`components/RoutePointPlaceSelect.tsx`, `components/TagPicker.tsx`, `components/TourDayCard.tsx`,
`components/TourDayFields.tsx`, `components/TourDaysEditor.tsx`, `components/TourForm.tsx`,
`components/TourFormHeader.tsx`, `components/TourTypeToggle.tsx`, `hooks/useTourForm.ts`,
`lib/price.ts`, `lib/validation.ts`, `reducer/tourFormReducer.ts`, `lib/tourMapper.ts`.

Особенности:
- `lib/validation.ts` и `reducer/tourFormReducer.ts` возвращают тексты ошибок валидации — они
  чистые: пусть возвращают **код/ключ ошибки**, а текст подставляет компонент через copy. Если
  так дороже, чем стоит, — принимать `copy` параметром; выбрать один вариант и держаться его во
  всём модуле.
- `lib/tourMapper.ts:550` — `День ${i+1}` → `copy.dayLabel(i + 1)` (EN: `Day {n}`). Остальной
  русский в `tourMapper.ts` — комментарии, не трогать. `tourMapper.ts` используют и продукты
  (пачка G) — менять в нём **только** эту строку.
- `TourTypeToggle` — подписи типа тура из `adminEnumsCopy`.
- `lib/price.ts` и `TourDayCard.tsx` — `new Intl.NumberFormat('ru-RU')` по рецепту §5.
- `TranslationGroup`/`LocalizedListEditor` работают с **контентными** языками RU/EN — это данные,
  не UI-локаль. Пути `'ru'`/`'en'` как `LangKey` НЕ трогать; переводятся только подписи вкладок
  (они уже в `features/admin/ui`, пачка A).

## Пачка E — Пользователи (`features/admin/users`, 14 файлов)

Copy-модуль: `users/lib/userCopy.ts` (уже существует, ~31 строка текста).

Файлы: `UserDetailPage.tsx`, `UsersPage.tsx`, `components/LoginHistoryList.tsx`,
`components/PromoteToAdminModal.tsx`, `components/RoleSelect.tsx`, `components/UserDangerZone.tsx`,
`components/UserDetailHeader.tsx`, `components/UserDetailInfo.tsx`, `components/UsersTable.tsx`,
`components/UsersToolbar.tsx`, `lib/filterUsers.ts`, `lib/onlineStatus.ts`, `lib/userAgent.ts`,
`lib/userCopy.ts`.

Особенности:
- `lib/onlineStatus.ts`: `new Intl.RelativeTimeFormat('ru', …)` → карта по локали (рецепт §5);
  `В сети` / `Был(а) …` / `Нет данных об активности` — в copy. Английский вариант `Был(а) X` —
  `Last seen X` (без гендерной формы).
- `lib/userAgent.ts`: единственная кириллица в значении — `'Яндекс.Браузер'`. Это бренд:
  заменить литерал на `'Yandex Browser'` в обеих локалях, copy-модуль сюда не тянуть.
- `LoginHistoryList`/`UserDetailInfo`: `Intl.DateTimeFormat('ru', …)`, `Intl.DisplayNames(['ru'])`,
  `countryDisplayName(code, 'ru')` — на текущую локаль.
- `lib/filterUsers.ts` — кириллица только в комментарии, файл не менять (оставлен в списке,
  чтобы было видно, что он проверен).
- Подписи ролей — `adminEnumsCopy`/`shared/auth`; если подпись роли лежит в `shared/auth`,
  добавить её в `ui.*`-словарь **нельзя** — вынести в `userCopy` и передать пропом.

## Пачка F — Справочники (`features/admin/catalog`, 15 файлов)

Copy-модуль: **создать** `catalog/lib/catalogCopy.ts` — общий на все вкладки, с секциями
`tags` / `places` / `regions` / `noteTemplates` / `expenseTemplates` / `common`.

Файлы: `CatalogPage.tsx`, `CatalogSearchInput.tsx`,
`expense-templates/ExpenseTemplateForm.tsx`, `expense-templates/ExpenseTemplatesTab.tsx`,
`lib/catalogErrors.ts`, `lib/catalogMapper.ts`, `lib/useCatalogReorder.ts`,
`lib/useCatalogSearch.ts`, `note-templates/NoteTemplateForm.tsx`,
`note-templates/NoteTemplatesTab.tsx`, `places/PlaceForm.tsx`, `places/PlacesTab.tsx`,
`regions/RegionsTab.tsx`, `tags/TagForm.tsx`, `tags/TagsTab.tsx`.

Особенности:
- `lib/catalogErrors.ts`: `catalogErrorMessage` — 16 вызовов, самый частый маппер в проекте.
  Сигнатура `catalogErrorMessage(copy, err, action)`; названия действий тоже в copy.
- Подписи цветов тегов — из `adminEnumsCopy` (`tagColor`).
- `lib/catalogMapper.ts` работает с `languageCode` **контента** — не трогать, кроме случаев,
  где строка реально показывается в UI.
- `useCatalogReorder.ts` — тексты уведомлений/ошибок перетаскивания в copy (хук, `useCopy` можно).

## Пачка G — Продукты + Дашборд (`features/admin/products` 4 файла, `features/admin/dashboard` 2 файла)

Copy-модули: **создать** `products/lib/productsCopy.ts` и `dashboard/lib/dashboardCopy.ts`.

Файлы: `products/ProductsPage.tsx`, `products/components/ProductsTable.tsx`,
`products/components/ProductsToolbar.tsx`, `products/lib/filterProducts.ts`,
`dashboard/DashboardPage.tsx`, `dashboard/components/StatCards.tsx`.

Особенности:
- `ProductsTable` берёт заголовок тура через `tourTitleRu(...)` — переименовать в `tourTitle` и
  сделать локале-зависимым с фолбэком на RU (ADR 021, решение 5), включая состояние `empty`
  («название не заполнено»).
- `StatCards` считает заполненность EN-переводов (`languageCode === English`) — это **логика по
  данным**, её не трогать; переводится только подпись карточки.
- `filterProducts.ts` ищет и по RU, и по EN — оставить как есть.
- Подписи типа тура — `adminEnumsCopy`.

## Пачка H — Настройки + Уведомления (`features/admin/settings` 10 файлов, `features/admin/notifications` 4 файла)

Copy-модули: `settings/lib/settingsCopy.ts` (существует, ~47 строк текста) и
`notifications/lib/notificationsCopy.ts` (существует, ~17 строк).

Файлы: `settings/SettingsPage.tsx`, `settings/components/SettingField.tsx`,
`settings/components/SettingsActions.tsx`, `settings/components/SettingsForm.tsx`,
`settings/components/SettingsSectionCard.tsx`, `settings/hooks/useSettingsForm.ts`,
`settings/lib/settingsCopy.ts`, `settings/lib/settingsMapper.ts`, `settings/lib/validation.ts`,
`settings/types.ts`, `notifications/NotificationsPage.tsx`,
`notifications/components/EmailTemplateCard.tsx`, `notifications/components/RichTextEditor.tsx`,
`notifications/lib/notificationsCopy.ts`.

Особенности:
- `settingsCopy` содержит подписи и подсказки **к настройкам сайта** — переводится подпись поля,
  а не значение настройки.
- `settings/lib/validation.ts` — чистая, copy параметром (или коды ошибок, как в пачке D).
- `SettingsActions.toLocaleTimeString('ru-RU')` — по рецепту §5.
- `RichTextEditor` — подписи тулбара и `aria-label` кнопок (16 строк); сам HTML-контент письма
  не трогать.
- `settings/types.ts` и `settings/lib/settingsMapper.ts` — проверить: если кириллица только в
  комментариях, файлы не менять.

---

## Проверка каждой пачки (перед сдачей)

1. `npm run build` в `Hay Travel/Frontend` — зелёная.
2. Поиск по своей пачке `grep -P "['\"\`>][^'\"\`<]*[А-Яа-яЁё]"` не находит **ничего, кроме
   комментариев и `*Copy.ts`**.
3. Ручная проверка на своих экранах: переключить язык в шапке/сайдбаре админки → все подписи
   меняются, ни одна не осталась русской, вёрстка не ломается от более длинных английских слов
   (кнопки в тулбаре, заголовки колонок таблиц, чипсы).
4. **Мобильная версия обязательна** (360px): таблицы/тулбары/модалки на английском не должны
   переполняться по горизонтали.
5. Обновление страницы сохраняет выбранный язык.
