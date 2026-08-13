import { Link } from 'react-router'
import { Button } from '@/shared/ui'
import type { OrderInfoModel } from '@/shared/types/booking'
import { ordersCopy } from '../lib/ordersCopy'
import { OrderRow } from './OrderRow'

export interface OrderClientTabProps {
  order: OrderInfoModel
  /** Every other (non-cancelled-filter-agnostic) order by the same `userId`, already narrowed by
   * `orderDetailLoader` from the full admin order list — no separate "orders by user" endpoint. */
  clientOrders: OrderInfoModel[]
}

/** "Клиент" tab of `OrderDetailPage`: who placed it, a link to their full profile
 * (`UserDetailPage`), and their other orders — reuses `OrderRow` as-is for that list, since it is
 * already just "one order, minimal fields, links to its own detail page". */
export function OrderClientTab({ order, clientOrders }: OrderClientTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="font-semibold text-neutral-900">{order.userFullName.trim() || order.userEmail}</p>
        <a href={`mailto:${order.userEmail}`} className="mt-0.5 block text-sm text-brand-700 hover:underline">
          {order.userEmail}
        </a>
        <Link to={`/admin/users/${order.userId}`} className="mt-3 inline-block">
          <Button type="button" variant="secondary" size="sm" className="min-h-11">
            {ordersCopy.openClient}
          </Button>
        </Link>
      </div>

      <div>
        <p className="text-sm font-semibold text-neutral-900">{ordersCopy.clientOtherOrders}</p>
        {clientOrders.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
            {ordersCopy.clientNoOtherOrders}
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {clientOrders.map((clientOrder) => (
              <li key={clientOrder.id}>
                <OrderRow order={clientOrder} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
