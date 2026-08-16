/**
 * Russian copy and error mapping for the Заказы screen (B12, 2026-08-13) — mirrors
 * `calendar/lib/calendarCopy.ts`'s shape and local-error-code convention.
 */

import { ApiError } from '@/shared/lib/http'

const ORDER_ACCESS_FORBIDDEN = 2019
const ORDER_NOT_FOUND = 2020
const ORDER_NOT_EDITABLE = 2021 // Confirm/Update on a non-pending order.
const TOUR_DATE_UNAVAILABLE = 2014
const ORDER_DATE_IN_PAST = 2016
const INVALID_GUEST_COUNT = 2015

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = mod100 % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export const ordersUnit = (count: number): string =>
  `${count} ${plural(count, 'заказ', 'заказа', 'заказов')}`

export const ordersCopy = {
  title: 'Заказы',
  subtitle: 'Заявки с публичного сайта — подтверждение, отмена, правка до подтверждения.',

  filterPending: 'Ждут подтверждения',
  filterConfirmed: 'Подтверждены',
  filterCancelled: 'Отменены',
  filterAll: 'Все',

  empty: 'Заказов в этом статусе нет.',

  statusPending: 'Ждёт подтверждения',
  statusConfirmed: 'Подтверждён',
  statusCancelled: 'Отменён',

  confirm: 'Подтвердить',
  cancel: 'Отменить',
  edit: 'Изменить',
  save: 'Сохранить',
  cancelEdit: 'Отмена',
  saving: 'Сохраняем…',

  cancelConfirmTitle: 'Отменить заказ?',
  cancelConfirmBody: 'Клиент увидит заказ отменённым. Действие необратимо через эту форму.',
  cancelConfirmAction: 'Отменить заказ',
  cancelConfirmDismiss: 'Не отменять',

  editDateLabel: 'Дата тура',
  editGuestsLabel: 'Гостей',

  createdLabel: 'Создан',
  confirmedLabel: 'Подтверждён',
  notConfirmedYet: 'ещё нет',

  paymentTitle: 'Оплата',
  tourPriceSnapshotLabel: 'Цена тура на момент заказа',
  totalAmountLabel: 'Итого',
  totalAmountWithDiscountLabel: 'Итого со скидкой',
  discountBadge: (percent: number) => `Скидка ${percent}%`,
  prepaidAmountLabel: 'Предоплата',
  prepaidNone: 'не внесена',
  quoteNeeded: 'Цена по запросу',
  quoteNeededHint:
    'От 7 гостей сайт не показывает автоматическую цену — сумму нужно согласовать с клиентом отдельно.',
  prepaidOf: (paid: string, total: string) => `${paid} из ${total}`,

  openClient: 'Открыть клиента',
  backToList: 'Заказы',

  tabOverview: 'Обзор',
  tabPayment: 'Оплата',
  tabClient: 'Клиент',

  clientOtherOrders: 'Другие заказы этого клиента',
  clientNoOtherOrders: 'Других заказов у этого клиента нет.',

  filtersTitle: 'Фильтры',
  filterTourLabel: 'Тур',
  filterTourAll: 'Все туры',
  filterClientLabel: 'Клиент',
  filterClientPlaceholder: 'Имя или email',
  filterIdLabel: '№ заказа',
  filterIdPlaceholder: 'Например, 42',
  filterDateFromLabel: 'Дата выезда от',
  filterDateToLabel: 'Дата выезда до',
  filtersClear: 'Сбросить фильтры',
  emptyFiltered: 'Ничего не найдено — попробуйте изменить фильтры.',

  dash: '—',
} as const

/** Money is already fixed at order time in one currency (always AMD today, ADR 014) — never
 * re-converted, so this is a plain grouping formatter, not `shared/currency/moneyFormat`'s
 * exchange-rate pipeline. */
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
    if (code === ORDER_NOT_EDITABLE) {
      return 'Заказ уже не в статусе «ждёт подтверждения» — обновите страницу.'
    }
    if (code === ORDER_NOT_FOUND) {
      return 'Заказ не найден — обновите страницу.'
    }
    if (code === ORDER_ACCESS_FORBIDDEN) {
      return 'Нет доступа к этому заказу.'
    }
    if (code === TOUR_DATE_UNAVAILABLE) {
      return 'Эта дата закрыта для брони.'
    }
    if (code === ORDER_DATE_IN_PAST) {
      return 'Дата тура не может быть в прошлом.'
    }
    if (code === INVALID_GUEST_COUNT) {
      return 'Число гостей должно быть не меньше 1.'
    }
    if (err.status === 403) {
      return `Не удалось ${action}: недостаточно прав.`
    }
    return `Не удалось ${action}: сервер вернул ошибку (${err.status}).`
  }
  return `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`
}
