import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, DatePicker, Input, Textarea } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { SidePanel } from '@/features/admin/ui/SidePanel'
import type { TourType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import { REGIONS, type RegionSlug } from '@/shared/data/armeniaRegions'
import {
  ClosureAction,
  type ClosureRuleCreateModel,
  type DayOfWeekCode,
} from '@/shared/types/booking'
import { calendarCopy, weekdayOrder } from '../lib/calendarCopy'
import { TOUR_TYPE_ORDER, tourTitleResolver, tourTypePluralLabel } from '../lib/calendarModel'
import { ScopeChip } from './ScopeChip'
import {
  compileBulkForm,
  emptyBulkForm,
  MAX_REASON_LENGTH,
  type BulkClosureForm,
  type BulkMode,
  type BulkScope,
} from '../lib/closureRuleForm'

export interface BulkClosurePanelProps {
  open: boolean
  tours: TourInfoModel[]
  /** The page is saving its draft — the panel is read-only meanwhile. */
  pending: boolean
  onClose: () => void
  /** Puts the compiled rules into the page DRAFT. Nothing is sent to the server from here. */
  onAdd: (models: ClosureRuleCreateModel[]) => void
}

/**
 * Closing (or re-opening) many days at once: a date range, or a weekday that repeats.
 *
 * ОБЛАСТЬ (решение 0.27, 2026-08-29) — настоящая, из трёх взаимоисключающих вариантов, которые
 * понимает бэк: «Все продукты» (одно глобальное правило), «Тип продукта» (правило на КАТЕГОРИЮ —
 * действует и на продукты, заведённые позже) и «Выбранные продукты» (мультивыбор).
 *
 * До этого типовой области не существовало, а «Туры»/«Экскурсии» были ПРЕСЕТАМИ, которые просто
 * набивали мультивыбор идентификаторами из текущего каталога. Они убраны: два способа сделать
 * «закрыть все экскурсии» с разным результатом — это ловушка, а не удобство. Фильтр по региону
 * остался пресетом сознательно: области «регион» на бэке нет и не планируется, там это честный
 * помощник выбора, а не имитация правила.
 *
 * The final «Добавить в черновик» button puts the rules into the PAGE draft (like «Добавить строку»
 * in an order) — they reach the server on «Сохранить» in the page toolbar and are visible on the
 * «Блокировки» tab as «новое» until then. The old «too many rules» confirmation is gone: a wrong
 * batch can now simply be selected and removed from the draft.
 *
 * The form compiles through `compileBulkForm` on every change, so the "N rules will be created"
 * line and the added payload can never disagree — they are the same call.
 */
export function BulkClosurePanel({ open, tours, pending, onClose, onAdd }: BulkClosurePanelProps) {
  const copy = useCopy(calendarCopy)
  const { locale } = useLocale()
  const [form, setForm] = useState<BulkClosureForm>(emptyBulkForm)
  const [tourSearch, setTourSearch] = useState('')

  // A half-filled operation must not survive into the next opening of the panel.
  useEffect(() => {
    if (open) return
    setForm(emptyBulkForm)
    setTourSearch('')
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
  // Область живёт В ФОРМЕ: `compileBulkForm` сама решает, что взять — `tourTypes`, `tourIds` или
  // ничего, — поэтому выбор, сделанный в одной области, переживает переключение на другую и
  // обратно, а компилятору не приходится угадывать по пустоте списка.
  const validation = useMemo(() => compileBulkForm(form, copy), [form, copy])

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

  function toggleTourType(tourType: TourType) {
    patch({
      tourTypes: form.tourTypes.includes(tourType)
        ? form.tourTypes.filter((value) => value !== tourType)
        : [...form.tourTypes, tourType],
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
    onAdd(validation.models)
  }

  const radioClass = 'flex min-h-11 cursor-pointer items-center gap-2 text-sm text-neutral-800'

  return (
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

        {/* Зона наведения — сам `fieldset` (`as`), а не лишняя обёртка внутри него: `legend`
            обязан оставаться ПЕРВЫМ ребёнком fieldset, иначе браузер рисует его как обычный
            блок. Кнопка «?» живёт внутри legend'а — так подпись и триггер стоят в одну строку. */}
        <HelpRevealZone as="fieldset">
          <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <span className="inline-flex items-center gap-2">
              {copy.bulkScopeTitle}
              {/* Пояснение области — через «?», не инлайн-текстом: конвенция админки. */}
              <HelpButton surface="admin" title={copy.bulkScopeTitle}>
                {copy.bulkScopeHelp}
              </HelpButton>
            </span>
          </legend>
          <div className="mt-1 flex flex-col">
            {(
              [
                { value: 'global', label: copy.bulkScopeAll },
                { value: 'types', label: copy.bulkScopeTypes },
                { value: 'products', label: copy.bulkScopeSelected },
              ] as { value: BulkScope; label: string }[]
            ).map((option) => (
              <label key={option.value} className={radioClass}>
                <input
                  type="radio"
                  name="bulk-scope"
                  checked={form.scope === option.value}
                  onChange={() => patch({ scope: option.value })}
                  className="h-4 w-4 text-neutral-900"
                />
                {option.label}
              </label>
            ))}
          </div>

          {form.scope === 'types' && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {copy.bulkTypesTitle}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TOUR_TYPE_ORDER.map((tourType) => (
                  <ScopeChip
                    key={tourType}
                    label={tourTypePluralLabel(tourType, copy)}
                    selected={form.tourTypes.includes(tourType)}
                    onClick={() => toggleTourType(tourType)}
                  />
                ))}
              </div>
            </div>
          )}

          {form.scope === 'products' && (
            <div className="mt-2 flex flex-col gap-2">
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
        </HelpRevealZone>

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
            {copy.bulkClose}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || !validation.ok || validation.models.length === 0}
            className="min-h-11 w-full sm:w-auto"
          >
            {copy.bulkApply}
          </Button>
        </div>
      </div>
    </SidePanel>
  )
}
