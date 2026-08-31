/**
 * Как заказ читается клиентом: подписи статусов, их «вес», даты и подпись исполнителя
 * (раздел «Мои заказы», батч 2026-08-29).
 *
 * ── Почему это копия админской карты, а не импорт ────────────────────────────────────────────
 * `features/admin/orders/lib/ordersCopy.ts` держит ровно ту же `statusBadgeTone`, и повторять её
 * неприятно. Импортировать её сюда нельзя по двум независимым причинам, и обе сильнее неудобства
 * дубля: `features/auth` не имеет права зависеть от `features/admin` (ни один модуль проекта так
 * не делает), а тот модуль тянет за собой весь админский `defineCopy`-словарь заказов — он уехал
 * бы в бандл каждого посетителя публичного сайта.
 *
 * Значения обязаны совпадать с админскими: клиент и менеджер должны видеть один и тот же объект
 * в одном и том же «весе». Меняя тон статуса там — поменяйте и здесь.
 *
 * Подписи статусов — НЕ копия: админские живут в `ordersCopy`, публичные в общем словаре, и
 * формулировки у них разные по адресату («Готов к назначению» — это фраза для менеджера, но
 * клиенту она тоже честно говорит, на каком этапе его заказ).
 */

import type { TranslationKey } from '@/shared/i18n/dictionary'
import type { Locale } from '@/shared/lib/locale'
import { parseISODate, parseUtcTimestamp } from '@/shared/lib/date'
import { OrderStatus } from '@/shared/types/booking'
import type { OrderInfoModel, OrderLineInfoModel } from '@/shared/types/booking'
import { EmployeeJobRole } from '@/shared/types/employeeRole'

export type OrderStatusTone = 'neutral' | 'strong' | 'muted'

/** Зеркало `statusBadgeTone` из админки — см. заголовок модуля. */
export const ORDER_STATUS_TONE: Record<OrderStatus, OrderStatusTone> = {
  [OrderStatus.Open]: 'neutral',
  [OrderStatus.Hold]: 'muted',
  [OrderStatus.Approved]: 'strong',
  [OrderStatus.Rejected]: 'muted',
  [OrderStatus.ReadyForAssignment]: 'neutral',
  [OrderStatus.PendingPayment]: 'neutral',
  [OrderStatus.Completed]: 'strong',
  [OrderStatus.Request]: 'neutral',
}

export const ORDER_STATUS_LABEL_KEY: Record<OrderStatus, TranslationKey> = {
  [OrderStatus.Open]: 'account.orders.statusOpen',
  [OrderStatus.Hold]: 'account.orders.statusHold',
  [OrderStatus.Approved]: 'account.orders.statusApproved',
  [OrderStatus.Rejected]: 'account.orders.statusRejected',
  [OrderStatus.ReadyForAssignment]: 'account.orders.statusReadyForAssignment',
  [OrderStatus.PendingPayment]: 'account.orders.statusPendingPayment',
  [OrderStatus.Completed]: 'account.orders.statusCompleted',
  [OrderStatus.Request]: 'account.orders.statusRequest',
}

export const EMPLOYEE_ROLE_LABEL_KEY: Record<EmployeeJobRole, TranslationKey> = {
  [EmployeeJobRole.Driver]: 'account.orders.roleDriver',
  [EmployeeJobRole.Guide]: 'account.orders.roleGuide',
  [EmployeeJobRole.DriverGuide]: 'account.orders.roleDriverGuide',
}

/** По одному формату на локаль, построенному один раз: `Intl.DateTimeFormat` дорог в
 * конструировании, а список форматирует по дате на каждую строку каждого заказа. */
const DAY_FORMAT: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
}

/**
 * `createdAtUtc` (мгновение) → календарный день в часовом поясе посетителя.
 *
 * Без времени: «создан 29.08.2026» отвечает на вопрос «когда это было», а минуты оформления
 * клиенту не нужны ни разу. Неразбираемое значение отдаётся как есть — строка со странной датой
 * лучше, чем «Invalid Date» посреди списка.
 */
export function formatOrderCreatedDate(value: string, locale: Locale): string {
  const date = parseUtcTimestamp(value)
  return date === null ? value : DAY_FORMAT[locale].format(date)
}

/**
 * `tourDate` (`YYYY-MM-DD`, календарный день без пояса) → `30.08.2026`.
 *
 * Через `parseISODate`, а не `new Date(value)`: второй разбирает строку как полночь UTC и в
 * любом поясе западнее Гринвича показал бы предыдущий день (см. `shared/lib/date.ts`).
 */
export function formatLineDate(value: string, locale: Locale): string {
  const date = parseISODate(value)
  return date === null ? value : DAY_FORMAT[locale].format(date)
}

/** `"09:00:00"` → `09:00`. Секунды на экране бессмысленны, а `Intl` здесь не нужен: это уже
 * настенное время без пояса, ровно то, которое видел клиент при бронировании. */
export function formatLineTime(value: string | null): string | null {
  if (!value) return null
  return value.slice(0, 5)
}

/**
 * Заявка без цены: кастомный трансфер, который менеджер ещё считает.
 *
 * Проверяются ОБА условия. Только статус мало: как только менеджер проставит сумму, заявка
 * останется в `Request` до одобрения, и «Цена согласовывается» поверх уже названной суммы было бы
 * прямой дезинформацией. Только ноль тоже мало: бесплатным заказ быть не может, но ноль в любом
 * другом статусе — это «не посчитано», а не «согласовывается».
 */
export function isPriceNegotiated(order: OrderInfoModel): boolean {
  return order.status === OrderStatus.Request && order.total === 0
}

/** Строка «отменена/не состоится» — у таких заказов исполнителя не будет никогда, и «Ещё не
 * назначен» читалось бы как ожидание, которого нет. */
export function isSettledWithoutEmployee(status: OrderStatus): boolean {
  return status === OrderStatus.Rejected || status === OrderStatus.Hold
}

/** Ключ подписи «исполнителя нет». Три разных ответа, потому что это три разных положения дел:
 * заявку ещё считают, обычный заказ ждёт назначения, отклонённый — не ждёт ничего. */
export function emptyEmployeeLabelKey(status: OrderStatus): TranslationKey {
  if (status === OrderStatus.Request) return 'account.orders.employeePending'
  if (isSettledWithoutEmployee(status)) return 'account.orders.employeeNotAssigned'
  return 'account.orders.employeeNone'
}

/**
 * Трансфер ли эта строка.
 *
 * `lineKind === CustomTransfer` (2) — заявка своим маршрутом; у брони трансферного ПРОДУКТА
 * `lineKind` обычный, но есть снимок класса авто, которого нет ни у тура, ни у экскурсии.
 * Отличить же тур от экскурсии по строке заказа НЕЛЬЗЯ: `OrderLineInfoModel` не несёт вида
 * продукта, поэтому бейджа «Тур»/«Экскурсия» здесь нет — выдумывать его по названию мы не вправе.
 */
export function isTransferLine(line: OrderLineInfoModel): boolean {
  return line.customTransferDetails !== null || line.vehicleClassNameSnapshot !== null
}
