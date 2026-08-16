/**
 * Wire types for orders, closure rules and the availability calendar — a 1:1 mirror of the
 * backend contract (spec 001 §2.4), in the same deliberately "dumb" DTO style as
 * `shared/types/attours.ts`.
 *
 * Unlike `attours.ts` (admin-only), these live in `shared/types` because BOTH sides consume them:
 * the admin calendar reads `CalendarMonthModel`/`ClosureRuleInfoModel`, and the public booking
 * card posts `OrderCreateModel` and reads back `OrderInfoModel`. A feature cannot import another
 * feature's types, so anything two features share has to sit here.
 *
 * Dates are STRINGS, never `Date`. Two independent reasons:
 *  - `Order.TourDate` and every `ClosureRule` date are `DateOnly` server-side — a wall-clock
 *    calendar day, with no time and no timezone. `Date` cannot represent that without inventing
 *    an instant.
 *  - `new Date('2026-07-27')` parses as UTC midnight, which local-renders as the 26th anywhere
 *    west of UTC (see `shared/lib/date.ts`'s `parseISODate`). Keeping the wire shape as
 *    `YYYY-MM-DD` strings means that trap can only be hit by explicitly calling the wrong parser.
 * `createdAtUtc` is the one exception: it IS an instant, and arrives as an ISO-8601 UTC timestamp.
 *
 * Enums are frozen const objects + a value-union (`erasableSyntaxOnly` forbids TS `enum` — same
 * convention as `features/admin/lib/enums.ts` and `shared/auth/types.ts`).
 */

export const OrderStatus = {
  PendingConfirmation: 1,
  Confirmed: 2,
  Cancelled: 3,
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

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

/**
 * The money side of an order, computed and owned by the server (ADR 014).
 *
 * Never rendered anywhere on the frontend: the server multiplies `tourPriceSnapshot` by the guest
 * count and knows nothing about the public site's 5–6 guest tiered surcharge
 * (`shared/currency/pricing.ts`), so its total can legitimately differ from the "Итого" the
 * visitor just saw. See spec 003 §4.3 p.7.
 */
export interface OrderPaymentInfoModel {
  /** Original tour price at order time, BEFORE any discount (D-1, 2026-08-16). */
  tourPriceSnapshot: number
  /** Snapshot of the discount tag's percent at order time, `null` — no discount was applied.
   * A later edit/removal of the tag never changes this retroactively. */
  discountPercent: number | null
  totalAmount: number
  prepaidAmount: number
  currency: string
}

export interface OrderInfoModel {
  id: number
  userId: number
  /** Denormalized for the admin list — no second request to resolve the customer. */
  userEmail: string
  userFullName: string
  tourId: number
  /** Already resolved to a language server-side: RU in the admin list (`GetAll`). */
  tourTitle: string
  tourMainImageUrl: string | null
  /** `DateOnly` on the wire — `YYYY-MM-DD`, NOT an ISO timestamp. */
  tourDate: string
  guestCount: number
  status: OrderStatus
  /** ISO-8601 UTC instant. */
  createdAtUtc: string
  /** ISO-8601 UTC instant. `null` while `PendingConfirmation`. */
  confirmedAtUtc: string | null
  payment: OrderPaymentInfoModel
}

/** `PUT api/Order/Update` payload — only while `status === PendingConfirmation` (B12,
 * 2026-08-13). `tourId` is not editable: a different tour is a different order. */
export interface OrderUpdateModel {
  id: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
}

/** `POST api/Order/Create`. No `userId`: the server takes it from the token, never from the body
 * (spec 001 §5.1, IDOR guard). No money and no status either — both are server-side. */
export interface OrderCreateModel {
  tourId: number
  /** `YYYY-MM-DD`. */
  tourDate: string
  guestCount: number
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
  /** Причина победившего глобального правила закрытия (B12, 2026-08-13); `null` — день
   * открыт, или причина не указывалась. Только для глобального закрытия. */
  closureReason: string | null
  closedTourIds: number[]
  /** Sum over `ordersByTour`. Cancelled orders are excluded server-side. */
  totalOrders: number
  ordersByTour: CalendarDayTourOrdersModel[]
}

export interface CalendarMonthModel {
  year: number
  /** 1–12, as the backend sends it. `Date`'s month is 0-based — convert at the boundary. */
  month: number
  days: CalendarDayModel[]
}
