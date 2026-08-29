import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Textarea } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TourInfoModel } from '@/shared/types/attours'
import type { TourType } from '@/features/admin/lib/enums'
import {
  ClosureRuleType,
  type CalendarDayModel,
  type ClosureRuleInfoModel,
  type ClosureRuleScope,
} from '@/shared/types/booking'
import { calendarCopy } from '../lib/calendarCopy'
import {
  closedScopesOf,
  TOUR_TYPE_ORDER,
  tourTitleResolver,
  tourTypePluralLabel,
} from '../lib/calendarModel'
import { MAX_REASON_LENGTH } from '../lib/closureRuleForm'
import { ScopeChip } from './ScopeChip'

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
  /** `calendar.Create` + `calendar.Delete` — closing a day CREATES a rule and re-opening it DELETES
   * one, so the block is editable only with both. Treated exactly like `isPast`: the controls stay
   * visible (they are also how the current state is READ) but are inert, with a reason on screen. */
  canManage: boolean
  /** Why the block is locked when `canManage` is false. */
  readOnlyHint: string
  /** `targets`: `[{ tourId: null, tourType: null }]` = весь день целиком; иначе один или несколько
   * продуктов и/или целых типов продукта сразу (B12, 2026-08-13 — раньше можно было закрыть только
   * один тур за раз; решение 0.27, 2026-08-29 — добавилась область «тип продукта»). `reason` — то
   * же необязательное поле, что у массовой операции. */
  onToggle: (targets: ClosureRuleScope[], close: boolean, reason: string | null) => void
}

/**
 * Availability controls for one day: close products (or the whole day), and re-open whichever of
 * them is currently closed — both through the same picker + one-button shape (F16, 2026-08-14):
 * pick specific targets and the button acts on just those; pick none and it acts on the whole day
 * (opening always at least covers "everything currently closed", since there is no narrower
 * "whole day" target left once a per-product set is already open).
 *
 * Целей теперь два вида (решение 0.27, 2026-08-29): отдельный продукт и ЦЕЛЫЙ ТИП продукта
 * («закрыть трансферы»). Тип — не набор сегодняшних id, а настоящая область правила: продукт,
 * заведённый завтра, тоже окажется закрыт. Оба вида можно выбрать в одном действии — уходят они
 * одним батчем, как и раньше уходил мультивыбор продуктов.
 *
 * The DISPLAYED state always comes from the server's `CalendarDayModel` (ADR 015) — `rules` is
 * read here for one purpose only: to tell the admin that a day is closed by a WEEKLY rule, because
 * in that case unticking the box does not delete anything, it creates a one-day exception. Hiding
 * that difference would make the «Блокировки» tab look like it ignored the click.
 */
export function DayClosureControls({
  dateISO,
  day,
  tours,
  rules,
  pending,
  isPast,
  canManage,
  readOnlyHint,
  onToggle,
}: DayClosureControlsProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()
  const [selectedCloseIds, setSelectedCloseIds] = useState<number[]>([])
  const [selectedOpenIds, setSelectedOpenIds] = useState<number[]>([])
  const [selectedCloseTypes, setSelectedCloseTypes] = useState<TourType[]>([])
  const [selectedOpenTypes, setSelectedOpenTypes] = useState<number[]>([])
  const [tourSearch, setTourSearch] = useState('')
  const [reason, setReason] = useState('')
  const locked = pending || isPast || !canManage

  // Reset every draft whenever the day or its data changes — after a successful toggle the parent
  // hands down a fresh `day`, and stale state there would invite a second, pointless action or
  // leak one day's note into the next.
  useEffect(() => {
    setSelectedCloseIds([])
    setSelectedOpenIds([])
    setSelectedCloseTypes([])
    setSelectedOpenTypes([])
    setTourSearch('')
    setReason('')
  }, [dateISO, day])

  const trimmedReason = reason.trim()

  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])

  const closedGlobally = day?.isClosedGlobally === true
  const { tourIds: closedTourIds, tourTypes: closedTourTypes } = closedScopesOf(day)

  const closedByRecurringRule =
    closedGlobally &&
    !rules.some(
      (rule) =>
        rule.type === ClosureRuleType.SpecificDate &&
        rule.date === dateISO &&
        rule.tourId === null &&
        // Правило области «тип продукта» день целиком не закрывает — оно не может быть причиной
        // глобального закрытия, и принимать его за точечное было бы неверно.
        rule.tourType === null,
    )

  /** Типы, которые ещё не закрыты этим днём — закрывать уже закрытое нечем. */
  const closableTourTypes = TOUR_TYPE_ORDER.filter((tourType) => !closedTourTypes.includes(tourType))

  // Depends on `day`, not on the derived `closedTourIds` array — that one is a fresh reference on
  // every render, which would make the memo a no-op.
  const closableTours = useMemo(() => {
    const closed = day?.closedTourIds ?? []
    const query = tourSearch.trim().toLowerCase()
    return tours
      .filter((tour) => !closed.includes(tour.id))
      .filter((tour) => query === '' || tourTitle(tour.id).toLowerCase().includes(query))
      .sort((a, b) => tourTitle(a.id).localeCompare(tourTitle(b.id), locale))
  }, [tours, day, tourSearch, tourTitle, locale])

  function toggleClose(id: number) {
    setSelectedCloseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleOpen(id: number) {
    setSelectedOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleCloseType(tourType: TourType) {
    setSelectedCloseTypes((prev) =>
      prev.includes(tourType) ? prev.filter((x) => x !== tourType) : [...prev, tourType],
    )
  }

  function toggleOpenType(tourType: number) {
    setSelectedOpenTypes((prev) =>
      prev.includes(tourType) ? prev.filter((x) => x !== tourType) : [...prev, tourType],
    )
  }

  /** Ничего не выбрано → цель одна: весь день. Выбраны продукты и/или типы → только они, одним
   * батчем (правила разной области в одном вызове `CreateRules` допустимы — взаимоисключимы поля
   * ВНУТРИ одного правила, а не правила между собой). */
  function handleClose() {
    const targets: ClosureRuleScope[] = [
      ...selectedCloseTypes.map((tourType) => ({ tourId: null, tourType })),
      ...selectedCloseIds.map((tourId) => ({ tourId, tourType: null })),
    ]
    onToggle(targets.length > 0 ? targets : [{ tourId: null, tourType: null }], true, trimmedReason || null)
  }

  function handleOpen() {
    if (closedGlobally) {
      onToggle([{ tourId: null, tourType: null }], false, trimmedReason || null)
      return
    }
    const picked: ClosureRuleScope[] = [
      ...selectedOpenTypes.map((tourType) => ({ tourId: null, tourType })),
      ...selectedOpenIds.map((tourId) => ({ tourId, tourType: null })),
    ]
    // Ничего не отмечено — открываем всё, что сейчас закрыто в этом дне: и типы, и продукты.
    const targets: ClosureRuleScope[] =
      picked.length > 0
        ? picked
        : [
            ...closedTourTypes.map((tourType) => ({ tourId: null, tourType })),
            ...closedTourIds.map((tourId) => ({ tourId, tourType: null })),
          ]
    if (targets.length === 0) return
    onToggle(targets, false, trimmedReason || null)
  }

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
      {closedGlobally && !closedByRecurringRule && day?.closureReason && (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {copy.closureReasonLabel}: {day.closureReason}
        </p>
      )}

      {!isPast && canManage && (
        <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {copy.bulkReasonTitle}
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

      {/* Open: whole day (nothing left to pick when `closedGlobally`) or the specific targets that
          are already closed — типы продукта и отдельные продукты в одном блоке. Pick some and the
          button opens just those, pick none and it opens everything currently closed. */}
      {closedGlobally ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {copy.closedToursTitle}
          </h4>
          <p className="mt-2 text-sm text-neutral-600">{copy.wholeDayClosedNote}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={locked}
            onClick={handleOpen}
            className="mt-2 min-h-11 w-full sm:w-auto"
          >
            {copy.openWholeDay}
          </Button>
        </div>
      ) : (
        (closedTourTypes.length > 0 || closedTourIds.length > 0) && (
          <div className="flex flex-col gap-3">
            {closedTourTypes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {copy.closedTypesTitle}
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {closedTourTypes.map((tourType) => (
                    <ScopeChip
                      key={tourType}
                      label={tourTypePluralLabel(tourType, copy)}
                      selected={selectedOpenTypes.includes(tourType)}
                      disabled={locked}
                      onClick={() => toggleOpenType(tourType)}
                    />
                  ))}
                </div>
              </div>
            )}

            {closedTourIds.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {copy.closedToursTitle}
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {closedTourIds.map((tourId) => (
                    <ScopeChip
                      key={tourId}
                      label={tourTitle(tourId)}
                      selected={selectedOpenIds.includes(tourId)}
                      disabled={locked}
                      onClick={() => toggleOpen(tourId)}
                    />
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={locked}
              onClick={handleOpen}
              className="min-h-11 w-full sm:w-auto"
            >
              {copy.openTour}
            </Button>
          </div>
        )
      )}

      {/* A narrower rule on top of a globally closed day changes nothing and only clutters the
          rules list, so the whole block is locked with the reason spelled out. */}
      {closedGlobally ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {copy.closeTourTitle}
          </h4>
          <p className="mt-2 text-xs text-neutral-500">{copy.dayAlreadyClosedHint}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {closableTourTypes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {copy.closeTypeTitle}
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {closableTourTypes.map((tourType) => (
                  <ScopeChip
                    key={tourType}
                    label={tourTypePluralLabel(tourType, copy)}
                    selected={selectedCloseTypes.includes(tourType)}
                    disabled={locked}
                    onClick={() => toggleCloseType(tourType)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.closeTourTitle}
            </h4>
            <div className="mt-2 flex flex-col gap-2">
              <Input
                value={tourSearch}
                onChange={(event) => setTourSearch(event.target.value)}
                placeholder={copy.closeTourSearch}
                disabled={locked}
                aria-label={copy.closeTourSearch}
              />
              {closableTours.length === 0 ? (
                <p className="px-1 py-2 text-sm text-neutral-500">{copy.closeTourNoResults}</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 p-2">
                  <div className="flex flex-wrap gap-1.5">
                    {closableTours.map((tour) => (
                      <ScopeChip
                        key={tour.id}
                        label={tourTitle(tour.id)}
                        selected={selectedCloseIds.includes(tour.id)}
                        disabled={locked}
                        onClick={() => toggleClose(tour.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Одна кнопка на оба пикера: ничего не выбрано — закрывается весь день, выбраны только
              типы — «закрыть выбранные типы», выбраны продукты (в том числе вместе с типами) —
              обычное «Закрыть». */}
          <Button
            type="button"
            size="sm"
            disabled={locked}
            onClick={handleClose}
            className="min-h-11 w-full sm:w-auto"
          >
            {selectedCloseIds.length > 0
              ? copy.closeTourAction
              : selectedCloseTypes.length > 0
                ? copy.closeTypeAction
                : copy.closeWholeDay}
          </Button>
        </div>
      )}
    </section>
  )
}
