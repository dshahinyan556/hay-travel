import { useMemo, useState } from 'react'
import { redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import {
  AdminActionsMenu,
  AdminSummaryPanel,
  AdminToolbar,
  Button,
  Modal,
  Tabs,
  type AdminActionsMenuGroup,
  type TabItem,
} from '@/shared/ui'
import {
  AdminScreen,
  canView,
  ensurePermissionsReady,
  useScreenPermission,
} from '@/shared/auth'
import { getAllTours } from '@/features/admin/api/adminTours'
import { getVehicleClasses } from '@/features/admin/api/adminCatalog'
import { vehicleClassesToOptions } from '@/features/admin/lib/tourMapper'
import type { VehicleClassOption } from '@/features/admin/lib/tourMapper'
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
  unassignEmployee,
  updateOrderLine,
  updateOrderLineEmployee,
} from '@/features/admin/api/adminOrders'
import {
  OrderStatus,
  type OrderAssignEmployeeItem,
  type OrderEventInfoModel,
  type OrderInfoModel,
  type OrderLineInfoModel,
  type OrderPaymentType,
} from '@/shared/types/booking'
import { LanguageCode } from '@/shared/types/language'
import { OrderLineKind } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import type { UserInfoModel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getStoredLocale } from '@/shared/lib/locale'
import { formatOrderMoney, ordersCopy, ordersErrorMessage, type OrdersCopy } from './lib/ordersCopy'
import { orderPermissionHints } from './lib/orderPermissionHints'
import { OrderHeader } from './components/OrderHeader'
import { OrderLinesGrid } from './components/OrderLinesGrid'
import { AddLineModal, type NewLineDraft } from './components/AddLineModal'
import { AssignEmployeesModal } from './components/AssignEmployeesModal'
import { OrderPaymentTab } from './components/OrderPaymentTab'
import { OrderFulfillmentTab } from './components/OrderFulfillmentTab'
import { OrderHistoryTab } from './components/OrderHistoryTab'
import { OrderRequestDetails } from './components/OrderRequestDetails'
import { OrderContextActions, type OrderContextActionKey } from './components/OrderContextActions'
import { lineTitle } from './lib/ordersModel'

/** Same permission gate as `ordersLoader`, plus a defensive id check mirroring
 * `userDetailLoader`/`tourEditLoader`. A missing/deleted id 404s from `getOrder` itself and is
 * NOT caught here — it propagates to `AdminErrorBoundary`.
 *
 * Loads `tours`/`employees` alongside the order, plus `events` for the "История" tab — one more
 * parallel round-trip, same pairing convention as the other two.
 *
 * Those two companions are gated by OTHER keys (`products.View` and `users.View`) and therefore
 * degrade to empty lists instead of 403-ing the whole order card: without tours the "add a line"
 * picker has no options, without employees the assignment picker has none, and both explain
 * themselves where they are used.
 *
 * Справочник классов авто (батч 2026-08-29) — та же схема, третьим «мягким» спутником: он нужен
 * ровно одному контролу «+ Добавить строку» (названия и вместимость классов трансфера), живёт за
 * своим правом `catalog.vehicle-classes` и грузится ЗДЕСЬ, а не запросом из модалки — та остаётся
 * презентационной, как и остальные модалки этого экрана. */
export async function orderDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Orders)) throw redirect('/admin')

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    // A loader runs before any component mounts, so there is no `useCopy` here — the copy module is
    // called directly with the persisted locale (`defineCopy.ts`, rule 3).
    throw new Response(ordersCopy(getStoredLocale()).invalidOrderId, { status: 400 })
  }

  const [order, tours, employees, events, vehicleClasses] = await Promise.all([
    getOrder(id),
    canView(AdminScreen.Products) ? getAllTours() : Promise.resolve([]),
    canView(AdminScreen.Users) ? getEmployees() : Promise.resolve([]),
    getOrderEvents(id),
    canView(AdminScreen.CatalogVehicleClasses)
      ? getVehicleClasses().catch(() => [])
      : Promise.resolve([]),
  ])
  return { order, tours, employees, events, vehicleClasses: vehicleClassesToOptions(vehicleClasses) }
}

export function OrderDetailPage() {
  const { order, tours, employees, events, vehicleClasses } = useLoaderData<typeof orderDetailLoader>()
  // Keyed by id: navigating between two order URLs remounts with fresh tab/draft/pending state
  // instead of carrying the previous order's editing state over — same reasoning as `UserDetailPage`.
  return (
    <OrderDetailView
      key={order.id}
      order={order}
      tours={tours}
      employees={employees}
      events={events}
      vehicleClasses={vehicleClasses}
    />
  )
}

type OrderDetailTabId = 'overview' | 'payment' | 'fulfillment' | 'history'

/** Несохранённые правки одной СТРОКИ: предоплата («детали для выполнения» переехали на
 * исполнителя, редизайн 2026-08-23) и — только у строки-заявки — согласованная менеджером цена
 * (батч 2026-08-29). Keyed by line id. */
interface LineDraftPatch {
  requiresPrepayment?: boolean
  prepaymentAmount?: number
  /** Итог строки-заявки. У строки по продукту в черновик не попадает вовсе: сервер отбивает
   * ручную сумму на ней 400-ым (`OrderNotEditable`), а не игнорирует молча. */
  lineTotal?: number
}

/** Несохранённые правки одного ИСПОЛНИТЕЛЯ строки. Ключ — `OrderLineEmployeeInfoModel.id`
 * (id связки, не строки и не пользователя). */
interface LineEmployeeDraftPatch {
  pickupDetails?: string
  navigatorLink?: string
  comment?: string
  commentEn?: string
}

interface OrderDraft {
  rejectReason?: string
  lines: Record<number, LineDraftPatch>
  lineEmployees: Record<number, LineEmployeeDraftPatch>
}

const EMPTY_DRAFT: OrderDraft = { lines: {}, lineEmployees: {} }

/** Что подтверждаем снять. `employeeId: null` — всех исполнителей строки (сегодня такую цель ставит
 * только будущий bulk-жест; чипы грида всегда адресные). */
export interface UnassignTarget {
  lineId: number
  employeeId: number | null
  employeeName: string | null
}

/** Merges the draft on top of the last-loaded `order` — every read-side component in this file
 * sees ONLY the result of this, never the raw draft or a "which fields changed" flag. This is what
 * makes the draft model work without touching `OrderLinesGrid`/`OrderFulfillmentTab`'s own props:
 * they render whatever order they're handed exactly as before, they just now sometimes get one
 * with unsaved edits baked in. Мульти-исполнители ничего в этом принципе не меняют — просто
 * накладывается второй слой патчей, по связкам `line.employees`. */
function applyDraft(order: OrderInfoModel, draft: OrderDraft): OrderInfoModel {
  return {
    ...order,
    rejectReason: draft.rejectReason !== undefined ? draft.rejectReason : order.rejectReason,
    lines: order.lines.map((line) => {
      const patch = draft.lines[line.id]
      const merged = patch ? { ...line, ...patch } : line
      return {
        ...merged,
        employees: line.employees.map((employee) => {
          const employeePatch = draft.lineEmployees[employee.id]
          return employeePatch ? { ...employee, ...employeePatch } : employee
        }),
      }
    }),
  }
}

function isDraftDirty(draft: OrderDraft): boolean {
  return (
    draft.rejectReason !== undefined ||
    Object.keys(draft.lines).length > 0 ||
    Object.keys(draft.lineEmployees).length > 0
  )
}

/** Client-only placeholder for the "Add" toolbar button (checklist §3) — visual "new draft" state
 * only, never sent anywhere. `currency` is inherited from the real order just so `formatOrderMoney`
 * has something to format; every other field is an empty default. */
function blankDraftOrder(currency: string, copy: OrdersCopy): OrderInfoModel {
  return {
    id: 0,
    number: copy.newDraftOrderNumber,
    userId: 0,
    userEmail: '',
    userFullName: '',
    userPreferredLanguage: LanguageCode.Russian,
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
  vehicleClasses,
}: {
  order: OrderInfoModel
  tours: TourInfoModel[]
  employees: UserInfoModel[]
  events: OrderEventInfoModel[]
  vehicleClasses: VehicleClassOption[]
}) {
  const revalidator = useRevalidator()
  const navigate = useNavigate()
  const copy = useCopy(ordersCopy)
  const { locale } = useLocale()
  /** Уровень доступа к экрану «Заказы» ЭТОЙ сессии. Хук, а не разовый `canUpdate(...)`: матрица
   * может обновиться в фоне (ротация токена, правка своей роли), и кнопки обязаны это увидеть.
   *
   * `View`-only пользователь до этого момента видел полностью рабочий экран, где каждое действие
   * приводило к 403 от сервера (проверено 2026-08-27) — теперь такие действия выключены и
   * объясняют себя тултипом. Это по-прежнему ТОЛЬКО UX: запрет живёт в `[RequiresPermission]`
   * на бэке, здесь мы лишь не предлагаем то, что заведомо будет отклонено. */
  const orderPermission = useScreenPermission(AdminScreen.Orders)
  const hints = useMemo(
    () => orderPermissionHints(orderPermission, copy.noPermissionHint),
    [orderPermission, copy],
  )
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
  /** Открытый попап назначения: `null` — закрыт; `{ lineId: null }` — «на все строки» (пункт меню
   * «…»); `{ lineId: n }` — «+ Назначить» в конкретной строке. */
  const [assignTarget, setAssignTarget] = useState<{ lineId: number | null } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  /** Что подтверждаем снять, или `null` — page owns the modal, same split as the delete-order
   * confirm above. */
  const [unassignTarget, setUnassignTarget] = useState<UnassignTarget | null>(null)
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT)
  const [newDraftMode, setNewDraftMode] = useState(false)
  /** Set to the action a "send" button wants to run once the user picks "Сохранить и отправить"
   * in the unsaved-changes dialog (checklist §5's "если есть что сейвить — спрашивает"). */
  const [pendingSendAfterSave, setPendingSendAfterSave] = useState<'client' | 'employees' | null>(null)

  const effectiveOrder = useMemo(
    () => (newDraftMode ? blankDraftOrder(order.currency, copy) : applyDraft(order, draft)),
    [order, draft, newDraftMode, copy],
  )
  const dirty = !newDraftMode && isDraftDirty(draft)
  /** Целевая строка попапа назначения — её подпись идёт в шапку, а её текущие исполнители
   * помечаются как «уже назначен». `null` при bulk-режиме («на все строки»). */
  const assignTargetLine =
    assignTarget === null || assignTarget.lineId === null
      ? null
      : (order.lines.find((line) => line.id === assignTarget.lineId) ?? null)

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
      setError(ordersErrorMessage(copy, err, action))
    } finally {
      setPending(false)
      setBusyAction(null)
      setHeavyOp(false)
    }
  }

  function patchLine(lineId: number, patch: LineDraftPatch) {
    setDraft((prev) => ({ ...prev, lines: { ...prev.lines, [lineId]: { ...prev.lines[lineId], ...patch } } }))
  }

  /** Сиблинг `patchLine` для второго слоя черновика. `employeeRowId` — id связки
   * `OrderLineEmployee`, именно он адресует `UpdateLineEmployee`. */
  function patchLineEmployee(employeeRowId: number, patch: LineEmployeeDraftPatch) {
    setDraft((prev) => ({
      ...prev,
      lineEmployees: {
        ...prev.lineEmployees,
        [employeeRowId]: { ...prev.lineEmployees[employeeRowId], ...patch },
      },
    }))
  }

  /** Commits the whole draft: one `SetStatus` call if the reject reason changed, one `UpdateLine`
   * per dirty line (предоплата) и один `UpdateLineEmployee` на каждую грязную связку исполнителя —
   * everything else on the page (Assign/Payments/Add-Line/Send…) is its own immediate action and
   * was never part of the draft (checklist §2). */
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
          // `null` = «не трогать сумму». Отправляем число ТОЛЬКО со строки-заявки и только если
          // его действительно правили: на строке по продукту любое непустое значение — 400.
          lineTotal:
            base.lineKind === OrderLineKind.CustomTransfer && patch.lineTotal !== undefined
              ? patch.lineTotal
              : null,
        }),
      )
    }
    // Пустая строка → `null`: правило «пустое поле нигде не появляется» (ни в PDF, ни в письме)
    // живёт на сервере, и отправить `''` значило бы «поле заполнено пустотой».
    const assignedEmployees = order.lines.flatMap((line) => line.employees)
    for (const [rowIdText, patch] of Object.entries(draft.lineEmployees)) {
      const rowId = Number(rowIdText)
      const base = assignedEmployees.find((employee) => employee.id === rowId)
      if (!base) continue
      calls.push(
        updateOrderLineEmployee({
          id: rowId,
          pickupDetails: (patch.pickupDetails ?? base.pickupDetails) || null,
          navigatorLink: (patch.navigatorLink ?? base.navigatorLink) || null,
          comment: (patch.comment ?? base.comment) || null,
          commentEn: (patch.commentEn ?? base.commentEn) || null,
        }),
      )
    }
    await Promise.all(calls)
    setDraft(EMPTY_DRAFT)
  }

  /** Все исполнители строки одним списком — форма, которую ждёт аддитивный upsert `AssignEmployee`
   * при переотправке письма (набор не меняется, меняется только факт отправки). */
  function assignItemsOf(line: OrderLineInfoModel): OrderAssignEmployeeItem[] {
    return line.employees.map((employee) => ({
      employeeId: employee.employeeId,
      employeeRole: employee.employeeRole,
    }))
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
    void run(copy.errorActions.sendToClient, () => sendOrderToClient(order.id), {
      onSuccess: () => setNotice(copy.sendToClientSent),
      busy: 'sendToClient',
      heavy: true,
    })
  }

  /** Переотправка письма — по одному вызову на строку, у которой есть исполнители: `lineId` в
   * модели один, а роли у людей на разных строках разные, так что «одним bulk-вызовом» это не
   * выражается. */
  function sendToEmployeesNow() {
    const assignedLines = order.lines.filter((line) => line.employees.length > 0)
    void run(
      copy.errorActions.sendToEmployees,
      () =>
        Promise.all(
          assignedLines.map((line) =>
            assignEmployee({
              orderId: order.id,
              lineId: line.id,
              employees: assignItemsOf(line),
              sendEmail: true,
            }),
          ),
        ),
      { onSuccess: () => setNotice(copy.actionSendToEmployeesSent), busy: 'sendToEmployees', heavy: true },
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
      setError(ordersErrorMessage(copy, err, copy.errorActions.saveChanges))
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
    { id: 'overview', label: copy.tabOverview },
    { id: 'payment', label: copy.tabPayment },
    { id: 'fulfillment', label: copy.tabFulfillment },
    { id: 'history', label: copy.tabHistory },
  ]

  /** Frozen (checklist-add-order-clients.txt Задача A) — Rejected/Completed lock the entire order
   * down to the "Возобновить" button. Folded into `blockedForDraft` so every existing consumer
   * (`OrderHeader`'s reject-reason field, `OrderLinesGrid`, `OrderPaymentTab`,
   * `OrderFulfillmentTab` — they all already take `pending={blockedForDraft}`) disables for free,
   * no per-component prop threading needed. */
  const frozen = effectiveOrder.status === OrderStatus.Rejected || effectiveOrder.status === OrderStatus.Completed
  /** Заморозка ДО решения: Open ещё не одобрен/отклонён, поэтому редактируется только через
   * Одобрить/Отклонить/Удалить — контент (строки/оплаты/pickup/навигатор/причина отказа/
   * Add/Save/"...") заблокирован так же, как при frozen, но Approve/Reject НЕ прячутся
   * (в отличие от frozen, где их место занимает "Возобновить"). */
  const preDecision = effectiveOrder.status === OrderStatus.Open
  /** Заказ-заявка (батч 2026-08-29). НАМЕРЕННО не попадает ни во `frozen`, ни в `preDecision`:
   * заявку нужно править ДО решения — иначе одобрять было бы нечего, цены у неё нет. Флаг
   * управляет только пояснением сверху; редактирование он не ограничивает. */
  const isRequestOrder = effectiveOrder.status === OrderStatus.Request
  const blockedForDraft = pending || newDraftMode || frozen || preDecision
  const hasAssignedEmployee = order.lines.some((line) => line.employees.length > 0)
  /** "…" `AdminActionsMenu` groups (checklist §6) — Назначить/Отправить-клиенту/
   * Отправить-исполнителям used to be flat contextual buttons; they moved here to declutter the
   * mobile toolbar row (see `OrderContextActions`'s doc comment). Handlers/gating unchanged. */
  /** Все три пункта меню — `Update` на бэке (`AssignEmployee`, `SendToClient`, снова
   * `AssignEmployee` с письмом), поэтому гейт у них общий. */
  const actionsMenuGroups: AdminActionsMenuGroup[] = newDraftMode || frozen || preDecision
    ? []
    : [
        {
          title: copy.actionsGroupAssign,
          items: [
            {
              label: copy.actionAssign,
              onClick: () => setAssignTarget({ lineId: null }),
              disabled: pending || hints.update !== null,
              hint: hints.update,
            },
          ],
        },
        {
          title: copy.actionsGroupSend,
          items: [
            {
              label: copy.actionSendToClientLabel,
              onClick: () => requestSend('client', sendToClientNow),
              disabled: pending || hints.update !== null,
              hint: hints.update,
            },
            {
              label: copy.actionSendToEmployees,
              onClick: () => requestSend('employees', sendToEmployeesNow),
              disabled: pending || !hasAssignedEmployee || hints.update !== null,
              hint: hints.update,
            },
          ],
        },
      ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <nav className="text-xs text-neutral-500" aria-label={copy.breadcrumbsLabel}>
        {copy.backToList} · <span className="font-semibold text-neutral-800">{copy.orderTitle(order.number)}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <AdminToolbar
          onCancel={handleCancel}
          onSave={() => void run(copy.errorActions.save, saveDraft)}
          onAdd={handleAdd}
          onDelete={() => setDeleteOpen(true)}
          // Cancel — чисто клиентский откат черновика, прав не требует и подсказки не получает.
          cancelState={{ disabled: pending || (!dirty && !newDraftMode) }}
          saveState={{
            disabled: pending || newDraftMode || frozen || preDecision || !dirty || hints.update !== null,
            pending: pending && busyAction === null && !heavyOp,
            hint: hints.update,
          }}
          // «Добавить» тулбара заводит НОВЫЙ заказ (черновик) — это `Create`, а не правка текущего.
          addState={{ disabled: pending || frozen || preDecision || hints.create !== null, hint: hints.create }}
          deleteState={{ disabled: pending || newDraftMode || hints.delete !== null, hint: hints.delete }}
          actionsMenu={
            actionsMenuGroups.length > 0 && (
              <AdminActionsMenu groups={actionsMenuGroups} label={copy.actionsLabel(order.number)} disabled={pending} />
            )
          }
        />
        {!newDraftMode && (
          <OrderContextActions
            order={effectiveOrder}
            pending={pending}
            busyAction={busyAction}
            updateHint={hints.update}
            onApprove={() =>
              void run(copy.errorActions.approve, () => setOrderStatus({ id: order.id, status: OrderStatus.Approved, rejectReason: order.rejectReason }), {
                busy: 'approve',
              })
            }
            onReject={() =>
              void run(copy.errorActions.reject, () => setOrderStatus({ id: order.id, status: OrderStatus.Rejected, rejectReason: order.rejectReason }), {
                busy: 'reject',
              })
            }
            onReopen={() =>
              void run(copy.errorActions.reopen, () => setOrderStatus({ id: order.id, status: OrderStatus.Open, rejectReason: null }), {
                busy: 'reopen',
              })
            }
          />
        )}
      </div>

      {newDraftMode && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
          {copy.newDraftBanner}
        </div>
      )}
      {frozen && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
          {copy.frozenBanner}
        </div>
      )}
      {preDecision && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
          {copy.preDecisionBanner}
        </div>
      )}
      {isRequestOrder && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-700">
          {copy.requestBanner}
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
          className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
        >
          <span aria-hidden="true">✓</span>
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <OrderHeader
          order={effectiveOrder}
          // Причина отказа коммитится через `SetStatus` (`Update`) — без права её нельзя даже
          // набрать: черновик всё равно было бы нечем сохранить.
          pending={blockedForDraft || hints.update !== null}
          onRejectReasonChange={(reason) => setDraft((prev) => ({ ...prev, rejectReason: reason }))}
        />
        <AdminSummaryPanel
          title={copy.summaryTitle}
          className="lg:self-start"
          rows={[
            { key: 'lines', label: copy.summaryLines, value: effectiveOrder.lines.length },
            { key: 'guests', label: copy.summaryGuests, value: guestTotal },
            {
              key: 'gross',
              label: copy.summaryGross,
              value: formatOrderMoney(grossTotal, effectiveOrder.currency, locale),
            },
            {
              key: 'discount',
              label: copy.summaryDiscount,
              value:
                effectiveOrder.discountTotal > 0
                  ? `−${formatOrderMoney(effectiveOrder.discountTotal, effectiveOrder.currency, locale)}`
                  : copy.dash,
            },
            {
              key: 'paid',
              label: copy.summaryPaid,
              value: paidTotal > 0 ? formatOrderMoney(paidTotal, effectiveOrder.currency, locale) : copy.dash,
            },
            {
              key: 'due',
              label: copy.summaryDue,
              value: formatOrderMoney(effectiveOrder.total - paidTotal, effectiveOrder.currency, locale),
              emphasis: true,
            },
          ]}
        />
      </div>

      <Tabs tabs={tabs} activeId={tab} onChange={(id) => setTab(id as OrderDetailTabId)} label={copy.tabsLabel} />

      {tab === 'overview' && (
        <>
          <OrderLinesGrid
            order={effectiveOrder}
            pending={blockedForDraft}
            hints={hints}
            onRequestAssign={(lineId) => setAssignTarget({ lineId })}
            onRequestUnassign={(target) => setUnassignTarget(target)}
            onToggleRequiresPrepayment={(line, requiresPrepayment) => patchLine(line.id, { requiresPrepayment })}
            onSavePrepaymentAmount={(line, prepaymentAmount) => patchLine(line.id, { prepaymentAmount })}
            onAddLine={() => setAddLineOpen(true)}
            onRemoveLines={(lineIds) =>
              run(copy.errorActions.removeLines, async () => {
                for (const lineId of lineIds) await removeOrderLine(lineId)
              })
            }
          />
          {/* Рендерит `null`, если заявок в заказе нет — обычный заказ выглядит как раньше.
              Цена заявки — `UpdateLine` (`Update`), тот же гейт, что у предоплаты в гриде. */}
          <OrderRequestDetails
            order={effectiveOrder}
            pending={blockedForDraft}
            updateHint={hints.update}
            onChangeLineTotal={(line, lineTotal) => patchLine(line.id, { lineTotal })}
          />
        </>
      )}
      {tab === 'payment' && (
        <OrderPaymentTab
          order={effectiveOrder}
          pending={blockedForDraft}
          createHint={hints.create}
          onAddPayment={(lineId, type: OrderPaymentType, amount) =>
            run(copy.errorActions.addPayment, () => addOrderPayment({ orderLineId: lineId, type, amount }))
          }
        />
      )}
      {tab === 'fulfillment' && (
        <OrderFulfillmentTab
          order={effectiveOrder}
          employees={employees}
          // Поля карточек исполнителей — `UpdateLineEmployee` (`Update`): та же логика, что и с
          // причиной отказа выше — не давать набивать черновик, который не сохранить.
          pending={blockedForDraft || hints.update !== null}
          updateHint={hints.update}
          onChangeEmployeeField={(employee, patch) => patchLineEmployee(employee.id, patch)}
          onRequestAssign={(lineId) => setAssignTarget({ lineId })}
          onAssignAndSend={(line) => {
            if (line.employees.length === 0) return
            void run(
              copy.errorActions.assignAndSend,
              () =>
                assignEmployee({
                  orderId: order.id,
                  lineId: line.id,
                  employees: assignItemsOf(line),
                  sendEmail: true,
                }),
              { heavy: true },
            )
          }}
        />
      )}
      {tab === 'history' && <OrderHistoryTab events={newDraftMode ? [] : events} />}

      <AddLineModal
        open={addLineOpen}
        tours={tours}
        vehicleClasses={vehicleClasses}
        pending={pending}
        onClose={() => setAddLineOpen(false)}
        onSubmit={(draft: NewLineDraft) =>
          run(copy.errorActions.addLine, () => addOrderLine({ orderId: order.id, ...draft }), {
            onSuccess: () => setAddLineOpen(false),
          })
        }
      />

      <AssignEmployeesModal
        open={assignTarget !== null}
        lineId={assignTarget?.lineId ?? null}
        lineLabel={
          assignTargetLine === null
            ? null
            : `${lineTitle(assignTargetLine, copy)} · ${assignTargetLine.tourDate}`
        }
        employees={employees}
        alreadyAssignedIds={assignTargetLine?.employees.map((employee) => employee.employeeId) ?? []}
        pending={pending}
        updateHint={hints.update}
        onClose={() => setAssignTarget(null)}
        onSubmit={(pickedEmployees, sendEmail) => {
          const target = assignTarget
          if (target === null) return
          void run(
            sendEmail ? copy.errorActions.assignAndSendEmail : copy.errorActions.assign,
            () =>
              assignEmployee({
                orderId: order.id,
                lineId: target.lineId,
                employees: pickedEmployees,
                sendEmail,
              }),
            { onSuccess: () => setAssignTarget(null), heavy: sendEmail },
          )
        }}
      />

      <Modal
        open={unassignTarget !== null}
        onClose={() => setUnassignTarget(null)}
        title={
          unassignTarget?.employeeId === null || unassignTarget === null
            ? copy.unassignConfirmTitleAll
            : copy.unassignConfirmTitleOne
        }
      >
        <p className="text-sm text-neutral-600">
          {unassignTarget === null || unassignTarget.employeeId === null
            ? copy.unassignConfirmBodyAll
            : copy.unassignConfirmBodyOne(unassignTarget.employeeName?.trim() || copy.dash)}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setUnassignTarget(null)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.unassignConfirmDismiss}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const target = unassignTarget
              if (target === null) return
              setUnassignTarget(null)
              void run(copy.errorActions.unassign, () =>
                unassignEmployee({ orderId: order.id, lineId: target.lineId, employeeId: target.employeeId }),
              )
            }}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.unassignConfirmAction}
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={copy.deleteConfirmTitle}>
        <p className="text-sm text-neutral-600">{copy.deleteConfirmBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeleteOpen(false)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.deleteConfirmDismiss}
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
                  setError(ordersErrorMessage(copy, err, copy.errorActions.delete))
                  setPending(false)
                })
            }}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.deleteConfirmAction}
          </Button>
        </div>
      </Modal>

      <Modal
        open={pendingSendAfterSave !== null}
        onClose={() => setPendingSendAfterSave(null)}
        title={copy.saveBeforeSendTitle}
      >
        <p className="text-sm text-neutral-600">{copy.saveBeforeSendBody}</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPendingSendAfterSave(null)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.saveBeforeSendCancel}
          </Button>
          <Button
            type="button"
            onClick={() => void confirmSaveThenSend()}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.saveBeforeSendConfirm}
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
            <span className="text-sm font-medium text-neutral-800">{copy.heavyOpOverlay}</span>
          </div>
        </div>
      )}
    </div>
  )
}
