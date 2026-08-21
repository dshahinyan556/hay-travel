import { useMemo, useState } from 'react'
import { redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { AdminSummaryPanel, AdminToolbar, Button, Modal, Tabs, type TabItem } from '@/shared/ui'
import { canManageCalendar, ensureAuthReady, getAuthState } from '@/shared/auth'
import { getAllTours } from '@/features/admin/api/adminTours'
import {
  addOrderLine,
  addOrderPayment,
  assignEmployee,
  deleteOrder,
  getEmployees,
  getOrder,
  getOrderEvents,
  removeOrderLine,
  sendOrderToClient,
  setOrderStatus,
  updateOrderLine,
} from '@/features/admin/api/adminOrders'
import { OrderStatus, type OrderEventInfoModel, type OrderInfoModel, type OrderPaymentType } from '@/shared/types/booking'
import type { TourInfoModel } from '@/shared/types/attours'
import type { UserInfoModel } from '@/shared/auth'
import { formatOrderMoney, ordersCopy, ordersErrorMessage } from './lib/ordersCopy'
import { OrderHeader } from './components/OrderHeader'
import { OrderLinesGrid } from './components/OrderLinesGrid'
import { AddLineModal, type NewLineDraft } from './components/AddLineModal'
import { AssignAllModal } from './components/AssignAllModal'
import { OrderPaymentTab } from './components/OrderPaymentTab'
import { OrderFulfillmentTab } from './components/OrderFulfillmentTab'
import { OrderHistoryTab } from './components/OrderHistoryTab'
import { OrderContextActions, type OrderContextActionKey } from './components/OrderContextActions'

/** Same permission gate as `ordersLoader`, plus a defensive id check mirroring
 * `userDetailLoader`/`tourEditLoader`. A missing/deleted id 404s from `getOrder` itself and is
 * NOT caught here — it propagates to `AdminErrorBoundary`.
 *
 * Loads `tours`/`employees` alongside the order (unchanged), plus `events` for the new "История"
 * tab — one more parallel round-trip, same pairing convention as the other two. */
export async function orderDetailLoader({ params }: LoaderFunctionArgs) {
  await ensureAuthReady()
  if (!canManageCalendar(getAuthState().user?.role)) throw redirect('/admin')

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Некорректный идентификатор заказа', { status: 400 })
  }

  const [order, tours, employees, events] = await Promise.all([
    getOrder(id),
    getAllTours(),
    getEmployees(),
    getOrderEvents(id),
  ])
  return { order, tours, employees, events }
}

export function OrderDetailPage() {
  const { order, tours, employees, events } = useLoaderData<typeof orderDetailLoader>()
  // Keyed by id: navigating between two order URLs remounts with fresh tab/draft/pending state
  // instead of carrying the previous order's editing state over — same reasoning as `UserDetailPage`.
  return <OrderDetailView key={order.id} order={order} tours={tours} employees={employees} events={events} />
}

type OrderDetailTabId = 'overview' | 'payment' | 'fulfillment' | 'history'

/** One line's unsaved edits (checklist §2) — only the four fields this task defers to Save. Keyed
 * by line id, values merge on top of the last-loaded line. */
interface LineDraftPatch {
  requiresPrepayment?: boolean
  prepaymentAmount?: number
  pickupDetails?: string
  navigatorLink?: string
}

interface OrderDraft {
  rejectReason?: string
  lines: Record<number, LineDraftPatch>
}

const EMPTY_DRAFT: OrderDraft = { lines: {} }

/** Merges the draft on top of the last-loaded `order` — every read-side component in this file
 * sees ONLY the result of this, never the raw draft or a "which fields changed" flag. This is what
 * makes the draft model work without touching `OrderLinesGrid`/`OrderFulfillmentTab`'s own props:
 * they render whatever order they're handed exactly as before, they just now sometimes get one
 * with unsaved edits baked in. */
function applyDraft(order: OrderInfoModel, draft: OrderDraft): OrderInfoModel {
  return {
    ...order,
    rejectReason: draft.rejectReason !== undefined ? draft.rejectReason : order.rejectReason,
    lines: order.lines.map((line) => {
      const patch = draft.lines[line.id]
      return patch ? { ...line, ...patch } : line
    }),
  }
}

function isDraftDirty(draft: OrderDraft): boolean {
  return draft.rejectReason !== undefined || Object.keys(draft.lines).length > 0
}

/** Client-only placeholder for the "Add" toolbar button (checklist §3) — visual "new draft" state
 * only, never sent anywhere. `currency` is inherited from the real order just so `formatOrderMoney`
 * has something to format; every other field is an empty default. */
function blankDraftOrder(currency: string): OrderInfoModel {
  return {
    id: 0,
    number: ordersCopy.newDraftOrderNumber,
    userId: 0,
    userEmail: '',
    userFullName: '',
    status: OrderStatus.Open,
    rejectReason: null,
    createdAtUtc: new Date().toISOString(),
    approvedAtUtc: null,
    currency,
    lines: [],
    discountTotal: 0,
    total: 0,
  }
}

function OrderDetailView({
  order,
  tours,
  employees,
  events,
}: {
  order: OrderInfoModel
  tours: TourInfoModel[]
  employees: UserInfoModel[]
  events: OrderEventInfoModel[]
}) {
  const revalidator = useRevalidator()
  const navigate = useNavigate()
  const [tab, setTab] = useState<OrderDetailTabId>('overview')
  const [pending, setPending] = useState(false)
  const [busyAction, setBusyAction] = useState<OrderContextActionKey | null>(null)
  /** Set while an email-sending action (assign+send / send to client / send to employees) is in
   * flight — drives the visible "тяжёлый процесс" overlay (checklist §8), separate from `pending`
   * because quick actions (Approve/Reject/inline Save) block the page too but don't need one. */
  const [heavyOp, setHeavyOp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addLineOpen, setAddLineOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT)
  const [newDraftMode, setNewDraftMode] = useState(false)
  /** Set to the action a "send" button wants to run once the user picks "Сохранить и отправить"
   * in the unsaved-changes dialog (checklist §5's "если есть что сейвить — спрашивает"). */
  const [pendingSendAfterSave, setPendingSendAfterSave] = useState<'client' | 'employees' | null>(null)

  const effectiveOrder = useMemo(
    () => (newDraftMode ? blankDraftOrder(order.currency) : applyDraft(order, draft)),
    [order, draft, newDraftMode],
  )
  const dirty = !newDraftMode && isDraftDirty(draft)

  async function run(
    action: string,
    task: () => Promise<unknown>,
    options?: { onSuccess?: () => void; busy?: OrderContextActionKey; heavy?: boolean },
  ) {
    if (pending) return
    setPending(true)
    setBusyAction(options?.busy ?? null)
    if (options?.heavy) setHeavyOp(true)
    setError(null)
    setNotice(null)
    try {
      await task()
      options?.onSuccess?.()
      await revalidator.revalidate()
    } catch (err) {
      setError(ordersErrorMessage(err, action))
    } finally {
      setPending(false)
      setBusyAction(null)
      setHeavyOp(false)
    }
  }

  function patchLine(lineId: number, patch: LineDraftPatch) {
    setDraft((prev) => ({ ...prev, lines: { ...prev.lines, [lineId]: { ...prev.lines[lineId], ...patch } } }))
  }

  /** Commits the whole draft: one `SetStatus` call if the reject reason changed, one
   * `UpdateLine` per dirty line — everything else on the page (Assign/Payments/Add-Line/Send…) is
   * its own immediate action and was never part of the draft (checklist §2). */
  async function saveDraft() {
    const calls: Promise<unknown>[] = []
    if (draft.rejectReason !== undefined) {
      calls.push(setOrderStatus({ id: order.id, status: order.status, rejectReason: draft.rejectReason || null }))
    }
    for (const [lineIdText, patch] of Object.entries(draft.lines)) {
      const lineId = Number(lineIdText)
      const base = order.lines.find((line) => line.id === lineId)
      if (!base) continue
      calls.push(
        updateOrderLine({
          id: lineId,
          requiresPrepayment: patch.requiresPrepayment ?? base.requiresPrepayment,
          prepaymentAmount: patch.prepaymentAmount ?? base.prepaymentAmount,
          pickupDetails: (patch.pickupDetails ?? base.pickupDetails) || null,
          navigatorLink: (patch.navigatorLink ?? base.navigatorLink) || null,
        }),
      )
    }
    await Promise.all(calls)
    setDraft(EMPTY_DRAFT)
  }

  function handleCancel() {
    if (newDraftMode) {
      setNewDraftMode(false)
      return
    }
    setDraft(EMPTY_DRAFT)
  }

  function handleAdd() {
    setDraft(EMPTY_DRAFT)
    setNewDraftMode(true)
  }

  /** SendToClient/SendToEmployees don't save the draft themselves (checklist §5) — with unsaved
   * edits they ask first, so the PDF/email reflect saved data, not what's still on screen. */
  function requestSend(kind: 'client' | 'employees', immediate: () => void) {
    if (dirty) {
      setPendingSendAfterSave(kind)
      return
    }
    immediate()
  }

  function sendToClientNow() {
    void run('отправить заказ клиенту', () => sendOrderToClient(order.id), {
      onSuccess: () => setNotice(ordersCopy.sendToClientSent),
      busy: 'sendToClient',
      heavy: true,
    })
  }

  function sendToEmployeesNow() {
    const assignedLines = order.lines.filter((line) => line.employeeId !== null)
    void run(
      'отправить заказ исполнителям',
      () =>
        Promise.all(
          assignedLines.map((line) =>
            assignEmployee({ orderId: order.id, employeeId: line.employeeId!, lineId: line.id, sendEmail: true }),
          ),
        ),
      { onSuccess: () => setNotice(ordersCopy.actionSendToEmployeesSent), busy: 'sendToEmployees', heavy: true },
    )
  }

  async function confirmSaveThenSend() {
    const kind = pendingSendAfterSave
    setPendingSendAfterSave(null)
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await saveDraft()
      await revalidator.revalidate()
    } catch (err) {
      setError(ordersErrorMessage(err, 'сохранить изменения'))
      setPending(false)
      return
    }
    setPending(false)
    if (kind === 'client') sendToClientNow()
    else if (kind === 'employees') sendToEmployeesNow()
  }

  const paidTotal = effectiveOrder.lines.reduce(
    (sum, line) => sum + line.payments.reduce((lineSum, payment) => lineSum + payment.amount, 0),
    0,
  )
  const guestTotal = effectiveOrder.lines.reduce((sum, line) => sum + line.guestCount, 0)
  const grossTotal = effectiveOrder.total + effectiveOrder.discountTotal

  const tabs: TabItem[] = [
    { id: 'overview', label: ordersCopy.tabOverview },
    { id: 'payment', label: ordersCopy.tabPayment },
    { id: 'fulfillment', label: ordersCopy.tabFulfillment },
    { id: 'history', label: ordersCopy.tabHistory },
  ]

  const blockedForDraft = pending || newDraftMode

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <nav className="text-xs text-neutral-500" aria-label="Хлебные крошки">
        {ordersCopy.backToList} · <span className="font-semibold text-neutral-800">{ordersCopy.orderTitle(order.number)}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <AdminToolbar
          onCancel={handleCancel}
          onSave={() => void run('сохранить заказ', saveDraft)}
          onAdd={handleAdd}
          onDelete={() => setDeleteOpen(true)}
          cancelState={{ disabled: pending || (!dirty && !newDraftMode) }}
          saveState={{ disabled: pending || newDraftMode || !dirty, pending: pending && busyAction === null && !heavyOp }}
          addState={{ disabled: pending }}
          deleteState={{ disabled: pending || newDraftMode }}
        />
        {!newDraftMode && (
          <OrderContextActions
            order={effectiveOrder}
            pending={pending}
            busyAction={busyAction}
            onApprove={() =>
              void run('одобрить заказ', () => setOrderStatus({ id: order.id, status: OrderStatus.Approved, rejectReason: order.rejectReason }), {
                busy: 'approve',
              })
            }
            onReject={() =>
              void run('отклонить заказ', () => setOrderStatus({ id: order.id, status: OrderStatus.Rejected, rejectReason: order.rejectReason }), {
                busy: 'reject',
              })
            }
            onAssign={() => setAssignOpen(true)}
            onSendToClient={() => requestSend('client', sendToClientNow)}
            onSendToEmployees={() => requestSend('employees', sendToEmployeesNow)}
          />
        )}
      </div>

      {newDraftMode && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
          {ordersCopy.newDraftBanner}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <span aria-hidden="true">✓</span>
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <OrderHeader
          order={effectiveOrder}
          pending={blockedForDraft}
          onRejectReasonChange={(reason) => setDraft((prev) => ({ ...prev, rejectReason: reason }))}
        />
        <AdminSummaryPanel
          title="Сводка"
          className="lg:self-start"
          rows={[
            { key: 'lines', label: 'Строк в заказе', value: effectiveOrder.lines.length },
            { key: 'guests', label: 'Гостей', value: guestTotal },
            { key: 'gross', label: 'Сумма по строкам', value: formatOrderMoney(grossTotal, effectiveOrder.currency) },
            {
              key: 'discount',
              label: 'Скидки',
              value: effectiveOrder.discountTotal > 0 ? `−${formatOrderMoney(effectiveOrder.discountTotal, effectiveOrder.currency)}` : ordersCopy.dash,
            },
            { key: 'paid', label: 'Оплачено', value: paidTotal > 0 ? formatOrderMoney(paidTotal, effectiveOrder.currency) : ordersCopy.dash },
            {
              key: 'due',
              label: 'Остаток к оплате',
              value: formatOrderMoney(effectiveOrder.total - paidTotal, effectiveOrder.currency),
              emphasis: true,
            },
          ]}
        />
      </div>

      <Tabs tabs={tabs} activeId={tab} onChange={(id) => setTab(id as OrderDetailTabId)} label="Разделы заказа" />

      {tab === 'overview' && (
        <OrderLinesGrid
          order={effectiveOrder}
          employees={employees}
          pending={blockedForDraft}
          onAssignEmployee={(lineId, employeeId) =>
            run('назначить исполнителя', () => assignEmployee({ orderId: order.id, employeeId, lineId, sendEmail: true }))
          }
          onToggleRequiresPrepayment={(line, requiresPrepayment) => patchLine(line.id, { requiresPrepayment })}
          onSavePrepaymentAmount={(line, prepaymentAmount) => patchLine(line.id, { prepaymentAmount })}
          onAddLine={() => setAddLineOpen(true)}
          onRemoveLines={(lineIds) =>
            run('удалить строки', async () => {
              for (const lineId of lineIds) await removeOrderLine(lineId)
            })
          }
        />
      )}
      {tab === 'payment' && (
        <OrderPaymentTab
          order={effectiveOrder}
          pending={blockedForDraft}
          onAddPayment={(lineId, type: OrderPaymentType, amount) =>
            run('добавить проводку', () => addOrderPayment({ orderLineId: lineId, type, amount }))
          }
        />
      )}
      {tab === 'fulfillment' && (
        <OrderFulfillmentTab
          order={effectiveOrder}
          pending={blockedForDraft}
          onChangePickup={(line, pickupDetails) => patchLine(line.id, { pickupDetails })}
          onChangeNavigator={(line, navigatorLink) => patchLine(line.id, { navigatorLink })}
          onAssignAndSend={(line) => {
            if (line.employeeId === null) return
            void run('назначить и отправить', () => assignEmployee({ orderId: order.id, employeeId: line.employeeId!, lineId: line.id, sendEmail: true }), {
              heavy: true,
            })
          }}
        />
      )}
      {tab === 'history' && <OrderHistoryTab events={newDraftMode ? [] : events} />}

      <AddLineModal
        open={addLineOpen}
        tours={tours}
        pending={pending}
        onClose={() => setAddLineOpen(false)}
        onSubmit={(draft: NewLineDraft) =>
          run('добавить строку', () => addOrderLine({ orderId: order.id, ...draft }), {
            onSuccess: () => setAddLineOpen(false),
          })
        }
      />

      <AssignAllModal
        open={assignOpen}
        employees={employees}
        pending={pending}
        onClose={() => setAssignOpen(false)}
        onSubmit={(employeeId, sendEmail) =>
          run(
            sendEmail ? 'назначить и отправить письмо' : 'назначить исполнителя',
            () => assignEmployee({ orderId: order.id, employeeId, lineId: null, sendEmail }),
            { onSuccess: () => setAssignOpen(false), heavy: sendEmail },
          )
        }
      />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={ordersCopy.deleteConfirmTitle}>
        <p className="text-sm text-neutral-600">{ordersCopy.deleteConfirmBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeleteOpen(false)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.deleteConfirmDismiss}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (pending) return
              setDeleteOpen(false)
              setPending(true)
              setError(null)
              // Deliberately NOT the shared `run` helper: on success this navigates away, and
              // `run`'s `revalidator.revalidate()`/`setPending(false)` would then run against an
              // already-unmounted `OrderDetailView`.
              deleteOrder(order.id)
                .then(() => navigate('/admin/orders'))
                .catch((err: unknown) => {
                  setError(ordersErrorMessage(err, 'удалить заказ'))
                  setPending(false)
                })
            }}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.deleteConfirmAction}
          </Button>
        </div>
      </Modal>

      <Modal
        open={pendingSendAfterSave !== null}
        onClose={() => setPendingSendAfterSave(null)}
        title={ordersCopy.saveBeforeSendTitle}
      >
        <p className="text-sm text-neutral-600">{ordersCopy.saveBeforeSendBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPendingSendAfterSave(null)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.saveBeforeSendCancel}
          </Button>
          <Button
            type="button"
            onClick={() => void confirmSaveThenSend()}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {ordersCopy.saveBeforeSendConfirm}
          </Button>
        </div>
      </Modal>

      {/* Whole-page overlay while a heavy operation (PDF generation + email) is in flight
          (checklist §8) — `pending` already disables every control underneath; this ADDS a
          visible reason so the wait doesn't read as a hang. */}
      {heavyOp && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-40 flex items-center justify-center bg-white/70 backdrop-blur-[1px]"
        >
          <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-5 py-3 shadow-lg">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            <span className="text-sm font-medium text-neutral-800">{ordersCopy.heavyOpOverlay}</span>
          </div>
        </div>
      )}
    </div>
  )
}
