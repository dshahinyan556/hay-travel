/**
 * Russian copy and error mapping for the Календарь screen. The admin panel is Russian-only by
 * design (`Hay Travel/CLAUDE.md`), so this mirrors `users/lib/userCopy.ts` rather than going
 * through the public site's i18n dictionary.
 */

import { ApiError } from '@/shared/lib/http'
import { DayOfWeekCode } from '@/shared/types/booking'

/** `GlobalErrorCode` values this screen's mutations can report (spec 001 §7) — local numeric
 * constants, the established admin convention (see `userCopy.ts`/`catalogErrors.ts`). */
const RELATIONAL_ENTITY_NOT_FOUND = 2003 // DeleteRule — the rule is already gone.
const TOUR_NOT_FOUND = 2004 // CreateRules — a rule points at a tour that no longer exists.
const INVALID_CLOSURE_RULE = 2017 // CreateRules — the rule's shape is wrong.
const CLOSURE_DATE_IN_PAST = 2022 // CreateRules — backdating is forbidden everywhere (B12).

/** Russian plural agreement: 1 заказ / 2 заказа / 5 заказов. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = mod100 % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/* Declared outside `calendarCopy` because the object references them — a self-reference inside an
   object literal would leave it with an inferred `any`. */
export const ordersUnit = (count: number): string =>
  `${count} ${plural(count, 'заказ', 'заказа', 'заказов')}`
export const guestsUnit = (count: number): string =>
  `${count} ${plural(count, 'гость', 'гостя', 'гостей')}`
export const rulesUnit = (count: number): string =>
  `${count} ${plural(count, 'правило', 'правила', 'правил')}`

export const calendarCopy = {
  title: 'Календарь',
  subtitle: 'Занятость по дням и правила закрытия дат.',

  tabsLabel: 'Разделы календаря',
  tabCalendar: 'Календарь',
  tabRules: 'Правила',

  /* ── Toolbar ────────────────────────────────────────────────────────────────────────────── */
  prevMonth: 'Предыдущий месяц',
  nextMonth: 'Следующий месяц',
  today: 'Сегодня',
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

  /* ── Day panel ──────────────────────────────────────────────────────────────────────────── */
  availabilityTitle: 'Доступность',
  ordersTitle: 'Заказы',
  closeWholeDay: 'Закрыть весь день (все туры)',
  closedByWeeklyHint:
    'День закрыт правилом по дню недели — снятие галочки не удалит это правило, а создаст исключение на эту дату.',
  closedToursTitle: 'Закрытые туры этого дня',
  openTour: 'Открыть',
  closeTourTitle: 'Закрыть отдельный тур',
  closeTourSearch: 'Поиск по названию',
  closeTourNoResults: 'Туры не найдены',
  closeTourAction: 'Закрыть',
  dayAlreadyClosedHint: 'День уже закрыт целиком — отдельное правило на тур ничего не изменит.',
  pastDayLockedHint: 'Прошедший день — задним числом закрывать или открывать нельзя.',
  closureReasonLabel: 'Причина',
  noOrders: 'Заказов на этот день нет.',
  noDayData: 'Нет данных за этот день.',
  statusConfirmed: 'Подтверждён',
  statusPending: 'Ждёт подтверждения',
  statusCancelled: 'Отменён',

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
  bulkTourSearch: 'Поиск по названию',
  bulkNoTours: 'Туры не найдены.',
  bulkReasonTitle: 'Причина (необязательно)',
  bulkPreview: (count: number) => `Будет создано ${rulesUnit(count)}`,
  bulkApply: 'Применить',
  bulkApplying: 'Применяем…',
  bulkCancel: 'Отмена',
  bulkConfirmTitle: 'Применить массовую операцию?',
  bulkConfirmBody: (count: number) =>
    `Будет создано ${rulesUnit(count)}. Удалять их придётся по одному — на вкладке «Правила».`,
  bulkConfirmAction: 'Применить',

  /* ── Bulk validation (returned by `compileBulkForm`) ────────────────────────────────────── */
  bulkErrorRangeRequired: 'Укажите обе границы диапазона.',
  bulkErrorRangeOrder: 'Дата «С» не может быть позже даты «По».',
  bulkErrorPastDate: 'Дата «С» не может быть в прошлом — задним числом закрывать нельзя.',
  bulkErrorWeekdaysRequired: 'Выберите хотя бы один день недели.',
  bulkErrorReasonTooLong: 'Причина не может быть длиннее 500 символов.',
  bulkErrorTooMany: (count: number, max: number) =>
    `Слишком много правил: ${count} при максимуме ${max}. Сузьте диапазон или выберите повтор по дням недели.`,

  /* ── Rules tab ──────────────────────────────────────────────────────────────────────────── */
  rulesEmpty: 'Правил закрытия пока нет.',
  rulesEmptyHint: 'Создать их можно кнопкой «Массовые операции» на вкладке «Календарь».',
  rulesScope: 'Область',
  rulesType: 'Тип',
  rulesWhen: 'Когда',
  rulesPeriod: 'Период',
  rulesAction: 'Действие',
  rulesReason: 'Причина',
  rulesAllTours: 'Все туры',
  rulesTypeDate: 'Дата',
  rulesTypeWeekly: 'По дню недели',
  rulesActionClose: 'Закрыто',
  rulesActionOpen: 'Открыто',
  rulesDelete: 'Удалить',
  rulesDeleteTitle: 'Удалить правило?',
  rulesDeleteBody:
    'Правило может закрывать сразу много дней. После удаления эти дни снова станут доступны для брони.',
  rulesDeleteConfirm: 'Удалить',
  rulesDeleting: 'Удаляем…',
  dash: '—',
} as const

/** Short weekday captions, keyed by `System.DayOfWeek` (Sunday = 0). */
export const weekdayLabels: Record<DayOfWeekCode, string> = {
  [DayOfWeekCode.Monday]: 'Пн',
  [DayOfWeekCode.Tuesday]: 'Вт',
  [DayOfWeekCode.Wednesday]: 'Ср',
  [DayOfWeekCode.Thursday]: 'Чт',
  [DayOfWeekCode.Friday]: 'Пт',
  [DayOfWeekCode.Saturday]: 'Сб',
  [DayOfWeekCode.Sunday]: 'Вс',
}

export const weekdayLabelsFull: Record<DayOfWeekCode, string> = {
  [DayOfWeekCode.Monday]: 'понедельник',
  [DayOfWeekCode.Tuesday]: 'вторник',
  [DayOfWeekCode.Wednesday]: 'среда',
  [DayOfWeekCode.Thursday]: 'четверг',
  [DayOfWeekCode.Friday]: 'пятница',
  [DayOfWeekCode.Saturday]: 'суббота',
  [DayOfWeekCode.Sunday]: 'воскресенье',
}

/** "каждый понедельник" needs the accusative-ish masculine/feminine agreement Russian expects. */
export const weekdayLabelsEvery: Record<DayOfWeekCode, string> = {
  [DayOfWeekCode.Monday]: 'каждый понедельник',
  [DayOfWeekCode.Tuesday]: 'каждый вторник',
  [DayOfWeekCode.Wednesday]: 'каждую среду',
  [DayOfWeekCode.Thursday]: 'каждый четверг',
  [DayOfWeekCode.Friday]: 'каждую пятницу',
  [DayOfWeekCode.Saturday]: 'каждую субботу',
  [DayOfWeekCode.Sunday]: 'каждое воскресенье',
}

/** Monday-first order — the order the grid and the weekday checkboxes render in. */
export const weekdayOrder: DayOfWeekCode[] = [
  DayOfWeekCode.Monday,
  DayOfWeekCode.Tuesday,
  DayOfWeekCode.Wednesday,
  DayOfWeekCode.Thursday,
  DayOfWeekCode.Friday,
  DayOfWeekCode.Saturday,
  DayOfWeekCode.Sunday,
]

/** Nominative — toolbar headings ("Август 2026"). */
export const monthLabels: string[] = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/** Genitive — inside a full date ("12 августа 2026"), where the nominative reads wrong. */
export const monthLabelsGenitive: string[] = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export function calendarErrorMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === INVALID_CLOSURE_RULE) {
      return 'Правило заполнено неверно — проверьте даты и день недели.'
    }
    if (code === CLOSURE_DATE_IN_PAST) {
      return 'Нельзя закрывать или открывать даты задним числом.'
    }
    if (code === TOUR_NOT_FOUND) {
      return 'Тур не найден — обновите страницу.'
    }
    if (code === RELATIONAL_ENTITY_NOT_FOUND) {
      return 'Правило уже удалено — обновите страницу.'
    }
    if (err.status === 403) {
      return `Не удалось ${action}: недостаточно прав.`
    }
    return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
  }
  return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
}

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}
