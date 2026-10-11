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
import { TourType } from '@/features/admin/lib/enums'
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

/* «N изменений» рядом с тулбаром — считает всё, что лежит в черновике страницы. */
const changesUnitRu = (count: number): string =>
  `${count} ${pluralizeRu(count, ['изменение', 'изменения', 'изменений'])}`
const changesUnitEn = (count: number): string => `${count} ${pluralizeEn(count, ['change', 'changes'])}`

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
    /** Скринридер-текст синей точки на вкладке, где лежат несохранённые правки. */
    tabUnsaved: 'есть несохранённые изменения',

    /* ── Черновик страницы ──────────────────────────────────────────────────────────────────── */
    changeCount: changesUnitRu,
    /** Подсказка тултипа на выключенных кнопках тулбара (нет права). */
    noPermissionHint: 'Недостаточно прав',
    draftWillClose: 'будет закрыт',
    draftWillOpen: 'будет открыт',
    draftNew: 'новое',
    draftWillDelete: 'удалится',
    draftUndo: 'Вернуть',
    draftDiscard: 'Убрать',
    /** Часть группы в черновике — «новых: 3», «удалится: 2». */
    draftNewCount: (count: number) => `новых: ${count}`,
    draftDeleteCount: (count: number) => `удалится: ${count}`,
    /** Клетка, на которую попадает новая/удаляемая блокировка из черновика — исход зависит от
     * приоритетов правил, поэтому говорим только «затронут», а не «закрыт/открыт». */
    draftCellTouched: 'затронут блокировками из черновика',
    /** Подпись клетки: «будет закрыт: Севан, Гарни». */
    draftCellWillClose: (what: string) => `будет закрыт: ${what}`,
    draftCellWillOpen: (what: string) => `будет открыт: ${what}`,
    draftCellWholeDay: 'весь день',
    legendDraftClose: 'будет закрыт (черновик)',
    legendDraftOpen: 'будет открыт (черновик)',
    legendDraftRules: 'затронут блокировкой из черновика',
    partialSaved: 'Часть изменений сохранена, остальные остались в черновике.',

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
    monthLoading: 'Загружаем месяц',

    /* ── Grid ───────────────────────────────────────────────────────────────────────────────── */
    gridLoadFailed: 'Не удалось загрузить месяц.',
    retry: 'Повторить',
    legendTitle: 'Обозначения',
    legendClosed: 'день закрыт целиком',
    legendPartial: 'закрыты отдельные продукты',
    legendPartialTypes: 'закрыт целый тип продукта',
    legendOrders: 'число заказов на день',
    closedLabel: 'закрыто',
    partialLabel: 'частично закрыто',

    /* ── Тип продукта как область правила (решение 0.27) ─────────────────────────────────────── */
    /** Множественное число — область адресует КАТЕГОРИЮ, а не один продукт, поэтому подписи свои,
     * а не `adminEnumsCopy.tourType` (там единственное число: «Трансфер»). */
    productTypePlural: {
      [TourType.Tour]: 'Туры',
      [TourType.Excursion]: 'Экскурсии',
      [TourType.Transfer]: 'Трансферы',
    } as Record<TourType, string>,
    /** Область правила в таблице и в подписи клетки: «Все трансферы». */
    productTypeScope: {
      [TourType.Tour]: 'Все туры',
      [TourType.Excursion]: 'Все экскурсии',
      [TourType.Transfer]: 'Все трансферы',
    } as Record<TourType, string>,
    /** Тип, которого нет в словаре (бэк добавил четвёртый раньше фронта) — лучше номер, чем пусто. */
    productTypeFallback: (tourType: number) => `Тип #${tourType}`,
    /** Подпись клетки дня: «закрыты трансферы», «закрыты трансферы, экскурсии». */
    closedTypesLabel: (types: string) => `закрыты ${types.toLowerCase()}`,
    /** An archived tour whose orders live on — a blank name would look like a broken calendar. */
    tourFallback: (tourId: number) => `Тур #${tourId}`,

    /* ── Day panel ──────────────────────────────────────────────────────────────────────────── */
    availabilityTitle: 'Доступность',
    availabilityHelpBody:
      'Галочки меняют черновик страницы — на сервер ничего не уходит, пока вы не нажмёте «Сохранить» вверху. Можно закрыть день целиком, целый тип продукта (например, только трансферы — тогда блокировка будет действовать и на продукты, которые вы заведёте позже) или конкретные продукты. Блокировка на отдельный продукт сильнее блокировки по типу: чтобы оставить один трансфер открытым при закрытых трансферах, добавьте на него исключение через «Добавить» — действие «Открыть даты».',
    ordersTitle: 'Заказы',
    /* Тип продукта как область (решение 0.27) — своя секция рядом с продуктовой. */
    wholeDayLabel: 'День закрыт целиком (все продукты)',
    typesTitle: 'Типы продуктов',
    productsTitle: 'Продукты',
    closedByWeeklyHint:
      'День закрыт блокировкой по дню недели — снятие галочки не удалит эту блокировку, а создаст исключение на эту дату.',
    closeTourSearch: 'Поиск по названию',
    closeTourNoResults: 'Продукты не найдены',
    dayAlreadyClosedHint:
      'День уже закрыт целиком — отдельная блокировка на продукт или тип ничего не изменит.',
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
      [OrderStatus.Request]: 'Заявка',
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
    bulkScopeAll: 'Все продукты',
    bulkScopeTypes: 'Тип продукта',
    bulkScopeSelected: 'Выбранные продукты',
    bulkScopeHelp:
      'Область определяет, на что подействует блокировка. «Все продукты» — одна блокировка на дату для всего каталога. «Тип продукта» — на все продукты этого типа, включая те, которые вы заведёте позже. «Выбранные продукты» — только на перечисленные; продукт, созданный завтра, под такую блокировку не попадёт.',
    bulkTypesTitle: 'Типы продуктов',
    bulkPresetByRegion: 'По региону:',
    bulkResetFilters: 'Сбросить',
    bulkTourSearch: 'Поиск по названию',
    bulkNoTours: 'Продукты не найдены.',
    bulkReasonTitle: 'Причина (необязательно)',
    bulkPreview: (count: number) => `Будет создано ${blockingsUnitRu(count)}`,
    /** Правила уходят в черновик страницы, а не на сервер — как «Добавить строку» в заказе. */
    bulkApply: 'Добавить в черновик',
    bulkClose: 'Закрыть',

    /* ── Bulk validation (returned by `compileBulkForm`) ────────────────────────────────────── */
    bulkErrorRangeRequired: 'Укажите обе границы диапазона.',
    bulkErrorRangeOrder: 'Дата «С» не может быть позже даты «По».',
    bulkErrorPastDate: 'Дата «С» не может быть в прошлом — задним числом закрывать нельзя.',
    bulkErrorWeekdaysRequired: 'Выберите хотя бы один день недели.',
    bulkErrorTypesRequired: 'Выберите хотя бы один тип продукта.',
    bulkErrorProductsRequired: 'Выберите хотя бы один продукт.',
    bulkErrorReasonTooLong: 'Причина не может быть длиннее 500 символов.',
    bulkErrorTooMany: (count: number, max: number) =>
      `Слишком много блокировок: ${count} при максимуме ${max}. Сузьте диапазон или выберите повтор по дням недели.`,

    /* ── Rules tab ──────────────────────────────────────────────────────────────────────────── */
    rulesEmpty: 'Блокировок пока нет.',
    rulesEmptyHint: 'Создать их можно кнопкой «Добавить» вверху страницы.',
    rulesScope: 'Область',
    rulesType: 'Тип',
    rulesWhen: 'Когда',
    rulesPeriod: 'Период',
    rulesAction: 'Действие',
    rulesReason: 'Причина',
    rulesAllTours: 'Все продукты',
    rulesManyTours: (count: number) => `${count} продуктов`,
    /** Батч смешал разные области (например, тип + отдельные продукты) — точнее назвать число,
     * чем выбирать одну из них и врать про остальные. */
    rulesManyScopes: (count: number) => `${count} областей`,
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
    tabUnsaved: 'has unsaved changes',

    changeCount: changesUnitEn,
    noPermissionHint: 'Not enough permissions',
    draftWillClose: 'will be closed',
    draftWillOpen: 'will be opened',
    draftNew: 'new',
    draftWillDelete: 'will be deleted',
    draftUndo: 'Restore',
    draftDiscard: 'Remove',
    draftNewCount: (count: number) => `new: ${count}`,
    draftDeleteCount: (count: number) => `to delete: ${count}`,
    draftCellTouched: 'affected by closures from the draft',
    draftCellWillClose: (what: string) => `will be closed: ${what}`,
    draftCellWillOpen: (what: string) => `will be opened: ${what}`,
    draftCellWholeDay: 'the whole day',
    legendDraftClose: 'will be closed (draft)',
    legendDraftOpen: 'will be opened (draft)',
    legendDraftRules: 'affected by a closure from the draft',
    partialSaved: 'Some changes were saved, the rest stayed in the draft.',

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
    monthLoading: 'Loading the month',

    gridLoadFailed: 'Could not load the month.',
    retry: 'Retry',
    legendTitle: 'Legend',
    legendClosed: 'the whole day is closed',
    legendPartial: 'individual products are closed',
    legendPartialTypes: 'a whole product type is closed',
    legendOrders: 'number of orders on the day',
    closedLabel: 'closed',
    partialLabel: 'partly closed',

    productTypePlural: {
      [TourType.Tour]: 'Tours',
      [TourType.Excursion]: 'Excursions',
      [TourType.Transfer]: 'Transfers',
    } as Record<TourType, string>,
    productTypeScope: {
      [TourType.Tour]: 'All tours',
      [TourType.Excursion]: 'All excursions',
      [TourType.Transfer]: 'All transfers',
    } as Record<TourType, string>,
    productTypeFallback: (tourType: number) => `Type #${tourType}`,
    closedTypesLabel: (types: string) => `${types.toLowerCase()} are closed`,
    tourFallback: (tourId: number) => `Tour #${tourId}`,

    availabilityTitle: 'Availability',
    availabilityHelpBody:
      'The checkboxes change the page draft — nothing is sent to the server until you press “Save” at the top. You can close the whole day, a whole product type (transfers only, say — the closure then also covers products you create later) or specific products. A closure on a single product beats one on its type: to keep one transfer open while transfers are closed, add an exception for it via “Add” — the “Open dates” action.',
    ordersTitle: 'Orders',
    wholeDayLabel: 'The whole day is closed (all products)',
    typesTitle: 'Product types',
    productsTitle: 'Products',
    closedByWeeklyHint:
      'The day is closed by a weekday closure — unticking does not delete that closure, it creates an exception for this date.',
    closeTourSearch: 'Search by name',
    closeTourNoResults: 'No products found',
    dayAlreadyClosedHint:
      'The whole day is already closed — a closure on a single product or type would change nothing.',
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
      [OrderStatus.Request]: 'Request',
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
    bulkScopeAll: 'All products',
    bulkScopeTypes: 'Product type',
    bulkScopeSelected: 'Selected products',
    bulkScopeHelp:
      'The scope decides what the closure affects. “All products” — one closure per date for the whole catalogue. “Product type” — every product of that type, including the ones you create later. “Selected products” — only the listed ones; a product created tomorrow is not covered.',
    bulkTypesTitle: 'Product types',
    bulkPresetByRegion: 'By region:',
    bulkResetFilters: 'Reset',
    bulkTourSearch: 'Search by name',
    bulkNoTours: 'No products found.',
    bulkReasonTitle: 'Reason (optional)',
    bulkPreview: (count: number) => `${blockingsUnitEn(count)} will be created`,
    bulkApply: 'Add to draft',
    bulkClose: 'Close',

    bulkErrorRangeRequired: 'Set both ends of the range.',
    bulkErrorRangeOrder: '“From” cannot be later than “To”.',
    bulkErrorPastDate: '“From” cannot be in the past — closing dates retroactively is not allowed.',
    bulkErrorWeekdaysRequired: 'Pick at least one weekday.',
    bulkErrorTypesRequired: 'Pick at least one product type.',
    bulkErrorProductsRequired: 'Pick at least one product.',
    bulkErrorReasonTooLong: 'The reason cannot be longer than 500 characters.',
    bulkErrorTooMany: (count: number, max: number) =>
      `Too many closures: ${count} against a maximum of ${max}. Narrow the range or repeat by weekday instead.`,

    rulesEmpty: 'No closures yet.',
    rulesEmptyHint: 'Create them with the “Add” button at the top of the page.',
    rulesScope: 'Scope',
    rulesType: 'Kind',
    rulesWhen: 'When',
    rulesPeriod: 'Period',
    rulesAction: 'Action',
    rulesReason: 'Reason',
    rulesAllTours: 'All products',
    rulesManyTours: (count: number) => `${count} products`,
    rulesManyScopes: (count: number) => `${count} scopes`,
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
