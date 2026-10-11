/**
 * Pure helpers of the products list: which tours each view shows, what a row says about a product
 * (meta line + price) and how the featured-order draft is measured. No state, no I/O, no React.
 */

import { TourFormat, TourType } from '@/features/admin/lib/enums'
import { wireTimeToForm } from '@/features/admin/lib/tourMapper'
import { formatTotalPrice } from '@/features/admin/tour-form/lib/price'
import type { Locale } from '@/shared/lib/locale'
import type { TourInfoModel } from '@/shared/types/attours'
import type { ProductsCopy } from './productsCopy'

/** The three views of the screen, switched by the chips in the control zone. */
export type ProductsView = 'active' | 'featured' | 'archived'

/** Featured tours in the order the public «Избранное» block shows them (`featuredSortOrder`). */
export function featuredOf(tours: TourInfoModel[]): TourInfoModel[] {
  return tours.filter((t) => t.isFeatured).sort((a, b) => a.featuredSortOrder - b.featuredSortOrder)
}

/** One piece of a row's meta line. `wide` pieces are dropped on phones (the mobile card shows only
 * the type and the duration, per the approved mockup's phone frame). */
export interface ProductMetaPart {
  text: string
  wide: boolean
}

function formatCaption(format: number | null | undefined, copy: ProductsCopy['row']): string | null {
  if (format === TourFormat.Individual) return copy.formatIndividual
  if (format === TourFormat.Group) return copy.formatGroup
  if (format === TourFormat.Both) return copy.formatBoth
  return null
}

/**
 * The row's meta line: «Тур · 5 дней», «старт 09:00, 13:00», «групповой» — or, for a transfer,
 * «Трансфер», «3 класса авто». Start times are listed chronologically, like the editor keeps them.
 */
export function productMeta(
  tour: TourInfoModel,
  typeLabel: string,
  copy: ProductsCopy['row'],
): ProductMetaPart[] {
  if (tour.type === TourType.Transfer) {
    const classes = tour.transferPrices?.length ?? 0
    return [
      { text: typeLabel, wide: false },
      ...(classes > 0 ? [{ text: copy.vehicleClasses(classes), wide: false }] : []),
    ]
  }

  const parts: ProductMetaPart[] = [
    { text: `${typeLabel} · ${copy.days(tour.tourDays.length)}`, wide: false },
  ]
  const times = (tour.startTimes ?? [])
    .map((slot) => wireTimeToForm(slot.time))
    .filter((time) => time !== '')
    .sort()
  if (times.length > 0) parts.push({ text: copy.startTimes(times.join(', ')), wide: true })
  const format = formatCaption(tour.format, copy)
  if (format) parts.push({ text: format, wide: true })
  return parts
}

/**
 * The row's price, in the same «15 000 ֏» form the product card uses (`formatTotalPrice`):
 *  - transfer — the cheapest one-way price over its vehicle classes, «от …»;
 *  - group-only format — the per-person price, «… / чел.» (the group price is hidden for this
 *    format on the card too, решение 0.26);
 *  - otherwise — the server-computed `totalPrice` (sum of the days), «от …»: the group-size
 *    surcharge can only raise it.
 * `null` when the product has no price yet.
 */
export function productPrice(tour: TourInfoModel, locale: Locale, copy: ProductsCopy['row']): string | null {
  if (tour.type === TourType.Transfer) {
    const prices = (tour.transferPrices ?? []).map((p) => p.oneWayPrice).filter((p) => p > 0)
    return prices.length > 0 ? copy.priceFrom(formatTotalPrice(Math.min(...prices), locale)) : null
  }
  if (tour.format === TourFormat.Group) {
    const perPerson = tour.groupPricePerPerson ?? 0
    return perPerson > 0 ? copy.pricePerPerson(formatTotalPrice(perPerson, locale)) : null
  }
  const total = tour.totalPrice ?? 0
  return total > 0 ? copy.priceFrom(formatTotalPrice(total, locale)) : null
}

/**
 * Which items of `current` count as MOVED relative to `original` (both hold the same ids): every
 * item outside one longest subsequence that is still in the original relative order. That is the
 * smallest set of items whose moves explain the new order — dragging one product to the top marks
 * that one product, not every product it pushed down a slot.
 */
export function movedIds(original: number[], current: number[]): Set<number> {
  const position = new Map(original.map((id, index) => [id, index]))
  const sequence = current.map((id) => position.get(id) ?? -1)
  const length = sequence.map(() => 1)
  const previous = sequence.map(() => -1)
  let best = -1
  for (let i = 0; i < sequence.length; i++) {
    for (let j = 0; j < i; j++) {
      if (sequence[j] < sequence[i] && length[j] + 1 > length[i]) {
        length[i] = length[j] + 1
        previous[i] = j
      }
    }
    if (best === -1 || length[i] > length[best]) best = i
  }
  const stayed = new Set<number>()
  for (let i = best; i !== -1; i = previous[i]) stayed.add(i)
  return new Set(current.filter((_, index) => !stayed.has(index)))
}
