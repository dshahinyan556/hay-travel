import type { ReactNode } from 'react'
import { useMoney } from '@/shared/currency'
import type { TranslationKey } from '@/shared/i18n/dictionary'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { FormatChip } from '@/shared/ui'
import { OrderStatus, type OrderInfoModel, type OrderLineInfoModel } from '@/shared/types/booking'
import { contactNameAndValue } from '../lib/contactDisplay'
import {
  EMPLOYEE_ROLE_LABEL_KEY,
  ORDER_STATUS_LABEL_KEY,
  ORDER_STATUS_TONE,
  emptyEmployeeLabelKey,
  formatLineDate,
  formatLineTime,
  formatOrderCreatedDate,
  isPriceNegotiated,
  isTransferLine,
} from '../lib/ordersDisplay'
import { AuthNotice } from '../../components/AuthShell'
import { OrderStatusPill } from './OrderStatusPill'

/**
 * Один заказ клиента: шапка (номер, статус, дата создания, сумма) + строки.
 *
 * Заявка на кастомный трансфер — такой же заказ, просто в статусе «Заявка» и без цены; отдельной
 * карточки у неё нет, иначе клиенту пришлось бы помнить, в каком из двух списков искать свою
 * поездку.
 *
 * ── Таблица, которая перестаёт быть таблицей ─────────────────────────────────────────────────
 * На широком экране строки — сетка из четырёх колонок с общей шапкой. На 375 px та же строка
 * становится парами «подпись — значение» (`<dl>`), а шапка колонок пропадает: горизонтальная
 * прокрутка внутри карточки — худший способ прочитать состав собственной поездки.
 * Ячейки скрываются через `hidden`/`sm:hidden`, поэтому в сетке участвует ровно то, что видно.
 */
export interface OrderCardProps {
  order: OrderInfoModel
}

/** Шаблон колонок держится в одном месте: шапка и строки обязаны совпадать до пикселя. */
const LINE_GRID = 'sm:grid sm:grid-cols-[minmax(0,1fr)_132px_92px_176px] sm:gap-4'

/** Подписи колонок в порядке сетки. Только для широкого экрана: на телефоне те же четыре
 * значения подписаны каждое у себя (`<dl>`), и общая шапка там не к чему привязаться. */
const LINE_COLUMN_KEYS: TranslationKey[] = [
  'account.orders.colService',
  'account.orders.colDate',
  'account.orders.colGuests',
  'account.orders.colEmployee',
]

export function OrderCard({ order }: OrderCardProps) {
  const { t, locale } = useLocale()
  const money = useMoney()

  const negotiated = isPriceNegotiated(order)
  const isRejected = order.status === OrderStatus.Rejected
  const total = negotiated ? t('account.orders.priceNegotiated') : money.format(order.total)
  const totalClass = negotiated
    ? 'text-gold-ink'
    : isRejected
      ? 'text-ink-muted tabular-nums'
      : 'font-semibold text-ink tabular-nums'
  const created = t('account.orders.created', {
    date: formatOrderCreatedDate(order.createdAtUtc, locale),
  })

  /** Основной контакт заказа — сервер отдаёт его первым. У заказов, созданных до появления
   * контактов, список пуст, и текст про заявку обходится без имени. */
  const primaryContact = order.contacts[0] ?? null

  return (
    <li className="overflow-hidden rounded-2xl bg-panel ring-1 ring-edge ring-inset">
      <div className="border-b border-edge px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <span className="text-[15px] font-bold tabular-nums text-ink">
            {t('account.orders.number', { number: order.number })}
          </span>
          <OrderStatusPill
            label={t(ORDER_STATUS_LABEL_KEY[order.status])}
            tone={ORDER_STATUS_TONE[order.status]}
          />
          <span className="hidden text-[13px] text-ink-muted sm:inline">{created}</span>
          <div className="ml-auto hidden text-right sm:block">
            <span className="block text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
              {t('account.orders.totalLabel')}
            </span>
            <span className={`mt-0.5 block text-sm ${totalClass}`}>{total}</span>
          </div>
        </div>

        {/* На телефоне «создан …» и сумма уезжают во вторую строку: рядом с номером и пилюлей
            статуса они не помещаются, а переносить по одному слову — хуже, чем разложить. */}
        <div className="mt-2 flex items-baseline justify-between gap-3 sm:hidden">
          <span className="text-[13px] text-ink-muted">{created}</span>
          <span className={`text-[13px] ${totalClass}`}>{total}</span>
        </div>
      </div>

      <div className={`hidden px-5 pt-3 pb-1.5 ${LINE_GRID}`}>
        {LINE_COLUMN_KEYS.map((key) => (
          <span
            key={key}
            className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase"
          >
            {t(key)}
          </span>
        ))}
      </div>

      <ul aria-label={t('account.orders.linesLabel', { number: order.number })}>
        {order.lines.map((line) => (
          <OrderLineRow key={line.id} line={line} status={order.status} />
        ))}
      </ul>

      {/* Заявка — единственный статус, где клиент не знает, что происходит дальше: цены нет, и
          без этой строки экран выглядел бы как незавершённый заказ. */}
      {order.status === OrderStatus.Request && (
        <div className="border-t border-edge p-3.5 sm:p-4">
          <AuthNotice
            message={
              primaryContact
                ? t('account.orders.requestNotice', {
                    contact: contactNameAndValue(primaryContact),
                  })
                : t('account.orders.requestNoticeNoContact')
            }
          />
        </div>
      )}
    </li>
  )
}

function OrderLineRow({ line, status }: { line: OrderLineInfoModel; status: OrderStatus }) {
  const { t, locale } = useLocale()

  const date = formatLineDate(line.tourDate, locale)
  const time = formatLineTime(line.startTime)
  // Название приходит уже на языке запроса. `null` возможно только у строки с удалённым
  // продуктом — прочерк честнее выдуманного заголовка.
  const title = line.tourTitle ?? (isTransferLine(line) ? t('chip.transfer') : '—')

  const employees =
    line.employees.length > 0 ? (
      <span className="flex flex-col gap-0.5">
        {line.employees.map((employee) => (
          <span key={employee.id}>
            {employee.employeeFullName ?? '—'} · {t(EMPLOYEE_ROLE_LABEL_KEY[employee.employeeRole])}
          </span>
        ))}
      </span>
    ) : (
      <span className="text-ink-muted">{t(emptyEmployeeLabelKey(status))}</span>
    )

  return (
    <li
      // `first:border-t-0 sm:first:border-t`: на телефоне шапка колонок скрыта, и верхняя линия
      // первой строки легла бы вплотную к нижней линии шапки заказа — вышло бы 2 px вместо 1.
      className={`border-t border-edge px-4 py-3 first:border-t-0 sm:items-start sm:px-5 sm:py-3.5 sm:first:border-t ${LINE_GRID} ${
        // Отклонённый заказ гасится целиком: его строки — история, а не план поездки.
        status === OrderStatus.Rejected ? 'opacity-70' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {isTransferLine(line) && <LineChip>{t('chip.transfer')}</LineChip>}
          <FormatChip format={line.format} tone="surface" />
          {line.vehicleClassNameSnapshot && (
            <LineChip>{line.vehicleClassNameSnapshot}</LineChip>
          )}
          {line.isRoundTrip && <LineChip>{t('account.orders.roundTrip')}</LineChip>}
        </div>
      </div>

      {/* Телефонная раскладка: те же четыре значения парами «подпись — значение». */}
      <dl className="mt-2.5 flex flex-col gap-1.5 text-[13px] sm:hidden">
        <LineKeyValue label={t('account.orders.colDate')}>
          <span className="tabular-nums">{time ? `${date}, ${time}` : date}</span>
        </LineKeyValue>
        <LineKeyValue label={t('account.orders.colGuests')}>
          <span className="tabular-nums">{line.guestCount}</span>
        </LineKeyValue>
        <LineKeyValue label={t('account.orders.colEmployee')}>{employees}</LineKeyValue>
      </dl>

      <div className="hidden text-sm tabular-nums text-ink-dim sm:block">
        {date}
        {time && <span className="block text-[13px] text-ink-muted">{time}</span>}
      </div>
      <div className="hidden text-sm tabular-nums text-ink-dim sm:block">{line.guestCount}</div>
      <div className="hidden text-sm text-ink-dim sm:block">{employees}</div>
    </li>
  )
}

/** Чип строки заказа. Геометрия и цвета — те же, что у `FormatChip` в тоне `surface`, чтобы
 * «Трансфер», «Индивидуальный» и «Комфорт» стояли в ряд как один набор, а не как три разных. */
function LineChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-panel-raised px-2.5 py-1 text-xs text-ink-dim whitespace-nowrap ring-1 ring-edge ring-inset">
      {children}
    </span>
  )
}

function LineKeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0 text-right text-ink-dim">{children}</dd>
    </div>
  )
}
