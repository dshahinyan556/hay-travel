# Архитектура: настройки уведомлений + мульти-исполнители — ФРОНТЕНД

Проектный документ для `frontend-developer` и `ui-ux-engineer`. Покрывает **Фазу 3** чек-листа
`checklist-notification-recipients-redesign.txt`:

1. `/admin/notifications` — грид «Событие» → карточка события (шапка + вкладки) → «Платформы» →
   «Настройки Email» / «Настройки Telegram».
2. `OrderFulfillmentTab` — карточка на КАЖДОГО исполнителя строки, с Pickup/Navigator/Comment/
   CommentEn.
3. Попап назначения — мультивыбор людей, у каждого своя роль.
4. Хвосты: `User.PreferredLanguage` на карточке пользователя, чистка патерналистских плашек.

Этот файл — **и архитектура, и спецификация реализации**: отдельного `docs/specs/NNN-*.md` по
этой задаче нет, всё «что делать» здесь. Открытых вопросов не осталось — все развилки закрыты
в §0. Реализовывать строго по документу.

## Входные данные (считаются данностью, не переобсуждаются)

- **Бэкенд Фаз 1–2 уже написан и собирается.** Источник истины по контрактам — сами C#-файлы,
  а не [architecture-notification-recipients-multi-employee.md](architecture-notification-recipients-multi-employee.md)
  (тот писался ДО реализации). Все типы в §1–§2 сверены с:
  `NotificationSettingsController.cs`, `NotificationEventInfoModel.cs`,
  `NotificationPlatformInfoModel.cs`, `NotificationTemplateInfoModel.cs`,
  `NotificationRecipientInfoModel.cs`, `NotificationEventUpdateModel.cs`,
  `NotificationPlatformUpdateModel.cs`, `NotificationRecipientUpdateModel.cs`,
  `NotificationPlatform.cs`, `NotificationRecipientType.cs`, `NotificationRecipientSource.cs`,
  `OrderLinkedRecipient.cs`, `OrderLineEmployeeInfoModel.cs`, `OrderLineInfoModel.cs`,
  `OrderInfoModel.cs`, `OrderAssignEmployeeModel.cs`, `OrderUnassignEmployeeModel.cs`,
  `OrderLineEmployeeUpdateModel.cs`, `OrderLineUpdateModel.cs`, `SetUserPreferredLanguageModel.cs`,
  `UserInfoModel.cs`, `UserDetailInfoModel.cs`, `NotificationSettingsValidationService.cs`.
- **`api/EmailTemplate` больше нет.** Его заменил `api/NotificationSettings` (GET all /
  GET `{eventKey}` / PUT).
- **`OrderLine.EmployeeId/EmployeeRole/PickupDetails/NavigatorLink` больше нет.** На строке —
  список `employees` (0..N), «детали для выполнения» живут на каждом исполнителе.
- **`OrderLineUpdateModel` похудел** до `{ id, requiresPrepayment, prepaymentAmount }`.

## Ориентиры по стилю (конкретные файлы, а не абстракции)

| Что | Образец в коде |
| --- | --- |
| Список → карточка по роуту | `roles/RolesPage.tsx` → `roles/RoleDetailPage.tsx` |
| Таблица админки (desktop `<table>` + `<sm` карточки) | `roles/components/RolesTable.tsx` |
| Форма с baseline + dirty + submit | `roles/hooks/useRoleForm.ts`, `settings/hooks/useSettingsForm.ts` |
| Экран с одним общим Save и защитой от ухода | `settings/SettingsPage.tsx` (`useUnsavedChangesGuard` + `UnsavedChangesModal`) |
| Карточка-запись со своим control zone | `users/UserDetailPage.tsx` (`DataEntryScreenLayout` + `AdminActionButton`) |
| Вкладки | `shared/ui/Tabs.tsx` (используется в `OrderDetailPage`) |
| Declarative-sync грид (шлём весь набор разом) | `users/components/UserPermissionsCard.tsx` + `PUT Users/PermissionOverrides` |
| Локализация | `shared/i18n/defineCopy.ts`, ADR 021 — **ни одной строки интерфейса литералом в JSX** |
| Подписи енамов | `features/admin/lib/adminEnumsCopy.ts` (значения — в `lib/enums.ts`) |

---

## §0. Решения по развилкам

Оформлены здесь, а не отдельными ADR — ровно как это сделано в
[architecture-flexible-roles-frontend.md](architecture-flexible-roles-frontend.md) §0 для
сопоставимого по масштабу фронтового куска. Отдельный ADR завести стоит только если в ревью
всплывёт возражение по 0.1 или 0.3.

### 0.1. Карточка события — отдельный роут `/admin/notifications/:eventKey`, не модалка

Три вкладки, два RTE-редактора на 4 языковых поля и редактируемый грид получателей — это
полноценный экран-запись, а не подтверждение. Прямой прецедент в кодовой базе — пара
`RolesPage` → `RoleDetailPage`: список закрытого набора записей, карточка по своему URL,
`key`-инг по id для сброса черновика при переходе между записями.

Плюсы, которых не даёт модалка/раскрытие внутри страницы: deep-link на конкретное событие,
`AdminErrorBoundary` на неизвестный ключ, изоляция несохранённого черновика одного события от
другого, и `useUnsavedChangesGuard` работает штатно (он завязан на навигацию роутера).

Список грузится через `GET api/NotificationSettings` (все 4 события), карточка — через
`GET api/NotificationSettings/{eventKey}`. Да, список уже содержит всё нужное, но лоадер
карточки обязан уметь работать при прямом заходе по URL, а второй эндпоинт для этого и написан.

### 0.2. Где живёт состояние карточки — локальный хук `useNotificationEventForm`

Стор не нужен: данные читает ровно один экран, ничего межфичевого. `useState` + baseline,
дословно по `useRoleForm`: черновик события целиком, `isDirty` — глубокое сравнение с baseline,
после успешного PUT baseline заменяется **ответом сервера** (он приходит с санитизированным HTML
и с проставленными `id` у только что созданных строк-получателей — см. комментарий в
`NotificationSettingsController.UpdateAsync`). Ревалидация лоадера после сохранения не нужна.

`useReducer` не берём: операций мало и они однородные (патч поля черновика / добавить строку /
удалить строку) — тот же довод, что записан в `useRoleForm` («две операции не оправдывают
action-union»).

### 0.3. `AdminMailbox` (источник 4) обязан быть виден и редактируем в гриде

**Это не косметика, а защита от потери данных.** PUT — declarative sync: строки-получатели,
которых нет в присланном списке, `NotificationSettingsUpdateService.SyncRecipientsAsync`
**удаляет**. Миграция засеяла событие `OrderCreated` строкой с `sourceType: AdminMailbox`
(адрес берётся из `Email:AdminNotificationEmail`). Если UI не умеет отрисовать такую строку и
не положит её обратно в payload — первое же сохранение «Новой брони с сайта» молча снесёт
единственного получателя, и админ перестанет получать заявки.

Поэтому `AdminMailbox` — **полноценный, выбираемый** вариант в колонке «Получатель», подпись
«Служебный ящик администратора», без дополнительного поля ввода (адрес — из конфигурации
сервера), с пояснением-хинтом. То же самое правило в общем виде: **грид рендерит и
возвращает ВСЕ строки, пришедшие с сервера, включая источники, которых нет в чек-листе.**

### 0.4. Вкладка настроек платформы показывается по рубильнику черновика

Чек-лист (п.5): «Клик по чекбоксу платформы → появляется её вкладка настроек». Реализуем
буквально: вкладки `Настройки Email` / `Настройки Telegram` присутствуют тогда и только тогда,
когда `platform.isEnabled === true` **в черновике** (то есть появляются/исчезают мгновенно, без
сохранения).

Два следствия, которые обязан учесть разработчик:

1. Если активная вкладка исчезла (платформу выключили) — активной становится `Платформы`.
   Иначе `Tabs` останется с `activeId`, которого нет в списке, и тело вкладки не отрисуется.
2. **Поля шаблона Email отправляются в PUT всегда**, даже когда вкладка Email скрыта.
   `NotificationSettingsValidationService.ValidateTemplate` требует непустые `subject`/`bodyHtml`
   для платформы Email **независимо** от `IsEnabled`. Отправить `null` «потому что вкладка
   скрыта» = 400 (`EmailTemplateInvalid`, 2030). Черновик держит эти поля всегда, скрыта только
   их вкладка.

### 0.5. `Comment` — всегда, `CommentEn` — под сворачиваемым блоком с умным дефолтом

Решение: `Pickup` / `Navigator` / `Comment` (RU) в карточке исполнителя видны всегда;
`CommentEn` — за кнопкой-раскрытием «Комментарий на английском».

Обоснование:

- `Comment` — поле того же ранга, что Pickup/Navigator (все три одинаково попадают в PDF и в
  письмо и одинаково скрываются, если пусты). Спрятать его под «ещё» — гарантия, что его
  никогда не заполнят.
- `CommentEn` нужен только когда получатель читает по-английски. У заказа из трёх строк с двумя
  исполнителями на каждой это 6 карточек × 4 поля = 24 контрола — стена, в которой теряются
  нужные два.
- Дефолт раскрытия — **не догадка**: страница уже грузит список сотрудников (`getEmployees()`),
  а в `UserInfoModel` теперь есть `preferredLanguage`. Блок раскрыт изначально, если
  `commentEn` непуст **или** язык этого сотрудника — English. Сотрудник не найден в списке
  (нет права `users.View` → пустой массив) — блок свёрнут.
- Когда блок свёрнут, а `commentEn` пуст, под кнопкой — короткий факт-хинт «уйдёт русская
  версия» (это описание поведения, а не совет — под запрет п.1 чек-листа не попадает).

### 0.6. `LanguageCode` переезжает в `shared/types/language.ts`

`OrderInfoModel.userPreferredLanguage` (в `shared/types/booking.ts`) и
`UserInfoModel.preferredLanguage` (в `shared/auth/types.ts`) — оба в `shared`, а сегодняшний
`LanguageCode` живёт в `features/admin/lib/enums.ts`. `shared` не может импортировать из
`features`.

Создаём zero-import leaf `shared/types/language.ts` — дословно по образцу
`shared/types/employeeRole.ts` (там записана ровно эта же мотивация), а `features/admin/lib/
enums.ts` **ре-экспортирует** его (как уже сделано с `EmployeeJobRole`). Все ~7 существующих
импортов `LanguageCode` из `@/features/admin/lib/enums` продолжают работать без правок.

### 0.7. Подписи событий берём из своего copy-модуля, `displayName` — только фолбэк

`NotificationEventInfoModel.DisplayName` приходит с сервера по-русски всегда
(`EmailPlaceholders.DisplayNames`). Панель билингвальна (ADR 021). Добавляем в
`adminEnumsCopy.ts` словарь `emailActionKey` (RU/EN) и используем его; `displayName` печатается
только если ключ в словаре не найден (страховка на случай, если бэкенд добавит 5-е событие
раньше фронта).

### 0.8. Инлайн-назначение исполнителя в гриде строк — удаляется

`EmployeeAssignmentCell` (два `Select`а в ячейке) построен на «один исполнитель на строке» и с
множеством не работает: `Select` не выражает набор, а «сменить выбор» перестало быть
осмысленной операцией (снятие теперь адресное, по конкретному человеку).

Колонка «Исполнители» становится **read-only отображением**: чипы «Имя (Роль) ×», где «×» —
снять этого человека, плюс кнопка «+ Назначить», открывающая тот же попап мультивыбора, но с
`lineId` этой строки. Все мутации — через попап и через подтверждение снятия, оба принадлежат
странице. Это же убирает дублирование логики: раньше назначение жило в двух местах (ячейка
грида и модалка) с разными правилами про роль по умолчанию.

### 0.9. Назначение аддитивно — уже назначенных в попапе НЕ предвыбираем

`OrderAssignEmployeeService` — аддитивный upsert (комментарий в `OrderAssignEmployeeModel`).
Если предвыбрать уже назначенных, то «Назначить и отправить письмо» после добавления одного
человека разошлёт письма ВСЕМ, включая тех, кто их уже получил. Поэтому уже назначенные
показываются в списке с меткой «уже назначен», но чекбокс не отмечен. Отметить его можно — так
меняется роль уже назначенного человека (upsert), это осознанный сценарий.

### 0.10. Read-only режим при отсутствии `notifications.Update`

Экран открывается по `canView`, поля остаются с виду редактируемыми, «Сохранить» никогда не
включается, сверху — `readOnlyHint` (функциональная плашка про права, п.1 чек-листа её не
трогает). Ровно как в `SettingsPage` (`useScreenPermission(AdminScreen.Settings).canUpdate`).

---

## §1. Общие типы

### 1.1. `src/shared/types/language.ts` — **создать**

```ts
/**
 * Язык, выбранный пользователем для писем — зеркало backend `LanguageCode`
 * (`ATTours.Common/Enums/LanguageCode.cs`). Тот же смысл, что и у языка контента
 * (переводы тура), поэтому один enum на оба применения.
 *
 * Свой zero-import leaf по той же причине, что и `shared/types/employeeRole.ts`:
 * от него зависят и `shared/auth/types.ts` (`UserInfoModel.preferredLanguage`), и
 * `shared/types/booking.ts` (`OrderInfoModel.userPreferredLanguage`), а они не должны
 * импортировать друг друга.
 */
export const LanguageCode = { Russian: 1, English: 2 } as const
export type LanguageCode = (typeof LanguageCode)[keyof typeof LanguageCode]
```

### 1.2. `src/features/admin/lib/enums.ts` — **изменить**

- Удалить локальное объявление `LanguageCode` (строки ~58–63).
- Добавить `import { LanguageCode } from '@/shared/types/language'` и
  `export { LanguageCode }` — рядом с существующим ре-экспортом `EmployeeJobRole`, с таким же
  поясняющим комментарием.
- Ничего больше не трогать. Енамы уведомлений сюда **не** добавляем: они нужны единственной
  фиче и живут в `features/admin/types/notifications.ts` — той же логикой, по которой
  `features/admin/types/roles.ts` держит свои.

### 1.3. `src/shared/auth/types.ts` — **изменить**

В `UserInfoModel` и в `UserDetailInfoModel` добавить (оба поля non-nullable, дефолт `Russian`
проставляет сервер):

```ts
  /** Язык писем этого получателя (редизайн 2026-08-23). Решает, какая языковая версия шаблона
   * ему уйдёт. Non-nullable: «языка нет» — не состояние, у поля есть безопасный дефолт. */
  preferredLanguage: LanguageCode
```

Импорт: `import type { LanguageCode } from '@/shared/types/language'` — в шапке файла рядом с
`EmployeeJobRole`, и дополнить доккоммент модуля («leaf-модуль… импортирует только…») третьим
листом.

### 1.4. `src/shared/types/booking.ts` — **изменить**

**Добавить** (перед `OrderLineInfoModel`):

```ts
/** Один исполнитель на одной строке заказа (редизайн 2026-08-23). Заменяет плоские
 * `employeeId`/`employeeRole`/`pickupDetails`/`navigatorLink`, которые были на самой строке:
 * у строки теперь 0..N исполнителей, и «детали для выполнения» — у каждого свои.
 * `id` — идентификатор ЭТОЙ связки (`OrderLineEmployee`), не строки и не пользователя;
 * именно он адресует `PUT api/Order/UpdateLineEmployee`. */
export interface OrderLineEmployeeInfoModel {
  id: number
  employeeId: number
  /** Денормализовано сервером — второй запрос за именем не нужен. */
  employeeFullName: string | null
  /** Снапшот роли на момент назначения. Назначения без роли не существует. */
  employeeRole: EmployeeJobRole
  /** «Где забрать клиента». `null`/пусто — поле НЕ появится ни в PDF, ни в письме. */
  pickupDetails: string | null
  /** Ссылка на навигатор/карты. Правило пустоты — то же. */
  navigatorLink: string | null
  /** Свободный комментарий исполнителю, RU-версия. */
  comment: string | null
  /** EN-версия комментария. Пусто — англоязычному исполнителю уйдёт `comment`. */
  commentEn: string | null
}
```

**Изменить** `OrderLineInfoModel`: удалить `employeeId`, `employeeFullName`, `employeeRole`,
`pickupDetails`, `navigatorLink`; добавить

```ts
  /** 0..N исполнителей строки. Пустой список — строка не назначена. */
  employees: OrderLineEmployeeInfoModel[]
```

**Изменить** `OrderInfoModel`: добавить

```ts
  /** Язык клиента — тем же полем сервер выбирает языковую версию письма «Клиенту заказа». */
  userPreferredLanguage: LanguageCode
```

**Изменить** `OrderLineUpdateModel` — оставить только `{ id, requiresPrepayment, prepaymentAmount }`
(pickup/navigator переехали), обновить доккоммент.

**Переписать** `OrderAssignEmployeeModel`:

```ts
/** Один пункт мультивыбора попапа назначения. Роль обязательна: сервер отбивает 0
 * (`EmployeeRoleRequired`, 2029). */
export interface OrderAssignEmployeeItem {
  employeeId: number
  employeeRole: EmployeeJobRole
}

/** `PATCH api/Order/AssignEmployee`. `lineId: null` — на ВСЕ строки заказа.
 *
 * Семантика — АДДИТИВНЫЙ upsert, не «заменить набор»: не перечисленные здесь исполнители со
 * строки НЕ снимаются (для этого есть `unassignEmployee` с конкретным `employeeId`). Повторный
 * вызов с тем же человеком меняет ему роль и (при `sendEmail`) переотправляет письмо.
 * Пустой `employees` — 400. */
export interface OrderAssignEmployeeModel {
  orderId: number
  lineId: number | null
  employees: OrderAssignEmployeeItem[]
  /** `false` — тихое «Назначить», `true`/опущено — «Назначить и отправить письмо». Письмо
   * уходит только при совпадении намерения И включённого канала события. */
  sendEmail?: boolean
}
```

**Изменить** `OrderUnassignEmployeeModel`:

```ts
export interface OrderUnassignEmployeeModel {
  orderId: number
  /** `null` — все строки заказа. */
  lineId: number | null
  /** `null` — снять ВСЕХ исполнителей с целевых строк; задан — только этого человека.
   * Это `User.id`, а не `OrderLineEmployeeInfoModel.id`. */
  employeeId: number | null
}
```

**Добавить**:

```ts
/** `PUT api/Order/UpdateLineEmployee` — «детали для выполнения» ОДНОГО исполнителя ОДНОЙ строки.
 * `id` — `OrderLineEmployeeInfoModel.id`. Роль здесь не правится: её меняет assign (upsert). */
export interface OrderLineEmployeeUpdateModel {
  id: number
  pickupDetails: string | null
  navigatorLink: string | null
  comment: string | null
  commentEn: string | null
}
```

Импорт `LanguageCode` из `@/shared/types/language`; доккоммент модуля дополнить абзацем про
редизайн 2026-08-23 (по образцу уже имеющихся абзацев про ADR 019 / ADR 025).

---

## §2. Раздел «Настройки уведомлений»

### 2.1. Состав файлов

```
src/features/admin/notifications/
  NotificationsPage.tsx          изменить  — список событий (был: 4 карточки-формы)
  NotificationEventPage.tsx      создать   — карточка одного события (шапка + вкладки)
  components/
    NotificationEventsTable.tsx  создать   — грид «Событие»
    PlatformsTab.tsx             создать   — грид [чекбокс][платформа][статус]
    RecipientsGrid.tsx           создать   — грид получателей (+ строки-карточки на <sm)
    EmailTemplateEditor.tsx      создать   — Subject RU/EN + Body RU/EN
    EmailTemplateCard.tsx        УДАЛИТЬ   — целиком, заменён двумя выше
  hooks/
    useNotificationEventForm.ts  создать   — черновик события, dirty, submit
  lib/
    notificationEventModel.ts    создать   — draft-типы + toDraft/toUpdateModel/валидация строк
    notificationsCopy.ts         переписать
    placeholderLabels.ts         изменить  — добавить {{OrderLines}}
src/features/admin/types/notifications.ts   переписать целиком
src/features/admin/api/adminNotifications.ts переписать целиком
src/features/admin/index.ts                  изменить — экспорт новой страницы+лоадера
src/app/router.tsx                           изменить — роут `notifications/:eventKey`
src/features/admin/lib/adminEnumsCopy.ts     изменить — подписи 5 новых енамов
```

### 2.2. `src/features/admin/types/notifications.ts` — **переписать целиком**

```ts
/**
 * Wire-типы `api/NotificationSettings` — раздел «Настройки уведомлений» (редизайн 2026-08-23).
 * Заменяют плоские `EmailTemplateInfoModel`/`EmailTemplateUpdateModel` удалённого
 * `api/EmailTemplate`.
 *
 * Живут в `features/admin/types`, а не в `shared/types`: раздел админский, никакая другая фича
 * этих типов не потребляет (то же правило, что у `features/admin/types/roles.ts`).
 *
 * `bodyHtml`/`bodyHtmlEn` санитизируются НА СЕРВЕРЕ при сохранении (allow-list, ADR 026), и
 * ответ PUT содержит уже очищенный HTML — его и надо принимать за новый baseline, иначе
 * редактор покажет не то, что легло в БД.
 */

export const EmailActionKey = {
  OrderCreated: 1,
  OrderAssignEmployee: 2,
  OrderUnassignEmployee: 3,
  OrderSendToClient: 4,
} as const
export type EmailActionKey = (typeof EmailActionKey)[keyof typeof EmailActionKey]

/** Порядок строк грида и вкладок — фиксированный, а не по значению енама. */
export const EMAIL_ACTION_KEY_ORDER: readonly EmailActionKey[] = [
  EmailActionKey.OrderCreated,
  EmailActionKey.OrderAssignEmployee,
  EmailActionKey.OrderUnassignEmployee,
  EmailActionKey.OrderSendToClient,
]

/** Гейт лоадера карточки: набор событий закрыт кодом, чужой ключ — 400 ещё до запроса. */
export function isEmailActionKey(value: number): value is EmailActionKey

export const NotificationPlatform = { Email: 1, Telegram: 2 } as const
export type NotificationPlatform = (typeof NotificationPlatform)[keyof typeof NotificationPlatform]

/** Роль адреса в письме. Только для Email: у Telegram копий/скрытых копий не бывает. */
export const NotificationRecipientType = { To: 1, Cc: 2, Bcc: 3 } as const
export type NotificationRecipientType =
  (typeof NotificationRecipientType)[keyof typeof NotificationRecipientType]

/** Откуда берётся адрес. `AdminMailbox` — системный ящик из конфигурации сервера; строка с ним
 * засеяна миграцией на событие «Новая бронь с сайта» и обязана переживать сохранение (§0.3). */
export const NotificationRecipientSource = {
  User: 1,
  OrderLinked: 2,
  CustomEmail: 3,
  AdminMailbox: 4,
} as const
export type NotificationRecipientSource =
  (typeof NotificationRecipientSource)[keyof typeof NotificationRecipientSource]

/** Закрытый список ролей, привязанных к заказу. Админа здесь нет — он выбирается обычной
 * строкой с источником `User`. «Исполнитель заказа» при мульти-исполнителях = письмо КАЖДОМУ
 * активному исполнителю отдельно (это делает сервер). */
export const OrderLinkedRecipient = { Client: 1, Employee: 2 } as const
export type OrderLinkedRecipient = (typeof OrderLinkedRecipient)[keyof typeof OrderLinkedRecipient]

/* ---------------------------------- Info (GET) --------------------------------- */

export interface NotificationTemplateInfoModel {
  subject: string
  /** `null` — перевод не сделан; письмо англоязычному получателю уйдёт RU-версией. */
  subjectEn: string | null
  bodyHtml: string
  bodyHtmlEn: string | null
  /** Уже в фигурных скобках — вставляются в редактор как есть. */
  availablePlaceholders: string[]
}

export interface NotificationRecipientInfoModel {
  id: number
  isActive: boolean
  /** `null` у Telegram. */
  type: NotificationRecipientType | null
  sourceType: NotificationRecipientSource
  userId: number | null
  /** Денормализовано сервером — грид показывает read-only, даже если списка юзеров нет. */
  userFullName: string | null
  userEmail: string | null
  orderLinkedRole: OrderLinkedRecipient | null
  customEmail: string | null
  sortOrder: number
}

export interface NotificationPlatformInfoModel {
  platform: NotificationPlatform
  isEnabled: boolean
  /** `false` у Telegram: канал настраивается, отправки пока нет. */
  isImplemented: boolean
  /** Только у Email; у Telegram `null`. */
  template: NotificationTemplateInfoModel | null
  recipients: NotificationRecipientInfoModel[]
}

export interface NotificationEventInfoModel {
  eventKey: EmailActionKey
  /** Русская подпись из код-реестра сервера. Используется только как фолбэк — см. §0.7. */
  displayName: string
  platforms: NotificationPlatformInfoModel[]
}

/* --------------------------------- Update (PUT) -------------------------------- */

export interface NotificationRecipientUpdateModel {
  /** `null` — новая строка. */
  id: number | null
  isActive: boolean
  type: NotificationRecipientType | null
  sourceType: NotificationRecipientSource
  userId: number | null
  orderLinkedRole: OrderLinkedRecipient | null
  customEmail: string | null
  sortOrder: number
}

/** Шаблонные поля для Telegram игнорируются сервером, но для Email присылаются ВСЕГДА,
 * даже когда вкладка Email скрыта выключенным рубильником (§0.4). */
export interface NotificationPlatformUpdateModel {
  platform: NotificationPlatform
  isEnabled: boolean
  subject: string | null
  subjectEn: string | null
  bodyHtml: string | null
  bodyHtmlEn: string | null
  /** ПОЛНЫЙ набор строк грида: чего нет в списке — сервер удалит. */
  recipients: NotificationRecipientUpdateModel[]
}

export interface NotificationEventUpdateModel {
  eventKey: EmailActionKey
  platforms: NotificationPlatformUpdateModel[]
}
```

### 2.3. `src/features/admin/api/adminNotifications.ts` — **переписать целиком**

```ts
/** GET все 4 события с платформами/шаблонами/получателями — список раздела. */
export function getNotificationEvents(): Promise<NotificationEventInfoModel[]>
//  authFetch('api/NotificationSettings')

/** GET одно событие. Неизвестный ключ — 404 (`EmailTemplateInvalid`), не перехватывается:
 *  уходит в `AdminErrorBoundary`, как `getUserDetail`/`getOrder`. */
export function getNotificationEvent(eventKey: EmailActionKey): Promise<NotificationEventInfoModel>
//  authFetch(`api/NotificationSettings/${eventKey}`)

/** PUT — сохранение события ЦЕЛИКОМ (рубильники + шаблон + весь набор получателей).
 *  Ответ содержит санитизированный HTML и `id` у только что созданных строк — его и надо
 *  класть в baseline. */
export function updateNotificationEvent(
  model: NotificationEventUpdateModel,
): Promise<NotificationEventInfoModel>
//  authFetch('api/NotificationSettings', { method: 'PUT', body: JSON.stringify(model) })
```

Старые `getEmailTemplates`/`updateEmailTemplate` удалить (эндпоинта больше нет).

### 2.4. `src/app/router.tsx` — **изменить**

Рядом с существующим `notifications` добавить (порядок как у `roles`/`roles/:id`):

```tsx
{
  path: 'notifications/:eventKey',
  lazy: () =>
    import('@/features/admin').then((m) => ({
      Component: m.NotificationEventPage,
      loader: m.notificationEventLoader,
    })),
},
```

`features/admin/index.ts` — добавить `export { NotificationEventPage, notificationEventLoader } from './notifications/NotificationEventPage'`.

### 2.5. `NotificationsPage.tsx` — **изменить** (список событий)

Лоадер: гейт `ensurePermissionsReady()` + `canView(AdminScreen.Notifications)` (как сейчас),
дальше `getNotificationEvents()`, возвращает `{ events }`.

Страница: **`MaintenanceFormLayout` без `controlZone`** — тот же «no-create вариант», что у
`UsersPage` (набор записей закрыт: ни создать, ни удалить событие нельзя). `SetupFormLayout` и
`SingleRecordIdentity` отсюда уходят: экран перестал быть «одной записью», он стал списком из
четырёх, у каждой — своя карточка по своему URL.

```tsx
<MaintenanceFormLayout title={copy.title} subtitle={copy.subtitle}>
  <NotificationEventsTable events={events} onOpen={(e) => navigate(`/admin/notifications/${e.eventKey}`)} />
</MaintenanceFormLayout>
```

Пустого состояния нет: 4 события засеяны миграцией и удалить их нечем.

### 2.6. `components/NotificationEventsTable.tsx` — **создать**

```ts
export interface NotificationEventsTableProps {
  events: NotificationEventInfoModel[]
  onOpen: (event: NotificationEventInfoModel) => void
}
```

Структура — копия `RolesTable`: `<table>` от `sm` и `<ul>` карточек ниже; строка кликабельна
целиком (`cursor-pointer hover:bg-neutral-50`). `ActionsMenu` НЕ нужен (действий, кроме
«открыть», нет).

Колонки:

| Колонка | Содержимое |
| --- | --- |
| Событие | подпись из `adminEnumsCopy.emailActionKey[eventKey]`, фолбэк `event.displayName` |
| Платформы | чипы включённых платформ (`platform.isEnabled`), «—» если ни одной |
| Получателей | число активных получателей по всем платформам |

Колонки «Платформы»/«Получателей» — не в чек-листе (там «грид с ЕДИНСТВЕННОЙ колонкой») и
добавлены сознательно: список из четырёх одинаковых строк без единого различающего признака не
даёт ответа на главный вопрос экрана («кому и куда сейчас уходит?») и заставляет открывать все
четыре карточки по очереди. Это read-only производные, редактирования в списке по-прежнему нет.
Если Давид скажет «строго одна колонка» — убираются двумя строками разметки.

### 2.7. `NotificationEventPage.tsx` — **создать** (карточка события)

**Лоадер** (по образцу `roleDetailLoader`):

```ts
export async function notificationEventLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Notifications)) throw redirect('/admin')

  const copy = notificationsCopy(getStoredLocale())   // лоадер вне React — правило 3 defineCopy.ts
  const raw = Number(params.eventKey)
  if (!Number.isInteger(raw) || !isEmailActionKey(raw)) {
    throw new Response(copy.errorInvalidEventKey, { status: 400 })
  }

  // Список пользователей — для колонки «Получатель» источника User. Гейтится ЧУЖИМ ключом
  // (`users.View`), поэтому деградирует до пустого списка, а не 403-ит весь экран: уже
  // сохранённые строки останутся читаемыми за счёт денормализованных userFullName/userEmail.
  const [event, users] = await Promise.all([
    getNotificationEvent(raw),
    canView(AdminScreen.Users) ? getUsers() : Promise.resolve([]),
  ])
  return { event, users }
}
```

**Компонент**: `NotificationEventPage` читает лоадер и рендерит `<NotificationEventView key={event.eventKey} … />`
(key-инг — как в `OrderDetailPage`/`UserDetailPage`, чтобы черновик не переехал между событиями).

Разметка — `DataEntryScreenLayout` (шаблон A, «запись внутри списка»):

- `breadcrumbs`: `<Link to="/admin/notifications">{copy.title}</Link> · <span>{eventLabel}</span>`
- `title`: `eventLabel`, `subtitle`: `copy.eventSubtitle`
- `controlZone`: `ml-auto` ряд из двух `AdminActionButton` — «Отменить правки» (secondary,
  `disabled={!isDirty || isSubmitting}`) и «Сохранить» (primary, `pending={isSubmitting}`,
  `disabled={!canSubmit}`). **Не `AdminToolbar`**: его `onAdd`/`onDelete` обязательны и здесь
  бессмысленны. Прецедент такого control zone — `UserDetailPage`.
- `message`: баннер ошибки сохранения (`role="alert"`, стиль как в `OrderDetailPage`),
  баннер «сохранено» (`role="status"`), и `readOnlyHint` при `!canUpdate`.
- тело: `<Tabs …/>` + содержимое активной вкладки.
- в конце — `<UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />`,
  `guard = useUnsavedChangesGuard(isDirty && !isSubmitting)` (дословно как в `SettingsPage`).

**Вкладки** (`TabItem[]`, строятся из черновика):

| id | label | badge | когда есть |
| --- | --- | --- | --- |
| `platforms` | `copy.tabPlatforms` | число включённых платформ | всегда |
| `platform-1` | `copy.tabEmailSettings` | число активных получателей Email | `draft.platforms[Email].isEnabled` |
| `platform-2` | `copy.tabTelegramSettings` | число активных получателей Telegram | `draft.platforms[Telegram].isEnabled` |

`useEffect`, сбрасывающий `activeTab` на `'platforms'`, если текущего id больше нет в списке
(§0.4, пункт 1).

### 2.8. `hooks/useNotificationEventForm.ts` — **создать**

```ts
export interface UseNotificationEventFormArgs {
  event: NotificationEventInfoModel
}

export interface UseNotificationEventFormResult {
  draft: EventDraft
  /** Рубильник платформы (вкладка «Платформы»). */
  setPlatformEnabled: (platform: NotificationPlatform, isEnabled: boolean) => void
  /** Патч шаблона Email (subject/subjectEn/bodyHtml/bodyHtmlEn). */
  patchTemplate: (patch: Partial<Pick<PlatformDraft,
    'subject' | 'subjectEn' | 'bodyHtml' | 'bodyHtmlEn'>>) => void
  addRecipient: (platform: NotificationPlatform) => void
  removeRecipient: (platform: NotificationPlatform, rowKey: string) => void
  patchRecipient: (platform: NotificationPlatform, rowKey: string, patch: Partial<RecipientDraft>) => void
  isDirty: boolean
  /** Пер-строчные ошибки грида, ключ — `rowKey`. Показываются только после первой попытки
   * сохранения (валидировать по мере ввода — нытьё; то же правило, что у `nameError` в
   * `useRoleForm`). */
  rowErrors: Record<string, string>
  canSubmit: boolean
  submit: () => void
  isSubmitting: boolean
  error: string | null
  savedAt: number | null
}
```

Поведение:

- `useState<EventDraft>(() => toDraft(event))` + `useState<EventDraft>` baseline тем же
  инициализатором. `isDirty` — `!isEventDraftEqual(draft, baseline)`.
- `submit()`: `setAttempted(true)` → локальная валидация (`validateDraft`) → при ошибках
  `return` (баннер + `rowErrors`) → `updateNotificationEvent(toUpdateModel(draft))` → ответ
  сервера прогоняется через `toDraft` и кладётся И в `draft`, И в `baseline` (санитизированный
  HTML + новые `id`) → `savedAt = Date.now()`.
- Ошибка — через `notificationsErrorMessage(copy, err, copy.errorActions.saveEvent(name))`.
- Никакой `revalidator.revalidate()` — baseline и есть свежие данные (как в `useRoleForm`).

### 2.9. `lib/notificationEventModel.ts` — **создать**

Черновик отличается от wire-модели тремя вещами: у новых строк нет `id`, но React и патчи
нужен стабильный ключ; `sortOrder` не хранится, а выводится из порядка; текстовые поля в
черновике — `string`, а не `string | null` (контролируемые инпуты не любят `null`).

```ts
export interface RecipientDraft {
  /** Стабильный ключ строки на время жизни формы: `row-<id>` для пришедших с сервера,
   * `new-<n>` для добавленных. НЕ уходит на сервер. */
  rowKey: string
  /** `null` — строки ещё нет в БД. */
  id: number | null
  isActive: boolean
  type: NotificationRecipientType | null
  sourceType: NotificationRecipientSource
  userId: number | null
  orderLinkedRole: OrderLinkedRecipient | null
  customEmail: string
  /** Read-only подписи с сервера (для строк с источником User, когда списка юзеров нет). */
  userFullName: string | null
  userEmail: string | null
}

export interface PlatformDraft {
  platform: NotificationPlatform
  isEnabled: boolean
  isImplemented: boolean
  /** Пустые строки у Telegram — в PUT для него всё равно поедет `null`. */
  subject: string
  subjectEn: string
  bodyHtml: string
  bodyHtmlEn: string
  availablePlaceholders: string[]
  recipients: RecipientDraft[]
}

export interface EventDraft {
  eventKey: EmailActionKey
  platforms: PlatformDraft[]   // порядок как пришёл с сервера: Email, затем Telegram
}

export function toDraft(event: NotificationEventInfoModel): EventDraft
export function toUpdateModel(draft: EventDraft): NotificationEventUpdateModel
export function isEventDraftEqual(a: EventDraft, b: EventDraft): boolean
export function newRecipientRow(platform: NotificationPlatform): RecipientDraft
/** `null` — строка валидна. Правила зеркалят NotificationSettingsValidationService. */
export function recipientRowError(
  row: RecipientDraft,
  platform: NotificationPlatform,
  copy: NotificationsCopy,
): string | null
/** Пер-строчные ошибки всех платформ + флаг «есть ли ошибка шаблона Email». */
export function validateDraft(draft: EventDraft, copy: NotificationsCopy): {
  rowErrors: Record<string, string>
  templateError: string | null
}
```

Правила `toUpdateModel`:

- `sortOrder` = индекс строки в массиве (порядок грида — и есть порядок).
- Пустые строки → `null`: `customEmail.trim() || null`, `subjectEn.trim() || null`,
  `bodyHtmlEn` — `null`, если после `trim()` пусто **или** равно `'<p></p>'` (пустой документ
  редактора). Иначе сервер сохранил бы пустой абзац как «перевод есть», сломав фолбэк на RU.
- Для Telegram: `subject/subjectEn/bodyHtml/bodyHtmlEn = null`, `type = null` у всех строк.
- Для Email — шаблонные поля отправляются всегда (§0.4).

Правила `recipientRowError` (зеркало серверной валидации, чтобы не ловить 400):

| Условие | Ошибка |
| --- | --- |
| Email-платформа и `type === null` | `copy.rowErrorTypeRequired` |
| `sourceType === User` и `userId === null` | `copy.rowErrorUserRequired` |
| `sourceType === OrderLinked` и `orderLinkedRole === null` | `copy.rowErrorRoleRequired` |
| `sourceType === CustomEmail` и (пусто ИЛИ нет `@`) | `copy.rowErrorEmailInvalid` |
| дубликат по ключу `sourceType\|источник\|type` внутри платформы | `copy.rowErrorDuplicate` |

`templateError`: пустой `subject.trim()` или пустой `bodyHtml` (с той же проверкой на `'<p></p>'`)
у платформы Email → `copy.errorTemplateInvalid`. **Проверяется независимо от `isEnabled`.**

### 2.10. `components/PlatformsTab.tsx` — **создать**

```ts
export interface PlatformsTabProps {
  platforms: PlatformDraft[]
  disabled: boolean            // !canUpdate || isSubmitting
  onToggle: (platform: NotificationPlatform, isEnabled: boolean) => void
}
```

Таблица в том же обрамлении, что `RolesTable` (`rounded-xl border border-neutral-200 bg-white`,
шапка `bg-neutral-50 text-[11px] uppercase`). Три колонки:

1. `w-12` — `Checkbox` с `labelHidden` (подпись — в шапке колонки, как в `PermissionMatrix`),
   `aria-label` = `copy.platformToggleAria(platformName)`.
2. Название платформы (`adminEnumsCopy.notificationPlatform[...]`).
3. Статус: `isImplemented ? copy.platformWorking : copy.platformSetupOnly` — второй вариант
   серым, это факт («сообщения пока не отправляются»), а не совет.

На `<sm` — те же строки списком (`<ul>`), чекбокс слева, название и статус справа.

### 2.11. `components/RecipientsGrid.tsx` — **создать**

```ts
export interface RecipientsGridProps {
  platform: NotificationPlatform
  rows: RecipientDraft[]
  /** Пусто — нет права `users.View`; селект пользователей заменяется хинтом,
   * уже сохранённые строки печатают `userFullName`/`userEmail` из черновика. */
  users: UserInfoModel[]
  disabled: boolean
  /** Ключ — `rowKey`. Пусто, пока не было попытки сохранения. */
  errors: Record<string, string>
  onPatch: (rowKey: string, patch: Partial<RecipientDraft>) => void
  onAdd: () => void
  onRemove: (rowKey: string) => void
}
```

Колонки (`platform === Telegram` → колонка «Тип» не рендерится вовсе, ни в шапке, ни в строках):

| # | Колонка | Контрол |
| --- | --- | --- |
| 1 | Активен | `Checkbox` `labelHidden` |
| 2 | Тип (только Email) | `Select surface="admin"` — To / Копия / Скрытая копия |
| 3 | Источник | `Select surface="admin"` — Пользователь / Привязан к заказу / Свой адрес / Служебный ящик; для Telegram только первые два (серверная валидация это требует) |
| 4 | Получатель | зависит от источника, см. ниже |
| 5 | — | кнопка удаления строки (`AdminActionButton variant="ghost"` + `CloseIcon`, `aria-label` `copy.removeRowAria`) |

Колонка «Получатель» по источнику:

- `User` — `Select surface="admin" searchable` со списком `users`
  (`label = \`${firstName} ${lastName ?? ''}\`.trim() || email`, `value = String(id)`).
  Список пуст → вместо селекта текст `row.userFullName ?? row.userEmail ?? copy.userUnavailable`
  плюс хинт `copy.usersNoAccessHint`; строка при этом **не ломается и сохраняется как была**.
- `OrderLinked` — `Select` из двух опций: «Клиент заказа» / «Исполнитель заказа». Под селектом,
  при выбранном «Исполнитель заказа», факт-хинт `copy.orderLinkedEmployeeNote` («письмо уйдёт
  каждому исполнителю строки отдельно») — поведение системы, не совет.
- `CustomEmail` — `Input type="email"`, `placeholder` `copy.customEmailPlaceholder`.
- `AdminMailbox` — статичный текст `copy.adminMailboxValue` + `HelpButton`/хинт
  `copy.adminMailboxHint` («адрес задаётся в конфигурации сервера»). Контролов нет.

При смене источника `onPatch` сбрасывает поля чужих источников (`userId: null`,
`orderLinkedRole: null`, `customEmail: ''`) — тем же правилом, что сервер применяет в
`Apply(...)`; иначе строка, переключённая с CustomEmail на User, потащит мёртвый адрес.

Ошибка строки (`errors[rowKey]`) — под строкой (desktop: `<tr>` со `colSpan`; mobile: под
карточкой), `role="alert"`, красный текст, у виновного контрола `error`-состояние.

Ниже таблицы — кнопка `+ Добавить получателя` (`onAdd`) и, если строк нет, пустое состояние
`copy.recipientsEmptyTitle` / `copy.recipientsEmptyBody` («0 активных получателей — письмо не
уходит вообще»). Это осознанное состояние системы, а не ошибка; красным не красим.

Перетаскивания строк нет (`SortableList` не подключаем): порядок получателей ни на что, кроме
`sortOrder`, не влияет — добавить, если появится реальный запрос.

### 2.12. `components/EmailTemplateEditor.tsx` — **создать**

```ts
export interface EmailTemplateEditorProps {
  subject: string
  subjectEn: string
  bodyHtml: string
  bodyHtmlEn: string
  availablePlaceholders: string[]
  disabled: boolean
  /** Ошибка «тема/текст не могут быть пустыми» — только после попытки сохранения. */
  error: string | null
  onChange: (patch: Partial<Pick<EmailTemplateEditorProps,
    'subject' | 'subjectEn' | 'bodyHtml' | 'bodyHtmlEn'>>) => void
}
```

- **Тема**: `TranslationGroup` из `features/admin/ui` — он ровно для билингвальной пары
  однострочных полей (`label`, `value: { ru, en }`, `onChange(lang, value)`, `required`,
  `error`). RU обязателен, EN — нет.
- **Текст письма**: билингвального RTE в проекте ещё нет (единственный потребитель
  `RichTextEditor` — удаляемый `EmailTemplateCard`). Заводим локальный (не в `shared/ui` —
  «добавляй с экраном, которому нужно») блок внутри этого же файла: заголовок «Текст письма»,
  затем две колонки на `sm:grid-cols-2` (RU | English) с той же полоской-флагом, что в
  `TranslationGroup`, в каждой — `RichTextEditor` с
  `toolset={RICH_TEXT_TOOLSETS.email}`, `placeholders={placeholderItems(availablePlaceholders)}`,
  `minHeight="md"`, осмысленным `aria-label`. На узком экране колонки складываются в стек —
  редактор широкий, две колонки ниже `sm` не читаются.
- Под парой — хинт `copy.placeholdersHint` (описание, где брать поля) и
  `copy.translationFallbackHint` («EN пусто → уйдёт русская версия») — оба факты о поведении.
- Плашку `createdOnlyHint` **не переносим** (п.1 чек-листа — удаляется).

### 2.13. `lib/notificationsCopy.ts` — **переписать**

Оставить `defineCopy(ru, en)` и `notificationsErrorMessage`. Коды ошибок:

```ts
const EMAIL_TEMPLATE_INVALID = 2030          // пустая тема/тело, неизвестный ключ события
const NOTIFICATION_RECIPIENT_INVALID = 2038  // невалидная строка получателя / дубликат
```

Ключи (RU; EN — зеркально, по правилам ADR 021):

- Список: `title`, `subtitle`, `columnEvent`, `columnPlatforms`, `columnRecipients`,
  `rowOpenAria(name)`.
- Карточка: `eventSubtitle`, `tabsLabel`, `tabPlatforms`, `tabEmailSettings`,
  `tabTelegramSettings`, `save`, `saving`, `saved`, `cancelEdits`, `dirtyHint`, `readOnlyHint`.
- Платформы: `platformColumnActive`, `platformColumnName`, `platformColumnStatus`,
  `platformWorking`, `platformSetupOnly`, `platformToggleAria(name)`,
  `telegramNotImplementedBanner`.
- Получатели: `recipientsTitle`, `colActive`, `colType`, `colSource`, `colRecipient`,
  `addRecipient`, `removeRowAria(n)`, `recipientsEmptyTitle`, `recipientsEmptyBody`,
  `customEmailPlaceholder`, `adminMailboxValue`, `adminMailboxHint`, `usersNoAccessHint`,
  `userUnavailable`, `orderLinkedEmployeeNote`.
- Шаблон: `subjectLabel`, `bodyLabel`, `bodyPlaceholder`, `placeholdersHint`,
  `translationFallbackHint`, `langRu`, `langEn`.
- Ошибки: `errorInvalidEventKey`, `errorTemplateInvalid`, `errorRecipientInvalid`,
  `rowErrorTypeRequired`, `rowErrorUserRequired`, `rowErrorRoleRequired`,
  `rowErrorEmailInvalid`, `rowErrorDuplicate`, `errorFixRowsBeforeSave`,
  `errorActions.saveEvent(name)`, плюс существующие `errorForbidden/errorServer/errorNetwork`.
- **Удалить**: `identityBadge`, `identityTemplates`, `toggleLabel`, `createdOnlyHint`,
  `subjectPlaceholder` (перекрывается `TranslationGroup`).

### 2.14. `lib/adminEnumsCopy.ts` — **изменить**

Добавить пять словарей (RU/EN), по образцу существующего `employeeJobRole`:

```ts
emailActionKey:            // Новая бронь с сайта / Назначение исполнителя / Снятие исполнителя / Отправка заказа клиенту
notificationPlatform:      // Email / Telegram
notificationRecipientType: // Кому / Копия / Скрытая копия
notificationRecipientSource: // Пользователь / Привязан к заказу / Свой адрес / Служебный ящик
orderLinkedRecipient:      // Клиент заказа / Исполнитель заказа
```

Импорт значений — из `@/features/admin/types/notifications`. Это единственное место, где
`adminEnumsCopy` тянет типы фичи, но именно так уже устроено с `EmployeeJobRole`, а альтернатива
(дублировать енамы в `lib/enums.ts`) хуже.

### 2.15. `lib/placeholderLabels.ts` — **изменить**

Добавить недостающий токен из `EmailPlaceholders.cs`:

```ts
OrderLines: { label: 'Строки заказа', hint: 'Все позиции заказа списком — бэкенд собирает его сам' },
```

Остальное не трогать (механизм фолбэка на сырой токен уже есть).

### 2.16. Состояния и edge-кейсы раздела

| Состояние | Поведение |
| --- | --- |
| Неизвестный `:eventKey` в URL | лоадер бросает `Response(400)` → `AdminErrorBoundary` |
| Событие удалено/не найдено на сервере | 404 из `getNotificationEvent`, не перехватывается |
| Нет `notifications.Update` | поля активны, «Сохранить» навсегда disabled, `readOnlyHint` сверху |
| Нет `users.View` | селект пользователей → текст + `usersNoAccessHint`; существующие строки читаемы и сохраняются без изменений |
| 0 строк получателей | пустое состояние-объяснение, сохранение разрешено (сервер это допускает) |
| 0 **активных** строк | бейдж вкладки `0`; блокировок нет |
| Обе платформы выключены | видна только вкладка «Платформы»; сохранение разрешено |
| Ошибка в строке грида | подсветка + текст под строкой; общий баннер `errorFixRowsBeforeSave`; PUT не уходит |
| 400 `2038` с сервера | баннер `errorRecipientInvalid` (страховка, если локальная валидация что-то пропустила) |
| Уход со страницы с несохранённым | `UnsavedChangesModal` через `useUnsavedChangesGuard` |
| Ответ PUT вернул очищенный HTML | редактор перерисовывается из ответа (он же новый baseline) |

---

## §3. Заказы: мульти-исполнители

### 3.1. `src/features/admin/api/adminOrders.ts` — **изменить**

- `updateOrderLine` — сигнатура та же, но модель похудела (см. §1.4); доккоммент поправить.
- `assignEmployee(model: OrderAssignEmployeeModel)` — тело теперь с `employees: [...]`;
  доккоммент переписать под аддитивный upsert и мультивыбор.
- `unassignEmployee(model: OrderUnassignEmployeeModel)` — добавился `employeeId`.
- **Добавить**:

```ts
/** PUT `Order/UpdateLineEmployee` — «детали для выполнения» одного исполнителя одной строки.
 * Роль здесь не правится (её меняет `assignEmployee`). 404 `OrderLineEmployeeNotFound` (2039),
 * если связку сняли параллельно. */
export function updateOrderLineEmployee(model: OrderLineEmployeeUpdateModel): Promise<void>
```

- `getEmployees()` не трогаем (уже отдаёт `UserInfoModel[]`, теперь с `preferredLanguage`).

### 3.2. `orders/OrderDetailPage.tsx` — **изменить** (модель черновика)

```ts
/** Несохранённые правки одной СТРОКИ — теперь только предоплата. */
interface LineDraftPatch {
  requiresPrepayment?: boolean
  prepaymentAmount?: number
}

/** Несохранённые правки одного ИСПОЛНИТЕЛЯ строки. Ключ — `OrderLineEmployeeInfoModel.id`. */
interface LineEmployeeDraftPatch {
  pickupDetails?: string
  navigatorLink?: string
  comment?: string
  commentEn?: string
}

interface OrderDraft {
  rejectReason?: string
  lines: Record<number, LineDraftPatch>
  lineEmployees: Record<number, LineEmployeeDraftPatch>
}
const EMPTY_DRAFT: OrderDraft = { lines: {}, lineEmployees: {} }
```

- `applyDraft` — дополнительно мапит `line.employees` через `draft.lineEmployees[employee.id]`.
  Принцип не меняется: read-компоненты видят только результат мержа, про черновик не знают.
- `isDraftDirty` — плюс `Object.keys(draft.lineEmployees).length > 0`.
- `patchLineEmployee(employeeRowId, patch)` — сиблинг существующего `patchLine`.
- `saveDraft()`:
  - `setOrderStatus` при изменённом `rejectReason` (без изменений);
  - `updateOrderLine({ id, requiresPrepayment, prepaymentAmount })` на каждую грязную строку —
    **без** pickup/navigator;
  - `updateOrderLineEmployee({ id, pickupDetails, navigatorLink, comment, commentEn })` на
    каждую грязную связку; пустые строки → `null` (сохраняем правило «пустое поле нигде не
    появляется»);
  - всё так же `Promise.all` + `setDraft(EMPTY_DRAFT)`.
- `blankDraftOrder(...)`: добавить `userPreferredLanguage: LanguageCode.Russian`, `lines: []`.
- `hasAssignedEmployee` → `order.lines.some((line) => line.employees.length > 0)`.
- `sendToEmployeesNow()` → по одному вызову на строку, имеющую исполнителей:

```ts
const assignedLines = order.lines.filter((line) => line.employees.length > 0)
Promise.all(assignedLines.map((line) => assignEmployee({
  orderId: order.id,
  lineId: line.id,
  employees: line.employees.map((e) => ({ employeeId: e.employeeId, employeeRole: e.employeeRole })),
  sendEmail: true,
})))
```

- Состояние модалок:

```ts
/** Открытый попап назначения: `null` — закрыт; `{ lineId: null }` — «на все строки»
 * (пункт меню «…»); `{ lineId: n }` — «+ Назначить» в конкретной строке. */
const [assignTarget, setAssignTarget] = useState<{ lineId: number | null } | null>(null)

/** Что подтверждаем снять. `employeeId: null` — всех исполнителей строки. */
const [unassignTarget, setUnassignTarget] = useState<UnassignTarget | null>(null)
export interface UnassignTarget { lineId: number; employeeId: number | null; employeeName: string | null }
```

Существующие `assignOpen`/`unassignLineId` удаляются.

- Вкладка `fulfillment` теперь получает `employees` (список сотрудников из лоадера) — он нужен
  только для авто-раскрытия EN-блока (§0.5).

### 3.3. `orders/components/OrderLinesGrid.tsx` — **изменить**

Удалить `EmployeeAssignmentCell` целиком (§0.8), вместе с ним — `employeeOptions`, импорты
`Select`, `EmployeeJobRoleSelect`, `CheckIcon`.

Новые пропсы:

```ts
export interface OrderLinesGridProps {
  order: OrderInfoModel
  pending: boolean
  /** Открыть попап назначения на ЭТУ строку. */
  onRequestAssign: (lineId: number) => void
  /** Сообщает намерение — подтверждение владеет страница (тот же сплит, что был). */
  onRequestUnassign: (target: UnassignTarget) => void
  onToggleRequiresPrepayment: (line: OrderLineInfoModel, requiresPrepayment: boolean) => void
  onSavePrepaymentAmount: (line: OrderLineInfoModel, amount: number) => void
  onAddLine: () => void
  onRemoveLines: (lineIds: number[]) => void
}
```

(`employees` и `onAssignEmployee` уходят.)

Новый внутренний компонент — ячейка колонки «Исполнители»:

```ts
function LineEmployeesCell({ line, pending, onRequestAssign, onRequestUnassign }: {
  line: OrderLineInfoModel
  pending: boolean
  onRequestAssign: () => void
  onRequestUnassign: (employee: OrderLineEmployeeInfoModel) => void
})
```

Рендер: `flex flex-wrap gap-1.5`; на каждого исполнителя — чип
(`rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs`) с
`employeeFullName` + `(роль)` из `employeeRoleLabel(...)` + кнопка «×»
(`aria-label={copy.unassignEmployeeAria(name)}`, `disabled={pending}`). Если исполнителей нет —
серым `copy.employeeUnassigned`. Внизу — кнопка `+ copy.assignLine` (`AdminActionButton`
`variant="ghost"` `size="sm"`), вызывающая `onRequestAssign`.

Заголовок колонки: `copy.colEmployees` («Исполнители», мн. ч.), ширина `w-64`.

### 3.4. `orders/components/AssignAllModal.tsx` → **переименовать** в `AssignEmployeesModal.tsx`

Имя `AssignAll` перестало быть правдой: попап теперь и bulk, и на одну строку.

```ts
export interface AssignEmployeesModalProps {
  open: boolean
  /** `null` — назначение на ВСЕ строки заказа; иначе — id конкретной строки. */
  lineId: number | null
  /** Подпись целевой строки («Тур · дата») для шапки. `null` при `lineId === null`. */
  lineLabel: string | null
  employees: UserInfoModel[]
  /** `User.id` тех, кто уже назначен на целевую строку — помечаются меткой «уже назначен»,
   * но НЕ предвыбираются (§0.9). При `lineId === null` — пустой массив. */
  alreadyAssignedIds: number[]
  pending: boolean
  onClose: () => void
  /** Пустой список не приходит — кнопки заблокированы. */
  onSubmit: (employees: OrderAssignEmployeeItem[], sendEmail: boolean) => void
}
```

Внутреннее состояние: `const [picked, setPicked] = useState<Map<number, EmployeeJobRole | null>>(new Map())`
и `const [filter, setFilter] = useState('')`. Сброс обоих в `useEffect` на `open` (как сейчас).

Разметка (`Modal size="lg"`):

1. Шапка-пояснение: `lineId === null ? copy.assignScopeAllLines : copy.assignScopeLine(lineLabel)`.
2. Фильтр `Input` с `placeholder={copy.assignFilterPlaceholder}` — рендерится только при
   `employees.length > 8` (для трёх человек поле — шум).
3. Список: `max-h-[45vh] overflow-y-auto` + `divide-y divide-neutral-100`. Строка =
   `flex items-center justify-between gap-3 py-2`:
   - слева `Checkbox` с `label` = ФИО (фолбэк — email), под ним мелким серым метка
     `copy.alreadyAssigned`, если `alreadyAssignedIds.includes(id)`;
   - справа, **только когда отмечен**, `EmployeeJobRoleSelect` (`className="w-44"`,
     `aria-label={copy.assignRoleAria(name)}`), без `allowClear`.
   - Отметка чекбокса подставляет `employee.defaultJobRole ?? null` — тот же пре-филл, что был.
4. Пустое состояние `copy.noEmployees` (как сейчас).
5. Ряд кнопок без изменений: Отмена / Назначить (`sendEmail=false`) / Назначить и отправить
   письмо (`sendEmail=true`).

`canSubmit = picked.size > 0 && [...picked.values()].every((role) => role !== null)`.
При отправке — `[...picked].map(([employeeId, employeeRole]) => ({ employeeId, employeeRole: employeeRole! }))`.

Вызов со страницы:

```tsx
<AssignEmployeesModal
  open={assignTarget !== null}
  lineId={assignTarget?.lineId ?? null}
  …
  onSubmit={(employees, sendEmail) =>
    run(sendEmail ? copy.errorActions.assignAndSendEmail : copy.errorActions.assign,
      () => assignEmployee({ orderId: order.id, lineId: assignTarget!.lineId, employees, sendEmail }),
      { onSuccess: () => setAssignTarget(null), heavy: sendEmail })}
/>
```

### 3.5. Подтверждение снятия — **изменить** (внутри `OrderDetailPage`)

Тот же `Modal`, но текст зависит от цели:

- `employeeId !== null` → `copy.unassignConfirmTitleOne`, тело `copy.unassignConfirmBodyOne(name)`.
- `employeeId === null` → `copy.unassignConfirmTitleAll`, тело `copy.unassignConfirmBodyAll`.

Вызов: `unassignEmployee({ orderId: order.id, lineId: target.lineId, employeeId: target.employeeId })`.

### 3.6. `orders/components/OrderFulfillmentTab.tsx` — **переписать**

```ts
export type LineEmployeeFieldPatch = Partial<
  Pick<OrderLineEmployeeInfoModel, 'pickupDetails' | 'navigatorLink' | 'comment' | 'commentEn'>
>

export interface OrderFulfillmentTabProps {
  /** Уже с наложенным черновиком — правки в полях ниже могут быть несохранёнными;
   * коммитит их общий Save страницы, не эта вкладка. */
  order: OrderInfoModel
  /** Справочник сотрудников — нужен ТОЛЬКО чтобы узнать `preferredLanguage` назначенного
   * человека и решить, раскрывать ли EN-блок (§0.5). Пустой массив допустим. */
  employees: UserInfoModel[]
  pending: boolean
  onChangeEmployeeField: (employee: OrderLineEmployeeInfoModel, patch: LineEmployeeFieldPatch) => void
  /** «Назначить и отправить» по СТРОКЕ: переотправляет письмо всем её исполнителям. */
  onAssignAndSend: (line: OrderLineInfoModel) => void
  /** Открыть попап назначения из пустого состояния строки. */
  onRequestAssign: (lineId: number) => void
}
```

Дерево:

```
OrderFulfillmentTab
└─ LineFulfillmentCard          (на каждую строку заказа)
   ├─ шапка: tourTitle · tourDate · счётчик исполнителей
   ├─ пусто → пустое состояние + кнопка «Назначить исполнителя»
   ├─ EmployeeFulfillmentCard   (на КАЖДОГО исполнителя строки)
   └─ кнопка «Назначить и отправить» (disabled при 0 исполнителей)
```

```ts
function EmployeeFulfillmentCard({ employee, pending, defaultExpandEn, onChange }: {
  employee: OrderLineEmployeeInfoModel
  pending: boolean
  /** `preferredLanguage === English` у этого сотрудника (§0.5). */
  defaultExpandEn: boolean
  onChange: (patch: LineEmployeeFieldPatch) => void
})
```

Содержимое карточки исполнителя (`rounded-xl border border-neutral-200 bg-white p-3.5`):

1. Заголовок: `employeeFullName` (жирным) + чип роли (`employeeRoleLabel`).
2. `Textarea rows={2}` — «Где забрать клиента» (`pickupDetails`).
3. `Input` — «Ссылка на навигатор» (`navigatorLink`).
4. `Textarea rows={2}` — «Комментарий исполнителю» (`comment`).
5. Кнопка-раскрытие: `<button type="button" aria-expanded={expanded}>` с подписью
   `copy.fulfillmentCommentEnToggle` + шеврон. `useState(() => defaultExpandEn || Boolean(employee.commentEn?.trim()))`.
   Раскрыто → `Textarea rows={2}` для `commentEn`. Свёрнуто и `commentEn` пуст → под кнопкой
   хинт `copy.fulfillmentCommentEnFallbackHint`.
   `Accordion` из `shared/ui` не используем — он про публичный FAQ, здесь нужен один
   локальный toggle.

Все поля `disabled={pending}`, все с `label`/`aria-label` из copy — литералов в JSX нет.

### 3.7. `orders/lib/ordersCopy.ts` — **изменить**

Добавить: `colEmployees`, `assignLine`, `unassignEmployeeAria(name)`, `assignScopeAllLines`,
`assignScopeLine(label)`, `assignFilterPlaceholder`, `assignRoleAria(name)`, `alreadyAssigned`,
`unassignConfirmTitleOne`, `unassignConfirmBodyOne(name)`, `unassignConfirmTitleAll`,
`unassignConfirmBodyAll`, `fulfillmentCommentLabel`, `fulfillmentCommentPlaceholder`,
`fulfillmentCommentEnToggle`, `fulfillmentCommentEnLabel`, `fulfillmentCommentEnFallbackHint`,
`fulfillmentLineEmpty`, `fulfillmentEmployeesCount(n)`.

Добавить код ошибки `const ORDER_LINE_EMPLOYEE_NOT_FOUND = 2039` и ветку в
`ordersErrorMessage` → `copy.errorLineEmployeeGone` («исполнителя уже сняли со строки —
обновите страницу»).

Удалить/переименовать: `assignAllTitle`/`assignAllBody` → `assignTitle` + пара
`assignScope*`; `unassignConfirmTitle`/`unassignConfirmBody` → пара `*One`/`*All`;
`unassignLine` остаётся (используется в `aria-label` чипа).

`employeeRoleLabel(...)` — сигнатуру упростить: роль теперь non-nullable
(`EmployeeJobRole` вместо `EmployeeJobRole | null`), функция становится просто
`roleLabels[role]`. Проверить оба места вызова.

### 3.8. Состояния и edge-кейсы заказов

| Состояние | Поведение |
| --- | --- |
| Строка без исполнителей | грид: «Не назначен» + «+ Назначить»; fulfillment: пустое состояние строки |
| Несколько исполнителей на строке | несколько чипов в гриде, несколько карточек в fulfillment |
| Нет `users.View` | `employees = []`, попап показывает `noEmployees`, авто-раскрытие EN не срабатывает |
| Заказ frozen/preDecision | `blockedForDraft` уже прокинут во все три компонента — ничего дополнительно не нужно |
| Снятие последнего исполнителя | не ошибка; строка возвращается в «Не назначен» |
| Связку сняли в другой вкладке | `updateOrderLineEmployee` → 404 (2039) → баннер `errorLineEmployeeGone` |
| «Назначить и отправить» на строке без исполнителей | кнопка disabled + факт-хинт |
| Ассайн уже назначенного человека с другой ролью | валидный upsert, роль меняется |

---

## §4. Язык писем пользователя

### 4.1. `src/features/admin/api/adminUsers.ts` — **изменить**

```ts
/** PATCH `Users/SetPreferredLanguage` — язык писем пользователя. Значение вне enum сервер не
 * отбивает, а роняет в дефолт (Russian). */
export function setUserPreferredLanguage(model: SetUserPreferredLanguageModel): Promise<UserInfoModel>
```

Тип запроса — в том же файле, где живут остальные request-типы этого модуля
(`SetUserJobRoleModel` — образец): `{ userId: number; preferredLanguage: LanguageCode }`.

### 4.2. `src/shared/ui/` — **ничего не создавать**

Селект языка — два варианта, отдельного примитива не заслуживают: обычный
`Select surface="admin"` с опциями из `adminEnumsCopy.languageCode` прямо в `UserDetailInfo`.
(`EmployeeJobRoleSelect` вынесен в `features/admin/ui` только потому, что у него ДВА
потребителя в разных фичах; здесь потребитель один.)

### 4.3. `users/components/UserDetailInfo.tsx` — **изменить**

В карточке «Аккаунт», сразу под строкой «Роль по умолчанию», добавить ряд «Язык писем» — в
точности той же разметкой (`flex flex-wrap items-center justify-between gap-2 py-1.5`), но
**без** условия `user.role === RoleType.Employee`: письма получают и клиенты, и админы.
Новые пропсы: `onChangePreferredLanguage: (language: LanguageCode) => void`,
`languagePending: boolean`. Сохранение немедленное, без Save — как у `defaultJobRole`.

`UserDetailPage` — добавить обработчик по образцу существующего `handleJobRoleChange`
(тот же `pending`-флаг, тот же `revalidate`/локальное обновление).

Добавить в `adminEnumsCopy` словарь `languageCode` (`Русский` / `Английский`;
EN: `Russian` / `English`) и в `userCopy.info` ключи `preferredLanguage` /
`preferredLanguageAria`.

---

## §5. Чистка (п.1 чек-листа)

Удаляются патерналистские плашки-советы; функциональные (про права, описания полей) — остаются.

| Файл | Что убрать |
| --- | --- |
| `notifications/lib/notificationsCopy.ts` | ключ `createdOnlyHint` (RU+EN) |
| `notifications/components/EmailTemplateCard.tsx` | файл удаляется целиком вместе с блоком-плашкой |

Дополнительно `frontend-developer` должен пройтись `grep`-ом по админке на
`не рекомендуется|рекомендуем|лучше не|стоит|советуем` в `*Copy.ts` и вынести найденное на
ревью **отдельным списком, не удаляя молча** — «аналогичные плашки по всей админке» из п.1 не
перечислены поимённо, и решать судьбу каждой должен Давид. Явно НЕ трогать:
`readOnlyHint` (права), field-hints в `SettingsPage` (описания полей),
`actionSendToEmployeesHint` / `fulfillmentAssignAndSendHint` (объясняют, почему кнопка
заблокирована), `unassignConfirmBody*` (описывает поведение системы).

---

## §6. Сводка «создать / изменить / удалить»

### shared
- **создать** `shared/types/language.ts`
- **изменить** `shared/types/booking.ts` (§1.4), `shared/auth/types.ts` (§1.3)

### features/admin — общее
- **изменить** `lib/enums.ts` (ре-экспорт `LanguageCode`), `lib/adminEnumsCopy.ts` (6 словарей),
  `index.ts` (экспорт `NotificationEventPage`), `app/router.tsx` (роут `:eventKey`)

### features/admin/notifications
- **создать** `NotificationEventPage.tsx`, `components/NotificationEventsTable.tsx`,
  `components/PlatformsTab.tsx`, `components/RecipientsGrid.tsx`,
  `components/EmailTemplateEditor.tsx`, `hooks/useNotificationEventForm.ts`,
  `lib/notificationEventModel.ts`
- **изменить** `NotificationsPage.tsx`, `lib/notificationsCopy.ts`, `lib/placeholderLabels.ts`
- **удалить** `components/EmailTemplateCard.tsx`
- **переписать** `types/notifications.ts`, `api/adminNotifications.ts`

### features/admin/orders
- **создать** `components/AssignEmployeesModal.tsx` (на месте удаляемого `AssignAllModal.tsx`)
- **изменить** `OrderDetailPage.tsx`, `components/OrderLinesGrid.tsx`,
  `components/OrderFulfillmentTab.tsx`, `lib/ordersCopy.ts`, `api/adminOrders.ts`
- **удалить** `components/AssignAllModal.tsx`

### features/admin/users
- **изменить** `UserDetailPage.tsx`, `components/UserDetailInfo.tsx`, `lib/userCopy.ts`,
  `api/adminUsers.ts`

### docs (Фаза 4, вне этой задачи)
- `admin-panel.md`, `backend-api.md`, `CHANGELOG.md`

---

## §7. Порядок выполнения

Разбито так, чтобы после каждого шага проект **собирался** (`tsc` зелёный), а не копил
сломанные импорты.

1. **Типы.** `shared/types/language.ts` → `lib/enums.ts` → `shared/auth/types.ts` →
   `shared/types/booking.ts`. После шага `tsc` красный ровно в тех местах, которые правят
   шаги 2–4 — это карта работ.
2. **Заказы, API + страница.** `api/adminOrders.ts` → `OrderDetailPage.tsx` (черновик,
   `saveDraft`, состояния модалок) → `OrderLinesGrid.tsx` → `AssignEmployeesModal.tsx` →
   `OrderFulfillmentTab.tsx` → `ordersCopy.ts`.
3. **Уведомления, типы + API.** `types/notifications.ts` → `api/adminNotifications.ts` →
   `lib/notificationEventModel.ts` → `lib/notificationsCopy.ts` → `adminEnumsCopy.ts`.
4. **Уведомления, UI.** `NotificationsPage.tsx` + `NotificationEventsTable.tsx` →
   `NotificationEventPage.tsx` + `useNotificationEventForm.ts` → `PlatformsTab.tsx` →
   `RecipientsGrid.tsx` → `EmailTemplateEditor.tsx` → удалить `EmailTemplateCard.tsx` →
   роут + барель.
5. **Пользователи.** `adminUsers.ts` → `UserDetailInfo.tsx` → `UserDetailPage.tsx` → copy.
6. **Чистка** (§5) + список найденных плашек на ревью.

Шаги 2 и 3–4 независимы и могут идти параллельно двумя исполнителями; шаг 1 — общий фундамент
и делается первым, одним человеком.

### Обязательная проверка адаптива

Правило `agents.md`: каждая задача проверяется на узком экране по-настоящему, а не «на глаз в
десктопе». Здесь три места, где верстка ломается легче всего:

- грид получателей (4–5 колонок с контролами) — ниже `sm` обязан быть карточным;
- две колонки RU/EN редактора текста письма — ниже `sm` складываются в стек;
- карточки исполнителей fulfillment-вкладки — по одной в колонку, минимальная высота тапа 44px
  у кнопки-раскрытия EN.

---

## §8. Явно вне скоупа

- Реальная отправка в Telegram (бот, токены, chat_id) — в модели и в UI только каркас.
- Создание/удаление событий уведомлений — набор из 4 закрыт кодом.
- Произвольные order-linked роли, кроме «Клиент заказа» / «Исполнитель заказа».
- Перетаскивание строк получателей (`sortOrder` = порядок добавления).
- Кабинет сотрудника поверх `GetAssignedToMe` — на фронте потребителя этого эндпоинта до сих
  пор нет, и мульти-исполнители его не создают.
- Реальное создание заказа из админки (`newDraftMode` остаётся клиентской заглушкой).
- Смена языка писем самим пользователем в публичном `/account` — только админский экран.
- Тесты (`tester` пропущен по режиму до 2026-09-22, Давид проверяет сам).
