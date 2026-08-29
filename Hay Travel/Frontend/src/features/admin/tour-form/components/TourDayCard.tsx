import { useEffect, useState } from 'react'
import { DragHandle } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { Localized, PlaceOption, TourDayFormState } from '@/features/admin/types/form'
import type { DaySource } from '@/features/admin/lib/tourMapper'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { formatDayPrice } from '@/features/admin/tour-form/lib/price'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { RemoveButton } from '@/features/admin/ui/RepeaterControls'
import { TourDayFields } from './TourDayFields'

interface TourDayCardProps {
  day: TourDayFormState
  index: number
  /** True when removing this day keeps the day count legal for the current type. */
  canRemove: boolean
  /** Drag mechanics handed down by the `SortableList` in `TourDaysEditor`. */
  sortable: SortableRowRenderProps
  /** RU-title error for this day, if any. */
  titleError?: string
  /** Negative-price error for this day, if any. */
  priceError?: string
  /** Missing-route-point error for this day, if any. */
  routePointError?: string
  actions: TourFormActions
  /** `false` при формате «Групповой» — прячет и поле цены в теле, и её чип в свёрнутой шапке
   * (решение 0.26; подробности — в доккомментарии `TourDayFields`).
   * @default true */
  showPrice?: boolean
  /** Existing route-point catalog entries offered as autocomplete. */
  routePointSuggestions: Localized[]
  /** Place catalog entries a route point can be hard-linked to (F13 gap closure). */
  placeOptions: PlaceOption[]
  /** Other products' days offered as a "заполнить из другого продукта" source (F13, part 2). */
  daySources: DaySource[]
}

/**
 * One collapsible day. Collapsed, the header is a one-line summary (День N · title · images ·
 * price); expanded, it reveals the day's price, bilingual fields, its route points
 * (`LocalizedListEditor`) and its gallery (`ImageListEditor`, `features/admin/ui/`). Only local UI state here
 * (open/closed) — all data changes go through `actions`, keyed by `day.key`.
 *
 * Reordering is drag-and-drop by the header handle only (never the whole card — the body is full
 * of inputs). The `SortableList` that owns the drag lives one level up, in `TourDaysEditor`.
 */
export function TourDayCard({
  day,
  index,
  canRemove,
  sortable,
  titleError,
  priceError,
  routePointError,
  actions,
  showPrice = true,
  routePointSuggestions,
  placeOptions,
  daySources,
}: TourDayCardProps) {
  const { locale } = useLocale()
  const copy = useCopy(tourFormCopy).days
  const [open, setOpen] = useState(index === 0)
  const bodyId = `day-body-${day.key}`
  // The day's own title is CONTENT: RU is the required language, so the summary shows it as
  // typed. Only its placeholder ("День 2"/"Day 2") follows the interface language.
  const summaryTitle = day.title.ru.trim() || copy.label(index + 1)
  const hasError = Boolean(titleError || priceError || routePointError)

  // Collapse before a drag starts: an expanded card's body (price/text fields, route points,
  // gallery) can be far taller than a neighbouring collapsed card, and dnd-kit's keyboard
  // coordinate-getter moves the virtual cursor by increments of the DRAGGED item's own rect — on
  // a very tall expanded card a single arrow press can undershoot and land back on the same slot,
  // silently no-opping the move. Collapsing keeps every row a uniform, small height for the
  // duration of the drag regardless of input method.
  useEffect(() => {
    if (sortable.isDragging) setOpen(false)
  }, [sortable.isDragging])

  return (
    <div
      ref={sortable.setNodeRef}
      style={sortable.style}
      className={`relative overflow-hidden rounded-xl border bg-white ${
        sortable.isDragging ? 'z-10 border-neutral-400 shadow-lg' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-center gap-2 bg-neutral-50 px-2.5 py-2.5 sm:gap-2.5 sm:px-3">
        <DragHandle
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          label={copy.drag(index + 1)}
        />
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-neutral-950 text-xs font-bold text-white tabular-nums">
          {index + 1}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <span className="truncate text-sm font-bold text-neutral-900">{summaryTitle}</span>
          {!open && (
            <span className="truncate text-xs text-neutral-500">
              · {copy.images(day.gallery.length)}
              {showPrice && <> · {formatDayPrice(day.price, locale)}</>}
            </span>
          )}
          {hasError && (
            <span
              className="shrink-0 text-xs font-semibold text-rose-600"
              title={titleError ?? priceError ?? routePointError}
            >
              {copy.hasError}
            </span>
          )}
          <span
            aria-hidden="true"
            className={`ml-auto shrink-0 text-neutral-400 transition-transform ${open ? '' : '-rotate-90'}`}
          >
            ▾
          </span>
        </button>

        {canRemove && (
          <RemoveButton onClick={() => actions.removeDay(day.key)} label={copy.remove(index + 1)} />
        )}
      </div>

      {open && (
        <div id={bodyId} className="p-4">
          <TourDayFields
            day={day}
            titleError={titleError}
            priceError={priceError}
            routePointError={routePointError}
            actions={actions}
            showPrice={showPrice}
            routePointSuggestions={routePointSuggestions}
            placeOptions={placeOptions}
            daySources={daySources}
          />
        </div>
      )}
    </div>
  )
}
