import type { OrderStatusTone } from '../lib/ordersDisplay'

/**
 * Статус заказа в личном кабинете — публичный близнец `shared/ui/OrderStatusBadge`.
 *
 * Почему не переиспользуется тот: он собран на админской палитре (`bg-white`,
 * `text-neutral-900`, `border-neutral-*`), а кабинет живёт на ролевых токенах и переключается
 * между тёмной и светлой темами. На обсидиане админская пилюля стала бы белым пятном — это тот
 * же довод, по которому `Button` не годится для публичных экранов.
 *
 * Что от него сохранено дословно: контракт (`label` + `tone`, никакого знания об `OrderStatus`),
 * карта тонов (`ORDER_STATUS_TONE` — копия админской `statusBadgeTone`) и геометрия — 28 px
 * высоты, 11 px, 700, `tracking-[.08em]`, uppercase, точка 7 px. Клиент и менеджер должны видеть
 * один и тот же объект, отличающийся только палитрой поверхности.
 *
 * Красного здесь нет ни в одном тоне: отклонённый заказ — это решение компании, а не ошибка
 * клиента, и кричать на него цветом опасности не за что. «Холод» даётся весом, не оттенком.
 */
export interface OrderStatusPillProps {
  /** Готовый текст статуса. Маппинг `OrderStatus` → подпись делает вызывающий. */
  label: string
  tone: OrderStatusTone
}

const TONE_CLASS: Record<OrderStatusTone, string> = {
  neutral: 'text-ink-dim ring-1 ring-edge-strong',
  strong: 'bg-gold-soft text-gold-ink ring-1 ring-gold-line',
  muted: 'text-ink-muted ring-1 ring-edge',
}

const DOT_CLASS: Record<OrderStatusTone, string> = {
  neutral: 'bg-gold-ink',
  strong: 'bg-gold-ink',
  // Полая точка вместо залитой — «решено и закрыто» против «в работе», разница по весу.
  muted: 'bg-transparent shadow-[inset_0_0_0_1.5px_currentColor]',
}

export function OrderStatusPill({ label, tone }: OrderStatusPillProps) {
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-[7px] rounded-full px-3 text-[11px] font-bold tracking-[0.08em] whitespace-nowrap uppercase ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </span>
  )
}
