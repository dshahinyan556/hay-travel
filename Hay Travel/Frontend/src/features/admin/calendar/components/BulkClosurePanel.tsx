import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, DatePicker, Input, Modal, Textarea } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import { TourType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import { REGIONS, type RegionSlug } from '@/shared/data/armeniaRegions'
import {
  ClosureAction,
  type ClosureRuleCreateModel,
  type DayOfWeekCode,
} from '@/shared/types/booking'
import { calendarCopy, weekdayOrder } from '../lib/calendarCopy'
import { tourTitleResolver } from '../lib/calendarModel'
import {
  compileBulkForm,
  emptyBulkForm,
  MAX_REASON_LENGTH,
  type BulkClosureForm,
  type BulkMode,
} from '../lib/closureRuleForm'

/** Above this many rules the operation gets a confirmation step — 300 rules created by a
 * mis-clicked radio have to be deleted one at a time. */
const CONFIRM_THRESHOLD = 50

export interface BulkClosurePanelProps {
  open: boolean
  tours: TourInfoModel[]
  pending: boolean
  onClose: () => void
  onApply: (models: ClosureRuleCreateModel[]) => void
}

/**
 * Closing (or re-opening) many days at once: a date range, or a weekday that repeats.
 *
 * There are no tags on tours in this system, so "bulk by tag" is expressed as scope — «Все туры»
 * (one global rule) or an explicit multi-select, with «Все · Туры · Экскурсии» presets that just
 * fill that multi-select from `TourType`. No new "tag" concept is invented on the frontend.
 *
 * The form compiles through `compileBulkForm` on every change, so the "N rules will be created"
 * line and the submitted payload can never disagree — they are the same call.
 */
export function BulkClosurePanel({ open, tours, pending, onClose, onApply }: BulkClosurePanelProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()
  const [form, setForm] = useState<BulkClosureForm>(emptyBulkForm)
  const [tourSearch, setTourSearch] = useState('')
  const [scopeAll, setScopeAll] = useState(true)
  const [confirming, setConfirming] = useState(false)

  // A half-filled operation must not survive into the next opening of the panel.
  useEffect(() => {
    if (open) return
    setForm(emptyBulkForm)
    setTourSearch('')
    setScopeAll(true)
    setConfirming(false)
  }, [open])

  const tourTitle = useMemo(() => tourTitleResolver(tours, locale, copy), [tours, locale, copy])
  const sortedTours = useMemo(
    () => [...tours].sort((a, b) => tourTitle(a.id).localeCompare(tourTitle(b.id), locale)),
    [tours, tourTitle, locale],
  )
  // Only regions that actually have a tour in them — a preset button for an empty region would
  // always produce zero rules. Ordered like the map/catalog (`REGIONS`), not alphabetically.
  const availableRegions = useMemo(() => {
    const present = new Set(tours.flatMap((tour) => (tour.regions ?? []).map((region) => region.slug)))
    return REGIONS.filter((region) => present.has(region.slug))
  }, [tours])
  const visibleTours = useMemo(() => {
    const query = tourSearch.trim().toLowerCase()
    if (query === '') return sortedTours
    return sortedTours.filter((tour) => tourTitle(tour.id).toLowerCase().includes(query))
  }, [sortedTours, tourSearch, tourTitle])

  // Memoized on the two things that actually change it — `form` is only replaced by `patch`, so
  // this does not recompile on unrelated renders. Worth memoizing: a wide range × many tours is a
  // few hundred objects per call.
  // «Все туры» is a SCOPE, expressed as an empty `tourIds` (one global rule), not as "every tour
  // ticked" — so the selection made under «Выбранные туры» is preserved if the admin toggles back.
  const validation = useMemo(
    () => compileBulkForm(scopeAll ? { ...form, tourIds: [] } : form, copy),
    [form, scopeAll, copy],
  )

  function patch(changes: Partial<BulkClosureForm>) {
    setForm((prev) => ({ ...prev, ...changes }))
  }

  function toggleWeekday(code: DayOfWeekCode, checked: boolean) {
    patch({
      weekdays: checked
        ? [...form.weekdays, code]
        : form.weekdays.filter((value) => value !== code),
    })
  }

  function applyPreset(type: TourType | 'all') {
    patch({
      tourIds: tours.filter((tour) => type === 'all' || tour.type === type).map((tour) => tour.id),
    })
  }

  function applyRegionPreset(slug: RegionSlug) {
    patch({
      tourIds: tours
        .filter((tour) => (tour.regions ?? []).some((region) => region.slug === slug))
        .map((tour) => tour.id),
    })
  }

  /** Clears only the tour-scope filter (search text + selection), not the whole form — the
   * action/mode/date fields above are a separate decision and resetting them alongside would
   * throw away work the admin already did there. */
  function resetTourFilters() {
    setTourSearch('')
    patch({ tourIds: [] })
  }

  function submit() {
    if (!validation.ok || pending) return
    if (validation.models.length > CONFIRM_THRESHOLD) {
      setConfirming(true)
      return
    }
    onApply(validation.models)
  }

  const radioClass = 'flex min-h-11 cursor-pointer items-center gap-2 text-sm text-neutral-800'

  return (
    <>
      <SidePanel open={open} onClose={onClose} title={copy.bulkTitle}>
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.bulkActionTitle}
            </legend>
            <div className="mt-1 flex flex-col">
              <label className={radioClass}>
                <input
                  type="radio"
                  name="bulk-action"
                  checked={form.action === ClosureAction.Close}
                  onChange={() => patch({ action: ClosureAction.Close })}
                  className="h-4 w-4 text-neutral-900"
                />
                {copy.bulkActionClose}
              </label>
              <label className={radioClass}>
                <input
                  type="radio"
                  name="bulk-action"
                  checked={form.action === ClosureAction.Open}
                  onChange={() => patch({ action: ClosureAction.Open })}
                  className="h-4 w-4 text-neutral-900"
                />
                {copy.bulkActionOpen}
              </label>
              {form.action === ClosureAction.Open && (
                <p className="text-xs text-neutral-500">{copy.bulkActionOpenHint}</p>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.bulkModeTitle}
            </legend>
            <div className="mt-1 flex flex-col">
              {(['range', 'weekly'] as BulkMode[]).map((mode) => (
                <label key={mode} className={radioClass}>
                  <input
                    type="radio"
                    name="bulk-mode"
                    checked={form.mode === mode}
                    onChange={() => patch({ mode })}
                    className="h-4 w-4 text-neutral-900"
                  />
                  {mode === 'range' ? copy.bulkModeRange : copy.bulkModeWeekly}
                </label>
              ))}
            </div>
          </fieldset>

          {form.mode === 'weekly' && (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {copy.bulkWeekdaysTitle}
              </legend>
              {/* 4 columns at 360px, 7 once there is room for a full week on one line. */}
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {weekdayOrder.map((code) => (
                  <Checkbox
                    key={code}
                    label={copy.weekdayShort[code]}
                    checked={form.weekdays.includes(code)}
                    onChange={(event) => toggleWeekday(code, event.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {form.mode === 'range' ? copy.bulkModeRange : copy.bulkPeriodTitle}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <label className="text-xs text-neutral-500">
                {copy.bulkFrom}
                <DatePicker
                  value={form.fromISO}
                  onChange={(value) => patch({ fromISO: value })}
                  surface="admin"
                  // Бэкдейтинг запрещён везде (B12, 2026-08-13) — раньше «С» намеренно не
                  // клэмпился к сегодня ("хозяйственный смысл"), это решение отменено без
                  // остатка: прошлое не редактируется ни точечно, ни массово.
                  disablePast
                  className="mt-1"
                  aria-label={copy.bulkFrom}
                />
              </label>
              <label className="text-xs text-neutral-500">
                {copy.bulkTo}
                <DatePicker
                  value={form.toISO}
                  onChange={(value) => patch({ toISO: value })}
                  surface="admin"
                  disablePast
                  className="mt-1"
                  aria-label={copy.bulkTo}
                />
              </label>
            </div>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.bulkScopeTitle}
            </legend>
            <div className="mt-1 flex flex-col">
              <label className={radioClass}>
                <input
                  type="radio"
                  name="bulk-scope"
                  checked={scopeAll}
                  onChange={() => setScopeAll(true)}
                  className="h-4 w-4 text-neutral-900"
                />
                {copy.bulkScopeAll}
              </label>
              <label className={radioClass}>
                <input
                  type="radio"
                  name="bulk-scope"
                  checked={!scopeAll}
                  onChange={() => setScopeAll(false)}
                  className="h-4 w-4 text-neutral-900"
                />
                {copy.bulkScopeSelected}
              </label>
            </div>

            {!scopeAll && (
              <div className="mt-2 flex flex-col gap-2">
                {/* Presets only FILL the multi-select — the selection stays explicit and editable,
                    so "Экскурсии" never becomes an invisible saved criterion. */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: copy.bulkPresetAll, value: 'all' as const },
                    { label: copy.bulkPresetTours, value: TourType.Tour },
                    { label: copy.bulkPresetExcursions, value: TourType.Excursion },
                  ].map((preset) => (
                    <button
                      key={String(preset.value)}
                      type="button"
                      onClick={() => applyPreset(preset.value)}
                      className="cursor-pointer rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {availableRegions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      {copy.bulkPresetByRegion}
                    </span>
                    {availableRegions.map((region) => (
                      <button
                        key={region.slug}
                        type="button"
                        onClick={() => applyRegionPreset(region.slug)}
                        className="cursor-pointer rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
                      >
                        {/* `REGIONS` ships both names — a region caption follows the interface
                            locale like every other label here, it is not admin-entered content. */}
                        {locale === 'en' ? region.en : region.ru}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    value={tourSearch}
                    onChange={(event) => setTourSearch(event.target.value)}
                    placeholder={copy.bulkTourSearch}
                    aria-label={copy.bulkTourSearch}
                    className="flex-1"
                  />
                  {(tourSearch !== '' || form.tourIds.length > 0) && (
                    <button
                      type="button"
                      onClick={resetTourFilters}
                      className="shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15"
                    >
                      {copy.bulkResetFilters}
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 p-2">
                  {visibleTours.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-neutral-500">{copy.bulkNoTours}</p>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {visibleTours.map((tour) => {
                        const selected = form.tourIds.includes(tour.id)
                        return (
                          <li key={tour.id} className="min-w-0">
                            {/* Same hover-highlighted-row convention as `Select`'s searchable
                                list (admin surface) — see DayClosureControls' identical list. */}
                            <Checkbox
                              label={tourTitle(tour.id)}
                              checked={selected}
                              containerClassName={`w-full rounded-lg px-2 py-1.5 transition-colors ${
                                selected ? 'bg-neutral-100 font-semibold' : 'hover:bg-neutral-100'
                              }`}
                              onChange={(event) =>
                                patch({
                                  tourIds: event.target.checked
                                    ? [...form.tourIds, tour.id]
                                    : form.tourIds.filter((id) => id !== tour.id),
                                })
                              }
                            />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </fieldset>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {copy.bulkReasonTitle}
              <Textarea
                value={form.reason}
                onChange={(event) => patch({ reason: event.target.value })}
                maxLength={MAX_REASON_LENGTH}
                rows={2}
                className="mt-1 font-normal normal-case tracking-normal"
              />
            </label>
            <p className="mt-1 text-right text-xs tabular-nums text-neutral-400">
              {form.reason.length} / {MAX_REASON_LENGTH}
            </p>
          </div>

          {validation.ok ? (
            <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
              {copy.bulkPreview(validation.models.length)}
            </p>
          ) : (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {validation.message}
            </p>
          )}

          {/* `flex-col-reverse` below `sm`: the primary action ends up on top, under the thumb. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={pending}
              className="min-h-11 w-full sm:w-auto"
            >
              {copy.bulkCancel}
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={pending || !validation.ok || validation.models.length === 0}
              className="min-h-11 w-full sm:w-auto"
            >
              {pending ? copy.bulkApplying : copy.bulkApply}
            </Button>
          </div>
        </div>
      </SidePanel>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={copy.bulkConfirmTitle}
      >
        <p className="text-sm text-neutral-600">
          {validation.ok ? copy.bulkConfirmBody(validation.models.length) : ''}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.bulkCancel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!validation.ok) return
              setConfirming(false)
              onApply(validation.models)
            }}
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
          >
            {pending ? copy.bulkApplying : copy.bulkConfirmAction}
          </Button>
        </div>
      </Modal>
    </>
  )
}
