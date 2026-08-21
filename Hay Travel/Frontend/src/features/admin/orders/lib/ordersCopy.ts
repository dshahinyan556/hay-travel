/**
 * Russian copy and error mapping for the Заказы screen (ADR 019 redesign, 2026-08-16) — mirrors
 * `calendar/lib/calendarCopy.ts`'s shape and local-error-code convention.
 */

import { ApiError } from '@/shared/lib/http'
import { OrderEventType, OrderStatus } from '@/shared/types/booking'

/** `GlobalErrorCode` values this screen's mutations can report. Local numeric constants, same
 * convention `userCopy.ts`/`catalogErrors.ts` follow. */
const TOUR_DATE_UNAVAILABLE = 2014
const INVALID_GUEST_COUNT = 2015
const ORDER_DATE_IN_PAST = 2016
const ORDER_ACCESS_FORBIDDEN = 2019
const ORDER_NOT_FOUND = 2020
const ORDER_NOT_EDITABLE = 2021
const ORDER_LINE_NOT_FOUND = 2026
const USER_IS_NOT_EMPLOYEE = 2027
const ORDER_MUST_HAVE_AT_LEAST_ONE_LINE = 2028

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = mod100 % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export const ordersUnit = (count: number): string => `${count} ${plural(count, 'заказ', 'заказа', 'заказов')}`
export const lineUnit = (count: number): string => `${count} ${plural(count, 'строка', 'строки', 'строк')}`

export const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.Open]: 'Открыт',
  [OrderStatus.Hold]: 'На удержании',
  [OrderStatus.Approved]: 'Одобрен',
  [OrderStatus.Rejected]: 'Отклонён',
  [OrderStatus.ReadyForAssignment]: 'Готов к назначению',
  [OrderStatus.PendingPayment]: 'Ждёт оплаты',
  [OrderStatus.Completed]: 'Завершён',
}

export const statusClasses: Record<OrderStatus, string> = {
  [OrderStatus.Open]: 'bg-amber-50 text-amber-700',
  [OrderStatus.Hold]: 'bg-neutral-100 text-neutral-500',
  [OrderStatus.Approved]: 'bg-emerald-50 text-emerald-700',
  [OrderStatus.Rejected]: 'bg-rose-50 text-rose-700',
  [OrderStatus.ReadyForAssignment]: 'bg-sky-50 text-sky-700',
  [OrderStatus.PendingPayment]: 'bg-amber-50 text-amber-700',
  [OrderStatus.Completed]: 'bg-brand-50 text-brand-800',
}

/** Maps `OrderStatus` to `OrderStatusBadge`'s `tone` (checklist §4 — the badge itself has no
 * knowledge of `OrderStatus`, so the page supplies this). `Approved`/`Completed` read as settled
 * (`strong`, solid black), `Rejected` reads as cold (`muted`), everything else is plain `neutral`. */
export const statusBadgeTone: Record<OrderStatus, 'neutral' | 'strong' | 'muted'> = {
  [OrderStatus.Open]: 'neutral',
  [OrderStatus.Hold]: 'muted',
  [OrderStatus.Approved]: 'strong',
  [OrderStatus.Rejected]: 'muted',
  [OrderStatus.ReadyForAssignment]: 'neutral',
  [OrderStatus.PendingPayment]: 'neutral',
  [OrderStatus.Completed]: 'strong',
}

/** Status filter/`Select` options, in the order they should list — not `Object.values` order,
 * which would follow the enum's declaration order (fine here, kept explicit for readability). */
export const STATUS_ORDER: OrderStatus[] = [
  OrderStatus.Open,
  OrderStatus.PendingPayment,
  OrderStatus.Hold,
  OrderStatus.Approved,
  OrderStatus.ReadyForAssignment,
  OrderStatus.Rejected,
  OrderStatus.Completed,
]

/** Small grey tag pill next to each "История" row — the mockup's §D "тип события". Purely a
 * visual category label; the sentence itself is `event.description` (server-built, verbatim). */
export const eventTypeTagLabels: Record<OrderEventType, string> = {
  [OrderEventType.Created]: 'создание',
  [OrderEventType.StatusChanged]: 'статус',
  [OrderEventType.Updated]: 'бронь',
  [OrderEventType.LineAdded]: 'строка',
  [OrderEventType.LineRemoved]: 'строка',
  [OrderEventType.LineUpdated]: 'строка',
  [OrderEventType.EmployeeAssigned]: 'назначение',
  [OrderEventType.SentToClient]: 'письмо',
  [OrderEventType.PaymentAdded]: 'оплата',
}

export const ordersCopy = {
  title: 'Заказы',
  subtitle: 'Заявки с публичного сайта и заказы, оформленные вручную.',

  filterAll: 'Все',
  empty: 'Заказов в этом статусе нет.',
  emptyFiltered: 'Ничего не найдено — попробуйте изменить фильтры.',

  filterTourLabel: 'Тур',
  filterTourAll: 'Все туры',
  filterClientLabel: 'Клиент',
  filterClientPlaceholder: 'Имя или email',
  filterNumberLabel: '№ заказа',
  filterNumberPlaceholder: 'Например, 160826-0007',
  filterDateFromLabel: 'Дата тура от',
  filterDateToLabel: 'Дата тура до',
  filtersClear: 'Сбросить фильтры',

  backToList: 'Заказы',
  orderTitle: (number: string) => `Заказ №${number}`,
  createdLabel: 'Создан',
  approvedLabel: 'Одобрен',
  notApprovedYet: 'ещё нет',
  openClient: 'Открыть профиль',

  statusFieldLabel: 'Статус',
  rejectReasonLabel: 'Причина отказа',
  rejectReasonPlaceholder: 'Необязательно',

  tabOverview: 'Обзор',
  tabPayment: 'Оплата',
  tabFulfillment: 'Детали для выполнения',
  tabHistory: 'История',

  actionsLabel: (number: string) => `Дополнительные действия по заказу №${number}`,
  actionDelete: 'Удалить заказ',
  sendToClientSent: 'Письмо клиенту отправлено.',

  // Contextual action row next to AdminToolbar (checklist §5) — thin wrappers over existing
  // endpoints (SetStatus/AssignEmployee/SendToClient), no new status values introduced.
  actionApprove: 'Одобрить',
  actionApprovePending: 'Одобряем…',
  actionReject: 'Отклонить',
  actionRejectPending: 'Отклоняем…',
  actionAssign: 'Назначить исполнителя',
  actionSendToClientLabel: 'Отправить заказ клиенту',
  actionSendToClientPending: 'Отправляем…',
  actionSendToEmployees: 'Отправить заказ исполнителям',
  actionSendToEmployeesPending: 'Отправляем…',
  actionSendToEmployeesHint: 'Сначала назначьте исполнителя хотя бы на одну строку.',
  actionSendToEmployeesSent: 'Письмо исполнителям отправлено повторно.',

  // "Сохранить перед отправкой?" — SendToClient/SendToEmployees don't save the draft themselves
  // (checklist §5); with unsaved changes they ask first, so the PDF/email reflect saved data.
  saveBeforeSendTitle: 'Сохранить перед отправкой?',
  saveBeforeSendBody: 'В заказе есть несохранённые изменения — письмо должно уйти с актуальными данными.',
  saveBeforeSendConfirm: 'Сохранить и отправить',
  saveBeforeSendCancel: 'Отмена',

  // "Назначить исполнителя" popup (checklist §5) — 3 buttons, replaces the old bulk-only modal.
  assignAllTitle: 'Назначить исполнителя',
  assignAllBody: 'Выбранный сотрудник будет назначен на каждую строку заказа.',
  assignFieldLabel: 'Сотрудник',
  assignPlaceholder: 'Выберите сотрудника…',
  assignSubmitSilent: 'Назначить',
  assignSubmitAndSend: 'Назначить и отправить письмо',
  assignCancel: 'Отмена',
  noEmployees: 'В системе нет ни одного пользователя с ролью «Исполнитель».',

  // Add → client-only blank draft (checklist §3) — no real creation yet.
  newDraftBanner: 'Новый заказ — черновик. Сохранение появится в отдельной задаче.',
  newDraftSaveHint: 'Создание заказа из этого экрана появится в будущей задаче.',
  newDraftOrderNumber: 'новый',
  newDraftClientPlaceholder: 'Клиент не выбран',

  // Whole-page overlay while a heavy operation (PDF + email) is in flight (checklist §8).
  heavyOpOverlay: 'Формируем PDF и отправляем письмо — это может занять несколько секунд…',

  // "История" tab (checklist §7) — pure readonly timeline.
  historyEmptyTitle: 'Событий пока нет',
  historyEmptyBody: 'Здесь появятся изменения статуса, назначения и платежи по этому заказу.',
  historyAuthorLabel: 'Автор',
  historySystemActor: 'Система',

  deleteConfirmTitle: 'Удалить заказ?',
  deleteConfirmBody: 'Заказ и все его строки/платежи будут удалены безвозвратно.',
  deleteConfirmAction: 'Удалить заказ',
  deleteConfirmDismiss: 'Не удалять',

  linesTitle: 'Строки заказа',
  colProduct: 'Тур',
  colDate: 'Дата',
  colGuests: 'Гостей',
  colEmployee: 'Исполнитель',
  colPrepayment: 'Предоплата',
  colPrice: 'Цена',
  colDiscount: 'Скидка',
  colTotal: 'Итого',
  employeeUnassigned: 'Не назначен',
  addLine: 'Добавить строку',
  removeLine: 'Удалить строку',
  removeLineSelected: (count: number) => `Удалить (${count})`,

  addLineTitle: 'Новая строка заказа',
  fieldTour: 'Тур',
  fieldTourPlaceholder: 'Выберите тур…',
  fieldDate: 'Дата тура',
  fieldGuests: 'Гостей',
  fieldRequiresPrepayment: 'Требуется предоплата',
  fieldPrepaymentAmount: 'Сумма предоплаты',
  addLineSubmit: 'Добавить',
  addLineCancel: 'Отмена',

  discountBadge: (percent: number) => `−${percent}%`,

  paymentsEmpty: 'Проводок по этой строке ещё нет.',
  addPayment: 'Добавить проводку',
  paymentTypeLabel: 'Тип',
  paymentTypePrepayment: 'Предоплата',
  paymentTypePayment: 'Оплата',
  paymentAmountLabel: 'Сумма',
  paymentSubmit: 'Добавить',
  paymentCancel: 'Отмена',
  linePrepaymentRequired: (amount: string) => `Требуется предоплата: ${amount}`,
  linePrepaymentNotRequired: 'Предоплата не требуется',

  fulfillmentPickupLabel: 'Где забрать клиента',
  fulfillmentPickupPlaceholder: 'Например, у входа в отель «Армения», 09:00',
  fulfillmentNavigatorLabel: 'Ссылка на навигатор',
  fulfillmentNavigatorPlaceholder: 'https://maps.google.com/…',
  fulfillmentSave: 'Сохранить',
  fulfillmentSaved: 'Сохранено.',
  fulfillmentAssignAndSend: 'Назначить и отправить',
  fulfillmentAssignAndSendHint: 'Сначала выберите исполнителя строки в разделе «Обзор».',
  fulfillmentSent: 'Письмо исполнителю отправлено.',

  save: 'Сохранить',
  saving: 'Сохраняем…',
  cancelEdit: 'Отмена',

  dash: '—',
} as const

/** Money is fixed per-line at order/add-line time (ADR 019) — never re-converted, so this is a
 * plain grouping formatter, not `shared/currency/moneyFormat`'s exchange-rate pipeline. */
export function formatOrderMoney(amount: number, currency: string): string {
  const digits = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)
  return `${digits} ${currency}`
}

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

export function ordersErrorMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === ORDER_NOT_EDITABLE) return 'Заказ уже нельзя редактировать в этом статусе — обновите страницу.'
    if (code === ORDER_NOT_FOUND) return 'Заказ не найден — обновите страницу.'
    if (code === ORDER_LINE_NOT_FOUND) return 'Строка заказа не найдена — обновите страницу.'
    if (code === ORDER_ACCESS_FORBIDDEN) return 'Нет доступа к этому заказу.'
    if (code === ORDER_MUST_HAVE_AT_LEAST_ONE_LINE) return 'Нельзя удалить последнюю строку заказа — удалите весь заказ.'
    if (code === USER_IS_NOT_EMPLOYEE) return 'У выбранного пользователя нет роли «Исполнитель».'
    if (code === TOUR_DATE_UNAVAILABLE) return 'Эта дата закрыта для брони.'
    if (code === ORDER_DATE_IN_PAST) return 'Дата тура не может быть в прошлом.'
    if (code === INVALID_GUEST_COUNT) return 'Число гостей должно быть не меньше 1.'
    if (err.status === 403) return `Не удалось ${action}: недостаточно прав.`
    return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
  }
  return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
}
