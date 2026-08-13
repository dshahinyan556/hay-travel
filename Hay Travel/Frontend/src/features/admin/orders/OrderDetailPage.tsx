import { useState } from 'react'
import { Link, redirect, useLoaderData, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { Tabs, type TabItem } from '@/shared/ui'
import { canManageCalendar, ensureAuthReady, getAuthState } from '@/shared/auth'
import { cancelOrder, confirmOrder, getOrder, getOrders, updateOrder } from '@/features/admin/api/adminOrders'
import { OrderStatus, type OrderInfoModel } from '@/shared/types/booking'
import { ordersCopy, ordersErrorMessage } from './lib/ordersCopy'
import { OrderOverviewTab } from './components/OrderOverviewTab'
import { OrderPaymentTab } from './components/OrderPaymentTab'
import { OrderClientTab } from './components/OrderClientTab'

const statusClasses: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: 'bg-amber-50 text-amber-700',
  [OrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
  [OrderStatus.Cancelled]: 'bg-neutral-100 text-neutral-500',
}

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PendingConfirmation]: ordersCopy.statusPending,
  [OrderStatus.Confirmed]: ordersCopy.statusConfirmed,
  [OrderStatus.Cancelled]: ordersCopy.statusCancelled,
}

/**
 * Same permission gate as `ordersLoader`, plus a defensive id check mirroring
 * `userDetailLoader`/`tourEditLoader`. A missing/deleted id 404s from `getOrder` itself and is
 * NOT caught here — it propagates to `AdminErrorBoundary`.
 *
 * `getOrders()` alongside the single order is how the "Клиент" tab gets this customer's other
 * orders — there is no dedicated "orders by user" endpoint, and the admin order list is small
 * enough that loading it whole and filtering client-side (same as `OrdersPage` already does for
 * every other filter) is simpler than adding one.
 */
export async function orderDetailLoader({ params }: LoaderFunctionArgs) {
  await ensureAuthReady()
  if (!canManageCalendar(getAuthState().user?.role)) throw redirect('/admin')

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Некорректный идентификатор заказа', { status: 400 })
  }

  const [order, allOrders] = await Promise.all([getOrder(id), getOrders()])
  const clientOrders = allOrders.filter((o) => o.userId === order.userId && o.id !== order.id)
  return { order, clientOrders }
}

export function OrderDetailPage() {
  const { order, clientOrders } = useLoaderData<typeof orderDetailLoader>()
  // Keyed by id: navigating between two order URLs remounts with fresh tab/pending state instead
  // of carrying the previous order's editing state over — same reasoning as `UserDetailPage`.
  return <OrderDetailView key={order.id} order={order} clientOrders={clientOrders} />
}

type OrderDetailTabId = 'overview' | 'payment' | 'client'

function OrderDetailView({ order, clientOrders }: { order: OrderInfoModel; clientOrders: OrderInfoModel[] }) {
  const revalidator = useRevalidator()
  const [tab, setTab] = useState<OrderDetailTabId>('overview')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: string, task: () => Promise<unknown>) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await task()
      await revalidator.revalidate()
    } catch (err) {
      setError(ordersErrorMessage(err, action))
    } finally {
      setPending(false)
    }
  }

  const tabs: TabItem[] = [
    { id: 'overview', label: ordersCopy.tabOverview },
    { id: 'payment', label: ordersCopy.tabPayment },
    { id: 'client', label: ordersCopy.tabClient },
  ]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
          <Link to="/admin/orders" className="transition-colors hover:text-neutral-800">
            {ordersCopy.backToList}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">Заказ №{order.id}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold break-words text-neutral-900">{order.tourTitle}</h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              {order.tourDate} · {order.guestCount} гостей
            </p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses[order.status]}`}
          >
            {statusLabels[order.status]}
          </span>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <Tabs tabs={tabs} activeId={tab} onChange={(id) => setTab(id as OrderDetailTabId)} label="Разделы заказа" />

      {tab === 'overview' && (
        <OrderOverviewTab
          order={order}
          pending={pending}
          onConfirm={() => run('подтвердить заказ', () => confirmOrder(order.id))}
          onCancel={() => run('отменить заказ', () => cancelOrder(order.id))}
          onSave={(tourDate, guestCount) =>
            run('сохранить изменения', () => updateOrder({ id: order.id, tourDate, guestCount }))
          }
        />
      )}
      {tab === 'payment' && <OrderPaymentTab order={order} />}
      {tab === 'client' && <OrderClientTab order={order} clientOrders={clientOrders} />}
    </div>
  )
}
