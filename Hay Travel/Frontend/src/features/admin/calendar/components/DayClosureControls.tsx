import { useMemo, useState } from 'react'
import { Checkbox, Input, Textarea } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TourInfoModel } from '@/shared/types/attours'
import {
  ClosureRuleType,
  type CalendarDayModel,
  type ClosureRuleInfoModel,
  type ClosureRuleScope,
} from '@/shared/types/booking'
import { calendarCopy } from '../lib/calendarCopy'
import { applyMarksToDay, wholeDayScope, type DayDraftMarks } from '../lib/calendarDraft'
import {
  closedScopesOf,
  TOUR_TYPE_ORDER,
  tourTitleResolver,
  tourTypePluralLabel,
} from '../lib/calendarModel'
import { MAX_REASON_LENGTH } from '../lib/closureRuleForm'
import { DraftTag } from './DraftTag'

export interface DayClosureControlsProps {
  dateISO: string
  /** The server's row for this day (SAVED state), or `null` for a tail day outside the loaded
   * month. Draft toggles are laid over it here via `draftMarks`. */
  day: CalendarDayModel | null
  tours: TourInfoModel[]
  /** ALL saved rules, used only to explain WHERE the current state comes from — never to compute it. */
  rules: ClosureRuleInfoModel[]
  /** Unsaved toggles of this day, or `null` if there are none. */
  draftMarks: DayDraftMarks | null
  /** The day-level reason typed so far (applies to every toggle of this day). */
  reason: string
  pending: boolean
  /** Бэкдейтинг запрещён везде (B12, 2026-08-13) — прошедший день виден (история заказов
   * читается), но availability-контролы полностью заблокированы, не только скрыты. */
  isPast: boolean
  /** `calendar.Create` + `calendar.Delete` — closing a day CREATES a rule and re-opening it DELETES
   * one, so the block is editable only with both. Treated exactly like `isPast`: the controls stay
   * visible (they are also how the current state is READ) but are inert, with a reason on screen. */
  canManage: boolean
  /** Why the block is locked when `canManage` is false. */
  readOnlyHint: string
  /** Writes the wanted state of ONE scope into the page draft. `savedClosed` — how the scope looks
   * on the server now; when it equals `close`, the draft entry disappears (nothing to save). */
  onToggle: (scope: ClosureRuleScope, close: boolean, savedClosed: boolean) => void
  onReasonChange: (reason: string) => void
}

/**
 * Availability controls for one day: the whole day, whole product types, single products — each a
 * checkbox that is CHECKED while the scope is closed. Ticking/unticking writes into the page draft
 * (nothing is sent until «Сохранить» in the page toolbar), and a scope whose draft state differs
 * from the saved one carries «будет закрыт» / «будет открыт».
 *
 * Целей три вида (решение 0.27, 2026-08-29): весь день, ЦЕЛЫЙ ТИП продукта («закрыть трансферы» —
 * не набор сегодняшних id, а настоящая область правила: продукт, заведённый завтра, тоже окажется
 * закрыт) и отдельный продукт. Несколько целей одного дня уходят одной группой, как раньше уходил
 * мультивыбор.
 *
 * The SAVED state always comes from the server's `CalendarDayModel` (ADR 015) — `rules` is read here
 * for one purpose only: to tell the admin that a day is closed by a WEEKLY rule, because in that
 * case unticking the box does not delete anything, it creates a one-day exception. Hiding that
 * difference would make the «Блокировки» tab look like it ignored the click.
 */
export function DayClosureControls({
  dateISO,
  day,
  tours,
  rules,
  draftMarks,
  reason,
  pending,
  isPast,
  canManage,
  readOnlyHint,
  onToggle,
  onReasonChange,
}: DayClosureControlsProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()
  const [tourSearch, setTourSearch] = useState('')
  const locked = pending || isPast || !canManage

  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])

  // Saved vs. effective (saved + draft). Checkboxes show the effective state; `saved*` decides
  // whether a click is a real change.
  const saved = closedScopesOf(day)
  const savedGlobal = day?.isClosedGlobally === true
  const effectiveDay = applyMarksToDay(day, dateISO, draftMarks)
  const closedGlobally = effectiveDay?.isClosedGlobally === true
  const { tourIds: closedTourIds, tourTypes: closedTourTypes } = closedScopesOf(effectiveDay)

  const closedByRecurringRule =
    savedGlobal &&
    !rules.some(
      (rule) =>
        rule.type === ClosureRuleType.SpecificDate &&
        rule.date === dateISO &&
        rule.tourId === null &&
        // Правило области «тип продукта» день целиком не закрывает — оно не может быть причиной
        // глобального закрытия, и принимать его за точечное было бы неверно.
        rule.tourType === null,
    )

  const markOfTour = (tourId: number): 'close' | 'open' | null =>
    draftMarks?.closeTours.includes(tourId) ? 'close' : draftMarks?.openTours.includes(tourId) ? 'open' : null
  const markOfType = (tourType: number): 'close' | 'open' | null =>
    draftMarks?.closeTypes.includes(tourType) ? 'close' : draftMarks?.openTypes.includes(tourType) ? 'open' : null

  const visibleTours = useMemo(() => {
    const query = tourSearch.trim().toLowerCase()
    return tours
      .filter((tour) => query === '' || tourTitle(tour.id).toLowerCase().includes(query))
      .sort((a, b) => tourTitle(a.id).localeCompare(tourTitle(b.id), locale))
  }, [tours, tourSearch, tourTitle, locale])

  /** Метка draft-состояния справа от чекбокса. */
  const renderMark = (mark: 'close' | 'open' | null) =>
    mark === null ? null : (
      <DraftTag tone="info">{mark === 'close' ? copy.draftWillClose : copy.draftWillOpen}</DraftTag>
    )

  const rowClass = 'flex items-center justify-between gap-2 rounded-lg px-2 hover:bg-neutral-100'

  return (
    <section className="flex flex-col gap-4">
      <HelpRevealZone className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-neutral-900">{copy.availabilityTitle}</h3>
        <HelpButton surface="admin" title={copy.availabilityTitle}>
          {copy.availabilityHelpBody}
        </HelpButton>
      </HelpRevealZone>

      {isPast && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {copy.pastDayLockedHint}
        </p>
      )}

      {/* Only when the day itself is still editable — two "you cannot change this" notes stacked on
          top of each other would just be noise. */}
      {!isPast && !canManage && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{readOnlyHint}</p>
      )}

      {closedByRecurringRule && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {copy.closedByWeeklyHint}
        </p>
      )}
      {savedGlobal && !closedByRecurringRule && !draftMarks?.global && day?.closureReason && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {copy.closureReasonLabel}: {day.closureReason}
        </p>
      )}

      {!isPast && canManage && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {copy.bulkReasonTitle}
          <Textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            maxLength={MAX_REASON_LENGTH}
            rows={2}
            disabled={pending}
            className="mt-1 font-normal normal-case tracking-normal"
          />
        </label>
      )}

      <div className={rowClass}>
        <Checkbox
          label={copy.wholeDayLabel}
          checked={closedGlobally}
          disabled={locked}
          onChange={(event) => onToggle(wholeDayScope(), event.target.checked, savedGlobal)}
          containerClassName="min-h-11 min-w-0 flex-1"
        />
        {renderMark(draftMarks?.global ?? null)}
      </div>

      {/* A narrower rule on top of a globally closed day changes nothing and only clutters the
          rules list, so the block is locked with the reason spelled out. */}
      {closedGlobally ? (
        <p className="text-xs text-neutral-500">{copy.dayAlreadyClosedHint}</p>
      ) : (
        <>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.typesTitle}
            </h4>
            <ul className="mt-1 flex flex-col">
              {TOUR_TYPE_ORDER.map((tourType) => (
                <li key={tourType} className={rowClass}>
                  <Checkbox
                    label={tourTypePluralLabel(tourType, copy)}
                    checked={closedTourTypes.includes(tourType)}
                    disabled={locked}
                    onChange={(event) =>
                      onToggle(
                        { tourId: null, tourType },
                        event.target.checked,
                        saved.tourTypes.includes(tourType),
                      )
                    }
                    containerClassName="min-h-11 min-w-0 flex-1"
                  />
                  {renderMark(markOfType(tourType))}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.productsTitle}
            </h4>
            <div className="mt-2 flex flex-col gap-2">
              <Input
                value={tourSearch}
                onChange={(event) => setTourSearch(event.target.value)}
                placeholder={copy.closeTourSearch}
                disabled={pending}
                aria-label={copy.closeTourSearch}
              />
              {visibleTours.length === 0 ? (
                <p className="px-1 py-2 text-sm text-neutral-500">{copy.closeTourNoResults}</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 p-1">
                  {visibleTours.map((tour) => (
                    <li key={tour.id} className={rowClass}>
                      <Checkbox
                        label={tourTitle(tour.id)}
                        checked={closedTourIds.includes(tour.id)}
                        disabled={locked}
                        onChange={(event) =>
                          onToggle(
                            { tourId: tour.id, tourType: null },
                            event.target.checked,
                            saved.tourIds.includes(tour.id),
                          )
                        }
                        containerClassName="min-h-11 min-w-0 flex-1"
                      />
                      {renderMark(markOfTour(tour.id))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
