# Фоновые задачи (Hangfire) — 2026-08-28

Планировщик фоновых задач на Hangfire: реестр джоб в коде + история запусков в БД + admin API.
Реализовано и **живо проверено** (не только билд) — поднят локальный бэкенд, накачены обе
миграции, вызовы через реальные HTTP-запросы с dev-логином.

Повод: David не может вручную подтверждать каждую бронь 24/7 — нужен механизм, который сам
закрывает даты перед началом тура и отменяет то, что не подтвердили вовремя. По ходу выяснилось,
что нужна не одна фича, а универсальный, расширяемый механизм фоновых задач, чтобы под следующую
задачу (автоочистка чего угодно, будущие джобы) не пришлось переделывать ядро.

## Архитектура — где что живёт

- `ATTours.Common/Infrastructure/Jobs/` — контракты (`IBackgroundJobHandler`, `JobRunResult`,
  `JobExecutionContext`, `BackgroundJobDefinition`, `BackgroundJobCatalog`, `IJobDispatcher`,
  `IBackgroundJobRunner`). Hangfire здесь не упоминается вообще.
- `ATTours.Service/Jobs/` — сами хендлеры (`OrderAutoCancellationJob`, `LoginHistoryCleanupJob`,
  `TourDateAutoClosureJob`), `BackgroundJobRunner` (обвязка вокруг каждого прогона: строка истории
  ДО вызова хендлера, перехват исключений → `Failed`, тримминг старой истории) и
  `ScheduledJobRegistrySync` (апсертит каталог в таблицу `ScheduledJob` на старте).
- `ATTours.ClientAPI/Jobs/HangfireJobDispatcher.cs` — единственный файл во всём решении, который
  знает про Hangfire (`AddHangfire`/`AddHangfireServer`, распределённая блокировка на ключ задачи
  через `AcquireDistributedLock`, `[AutomaticRetry(Attempts = 0)]` — ретраи выключены осознанно,
  повторный запуск после сбоя это осознанное действие админа, не автоматика). Хранилище — та же
  БД, отдельная схема `HangFire`. Смена планировщика в будущем = переписать один этот файл.
- **Новая задача добавляется классом-хендлером + одной строкой в `BackgroundJobCatalog`** — ядро
  (регистрация, история, admin API) не трогается. Ради послойности (`Common` не может знать о
  типах из `Service`) `HandlerType` в каталоге резолвится по строке через `Type.GetType(...)` —
  единственное место без compile-time проверки имени, ошибка в имени падает громко при старте
  приложения, а не тихо в 3 часа ночи.

## Реестр и история (`ScheduledJob`/`ScheduledJobRun`)

`ScheduledJob` — состояние задачи: `Key`, `IsEnabled`, `CronExpression` (override дефолта из
каталога, `null` = дефолт). `ScheduledJobRun` — одна строка на каждый прогон: `Status`
(Running/Succeeded/Skipped/Failed), `AffectedCount`, `Summary`, `Error`, `TriggeredBy`
(Schedule/Manual), `ActorUserId`/`ActorFullName`. Пишется **всегда**, включая отказ и ошибку —
молчаливый провал недопустим. Ретеншен — `jobs.runHistory.retentionDays` (90 по умолчанию),
чистится тем же раннером, который закрывает прогон.

`IsEnabled` гейтит только **расписание** — ручной запуск (`POST api/Jobs/{key}/Run`) реально
выполняет и выключенную задачу: админ включает «Запустить сейчас» именно чтобы проверить то, что
сам выключил.

## Конфигурация (SiteSettings, группы `Booking`/`Jobs`)

Новый тип значения `SettingValueType.Number` — раньше в каталоге настроек были только строки.

| Ключ | Дефолт | Кто читает |
| --- | --- | --- |
| `booking.autoCloseLeadTimeHours` | 24 | `TourDateAutoClosureJob` + `OrderValidationService` + публичный `GetClosedDates` |
| `jobs.orderAutoCancel.deadlineHours` | 12 | `OrderAutoCancellationJob` |
| `jobs.loginHistoryCleanup.retentionDays` | 90 | `LoginHistoryCleanupJob` |
| `jobs.runHistory.retentionDays` | 90 | раннер (тримминг `ScheduledJobRun`) |

Инвариант: `orderAutoCancel.deadlineHours < booking.autoCloseLeadTimeHours` (иначе бронь,
созданная в последний разрешённый час, отменялась бы автоотменой немедленно). Нарушение → джоба
пишет прогон `Skipped` с причиной, а не отменяет заказы молча.

## Три джобы

1. **`order-auto-cancellation`** (`*/15 * * * *`) — sweep, не one-off на конкретный заказ:
   выводит истину из БД заново на каждом тике, переживает рестарты и не требует
   перепланирования при каждой смене статуса заказа. Дедлайн — от МИНИМАЛЬНОЙ `OrderLine.TourDate`
   заказа. Захватывает `Open`/`PendingPayment` (`Hold` не трогает — это осознанное действие
   админа). Прямо перед отменой перечитывает статус заказа (защита от гонки: админ мог подтвердить
   заказ в последний момент между сканом и записью). Действие — `OrderStatusService.
   SetStatusAsync(Rejected)` + `OrderEventLog.LogAutoCancelledAsync` (без `actorUserId` — у
   планировщика нет автора) + `OrderNotificationService.SendOrderAutoCancelledAsync` (новое
   событие `EmailActionKey.OrderAutoCancelled = 5`, тем же паттерном, что 4 существующих заказных
   события — письмо + Telegram через уже готовую параллельную инфраструктуру, см. ниже).
2. **`login-history-cleanup`** (`0 3 * * *`) — пакетное удаление `LoginHistory` старше
   `retentionDays`, батчами (лимит на прогон, чтобы не тянуть в память всю таблицу разом при
   первом запуске после долгого простоя).
3. **`tour-date-auto-closure`** (`0 * * * *`) — раз в час апсертит глобальный `ClosureRule`
   (`Type=SpecificDate`, `Action=Close`, новая колонка `IsAutoGenerated=true`) для каждого дня,
   чьё начало по времени Армении (`ArmeniaTimeZone`, новая утилита — `Asia/Yerevan` с фолбэком на
   `Caucasus Standard Time`, затем на фиксированный UTC+4) оказалось внутри
   `autoCloseLeadTimeHours`. Идемпотентно — не трогает дату, если на неё уже есть ЛЮБОЕ глобальное
   правило (ручное `Open` побеждает планировщик).

## Два барьера на одном пороге — «скрытно от глаз» + видно на фронте сразу

По требованию David — не просто закрыть день ПОСЛЕ того, как сработает джоба (шаг раз в час, до
59 минут задержки), а гарантировать, что клиент вообще не увидит дату выбираемой. Общий хелпер
`AutoClosureWindow.IsWithinAutoCloseWindow` (без похода в `ClosureRule`, прямое сравнение времени)
подключён в ДВУХ местах:
- `OrderValidationService.ResolveLineErrorAsync` — после существующей проверки `IsDateClosedAsync`,
  тем же кодом ошибки `TourDateUnavailable` (2014), что и у обычного закрытого дня — намеренно
  без нового кода, чтобы автозакрытие было неотличимо от ручного и не требовало правок фронта.
- `ClosureRuleInfo.GetClosedDatesAsync` (публичный `GET api/Availability/GetClosedDates`, источник
  для дата-пикера на сайте) — `ClosureRuleResolver.IsClosed(...) || IsWithinAutoCloseWindow(...)`.
  Без этой правки дата казалась бы выбираемой клиенту до тика джобы; с ней дата-пикер гасит её
  сразу же, как порог наступил.

Живая проверка (2026-08-28): порог 24ч → и сегодняшний, и завтрашний день закрыты одновременно
(порог считается от начала календарного дня по Армении, а не от текущего момента) — это ожидаемая
математика, не баг.

## Admin API — `api/Jobs`

Права — `AdminScreens.Jobs` (`"jobs"`, View+Update, без Create/Delete — набор задач фиксирован
каталогом в коде). **Сейчас выдано только системному админу** — осознанное решение David, не
раздавать роли задним числом через миграцию, раздавать вручную через админку когда понадобится.

| Метод | Route | Право |
| --- | --- | --- |
| GET | `api/Jobs` | View | список задач, `Parameters: List<JobParameterInfoModel>` (реальные значения, не только ключи) |
| PATCH | `api/Jobs/{key}/Enabled` | Update | |
| PATCH | `api/Jobs/{key}/Cron` | Update | валидация синтаксиса — пакет `Cronos`, не Hangfire (его `CronExpression` internal) |
| PATCH | `api/Jobs/{key}/Parameters` | Update | тело `{values: Record<string,string>}` — пишет через `SiteSettingsUpdateService`, но правом `jobs`, не `settings` (см. ниже, почему) |
| POST | `api/Jobs/{key}/Run` | Update | 202 при принятии, 409 `JobAlreadyRunning` если уже идёт прогон |
| GET | `api/Jobs/{key}/Runs?take=` | View | история, новые сверху, дефолт 50 / максимум 200 |
| GET | `api/Jobs/{key}/Runs/{runId}` | View | один прогон целиком (для страницы отчёта) |

Коды ошибок: `UnknownJobKey=2040`, `InvalidCronExpression=2041`, `JobAlreadyRunning=2042`,
`UnknownJobParameter=2043` (ключ настройки не принадлежит параметрам этой задачи).

## Фронтенд — экран «Фоновые задачи» (`/admin/jobs`)

Реализован (`Hay Travel/Frontend/src/features/admin/jobs/`), структура — по образцу **Orders**
(`OrderDetailPage`/`AdminToolbar`/`OrderHeader`/`Tabs`/`OrderHistoryTab`), НЕ Notifications: тулбар
Отмена/Сохранить (гейтится `dirty`) + отдельная кнопка «Запустить сейчас» вне черновика, шапка-
карточка + сводка, табы Обзор/История. Вкл/выкл, cron И параметры задачи — один общий черновик
(`Checkbox`, не `Switch`), коммитятся одной кнопкой Save (до 3 PATCH параллельно). Параметр,
физически хранящийся в общем `SiteSetting`, редактируется ПРЯМО на экране задачи, без перехода на
экран «Настройки» — экран джобы пишет через `PATCH api/Jobs/{key}/Parameters` напрямую (см.
[[feedback_screen_owns_its_own_config]]). История — компактная строка (время/статус/затронуто) +
кнопка «Подробный отчёт» на отдельную страницу `/admin/jobs/:key/runs/:runId` (полный текст
summary/error туда, не в строку списка — деталь работает и при прямом заходе по URL/F5).

Три раунда правок макета зафиксированы как переиспользуемые design-system правила проекта, не
только для этого экрана — см. память [[feedback_admin_screen_draft_save_pattern]] (draft+Save,
не instant-apply) и [[feedback_help_text_via_icon_not_inline]] ("?" иконка, не абзац текста).

Живо проверено в браузере 2026-08-29: draft/dirty/Save/Cancel, «Запустить сейчас» + опрос,
персист параметра через reload, страница отчёта переживает F5, 375px без горизонтального
переполнения.

### Правки после первого прохода (2026-08-29, по скриншотам David) — ВСЕ 10 СДЕЛАНЫ, проверено

1. ✅ **Переименован `DisplayName`** в `BackgroundJobCatalog.cs`: `order-auto-cancellation` →
   «Автоотклонение неподтверждённых заказов», `login-history-cleanup` → «Автоудаление истории
   входов», `tour-date-auto-closure` → «Автозакрытие дат». Живо проверено (`GET api/Jobs`).
2. ✅ Поле «По времени Армении» убрано — остался только «Время запуска (UTC)».
3. ✅ Отступ между лейблом и "?"-кнопкой увеличен (`gap-1.5`→`gap-2`) во всех местах, где она
   встречается на экране (и в нескольких общих местах вне экрана джоб — `Field.tsx`,
   `TranslationGroup`, `DayClosureControls`, `RecipientsGrid` — компонент общий, поэтому фикс
   один на всех).
4. ✅ Подсказка «Хранить журнал входов» переписана: «Записи журнала входов старше указанного
   числа дней удаляются автоматически при каждом прогоне этой задачи.» — проверено вживую.
5. ✅ Строка «Выражение: ... по умолчанию» убрана.
6. ✅ «Последний прогон» → «Последнее выполнение» — проверено вживую.
7. ✅ **Причина бага (не то, что казалось)**: не условие рендера, а то, что верхний select
   («Как часто» — категория расписания) сам подставлял живое `n` в свою подпись
   (`scheduleFrequencyLabel({kind:'everyNMinutes', n}, ...)`), и при дефолтном cron
   `order-auto-cancellation` (`*/15 * * * *`) обе подписи совпадали буквально («Каждые 15
   минут» дважды). У остальных двух задач дефолт daily/hourly, поэтому там второй select не
   рендерился вовсе — от того и казалось, что баг только на этой карточке. Исправлено: верхний
   select теперь показывает общую подпись категории («Каждые N минут»/«Каждые N часов»), не
   текущее значение. Проверено вживую.
8. ✅ Убран чужой параметр (`booking.autoCloseLeadTimeHours`) из `Parameters`
   `order-auto-cancellation` в каталоге — джоба по-прежнему читает оба значения в рантайме для
   проверки инварианта (живо перепроверено: временно сбитый порог дал `Skipped` с понятной
   причиной), но UI-карточка теперь показывает только свой параметр. Побочный эффект: `PATCH
   api/Jobs/order-auto-cancellation/Parameters` с этим ключом теперь отдаёт `400/2043`.
9. ✅ Полоса Running — `amber-500` (`JobRunsList.tsx`/`JobRow.tsx`, `shadow-[inset_3px_0_0_...]`,
   тот же приём, что у `Failed`), плюс `JobStatusBadge` тон `run` — `amber-300/50/800` с пульсом.
   Живой прогон в dev-БД слишком быстрый (0.0-0.4с), чтобы застать `Running` в браузере — фикс
   подтверждён чтением кода (оба места используют один и тот же shared-компонент/паттерн, что
   уже проверенный `Failed`), не наблюдением вживую.
10. ✅ Rose → `red-600` в `JobStatusBadge` (тон `fail`), обеих полосках слева (список + история),
    error-баннере на карточке задачи и блоке ошибки на странице отчёта — проверено (после фикса
    на странице не осталось ни одного класса с `rose`). **Осознанно НЕ тронуто**: rose-текст
    валидации полей (неверный cron/нечисловой параметр в `JobScheduleCard`/`JobParametersCard`)
    — это тот же паттерн, что у `Field.tsx` и всех остальных форм админки для ошибок ввода, другая
    смысловая категория, чем «прогон завершился ошибкой». Если David хочет rose→red и там —
    это отдельная, более широкая правка (заденет ещё `Button` variant="danger"/"outline-danger"
    по всему проекту), нужно отдельное подтверждение.

## Что НЕ входит в эту задачу

- **Обобщение уведомлений и Telegram-линковка (`INotificationDispatcher`, `UserTelegramLink`) —
  отменены.** Пока шла эта задача, параллельно и независимо была реализована и доведена до конца
  отдельная работа — Telegram-уведомления заказов по [spec 015](specs/015-telegram-notifications-backend.md)/
  [ADR 031](adr/031-telegram-notifications-transport-and-linking.md): `User.TelegramChatId`,
  линковка через существующий `UserToken`, доставка через существующий `OrderNotificationService`.
  Строить вторую, конкурирующую систему поверх готовой не стали — `OrderAutoCancellationJob`
  просто добавил одно новое событие в уже существующий вертикальный срез.
- Профиль пользователя «Подключить Telegram» — целиком в параллельной работе (spec 015), не здесь.

## Полный план реализации

Архитектурные решения, обсуждение с David, все trade-off'ы — `graceful-shimmying-hare*.md` в
`C:\Users\Dav\.claude\plans\` (черновики раундов backend-architect + финальный консолидированный
план с ревизиями по ходу реализации).
