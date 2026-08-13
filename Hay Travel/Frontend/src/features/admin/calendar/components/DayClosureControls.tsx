import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Input, Textarea } from '@/shared/ui'
import type { TourInfoModel } from '@/shared/types/attours'
import {
  ClosureRuleType,
  type CalendarDayModel,
  type ClosureRuleInfoModel,
} from '@/shared/types/booking'
import { calendarCopy } from '../lib/calendarCopy'
import { tourTitleResolver } from '../lib/calendarModel'
import { MAX_REASON_LENGTH } from '../lib/closureRuleForm'

export interface DayClosureControlsProps {
  dateISO: string
  /** The server's row for this day, or `null` for a tail day outside the loaded month. */
  day: CalendarDayModel | null
  tours: TourInfoModel[]
  /** ALL rules, used only to explain WHERE the current state comes from — never to compute it. */
  rules: ClosureRuleInfoModel[]
  pending: boolean
  /** Бэкдейтинг запрещён везде (B12, 2026-08-13) — прошедший день виден (история заказов
   * читается), но availability-контролы полностью заблокированы, не только скрыты. */
  isPast: boolean
  /** `tourIds`: `[null]` = весь день целиком; иначе один или несколько туров сразу (B12,
   * 2026-08-13 — раньше можно было закрыть только один тур за раз). `reason` — то же
   * необязательное поле, что у массовой операции: раньше одиночное закрытие дня его нигде
   * не собирало. */
  onToggle: (tourIds: (number | null)[], close: boolean, reason: string | null) => void
}

/**
 * Availability controls for one day: the whole-day switch, the list of tours closed on it, and a
 * picker to close one more.
 *
 * The DISPLAYED state always comes from the server's `CalendarDayModel` (ADR 015) — `rules` is
 * read here for one purpose only: to tell the admin that a day is closed by a WEEKLY rule, because
 * in that case unticking the box does not delete anything, it creates a one-day exception. Hiding
 * that difference would make the «Правила» tab look like it ignored the click.
 */
export function DayClosureControls({
  dateISO,
  day,
  tours,
  rules,
  pending,
  isPast,
  onToggle,
}: DayClosureControlsProps) {
  const [selectedTourIds, setSelectedTourIds] = useState<number[]>([])
  const [tourSearch, setTourSearch] = useState('')
  const [reason, setReason] = useState('')
  const locked = pending || isPast

  // Reset the picker (and the reason draft) whenever the day or its data changes — after a
  // successful toggle the parent hands down a fresh `day`, and stale state there would invite a
  // second, pointless close or leak one day's note into the next.
  useEffect(() => {
    setSelectedTourIds([])
    setTourSearch('')
    setReason('')
  }, [dateISO, day])

  const trimmedReason = reason.trim()

  const tourTitle = useMemo(() => tourTitleResolver(tours), [tours])

  const closedGlobally = day?.isClosedGlobally === true
  const closedTourIds = day?.closedTourIds ?? []

  const closedByRecurringRule =
    closedGlobally &&
    !rules.some(
      (rule) =>
        rule.type === ClosureRuleType.SpecificDate &&
        rule.date === dateISO &&
        rule.tourId === null,
    )

  // Depends on `day`, not on the derived `closedTourIds` array — that one is a fresh reference on
  // every render, which would make the memo a no-op.
  const closableTours = useMemo(() => {
    const closed = day?.closedTourIds ?? []
    const query = tourSearch.trim().toLowerCase()
    return tours
      .filter((tour) => !closed.includes(tour.id))
      .filter((tour) => query === '' || tourTitle(tour.id).toLowerCase().includes(query))
      .sort((a, b) => tourTitle(a.id).localeCompare(tourTitle(b.id), 'ru'))
  }, [tours, day, tourSearch, tourTitle])

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-bold text-neutral-900">{calendarCopy.availabilityTitle}</h3>

      {isPast && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {calendarCopy.pastDayLockedHint}
        </p>
      )}

      <div>
        <Checkbox
          label={calendarCopy.closeWholeDay}
          checked={closedGlobally}
          disabled={locked}
          onChange={(event) => onToggle([null], event.target.checked, trimmedReason || null)}
        />
        {closedByRecurringRule && (
          <p className="mt-1.5 text-xs text-neutral-500">{calendarCopy.closedByWeeklyHint}</p>
        )}
        {/* Причина видна только у точечного закрытия (SpecificDate) — недельное правило её
            несёт на вкладке «Правила», не в CalendarDayModel (B12). */}
        {closedGlobally && !closedByRecurringRule && day?.closureReason && (
          <p className="mt-1.5 text-xs text-neutral-500">
            {calendarCopy.closureReasonLabel}: {day.closureReason}
          </p>
        )}
      </div>

      {!isPast && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {calendarCopy.bulkReasonTitle}
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_REASON_LENGTH}
            rows={2}
            disabled={pending}
            className="mt-1 font-normal normal-case tracking-normal"
          />
        </label>
      )}

      {closedTourIds.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {calendarCopy.closedToursTitle}
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {closedTourIds.map((tourId) => (
              <li
                key={tourId}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-neutral-800" title={tourTitle(tourId)}>
                  {tourTitle(tourId)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={locked}
                  onClick={() => onToggle([tourId], false, trimmedReason || null)}
                  className="min-h-11 shrink-0"
                >
                  {calendarCopy.openTour}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {calendarCopy.closeTourTitle}
        </h4>
        {/* A tour-level rule on top of a globally closed day changes nothing and only clutters the
            rules list, so the whole block is locked with the reason spelled out. */}
        {closedGlobally ? (
          <p className="mt-2 text-xs text-neutral-500">{calendarCopy.dayAlreadyClosedHint}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={tourSearch}
              onChange={(event) => setTourSearch(event.target.value)}
              placeholder={calendarCopy.closeTourSearch}
              disabled={locked}
              aria-label={calendarCopy.closeTourSearch}
            />
            {/* Мультивыбор (B12, 2026-08-13) — раньше можно было закрыть только один тур за
                раз; тот же паттерн (поиск + список чекбоксов), что у BulkClosurePanel. */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 p-2">
              {closableTours.length === 0 ? (
                <p className="px-1 py-2 text-sm text-neutral-500">{calendarCopy.closeTourNoResults}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {closableTours.map((tour) => (
                    <li key={tour.id} className="min-w-0">
                      <Checkbox
                        label={tourTitle(tour.id)}
                        checked={selectedTourIds.includes(tour.id)}
                        disabled={locked}
                        onChange={(event) =>
                          setSelectedTourIds((prev) =>
                            event.target.checked
                              ? [...prev, tour.id]
                              : prev.filter((id) => id !== tour.id),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={locked || selectedTourIds.length === 0}
              onClick={() => onToggle(selectedTourIds, true, trimmedReason || null)}
              className="min-h-11 w-full sm:w-auto"
            >
              {calendarCopy.closeTourAction}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
