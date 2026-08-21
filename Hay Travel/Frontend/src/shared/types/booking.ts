/**
 * Wire types for orders, closure rules and the availability calendar — a 1:1 mirror of the
 * backend contract, in the same deliberately "dumb" DTO style as `shared/types/attours.ts`.
 *
 * Unlike `attours.ts` (admin-only), these live in `shared/types` because BOTH sides consume them:
 * the admin calendar reads `CalendarMonthModel`/`ClosureRuleInfoModel`, and the public booking
 * card posts `OrderCreateModel` and reads back `OrderInfoModel`. A feature cannot import another
 * feature's types, so anything two features share has to sit here.
 *
 * Dates are STRINGS, never `Date`. Two independent reasons:
 *  - `OrderLine.TourDate` and every `ClosureRule` date are `DateOnly` server-side — a wall-clock
 *    calendar day, with no time and no timezone. `Date` cannot represent that without inventing
 *    an instant.
 *  - `new Date('2026-07-27')` parses as UTC midnight, which local-renders as the 26th anywhere
 *    west of UTC (see `shared/lib/date.ts`'s `parseISODate`). Keeping the wire shape as
 *    `YYYY-MM-DD` strings means that trap can only be hit by explicitly calling the wrong parser.
 * `createdAtUtc`/`approvedAtUtc` are the exception: they ARE instants, and arrive as ISO-8601 UTC
 * timestamps.
 *
 * Enums are frozen const objects + a value-union (`erasableSyntaxOnly` forbids TS `enum` — same
 * convention as `features/admin/lib/enums.ts` and `shared/auth/types.ts`).
 *
 * ── Order became multi-line (ADR 019, 2026-08-16) ─────────────────────────────────────────────
 * `Order` is now a header (status/number/owner/currency) over a list of `OrderLine`s, each
 * carrying its own tour/date/guests/money/employee/fulfillment details. `OrderPayment` became a
 * ledger of transactions per line, not a 1:1 money snapshot of the whole order (see ADR 019). A
 * booking from the PUBLIC site is still always exactly one line — `OrderCreateModel` is unchanged
 * — multi-line is an admin-only capability (adding lines to an existing order, see
 * `OrderLineCreateModel`).
 */

export const OrderStatus = {
  /** Just created (site booking OR added manually in admin), no line requires prepayment yet. */
  Open: 1,
  /** On hold: line editing is disabled, only deletion is available. */
  Hold: 2,
  /** Approved by an admin. */
  Approved: 3,
  /** Rejected. Editing is disabled, only deletion is available. `rejectReason` explains why. */
  Rejected: 4,
  /** Approved and prepayment percentages are set on the lines — ready to assign employees. */
  ReadyForAssignment: 5,
  /** Created and at least one line requires prepayment — waiting for it before moving on. */
  PendingPayment: 6,
  /** Fulfilled ("Завершить" action). */
  Completed: 7,
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

/** One entry of an `OrderLine`'s money ledger — a transaction, not a snapshot (ADR 019). */
export const OrderPaymentType = {
  Prepayment: 1,
  Payment: 2,
} as const

export type OrderPaymentType = (typeof OrderPaymentType)[keyof typeof OrderPaymentType]

export const ClosureRuleType = {
  /** One concrete calendar date (`date` set, `dayOfWeek` null). */
  SpecificDate: 1,
  /** Repeats on a weekday, optionally bounded by `effectiveFrom`/`effectiveTo`. */
  Weekly: 2,
} as const

export type ClosureRuleType = (typeof ClosureRuleType)[keyof typeof ClosureRuleType]

export const ClosureAction = {
  Close: 1,
  /** An exception that re-opens a day an overlapping rule closed (ADR 012 precedence). */
  Open: 2,
} as const

export type ClosureAction = (typeof ClosureAction)[keyof typeof ClosureAction]

/** `System.DayOfWeek` — Sunday = 0 … Saturday = 6. NOT the Monday-first grid index used by
 * `mondayFirstWeekday`/`getMonthGrid` in `shared/lib/date.ts`; converting between the two is a
 * per-call-site concern and is done explicitly wherever both appear. */
export const DayOfWeekCode = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const

export type DayOfWeekCode = (typeof DayOfWeekCode)[keyof typeof DayOfWeekCode]

/* -------------------------------------------------------------------------- */
/*  Orders                                                                     */
/* -------------------------------------------------------------------------- */

/** One transaction in an `OrderLine`'s money ledger (ADR 019 — replaces the old 1:1
 * `OrderPaymentInfoModel` snapshot). Has its own addressable `id` and human `number` (`PP` +
 * digits, server-generated). */
export interface OrderPaymentInfoModel {
  id: number
  orderLineId: number
  type: OrderPaymentType
  number: string
  amount: number
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
}

/**
 * One line of an order — its own tour/date/guests/money/employee/fulfillment details (ADR 019).
 * `tourTitle`/`tourMainImageUrl`/`employeeFullName` are denormalized server-side so the list and
 * detail screens never need a second request to resolve them.
 */
export interface OrderLineInfoModel {
  id: number
  tourId: number
  /** Already resolved to a language server-side: RU in the admin list/detail. */
  tourTitle: string | null
  tourMainImageUrl: string | null
  /** `DateOnly` on the wire — `YYYY-MM-DD`, NOT an ISO timestamp. */
  tourDate: string
  guestCount: number

  requiresPrepayment: boolean
  prepaymentAmount: number

  /** Tour price at the moment this line was added, BEFORE any discount. */
  priceSnapshot: number
  /** Snapshot of the tour's discount percent at that moment, `null` — no discount was applied. A
   * later edit/removal of the tour's discount never changes this retroactively. */
  discountPercent: number | null
  /** `priceSnapshot` with `discountPercent` applied — this line's contribution to `Order.total`. */
  lineTotal: number

  employeeId: number | null
  employeeFullName: string | null

  /** "Где забрать клиента" — free text, admin-entered, `null` until set. */
  pickupDetails: string | null
  /** Navigator/maps link — free text, admin-entered, `null` until set. */
  navigatorLink: string | null

  payments: OrderPaymentInfoModel[]
}

/** The order header — status/number/owner/currency plus its lines. Money/tour/date all live on
 * `OrderLineInfoModel` now (ADR 019); `discountTotal`/`total` are aggregates the SERVER computes
 * over the lines, so the frontend never re-sums the grid on every render. */
export interface OrderInfoModel {
  id: number
  /** DDMMYY + a 4-digit daily counter (resets every day) — the human-facing order number, shown
   * everywhere instead of `id`. */
  number: string
  userId: number
  /** Denormalized for the admin list — no second request to resolve the customer. */
  userEmail: string
  userFullName: string
  status: OrderStatus
  /** Only meaningful while `status === Rejected`; `null` otherwise. */
  rejectReason: string | null
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
  /** ISO-8601 UTC instant. `null` until the order is first set to `Approved`. */
  approvedAtUtc: string | null
  currency: string

  lines: OrderLineInfoModel[]

  /** Sum of each line's snapshot-price × discount — server-computed aggregate. */
  discountTotal: number
  /** Sum of `lines[].lineTotal` — server-computed aggregate. */
  total: number
}

/** `PUT api/Order/Update` payload — a visitor editing THEIR OWN booking (always one line), only
 * while `status` is `Open`/`PendingPayment`. `id` is the `Order.id`, not a line id — editing a
 * specific line of an admin-built multi-line order is a different endpoint
 * (`OrderLineUpdateModel`). `tourId` is not editable: a different tour is a different order. */
export interface OrderUpdateModel {
  id: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

/** `POST api/Order/Create`. No `userId`: the server takes it from the token, never from the body
 * (IDOR guard). No money and no status either — both are server-side. Always creates exactly one
 * line. */
export interface OrderCreateModel {
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

/** `POST api/Order/AddLine` — admin adds a line to an existing order. */
export interface OrderLineCreateModel {
  orderId: number
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
  requiresPrepayment: boolean
  prepaymentAmount: number
}

/** `PUT api/Order/UpdateLine` — admin edits one line's prepayment + fulfillment details. Employee
 * assignment is a separate endpoint (`OrderAssignEmployeeModel`) — it has its own bulk semantics. */
export interface OrderLineUpdateModel {
  id: number
  requiresPrepayment: boolean
  prepaymentAmount: number
  pickupDetails: string | null
  navigatorLink: string | null
}

/** `PATCH api/Order/SetStatus` — replaces the old Confirm/Cancel pair (ADR 019, 7 statuses). Any
 * status is reachable from any other — this is a plain dropdown, not a state machine.
 * `rejectReason` is only read by the server when `status === Rejected`. */
export interface OrderStatusUpdateModel {
  id: number
  status: OrderStatus
  rejectReason: string | null
}

/** `PATCH api/Order/AssignEmployee`. `lineId: null` assigns EVERY line of the order at once (the
 * "назначить на все строки" bulk action) — each line can still be re-assigned individually
 * afterwards with a follow-up call carrying that line's id. `sendEmail` (default `true` server-side
 * when omitted) controls whether the assignment PDF+email fires — `false` is the assign-popup's
 * silent "Назначить" button, `true`/omitted is "Назначить и отправить письмо". */
export interface OrderAssignEmployeeModel {
  orderId: number
  employeeId: number
  lineId: number | null
  sendEmail?: boolean
}

/** Order-history audit log entry type (`docs/specs/007-order-event-log-backend.md`) — read-only,
 * written server-side after each mutation, never posted by the client. */
export const OrderEventType = {
  Created: 1,
  StatusChanged: 2,
  Updated: 3,
  LineAdded: 4,
  LineRemoved: 5,
  LineUpdated: 6,
  EmployeeAssigned: 7,
  SentToClient: 8,
  PaymentAdded: 9,
} as const

export type OrderEventType = (typeof OrderEventType)[keyof typeof OrderEventType]

/** `GET api/Order/{id}/Events` element — the "История" tab's readonly timeline. `description` is
 * a ready-to-render Russian sentence built server-side (e.g. "Статус изменён: «Открыт» →
 * «Одобрен»") — the client never reconstructs event text from `type` + raw fields, `type` is only
 * used for the small tag pill next to each row. */
export interface OrderEventInfoModel {
  id: number
  type: OrderEventType
  description: string
  actorUserId: number | null
  /** Snapshot of the actor's name AT THE TIME of the event — not re-resolved if they're renamed
   * later. `null` for system/unauthenticated-actor events, if any ever occur. */
  actorFullName: string | null
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
}

/** `POST api/Order/AddPayment` — a manual ledger entry (no payment gateway; the admin records the
 * fact of payment themselves). `number` is server-generated, not accepted here. */
export interface OrderPaymentCreateModel {
  orderLineId: number
  type: OrderPaymentType
  amount: number
}

/* -------------------------------------------------------------------------- */
/*  Closure rules                                                              */
/* -------------------------------------------------------------------------- */

export interface ClosureRuleInfoModel {
  id: number
  /** `null` = global rule, applying to every tour. */
  tourId: number | null
  type: ClosureRuleType
  action: ClosureAction
  /** Set iff `type === SpecificDate`. */
  date: string | null
  /** Set iff `type === Weekly`. */
  dayOfWeek: DayOfWeekCode | null
  /** Inclusive lower bound of a `Weekly` rule; `null` = unbounded. */
  effectiveFrom: string | null
  /** Inclusive upper bound of a `Weekly` rule; `null` = unbounded. */
  effectiveTo: string | null
  /** Internal admin note. Not translatable, not shown to visitors. */
  reason: string | null
  /** Every rule created by the same `CreateRules` call (one bulk operation, or a single toggle —
   * both go through it) shares one `batchId` — the admin screen groups rows by it. `null` only
   * for rules created before this column existed (2026-08-14). */
  batchId: string | null
}

/** One element of the `POST api/Availability/CreateRules` list payload. */
export interface ClosureRuleCreateModel {
  tourId: number | null
  type: ClosureRuleType
  action: ClosureAction
  date?: string | null
  dayOfWeek?: DayOfWeekCode | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  reason?: string | null
}

/* -------------------------------------------------------------------------- */
/*  Availability calendar                                                      */
/* -------------------------------------------------------------------------- */

export interface CalendarDayTourOrdersModel {
  tourId: number
  orderCount: number
  /** Total guests across this tour's orders on this day. */
  guestCount: number
}

/** One day of the admin month grid. Closure flags are the server's RESOLVED answer (rules are
 * stored, not materialized — ADR 012), so the client never recomputes them for display. */
export interface CalendarDayModel {
  date: string
  isClosedGlobally: boolean
  /** Причина победившего глобального правила закрытия; `null` — день открыт, или причина не
   * указывалась. Только для глобального закрытия. */
  closureReason: string | null
  closedTourIds: number[]
  /** Sum over `ordersByTour`. Rejected orders are excluded server-side (`OrderCalendarInfo`). */
  totalOrders: number
  ordersByTour: CalendarDayTourOrdersModel[]
}

export interface CalendarMonthModel {
  year: number
  /** 1–12, as the backend sends it. `Date`'s month is 0-based — convert at the boundary. */
  month: number
  days: CalendarDayModel[]
}
