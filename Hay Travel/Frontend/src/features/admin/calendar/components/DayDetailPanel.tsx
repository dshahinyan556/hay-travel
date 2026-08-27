import { useMemo, useRef } from 'react'
import { parseISODate } from '@/shared/lib/date'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import type { TourInfoModel } from '@/shared/types/attours'
import type { CalendarDayModel, ClosureRuleInfoModel, DayOfWeekCode } from '@/shared/types/booking'
import { calendarCopy, type CalendarCopy } from '../lib/calendarCopy'
import { tourTitleResolver, type CalendarOrderLine } from '../lib/calendarModel'
import { DayClosureControls } from './DayClosureControls'
import { DayOrdersList } from './DayOrdersList'

export interface DayDetailPanelProps {
  open: boolean
  dateISO: string | null
  /** The server's row for this day; `null` for a tail day of a neighbouring month. */
  day: CalendarDayModel | null
  /** Already narrowed to this day by the page. */
  orders: CalendarOrderLine[]
  tours: TourInfoModel[]
  rules: ClosureRuleInfoModel[]
  pending: boolean
  /** Бэкдейтинг запрещён везде (B12, 2026-08-13) — прошедший день остаётся открываемым
   * (история заказов читается), но его availability-контролы заблокированы. */
  isPast: boolean
  /** `calendar.Create` && `calendar.Delete` — see `DayClosureControls.canManage`. */
  canManage: boolean
  /** Why the closure block is read-only when `canManage` is false. */
  readOnlyHint: string
  onClose: () => void
  onToggleClosure: (tourIds: (number | null)[], close: boolean, reason: string | null) => void
}

/** "12 августа 2026, среда" / "12 August 2026, Wednesday" — genitive month, which is what a date
 * reads like in Russian (English has no genitive, so its list is the plain one). */
function formatFullDate(dateISO: string, copy: CalendarCopy): string {
  const date = parseISODate(dateISO)
  if (date === null) return dateISO
  // `getDay()` is Sunday-first, which is exactly `System.DayOfWeek` — the same numbering
  // `copy.weekdayFull` is keyed by.
  const weekday = copy.weekdayFull[date.getDay() as DayOfWeekCode]
  return `${date.getDate()} ${copy.monthsGenitive[date.getMonth()]} ${date.getFullYear()}, ${weekday}`
}

/**
 * Everything about one day: availability controls on top, that day's orders below.
 *
 * Makes NO requests — the month's orders are already in the hook's cache (ADR 016), which is why
 * opening a day is instant. A tail day of a neighbouring month has no loaded data, so its orders
 * section says so while the closure controls stay usable: a rule can be created for any date.
 */
export function DayDetailPanel({
  open,
  dateISO,
  day,
  orders,
  tours,
  rules,
  pending,
  isPast,
  canManage,
  readOnlyHint,
  onClose,
  onToggleClosure,
}: DayDetailPanelProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()

  // `SidePanel` stays mounted through its slide-out; `dateISO` is already `null` by then, and a
  // heading that blanks mid-animation looks like a bug. Remember the last real one.
  const lastTitle = useRef('')
  if (dateISO !== null) lastTitle.current = formatFullDate(dateISO, copy)

  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])

  return (
    <SidePanel open={open} onClose={onClose} title={lastTitle.current}>
      {dateISO !== null && (
        <div className="flex flex-col gap-5">
          <DayClosureControls
            dateISO={dateISO}
            day={day}
            tours={tours}
            rules={rules}
            pending={pending}
            isPast={isPast}
            canManage={canManage}
            readOnlyHint={readOnlyHint}
            onToggle={onToggleClosure}
          />

          <section className="border-t border-neutral-200 pt-5">
            <h3 className="text-sm font-bold text-neutral-900">{copy.ordersTitle}</h3>
            <div className="mt-3">
              {day === null ? (
                <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
                  {copy.noDayData}
                </p>
              ) : (
                <DayOrdersList orders={orders} tourTitle={tourTitle} />
              )}
            </div>
          </section>
        </div>
      )}
    </SidePanel>
  )
}
