/**
 * Copy of the Календарь screen, RU + EN (ADR 021).
 *
 * Everything the screen SAYS lives here; `defineCopy` types the English half against the Russian
 * one, so a missing or renamed key is a build error rather than a blank label. Non-translatable
 * things this module also owns — the error codes, the Monday-first weekday order — stay plain
 * exports outside `defineCopy`.
 *
 * Month and weekday names are NOT written out here: they come from `shared/lib/date`, the same
 * lists `shared/ui/DatePicker` draws, keyed by locale. Two hand-kept copies of twelve month names
 * is how one of them ends up out of step with the other.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { ApiError } from '@/shared/lib/http'
import {
  MONTHS_GENITIVE,
  MONTHS_NOMINATIVE,
  parseISODate,
  WEEKDAYS_FULL,
  WEEKDAYS_SHORT,
} from '@/shared/lib/date'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import type { Locale } from '@/shared/lib/locale'
import { DayOfWeekCode, OrderStatus } from '@/shared/types/booking'

/** `GlobalErrorCode` values this screen's mutations can report (spec 001 §7) — local numeric
 * constants, the established admin convention (see `userCopy.ts`/`catalogErrors.ts`). */
const RELATIONAL_ENTITY_NOT_FOUND = 2003 // DeleteRule/DeleteRules — the rule is already gone.
const TOUR_NOT_FOUND = 2004 // CreateRules — a rule points at a tour that no longer exists.
const INVALID_CLOSURE_RULE = 2017 // CreateRules — the rule's shape is wrong.
const CLOSURE_DATE_IN_PAST = 2022 // CreateRules — backdating is forbidden everywhere (B12).

/* Declared outside the copy objects because those objects reference them — a self-reference inside
   an object literal would leave it with an inferred `any`. */
const ordersUnitRu = (count: number): string =>
  `${count} ${pluralizeRu(count, ['заказ', 'заказа', 'заказов'])}`
const ordersUnitEn = (count: number): string => `${count} ${pluralizeEn(count, ['order', 'orders'])}`

const guestsUnitRu = (count: number): string =>
  `${count} ${pluralizeRu(count, ['гость', 'гостя', 'гостей'])}`
const guestsUnitEn = (count: number): string => `${count} ${pluralizeEn(count, ['guest', 'guests'])}`

// Слово «правило» показалось Давиду канцелярским — «блокировка» читается как то, что оно есть
// с точки зрения админа: конкретные даты стали недоступны для брони (2026-08-14).
const blockingsUnitRu = (count: number): string =>
  `${count} ${pluralizeRu(count, ['блокировка', 'блокировки', 'блокировок'])}`
const blockingsUnitEn = (count: number): string =>
  `${count} ${pluralizeEn(count, ['closure', 'closures'])}`

/**
 * `12.08.2026` / `12/08/2026` — the format the panel uses everywhere a date is tabular.
 * `en-GB` (day-month-year) rather than `en-US`: the order the team already reads dates in.
 */
const TABLE_DATE: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
}

/** An unparseable value is returned as-is: it comes off the wire, and hiding it would leave the
 * table cell blank with no hint of why. */
function formatTableDate(locale: Locale, dateISO: string | null): string | null {
  if (dateISO === null) return null
  const date = parseISODate(dateISO)
  return date === null ? dateISO : TABLE_DATE[locale].format(date)
}

/** ISO-8601 UTC instant → the admin's local date and time. */
const DATE_TIME: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }),
  en: new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }),
}

/** Monday-first name list → a map keyed by `System.DayOfWeek` (Sunday = 0), which is what the
 * backend's `ClosureRule.DayOfWeek` and native `getDay()` both use. */
function byDayCode(mondayFirst: string[]): Record<DayOfWeekCode, string> {
  return {
    [DayOfWeekCode.Monday]: mondayFirst[0],
    [DayOfWeekCode.Tuesday]: mondayFirst[1],
    [DayOfWeekCode.Wednesday]: mondayFirst[2],
    [DayOfWeekCode.Thursday]: mondayFirst[3],
    [DayOfWeekCode.Friday]: mondayFirst[4],
    [DayOfWeekCode.Saturday]: mondayFirst[5],
    [DayOfWeekCode.Sunday]: mondayFirst[6],
  }
}

export const calendarCopy = defineCopy(
  {
    title: 'Календарь',
    subtitle: 'Занятость по дням и блокировки дат.',

    tabsLabel: 'Разделы календаря',
    tabCalendar: 'Календарь',
    tabRules: 'Блокировки',

    /* ── Dates ────────────────────────────────────────────────────────────────────────────── */
    /** Nominative — toolbar headings ("Август 2026"). */
    months: MONTHS_NOMINATIVE.ru,
    /** Genitive — inside a full date ("12 августа 2026"), where the nominative reads wrong. */
    monthsGenitive: MONTHS_GENITIVE.ru,
    weekdayShort: byDayCode(WEEKDAYS_SHORT.ru),
    weekdayFull: byDayCode(WEEKDAYS_FULL.ru),
    /** "каждый понедельник" needs the gender agreement Russian expects — which is why this is a
     * list of its own and not "каждый" + `weekdayFull`. */
    weekdayEvery: {
      [DayOfWeekCode.Monday]: 'каждый понедельник',
      [DayOfWeekCode.Tuesday]: 'каждый вторник',
      [DayOfWeekCode.Wednesday]: 'каждую среду',
      [DayOfWeekCode.Thursday]: 'каждый четверг',
      [DayOfWeekCode.Friday]: 'каждую пятницу',
      [DayOfWeekCode.Saturday]: 'каждую субботу',
      [DayOfWeekCode.Sunday]: 'каждое воскресенье',
    } as Record<DayOfWeekCode, string>,
    formatTableDate: (dateISO: string | null) => formatTableDate('ru', dateISO),
    formatDateTime: (instantUtc: string) => DATE_TIME.ru.format(new Date(instantUtc)),

    /* ── Units ────────────────────────────────────────────────────────────────────────────── */
    ordersUnit: ordersUnitRu,
    guestsUnit: guestsUnitRu,
    blockingsUnit: blockingsUnitRu,

    /* ── Toolbar ────────────────────────────────────────────────────────────────────────────── */
    prevMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    bulk: 'Массовые операции',
    monthLoading: 'Загружаем месяц',

    /* ── Grid ───────────────────────────────────────────────────────────────────────────────── */
    gridLoadFailed: 'Не удалось загрузить месяц.',
    retry: 'Повторить',
    legendTitle: 'Обозначения',
    legendClosed: 'день закрыт целиком',
    legendPartial: 'закрыты отдельные туры',
    legendOrders: 'число заказов на день',
    closedLabel: 'закрыто',
    partialLabel: 'частично закрыто',
    /** An archived tour whose orders live on — a blank name would look like a broken calendar. */
    tourFallback: (tourId: number) => `Тур #${tourId}`,

    /* ── Day panel ──────────────────────────────────────────────────────────────────────────── */
    availabilityTitle: 'Доступность',
    availabilityHelpBody:
      'Если не выбрать ни одного тура — действие применится сразу к целому дню. Если выбрать конкретные туры — оно затронет только их.',
    ordersTitle: 'Заказы',
    closeWholeDay: 'Закрыть весь день (все туры)',
    openWholeDay: 'Открыть весь день',
    wholeDayClosedNote: 'День закрыт целиком.',
    closedByWeeklyHint:
      'День закрыт блокировкой по дню недели — кнопка «Открыть» не удалит эту блокировку, а создаст исключение на эту дату.',
    closedToursTitle: 'Закрытые туры этого дня',
    openTour: 'Открыть',
    closeTourTitle: 'Закрыть отдельный тур',
    closeTourSearch: 'Поиск по названию',
    closeTourNoResults: 'Туры не найдены',
    closeTourAction: 'Закрыть',
    dayAlreadyClosedHint: 'День уже закрыт целиком — отдельная блокировка на тур ничего не изменит.',
    pastDayLockedHint: 'Прошедший день — задним числом закрывать или открывать нельзя.',
    /** Shown instead of the editable controls when the role may read the calendar but not change
     * closures. Closing needs `calendar.Create`, re-opening needs `calendar.Delete`. */
    closureReadOnlyHint: 'У вашей роли нет права закрывать и открывать даты — только просмотр.',
    closureReasonLabel: 'Причина',
    noOrders: 'Заказов на этот день нет.',
    noDayData: 'Нет данных за этот день.',
    orderNumber: (number: string) => `Заказ №${number}`,
    statusLabels: {
      [OrderStatus.Open]: 'Открыт',
      [OrderStatus.Hold]: 'На удержании',
      [OrderStatus.Approved]: 'Одобрен',
      [OrderStatus.Rejected]: 'Отклонён',
      [OrderStatus.ReadyForAssignment]: 'Готов к назначению',
      [OrderStatus.PendingPayment]: 'Ждёт оплаты',
      [OrderStatus.Completed]: 'Завершён',
    } as Record<OrderStatus, string>,

    /* ── Bulk panel ─────────────────────────────────────────────────────────────────────────── */
    bulkTitle: 'Массовые операции',
    bulkActionTitle: 'Действие',
    bulkActionClose: 'Закрыть даты',
    bulkActionOpen: 'Открыть даты (исключение)',
    bulkActionOpenHint: 'Нужно, чтобы открыть отдельные дни внутри повторяющегося закрытия.',
    bulkModeTitle: 'Тип',
    bulkModeRange: 'Диапазон дат',
    bulkModeWeekly: 'Повтор по дням недели',
    bulkFrom: 'С',
    bulkTo: 'По',
    bulkWeekdaysTitle: 'Дни недели',
    bulkPeriodTitle: 'Действует (необязательно)',
    bulkScopeTitle: 'Область',
    bulkScopeAll: 'Все туры',
    bulkScopeSelected: 'Выбранные туры',
    bulkPresetAll: 'Все',
    bulkPresetTours: 'Туры',
    bulkPresetExcursions: 'Экскурсии',
    bulkPresetByRegion: 'По региону:',
    bulkResetFilters: 'Сбросить',
    bulkTourSearch: 'Поиск по названию',
    bulkNoTours: 'Туры не найдены.',
    bulkReasonTitle: 'Причина (необязательно)',
    bulkPreview: (count: number) => `Будет создано ${blockingsUnitRu(count)}`,
    bulkApply: 'Применить',
    bulkApplying: 'Применяем…',
    bulkCancel: 'Отмена',
    bulkConfirmTitle: 'Применить массовую операцию?',
    bulkConfirmBody: (count: number) =>
      `Будет создано ${blockingsUnitRu(count)}. Их можно будет удалить — целиком группой или по одной — на вкладке «Блокировки».`,
    bulkConfirmAction: 'Применить',

    /* ── Bulk validation (returned by `compileBulkForm`) ────────────────────────────────────── */
    bulkErrorRangeRequired: 'Укажите обе границы диапазона.',
    bulkErrorRangeOrder: 'Дата «С» не может быть позже даты «По».',
    bulkErrorPastDate: 'Дата «С» не может быть в прошлом — задним числом закрывать нельзя.',
    bulkErrorWeekdaysRequired: 'Выберите хотя бы один день недели.',
    bulkErrorReasonTooLong: 'Причина не может быть длиннее 500 символов.',
    bulkErrorTooMany: (count: number, max: number) =>
      `Слишком много блокировок: ${count} при максимуме ${max}. Сузьте диапазон или выберите повтор по дням недели.`,

    /* ── Rules tab ──────────────────────────────────────────────────────────────────────────── */
    rulesEmpty: 'Блокировок пока нет.',
    rulesEmptyHint: 'Создать их можно кнопкой «Массовые операции» на вкладке «Календарь».',
    rulesScope: 'Область',
    rulesType: 'Тип',
    rulesWhen: 'Когда',
    rulesPeriod: 'Период',
    rulesAction: 'Действие',
    rulesReason: 'Причина',
    rulesAllTours: 'Все туры',
    rulesManyTours: (count: number) => `${count} туров`,
    rulesTypeDate: 'Дата',
    rulesTypeWeekly: 'По дню недели',
    rulesActionClose: 'Закрыто',
    rulesActionOpen: 'Открыто',
    /** An open-ended bound reads as «…»: "с 12.08.2026" with nothing after it, or "по 31.12.2026"
     * with nothing before. The whole expression is one function because the two halves' word order
     * is a property of the language, not of the caller. */
    rulesPeriodRange: (from: string | null, to: string | null) =>
      `${from === null ? '…' : `с ${from}`} ${to === null ? '' : `по ${to}`}`.trim(),
    rulesSelectAria: (label: string) => `Выбрать блокировку от ${label}`,
    rulesSelectGroupAria: (count: number) => `Выбрать группу из ${count}`,
    // Группа (2+ блокировок одной массовой операции): раскрытие/сворачивание и агрегированная
    // сводка вместо N визуально неотличимых строк.
    rulesGroupExpand: 'Развернуть группу',
    rulesGroupCollapse: 'Свернуть группу',
    rulesGroupDatesCount: (count: number) => `${count} дат`,
    rulesGroupWeekdaysCount: (count: number) => `${count} дней недели`,
    rulesSelectAll: 'Выбрать все',
    rulesSelectedCount: (count: number) => `Выбрано: ${blockingsUnitRu(count)}`,
    rulesDeleteSelected: 'Удалить выбранное',
    rulesDeleteTitle: (count: number) => `Удалить ${blockingsUnitRu(count)}?`,
    rulesDeleteBody:
      'Выбранные блокировки могут закрывать сразу много дней. После удаления эти дни снова станут доступны для брони.',
    rulesDeleteConfirm: 'Удалить',
    rulesDeleting: 'Удаляем…',
    dash: '—',

    /* ── Mutation failures (`calendarErrorMessage`) ─────────────────────────────────────────── */
    errors: {
      invalidRule: 'Блокировка заполнена неверно — проверьте даты и день недели.',
      pastDate: 'Нельзя закрывать или открывать даты задним числом.',
      tourNotFound: 'Тур не найден — обновите страницу.',
      ruleGone: 'Блокировка уже удалена — обновите страницу.',
      forbidden: (action: string) => `Не удалось ${action}: недостаточно прав.`,
      server: (action: string, status: number) =>
        `Не удалось ${action}: сервер вернул ошибку (${status}).`,
      network: (action: string) => `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
    },
    /** The verb phrase the messages above interpolate — kept as copy so no call site carries a
     * bare string of its own. */
    errorActions: {
      closeDay: 'закрыть день',
      openDay: 'открыть день',
      applyBulk: 'применить массовую операцию',
      deleteRules: 'удалить блокировки',
    },
  },
  {
    title: 'Calendar',
    subtitle: 'Day-by-day occupancy and date closures.',

    tabsLabel: 'Calendar sections',
    tabCalendar: 'Calendar',
    tabRules: 'Closures',

    months: MONTHS_NOMINATIVE.en,
    monthsGenitive: MONTHS_GENITIVE.en,
    weekdayShort: byDayCode(WEEKDAYS_SHORT.en),
    weekdayFull: byDayCode(WEEKDAYS_FULL.en),
    weekdayEvery: {
      [DayOfWeekCode.Monday]: 'every Monday',
      [DayOfWeekCode.Tuesday]: 'every Tuesday',
      [DayOfWeekCode.Wednesday]: 'every Wednesday',
      [DayOfWeekCode.Thursday]: 'every Thursday',
      [DayOfWeekCode.Friday]: 'every Friday',
      [DayOfWeekCode.Saturday]: 'every Saturday',
      [DayOfWeekCode.Sunday]: 'every Sunday',
    } as Record<DayOfWeekCode, string>,
    formatTableDate: (dateISO: string | null) => formatTableDate('en', dateISO),
    formatDateTime: (instantUtc: string) => DATE_TIME.en.format(new Date(instantUtc)),

    ordersUnit: ordersUnitEn,
    guestsUnit: guestsUnitEn,
    blockingsUnit: blockingsUnitEn,

    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    bulk: 'Bulk operations',
    monthLoading: 'Loading the month',

    gridLoadFailed: 'Could not load the month.',
    retry: 'Retry',
    legendTitle: 'Legend',
    legendClosed: 'the whole day is closed',
    legendPartial: 'individual tours are closed',
    legendOrders: 'number of orders on the day',
    closedLabel: 'closed',
    partialLabel: 'partly closed',
    tourFallback: (tourId: number) => `Tour #${tourId}`,

    availabilityTitle: 'Availability',
    availabilityHelpBody:
      'Pick no tours and the action applies to the whole day at once. Pick specific tours and it affects only those.',
    ordersTitle: 'Orders',
    closeWholeDay: 'Close the whole day (all tours)',
    openWholeDay: 'Open the whole day',
    wholeDayClosedNote: 'The whole day is closed.',
    closedByWeeklyHint:
      'The day is closed by a weekday closure — “Open” does not delete that closure, it creates an exception for this date.',
    closedToursTitle: 'Closed tours of this day',
    openTour: 'Open',
    closeTourTitle: 'Close a single tour',
    closeTourSearch: 'Search by name',
    closeTourNoResults: 'No tours found',
    closeTourAction: 'Close',
    dayAlreadyClosedHint:
      'The whole day is already closed — a closure on a single tour would change nothing.',
    pastDayLockedHint: 'A past day — it cannot be closed or opened retroactively.',
    closureReadOnlyHint: 'Your role cannot close or re-open dates — view only.',
    closureReasonLabel: 'Reason',
    noOrders: 'No orders for this day.',
    noDayData: 'No data for this day.',
    orderNumber: (number: string) => `Order #${number}`,
    statusLabels: {
      [OrderStatus.Open]: 'Open',
      [OrderStatus.Hold]: 'On hold',
      [OrderStatus.Approved]: 'Approved',
      [OrderStatus.Rejected]: 'Rejected',
      [OrderStatus.ReadyForAssignment]: 'Ready for assignment',
      [OrderStatus.PendingPayment]: 'Awaiting payment',
      [OrderStatus.Completed]: 'Completed',
    } as Record<OrderStatus, string>,

    bulkTitle: 'Bulk operations',
    bulkActionTitle: 'Action',
    bulkActionClose: 'Close dates',
    bulkActionOpen: 'Open dates (exception)',
    bulkActionOpenHint: 'Needed to open individual days inside a repeating closure.',
    bulkModeTitle: 'Kind',
    bulkModeRange: 'Date range',
    bulkModeWeekly: 'Repeat by weekday',
    bulkFrom: 'From',
    bulkTo: 'To',
    bulkWeekdaysTitle: 'Weekdays',
    bulkPeriodTitle: 'Effective (optional)',
    bulkScopeTitle: 'Scope',
    bulkScopeAll: 'All tours',
    bulkScopeSelected: 'Selected tours',
    bulkPresetAll: 'All',
    bulkPresetTours: 'Tours',
    bulkPresetExcursions: 'Excursions',
    bulkPresetByRegion: 'By region:',
    bulkResetFilters: 'Reset',
    bulkTourSearch: 'Search by name',
    bulkNoTours: 'No tours found.',
    bulkReasonTitle: 'Reason (optional)',
    bulkPreview: (count: number) => `${blockingsUnitEn(count)} will be created`,
    bulkApply: 'Apply',
    bulkApplying: 'Applying…',
    bulkCancel: 'Cancel',
    bulkConfirmTitle: 'Apply the bulk operation?',
    bulkConfirmBody: (count: number) =>
      `${blockingsUnitEn(count)} will be created. You can delete them — the whole group at once or one by one — on the “Closures” tab.`,
    bulkConfirmAction: 'Apply',

    bulkErrorRangeRequired: 'Set both ends of the range.',
    bulkErrorRangeOrder: '“From” cannot be later than “To”.',
    bulkErrorPastDate: '“From” cannot be in the past — closing dates retroactively is not allowed.',
    bulkErrorWeekdaysRequired: 'Pick at least one weekday.',
    bulkErrorReasonTooLong: 'The reason cannot be longer than 500 characters.',
    bulkErrorTooMany: (count: number, max: number) =>
      `Too many closures: ${count} against a maximum of ${max}. Narrow the range or repeat by weekday instead.`,

    rulesEmpty: 'No closures yet.',
    rulesEmptyHint: 'Create them with the “Bulk operations” button on the “Calendar” tab.',
    rulesScope: 'Scope',
    rulesType: 'Kind',
    rulesWhen: 'When',
    rulesPeriod: 'Period',
    rulesAction: 'Action',
    rulesReason: 'Reason',
    rulesAllTours: 'All tours',
    rulesManyTours: (count: number) => `${count} tours`,
    rulesTypeDate: 'Date',
    rulesTypeWeekly: 'By weekday',
    rulesActionClose: 'Closed',
    rulesActionOpen: 'Open',
    rulesPeriodRange: (from: string | null, to: string | null) =>
      `${from === null ? '…' : `from ${from}`} ${to === null ? '' : `to ${to}`}`.trim(),
    rulesSelectAria: (label: string) => `Select the closure of ${label}`,
    rulesSelectGroupAria: (count: number) => `Select the group of ${count}`,
    rulesGroupExpand: 'Expand the group',
    rulesGroupCollapse: 'Collapse the group',
    rulesGroupDatesCount: (count: number) => `${count} dates`,
    rulesGroupWeekdaysCount: (count: number) => `${count} weekdays`,
    rulesSelectAll: 'Select all',
    rulesSelectedCount: (count: number) => `Selected: ${blockingsUnitEn(count)}`,
    rulesDeleteSelected: 'Delete selected',
    rulesDeleteTitle: (count: number) => `Delete ${blockingsUnitEn(count)}?`,
    rulesDeleteBody:
      'The selected closures can cover many days at once. Once they are deleted, those days become bookable again.',
    rulesDeleteConfirm: 'Delete',
    rulesDeleting: 'Deleting…',
    dash: '—',

    errors: {
      invalidRule: 'The closure is filled in incorrectly — check the dates and the weekday.',
      pastDate: 'Dates cannot be closed or opened retroactively.',
      tourNotFound: 'The tour was not found — refresh the page.',
      ruleGone: 'The closure has already been deleted — refresh the page.',
      forbidden: (action: string) => `Could not ${action}: you do not have permission.`,
      server: (action: string, status: number) =>
        `Could not ${action}: the server returned an error (${status}).`,
      network: (action: string) => `Could not ${action}: check your connection and try again.`,
    },
    errorActions: {
      closeDay: 'close the day',
      openDay: 'open the day',
      applyBulk: 'apply the bulk operation',
      deleteRules: 'delete the closures',
    },
  },
)

export type CalendarCopy = ReturnType<typeof calendarCopy>

/** Monday-first order — the order the grid and the weekday checkboxes render in. Not translatable:
 * it is an ordering, not a caption. */
export const weekdayOrder: DayOfWeekCode[] = [
  DayOfWeekCode.Monday,
  DayOfWeekCode.Tuesday,
  DayOfWeekCode.Wednesday,
  DayOfWeekCode.Thursday,
  DayOfWeekCode.Friday,
  DayOfWeekCode.Saturday,
  DayOfWeekCode.Sunday,
]

/**
 * @param action one of `copy.errorActions` — the verb phrase the message is built around. Passed in
 *               rather than read here so a call site never spells out a bare string.
 */
export function calendarErrorMessage(copy: CalendarCopy, err: unknown, action: string): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === INVALID_CLOSURE_RULE) return copy.errors.invalidRule
    if (code === CLOSURE_DATE_IN_PAST) return copy.errors.pastDate
    if (code === TOUR_NOT_FOUND) return copy.errors.tourNotFound
    if (code === RELATIONAL_ENTITY_NOT_FOUND) return copy.errors.ruleGone
    if (err.status === 403) return copy.errors.forbidden(action)
    return copy.errors.server(action, err.status)
  }
  return copy.errors.network(action)
}

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}
