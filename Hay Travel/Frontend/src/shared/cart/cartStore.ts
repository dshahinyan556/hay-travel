/**
 * The cart store: a module-level observable, deliberately OUTSIDE React (ADR 022).
 *
 * Same idiom as `shared/auth/authStore.ts` (ADR 007) and `shared/currency/currencyStore.ts`
 * (ADR 009) — a module variable holding an immutable snapshot, a `Set` of listeners, and
 * `useSyncExternalStore` bindings in `useCart.ts`. No Context and no Zustand:
 *  - `cartLoader` must read the cart BEFORE render, from outside React;
 *  - two independent subtrees read it (`app/layout`'s badge and `/cart`), and non-React code
 *    (`BookingCard`'s submit handler) mutates it;
 *  - a third way of holding state is a cost every later change pays.
 *
 * The cart is a client-side accumulator: nothing here ever reaches the backend until the visitor
 * presses "Отправить заявку", at which point the WHOLE cart becomes ONE multi-line order
 * (ADR 025). Signing out does not touch it — it belongs to the device, carries no personal data,
 * and has no server-side counterpart to merge with.
 *
 * MONEY IS NOT STORED. A price frozen in localStorage is the worst kind of wrong data; `/cart`
 * always recomputes every figure from the fresh `TourDetail` its loader fetched.
 */

import { formatISODate, stripTime } from '@/shared/lib/date'
import { clampGuests } from '@/shared/booking'
import type { AddCartItemInput, AddCartItemResult, CartItem, CartItemSnapshot, CartState } from './types'

export const CART_STORAGE_KEY = 'hay-travel-cart'
export const CART_STORAGE_VERSION = 1

/**
 * Hard cap on cart size. Mirrored by the backend (`OrderTooManyLines` 2032, spec 013) — this is
 * the maximum number of LINES in one order, so the two values are not allowed to drift apart.
 */
export const MAX_CART_ITEMS = 10

/** Past this age a stored position stops being a plan and becomes clutter. */
const MAX_ITEM_AGE_MS = 30 * 24 * 60 * 60 * 1000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface StoredCart {
  version: number
  items: unknown
}

/**
 * Позиция адресуется парой «тур + дата», а не UUID, и это не деталь реализации (§4.3 п.1):
 *  - повторное добавление того же тура на ту же дату обязано ОБНОВИТЬ строку, а не создать
 *    визуальный дубль;
 *  - чекаут раскладывает пер-строчные ошибки сервера обратно по позициям и в запасном пути
 *    собирает ключ из `tourId` + `tourDate` ответа (§7.5) — с UUID это было бы невозможно.
 */
function itemId(tourId: number, tourDate: string): string {
  return `${tourId}:${tourDate}`
}

/* -------------------------------------------------------------------------- */
/*  localStorage                                                               */
/* -------------------------------------------------------------------------- */

function sanitizeSnapshot(value: unknown): CartItemSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const { title, coverImage, kind, durationDays, durationNights } = value as Partial<CartItemSnapshot>
  if (typeof title !== 'string' || title === '') return null
  return {
    title,
    coverImage: typeof coverImage === 'string' ? coverImage : '',
    kind: kind === 'tour' || kind === 'excursion' ? kind : 'excursion',
    durationDays: typeof durationDays === 'number' && Number.isFinite(durationDays) ? durationDays : 1,
    durationNights: typeof durationNights === 'number' && Number.isFinite(durationNights) ? durationNights : 0,
  }
}

/**
 * Drops bad rows instead of throwing — same policy as `sanitizeRates` in the currency store. A
 * hand-edited (or version-skewed) cart must degrade to "fewer positions", never to a blank page.
 *
 * Past dates are dropped by STRING comparison of ISO days: `new Date('2026-07-27')` is UTC
 * midnight and would render as the 26th west of UTC (see `shared/lib/date`).
 */
function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []

  const todayISO = formatISODate(stripTime(new Date()))
  const now = Date.now()
  // Deduplicated by the rebuilt id, bigger `addedAt` wins.
  const byId = new Map<string, CartItem>()

  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const { tourId, tourDate, guestCount, addedAt, snapshot } = row as Partial<CartItem>

    if (typeof tourId !== 'number' || !Number.isFinite(tourId)) continue
    if (typeof tourDate !== 'string' || !ISO_DATE.test(tourDate)) continue
    if (tourDate < todayISO) continue

    const snap = sanitizeSnapshot(snapshot)
    if (snap === null) continue

    const added = typeof addedAt === 'number' && Number.isFinite(addedAt) ? addedAt : now
    if (now - added > MAX_ITEM_AGE_MS) continue

    const id = itemId(tourId, tourDate)
    const item: CartItem = {
      id,
      tourId,
      tourDate,
      guestCount: clampGuests(typeof guestCount === 'number' ? guestCount : Number.NaN),
      addedAt: added,
      snapshot: snap,
    }
    const existing = byId.get(id)
    if (!existing || existing.addedAt < item.addedAt) byId.set(id, item)
  }

  // Oldest first, and the cap keeps the FIRST ten — the same ten `addCartItem` would have kept by
  // refusing the eleventh.
  return [...byId.values()].sort((a, b) => a.addedAt - b.addedAt).slice(0, MAX_CART_ITEMS)
}

function readStoredItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<StoredCart>
    // A future version is not "a cart we can partially read": its item shape is unknown, so the
    // only honest answer is an empty cart.
    if (parsed?.version !== CART_STORAGE_VERSION) return []
    return sanitizeItems(parsed.items)
  } catch {
    return []
  }
}

function writeStoredItems(items: readonly CartItem[]): void {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ version: CART_STORAGE_VERSION, items } satisfies StoredCart),
    )
  } catch {
    /* ignore — Safari private mode etc.: the cart degrades to "this tab only", never throws */
  }
}

/* -------------------------------------------------------------------------- */
/*  State                                                                      */
/* -------------------------------------------------------------------------- */

let state: CartState = { items: readStoredItems() }
const listeners = new Set<() => void>()

/** Current snapshot. Referentially stable until something actually changes — `useSyncExternalStore`
 * requires that to avoid an infinite render loop. */
export function getCartState(): CartState {
  return state
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Replace the snapshot wholesale (never mutate it) and notify subscribers. */
function setState(next: CartState): void {
  state = next
  for (const listener of listeners) listener()
}

/** Persist + publish in one step, so the two can never disagree. */
function commit(items: readonly CartItem[]): void {
  const sorted = [...items].sort((a, b) => a.addedAt - b.addedAt)
  writeStoredItems(sorted)
  setState({ items: sorted })
}

/* -------------------------------------------------------------------------- */
/*  Mutations                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Adds a position, or updates the guest count of the one already holding this exact
 * "tour + date" pair. The same tour on a DIFFERENT date is a legitimate second position.
 *
 * `addedAt` is deliberately NOT refreshed on update: a position must not jump to the end of the
 * list just because the guest count changed. The snapshot IS refreshed — the caller always has
 * fresher tour data than localStorage does, and a stale title helps nobody.
 */
export function addCartItem(input: AddCartItemInput): AddCartItemResult {
  const id = itemId(input.tourId, input.tourDate)
  const existing = state.items.find((item) => item.id === id)

  if (existing) {
    commit(
      state.items.map((item) =>
        item.id === id
          ? { ...item, guestCount: clampGuests(input.guestCount), snapshot: input.snapshot }
          : item,
      ),
    )
    return 'updated'
  }

  // The cap applies to NEW positions only — updating an existing one is never blocked by it.
  if (state.items.length >= MAX_CART_ITEMS) return 'full'

  commit([
    ...state.items,
    {
      id,
      tourId: input.tourId,
      tourDate: input.tourDate,
      guestCount: clampGuests(input.guestCount),
      addedAt: Date.now(),
      snapshot: input.snapshot,
    },
  ])
  return 'added'
}

/**
 * Edits a position in place (the `/cart` row's date picker and guest stepper).
 *
 * Changing the date changes the position's identity, so the id is rebuilt. If the new id is
 * already taken by another position, the two MERGE: the edited row survives with its own guest
 * count and the other one is dropped — otherwise the cart would show two visually identical rows
 * that the backend would also reject as a duplicate line.
 */
export function updateCartItem(id: string, patch: { tourDate?: string; guestCount?: number }): void {
  const current = state.items.find((item) => item.id === id)
  if (!current) return

  const tourDate = patch.tourDate ?? current.tourDate
  if (!ISO_DATE.test(tourDate)) return
  const guestCount = clampGuests(patch.guestCount ?? current.guestCount)

  if (tourDate === current.tourDate && guestCount === current.guestCount) return

  const nextId = itemId(current.tourId, tourDate)
  const next: CartItem = { ...current, id: nextId, tourDate, guestCount }

  commit([
    // Drops both the old row (replaced below) and any row already sitting on the new id.
    ...state.items.filter((item) => item.id !== id && item.id !== nextId),
    next,
  ])
}

export function removeCartItem(id: string): void {
  if (!state.items.some((item) => item.id === id)) return
  commit(state.items.filter((item) => item.id !== id))
}

export function clearCart(): void {
  if (state.items.length === 0) return
  commit([])
}

/** Позиция для этого тура на эту дату, если она уже в корзине. Для подписи кнопки в BookingCard. */
export function findCartItem(tourId: number, tourDate: string): CartItem | undefined {
  return state.items.find((item) => item.id === itemId(tourId, tourDate))
}

/* -------------------------------------------------------------------------- */
/*  Cross-tab sync                                                             */
/* -------------------------------------------------------------------------- */

/*
  Not polish — data loss prevention. "Open three tours in three tabs" is a real way to fill a
  cart, and without this the tab that writes last would silently overwrite what the other two
  added. Registered at module init (mirroring the currency store) so it works regardless of what
  is mounted.
*/
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== CART_STORAGE_KEY) return
    // Re-read rather than trusting `event.newValue`: the same sanitiser has to run on it, and a
    // `null` newValue (the key was removed) is just "empty cart".
    setState({ items: readStoredItems() })
  })
}
