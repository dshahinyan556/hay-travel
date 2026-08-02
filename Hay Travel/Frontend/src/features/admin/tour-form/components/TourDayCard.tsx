import { useEffect, useState } from 'react'
import { DragHandle } from '@/shared/ui'
import type { SortableRowRenderProps } from '@/shared/ui'
import type { Localized, TourDayFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { TourDayFields } from './TourDayFields'
import { RemoveButton } from './RepeaterControls'

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
  /** Existing route-point catalog entries offered as autocomplete. */
  routePointSuggestions: Localized[]
}

const priceFormatter = new Intl.NumberFormat('ru-RU')

/** Turn the raw price string into a compact summary label, e.g. "15 000 ֏" or "0 ֏". */
function formatPrice(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return '0 ֏'
  const n = Number(trimmed.replace(',', '.'))
  return `${Number.isFinite(n) ? priceFormatter.format(n) : trimmed} ֏`
}

function imagesLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} картинка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} картинки`
  return `${count} картинок`
}

/**
 * One collapsible day. Collapsed, the header is a one-line summary (День N · title · images ·
 * price); expanded, it reveals the day's price, bilingual fields, its route points
 * (`LocalizedListEditor`) and its gallery (`GalleryImagesEditor`). Only local UI state here
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
  routePointSuggestions,
}: TourDayCardProps) {
  const [open, setOpen] = useState(index === 0)
  const bodyId = `day-body-${day.key}`
  const summaryTitle = day.title.ru.trim() || `День ${index + 1}`
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
        sortable.isDragging ? 'z-10 border-brand-300 shadow-lg' : 'border-neutral-200'
      }`}
    >
      <div className="flex items-center gap-2 bg-neutral-50 px-2.5 py-2.5 sm:gap-2.5 sm:px-3">
        <DragHandle
          ref={sortable.setActivatorNodeRef}
          {...sortable.attributes}
          {...sortable.listeners}
          label={`Перетащить день ${index + 1}, чтобы изменить порядок`}
        />
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-brand-700 text-xs font-bold text-white tabular-nums">
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
              · {imagesLabel(day.gallery.length)} · {formatPrice(day.price)}
            </span>
          )}
          {hasError && (
            <span
              className="shrink-0 text-xs font-semibold text-rose-600"
              title={titleError ?? priceError ?? routePointError}
            >
              ⚠ проверьте день
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
          <RemoveButton onClick={() => actions.removeDay(day.key)} label={`Удалить день ${index + 1}`} />
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
            routePointSuggestions={routePointSuggestions}
          />
        </div>
      )}
    </div>
  )
}
