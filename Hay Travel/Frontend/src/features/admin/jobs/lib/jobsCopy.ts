/**
 * Copy for «Фоновые задачи» (`features/admin/jobs`) — translatable text via `defineCopy(ru, en)`,
 * same convention as `ordersCopy.ts`/`notificationsCopy.ts`. Per-job-key and per-parameter-key
 * dictionaries live here too (not on the backend, not invented on the backend either): the
 * approved mockup's own rule (§05/§11) is that a job's description and its parameters' captions
 * belong to the FRONTEND's dictionary, keyed by the job/parameter key, so an unrecognised key from
 * a future job still renders — it just shows its own key/number instead of a caption, never a
 * blank or a crash.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import { ApiError } from '@/shared/lib/http'
import { JobRunStatus, JobTriggerType } from '@/features/admin/types/jobs'

/** `GlobalErrorCode` values this screen's mutations can report (`Backend/ATTours.Helper/Enums/
 * GlobalErrorCode.cs`) — local numeric constants, same convention as `ordersCopy.ts`. */
const UNKNOWN_JOB_KEY = 2040
const INVALID_CRON_EXPRESSION = 2041
const JOB_ALREADY_RUNNING = 2042
const UNKNOWN_JOB_PARAMETER = 2043
const SITE_SETTING_VALUE_NOT_ALLOWED = 2013

export const jobsCopy = defineCopy(
  {
    title: 'Фоновые задачи',
    titleHint:
      'Задачи, которые сервер выполняет сам по расписанию. Их набор задан кодом — добавить или удалить задачу из админки нельзя.',
    breadcrumbsLabel: 'Хлебные крошки',
    backToList: 'Фоновые задачи',

    /* ── Список ──────────────────────────────────────────────────────────────────────────── */
    colJobAndLastRun: 'Задача и последний прогон',
    colNextRun: 'Следующий запуск',
    colState: 'Состояние',
    nextLabel: 'Следующий',
    neverRun: 'Ещё ни разу не запускалась',
    notScheduled: 'не запланирован',
    disabledSub: 'задача выключена',
    stateEnabled: 'Включена',
    stateDisabled: 'Выключена',
    runButton: 'Запустить',
    runButtonPending: 'Запускаем…',
    openJobAria: (name: string) => `Открыть задачу: ${name}`,
    today: 'сегодня',
    yesterday: 'вчера',
    tomorrow: 'завтра',
    empty: 'Фоновых задач нет.',

    /* ── Статусы прогона (§04) ──────────────────────────────────────────────────────────── */
    statusLabels: {
      [JobRunStatus.Running]: 'Идёт',
      [JobRunStatus.Succeeded]: 'Успешно',
      [JobRunStatus.Skipped]: 'Пропущено',
      [JobRunStatus.Failed]: 'Ошибка',
    } as Record<number, string>,
    unknownStatus: (status: number) => `Статус ${status}`,

    /* ── Кто запустил ────────────────────────────────────────────────────────────────────── */
    triggeredByLabels: {
      [JobTriggerType.Schedule]: 'по расписанию',
      [JobTriggerType.Manual]: 'вручную',
    } as Record<number, string>,
    triggeredByManualField: 'Вручную',
    triggeredByScheduleField: 'По расписанию',

    /* ── Карточка задачи — шапка/тулбар ─────────────────────────────────────────────────── */
    runNowButton: 'Запустить сейчас',
    runNowButtonPending: 'Запускаем…',
    runNowHintWhenDirty:
      'Запуск выполнится с сохранёнными настройками — несохранённые правки на него не влияют.',
    keyLabel: 'Ключ',
    nextRunPrefix: 'Следующий запуск',
    inMinutes: (n: number) => `через ${n} ${pluralizeRu(n, ['минуту', 'минуты', 'минут'])}`,

    /* ── Сводка ──────────────────────────────────────────────────────────────────────────── */
    summaryTitle: 'Сводка',
    summaryState: 'Состояние',
    summarySchedule: 'Расписание',
    summaryNextRun: 'Следующий запуск',
    summaryLastRun: 'Последнее выполнение',
    summaryBySavedSchedule: 'по сохранённому расписанию',
    summaryAffectedAndDuration: (affected: number, duration: string | null) =>
      duration ? `затронуто ${affected} · ${duration}` : `затронуто ${affected}`,
    unsavedBadge: 'не сохранено',

    /* ── Вкладки ─────────────────────────────────────────────────────────────────────────── */
    tabOverview: 'Обзор',
    tabHistory: 'История',
    tabsLabel: 'Разделы задачи',

    /* ── Карточка «Расписание и состояние» ──────────────────────────────────────────────── */
    scheduleCardTitle: 'Расписание и состояние',
    scheduleCheckboxLabel: 'Запускать по расписанию',
    scheduleCheckboxHint:
      'Выключенная задача не запускается сама. Кнопка «Запустить сейчас» работает в любом случае.',
    frequencyLabel: 'Как часто',
    frequency: {
      everyNMinutes: (n: number) => `каждые ${n} минут`,
      /** Category label for the top "Как часто" `Select` — kept generic (a literal "N", not the
       * currently-picked number) so it never repeats the refinement `Select` right below it verbatim
       * (fix 2026-08-29: both used to read e.g. "Каждые 15 минут" and looked like a duplicated
       * control). */
      everyNMinutesGeneric: 'каждые N минут',
      hourly: 'каждый час, в начале часа',
      everyNHours: (n: number) => `каждые ${n} ч`,
      /** Same reasoning as `everyNMinutesGeneric`, for the "every N hours" category. */
      everyNHoursGeneric: 'каждые N часов',
      dailyAt: 'раз в сутки, в заданное время',
      weeklyAt: 'раз в неделю, в заданный день и время',
      custom: 'своё выражение (cron)',
    },
    timeUtcLabel: 'Время запуска (UTC)',
    timeUtcHint: 'Сервер исполняет расписание по UTC — это на 4 часа раньше времени Армении.',
    weekdayLabel: 'День недели',
    /** Sunday-first (index = cron's own day-of-week field, 0–6), NOT `shared/lib/date.ts`'s
     * Monday-first `WEEKDAYS_FULL` — sharing that array here would silently relabel every option
     * one day off, since cron and that calendar-grid helper number weekdays differently. */
    cronWeekdayNames: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    cronExpressionLabel: 'Cron-выражение',
    cronExpressionHint:
      'Пять или шесть частей через пробел: минуты, часы, дни, месяцы, дни недели. Например 0 */3 * * * — каждые 3 часа.',
    cronFieldCountError: (count: number) => `Нужно 5 или 6 частей — здесь ${count}`,
    cronInvalidError: 'Cron-выражение некорректно.',
    previewLabelSaved: 'Ближайшие запуски',
    previewLabelDraft: 'Если сохранить — ближайшие запуски',
    previewNoResult: '—',

    /* ── Карточка «Параметры задачи» ────────────────────────────────────────────────────── */
    parametersCardTitle: 'Параметры задачи',
    parameterNumberError: 'Введите целое неотрицательное число',
    /** Неизвестный `valueType` (сегодня недостижимо — все параметры задач `Number`), но экран не
     * должен падать, если каталог когда-нибудь заведёт параметр другого типа. */
    parameterUnknownTypeHint: 'Тип поля неизвестен фронтенду — значение можно править как текст.',

    /* ── Только просмотр / сообщения ────────────────────────────────────────────────────── */
    readOnlyHint: 'У вашей роли нет права изменять фоновые задачи — доступен только просмотр.',
    savedBanner: 'Настройки задачи сохранены.',
    runStartedBanner: 'Задача запущена. Результат появится в истории через несколько секунд.',
    runAlreadyRunningBanner: 'Задача уже выполняется — повторный запуск не потребовался.',

    /* ── Вкладка «История» ──────────────────────────────────────────────────────────────── */
    historyColTime: 'Время',
    historyColResult: 'Результат',
    historyColAffected: 'Затронуто',
    affectedUnit: (n: number) => `${n} ${pluralizeRu(n, ['запись', 'записи', 'записей'])}`,
    affectedDash: '—',
    reportButton: 'Подробный отчёт',
    historyFooterShown: (n: number) => `Показано ${n}`,
    historyRetentionHint: 'История прогонов хранится 90 дней, более старые записи сервер удаляет сам.',
    historyEmptyTitle: 'Задача ещё ни разу не запускалась',
    historyEmptyNextRun: (when: string) => `Первый запуск — ${when}`,
    historyEmptyDisabled: 'Задача выключена — расписания нет.',

    /* ── Страница отчёта о прогоне ──────────────────────────────────────────────────────── */
    runCrumb: (when: string) => `Прогон ${when}`,
    backToHistory: '← К истории задачи',
    runPanelTitle: 'Прогон',
    fieldStart: 'Начало',
    fieldEnd: 'Окончание',
    fieldDuration: 'Длительность',
    fieldTrigger: 'Запуск',
    fieldAffected: 'Затронуто',
    stillRunningDash: '—',
    reportCardTitle: 'Отчёт',
    errorCardTitle: 'Ошибка',
    notFoundTitle: 'Прогон не найден',
    notFoundBody: 'Такой записи больше нет — возможно, истёк 90-дневный срок хранения истории.',
    notFoundBack: 'К истории задачи',

    /* ── Ошибки/действия ─────────────────────────────────────────────────────────────────── */
    errors: {
      notFound: 'Задача не найдена — обновите страницу.',
      invalidCron: 'Cron-выражение некорректно.',
      unknownParameter: 'Один из параметров не относится к этой задаче — обновите страницу.',
      invalidNumber: 'Одно из значений — не целое число.',
      actionForbidden: (action: string) => `Не удалось ${action}: недостаточно прав.`,
      actionServer: (action: string, status: number) => `Не удалось ${action}: сервер вернул ошибку (${status}).`,
      actionNetwork: (action: string) => `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
    },
    errorActions: {
      save: 'сохранить задачу',
      run: 'запустить задачу',
    },

    /* ── Словарь по ключу задачи (BackgroundJobCatalog) ─────────────────────────────────── */
    jobHelpTextByKey: {
      'order-auto-cancellation':
        'Отменяет заказ, если он остался неподтверждённым дольше настроенного числа часов с момента создания.',
      'login-history-cleanup':
        'Удаляет записи журнала входов старше настроенного числа дней.',
      'tour-date-auto-closure':
        'Закрывает календарный день для новых броней, если до его начала осталось меньше настроенного числа часов.',
    } as Record<string, string>,
    /** Только для страницы отчёта, которая грузит один прогон напрямую и не тянет весь список
     * задач ради подписи в шапке (`JobRunReportPage`) — тот же приём, что и у `jobHelpTextByKey`:
     * неизвестный ключ показывает сам себя, экран не пустеет. */
    jobDisplayNameByKey: {
      'order-auto-cancellation': 'Автоотмена неподтверждённых заказов',
      'login-history-cleanup': 'Очистка журнала входов',
      'tour-date-auto-closure': 'Автозакрытие дат перед началом дня',
    } as Record<string, string>,

    /* ── Словарь по ключу параметра (SiteSettingKeys) ───────────────────────────────────── */
    parameters: {
      'booking.autoCloseLeadTimeHours': {
        label: 'Закрывать день за',
        summaryLabel: 'Порог закрытия',
        hint:
          'День перестаёт принимать новые брони, когда до его начала остаётся меньше этого числа часов. Должно быть больше порога автоотмены заказов.',
        unit: 'часов до начала дня',
        unitShort: 'ч',
      },
      'jobs.orderAutoCancel.deadlineHours': {
        label: 'Отменять заказ через',
        summaryLabel: 'Порог отмены',
        hint:
          'Неподтверждённый заказ отменяется автоматически, если с момента создания прошло больше этого числа часов. Должно быть меньше порога автозакрытия дня.',
        unit: 'часов после создания заказа',
        unitShort: 'ч',
      },
      'jobs.loginHistoryCleanup.retentionDays': {
        label: 'Хранить журнал входов',
        summaryLabel: 'Срок хранения журнала',
        hint: 'Записи журнала входов старше указанного числа дней удаляются автоматически при каждом прогоне этой задачи.',
        unit: 'дней',
        unitShort: 'дней',
      },
    } as Record<string, { label: string; summaryLabel: string; hint: string; unit: string; unitShort: string }>,
  },
  {
    title: 'Background jobs',
    titleHint:
      'Tasks the server runs on its own, on a schedule. The set is fixed in code — jobs cannot be added or removed from the admin panel.',
    breadcrumbsLabel: 'Breadcrumbs',
    backToList: 'Background jobs',

    colJobAndLastRun: 'Job and last run',
    colNextRun: 'Next run',
    colState: 'State',
    nextLabel: 'Next',
    neverRun: 'Has never run yet',
    notScheduled: 'not scheduled',
    disabledSub: 'job is disabled',
    stateEnabled: 'Enabled',
    stateDisabled: 'Disabled',
    runButton: 'Run',
    runButtonPending: 'Running…',
    openJobAria: (name: string) => `Open job: ${name}`,
    today: 'today',
    yesterday: 'yesterday',
    tomorrow: 'tomorrow',
    empty: 'There are no background jobs.',

    statusLabels: {
      [JobRunStatus.Running]: 'Running',
      [JobRunStatus.Succeeded]: 'Succeeded',
      [JobRunStatus.Skipped]: 'Skipped',
      [JobRunStatus.Failed]: 'Failed',
    } as Record<number, string>,
    unknownStatus: (status: number) => `Status ${status}`,

    triggeredByLabels: {
      [JobTriggerType.Schedule]: 'on schedule',
      [JobTriggerType.Manual]: 'manually',
    } as Record<number, string>,
    triggeredByManualField: 'Manual',
    triggeredByScheduleField: 'On schedule',

    runNowButton: 'Run now',
    runNowButtonPending: 'Running…',
    runNowHintWhenDirty: 'The run uses the SAVED settings — unsaved edits do not affect it.',
    keyLabel: 'Key',
    nextRunPrefix: 'Next run',
    inMinutes: (n: number) => `in ${n} ${pluralizeEn(n, ['minute', 'minutes'])}`,

    summaryTitle: 'Summary',
    summaryState: 'State',
    summarySchedule: 'Schedule',
    summaryNextRun: 'Next run',
    summaryLastRun: 'Last run',
    summaryBySavedSchedule: 'per the saved schedule',
    summaryAffectedAndDuration: (affected: number, duration: string | null) =>
      duration ? `${affected} affected · ${duration}` : `${affected} affected`,
    unsavedBadge: 'unsaved',

    tabOverview: 'Overview',
    tabHistory: 'History',
    tabsLabel: 'Job sections',

    scheduleCardTitle: 'Schedule and state',
    scheduleCheckboxLabel: 'Run on schedule',
    scheduleCheckboxHint: 'A disabled job does not run on its own. "Run now" still works regardless.',
    frequencyLabel: 'How often',
    frequency: {
      everyNMinutes: (n: number) => `every ${n} minutes`,
      everyNMinutesGeneric: 'every N minutes',
      hourly: 'every hour, on the hour',
      everyNHours: (n: number) => `every ${n}h`,
      everyNHoursGeneric: 'every N hours',
      dailyAt: 'once a day, at a set time',
      weeklyAt: 'once a week, on a set day and time',
      custom: 'custom expression (cron)',
    },
    timeUtcLabel: 'Run time (UTC)',
    timeUtcHint: 'The server runs the schedule in UTC — 4 hours behind Armenia time.',
    weekdayLabel: 'Day of week',
    cronWeekdayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    cronExpressionLabel: 'Cron expression',
    cronExpressionHint:
      'Five or six space-separated parts: minute, hour, day, month, weekday. E.g. 0 */3 * * * — every 3 hours.',
    cronFieldCountError: (count: number) => `Needs 5 or 6 parts — this has ${count}`,
    cronInvalidError: 'The cron expression is invalid.',
    previewLabelSaved: 'Upcoming runs',
    previewLabelDraft: 'Upcoming runs if saved',
    previewNoResult: '—',

    parametersCardTitle: 'Job parameters',
    parameterNumberError: 'Enter a non-negative whole number',
    parameterUnknownTypeHint: 'The frontend does not know this field type — the value is editable as plain text.',

    readOnlyHint: 'Your role has no permission to change background jobs — view only.',
    savedBanner: 'The job settings have been saved.',
    runStartedBanner: 'The job has been started. The result will appear in the history in a few seconds.',
    runAlreadyRunningBanner: 'The job is already running — a second run was not queued.',

    historyColTime: 'Time',
    historyColResult: 'Result',
    historyColAffected: 'Affected',
    affectedUnit: (n: number) => `${n} ${pluralizeEn(n, ['record', 'records'])}`,
    affectedDash: '—',
    reportButton: 'Full report',
    historyFooterShown: (n: number) => `Showing ${n}`,
    historyRetentionHint: 'Run history is kept for 90 days; older records are deleted by the server on their own.',
    historyEmptyTitle: 'This job has never run yet',
    historyEmptyNextRun: (when: string) => `First run — ${when}`,
    historyEmptyDisabled: 'The job is disabled — there is no schedule.',

    runCrumb: (when: string) => `Run ${when}`,
    backToHistory: '← Back to the job history',
    runPanelTitle: 'Run',
    fieldStart: 'Started',
    fieldEnd: 'Finished',
    fieldDuration: 'Duration',
    fieldTrigger: 'Trigger',
    fieldAffected: 'Affected',
    stillRunningDash: '—',
    reportCardTitle: 'Report',
    errorCardTitle: 'Error',
    notFoundTitle: 'Run not found',
    notFoundBody: 'This record no longer exists — the 90-day history retention period may have passed.',
    notFoundBack: 'Back to the job history',

    errors: {
      notFound: 'Job not found — refresh the page.',
      invalidCron: 'The cron expression is invalid.',
      unknownParameter: 'One of the parameters does not belong to this job — refresh the page.',
      invalidNumber: 'One of the values is not a whole number.',
      actionForbidden: (action: string) => `Could not ${action}: not enough permissions.`,
      actionServer: (action: string, status: number) => `Could not ${action}: the server returned an error (${status}).`,
      actionNetwork: (action: string) => `Could not ${action}: check your connection and try again.`,
    },
    errorActions: {
      save: 'save the job',
      run: 'run the job',
    },

    jobHelpTextByKey: {
      'order-auto-cancellation':
        'Cancels an order that stayed unconfirmed longer than the configured number of hours since creation.',
      'login-history-cleanup': 'Deletes login-history entries older than the configured number of days.',
      'tour-date-auto-closure':
        'Closes a calendar day to new bookings once less than the configured number of hours remain before it starts.',
    } as Record<string, string>,
    jobDisplayNameByKey: {
      'order-auto-cancellation': 'Auto-cancel unconfirmed orders',
      'login-history-cleanup': 'Login history cleanup',
      'tour-date-auto-closure': 'Auto-close tour dates before start',
    } as Record<string, string>,

    parameters: {
      'booking.autoCloseLeadTimeHours': {
        label: 'Close a day',
        summaryLabel: 'Closing threshold',
        hint:
          'A day stops accepting new bookings once fewer than this many hours remain before it starts. Must be greater than the order auto-cancel threshold.',
        unit: 'hours before the day starts',
        unitShort: 'h',
      },
      'jobs.orderAutoCancel.deadlineHours': {
        label: 'Cancel an order after',
        summaryLabel: 'Cancel threshold',
        hint:
          'An unconfirmed order is cancelled automatically once more than this many hours have passed since it was created. Must be less than the day auto-close threshold.',
        unit: 'hours after the order was created',
        unitShort: 'h',
      },
      'jobs.loginHistoryCleanup.retentionDays': {
        label: 'Keep login history for',
        summaryLabel: 'History retention',
        hint: 'Login-history entries older than the configured number of days are deleted automatically on every run of this job.',
        unit: 'days',
        unitShort: 'd',
      },
    } as Record<string, { label: string; summaryLabel: string; hint: string; unit: string; unitShort: string }>,
  },
)

export type JobsCopy = ReturnType<typeof jobsCopy>

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/** Same shape as `ordersErrorMessage` — `copy` is passed in rather than re-resolved, since this
 * runs inside a page's own async handler which already holds the resolved copy. */
export function jobsErrorMessage(copy: JobsCopy, err: unknown, action: string): string {
  const errors = copy.errors
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === UNKNOWN_JOB_KEY) return errors.notFound
    if (code === INVALID_CRON_EXPRESSION) return errors.invalidCron
    if (code === UNKNOWN_JOB_PARAMETER) return errors.unknownParameter
    if (code === SITE_SETTING_VALUE_NOT_ALLOWED) return errors.invalidNumber
    if (err.status === 403) return errors.actionForbidden(action)
    return errors.actionServer(action, err.status)
  }
  return errors.actionNetwork(action)
}

/** Exported for `adminJobs.ts#runJob` callers that want to recognise the one non-error 409
 * (`JobAlreadyRunning`) without reaching for the numeric literal a second time. */
export { JOB_ALREADY_RUNNING }
