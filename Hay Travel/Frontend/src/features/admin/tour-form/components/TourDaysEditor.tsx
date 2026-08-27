import { SortableList } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { TourType } from '@/features/admin/lib/enums'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import type { Localized, PlaceOption, TourDayFormState } from '@/features/admin/types/form'
import type { DaySource } from '@/features/admin/lib/tourMapper'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { minDaysFor } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { AddButton } from '@/features/admin/ui/RepeaterControls'
import { TourDayCard } from './TourDayCard'

interface TourDaysEditorProps {
  type: TourType
  days: TourDayFormState[]
  /** RU-title errors per day, keyed by `day.key`. */
  dayTitleErrors: Record<string, string | undefined>
  /** Negative-price errors per day, keyed by `day.key`. */
  dayPriceErrors: Record<string, string | undefined>
  /** Missing-route-point errors per day, keyed by `day.key`. */
  dayRoutePointErrors: Record<string, string | undefined>
  /** Day-count error (a Tour needs at least two days). */
  daysError?: string
  actions: TourFormActions
  /** Existing route-point catalog entries offered as autocomplete. */
  routePointSuggestions: Localized[]
  /** Place catalog entries a route point can be hard-linked to (F13 gap closure). */
  placeOptions: PlaceOption[]
  /** Other products' days offered as a "заполнить из другого продукта" source (F13, part 2). */
  daySources: DaySource[]
}

/** Stable identity for the drag list — days are addressed by their form key, never by index. */
const dayId = (day: TourDayFormState): string => day.key

/**
 * The "Дни" tab content — used for Tours only (a multi-day accordion of collapsible
 * `TourDayCard`s plus the add-day button). An Excursion has no "Дни" tab at all: its single day
 * IS the tour, so its price lives in the header and its route points / gallery render as flat
 * sections under the header (see `TourForm`).
 *
 * Owns the day-level drag context: `SortableList` renders no wrapper of its own, so it sits
 * directly inside the accordion column and hands each `TourDayCard` its drag mechanics.
 */
export function TourDaysEditor({
  type,
  days,
  dayTitleErrors,
  dayPriceErrors,
  dayRoutePointErrors,
  daysError,
  actions,
  routePointSuggestions,
  placeOptions,
  daySources,
}: TourDaysEditorProps) {
  const copy = useCopy(tourFormCopy).days
  const canRemove = days.length > minDaysFor(type)

  return (
    <div className="flex flex-col gap-3">
      {daysError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {daysError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <SortableList items={days} getId={dayId} onReorder={actions.moveDay} itemLabel={copy.item}>
          {(day, index, sortable) => (
            <TourDayCard
              day={day}
              index={index}
              canRemove={canRemove}
              sortable={sortable}
              titleError={dayTitleErrors[day.key]}
              priceError={dayPriceErrors[day.key]}
              routePointError={dayRoutePointErrors[day.key]}
              actions={actions}
              routePointSuggestions={routePointSuggestions}
              placeOptions={placeOptions}
              daySources={daySources}
            />
          )}
        </SortableList>
      </div>

      <AddButton onClick={actions.addDay}>{copy.add}</AddButton>
    </div>
  )
}
