import { TourType } from '@/features/admin/lib/enums'
import type { TourDayFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { minDaysFor } from '@/features/admin/tour-form/reducer/tourFormReducer'
import { TourDayCard } from './TourDayCard'
import { AddButton } from './RepeaterControls'

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
}

/**
 * The "Дни" tab content — used for Tours only (a multi-day accordion of collapsible
 * `TourDayCard`s plus the add-day button). An Excursion has no "Дни" tab at all: its single day
 * IS the tour, so its price lives in the header and its route points / gallery render as flat
 * sections under the header (see `TourForm`).
 */
export function TourDaysEditor({
  type,
  days,
  dayTitleErrors,
  dayPriceErrors,
  dayRoutePointErrors,
  daysError,
  actions,
}: TourDaysEditorProps) {
  const canRemove = days.length > minDaysFor(type)

  return (
    <div className="flex flex-col gap-3">
      {daysError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {daysError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {days.map((day, index) => (
          <TourDayCard
            key={day.key}
            day={day}
            index={index}
            canRemove={canRemove}
            canMoveUp={index > 0}
            canMoveDown={index < days.length - 1}
            titleError={dayTitleErrors[day.key]}
            priceError={dayPriceErrors[day.key]}
            routePointError={dayRoutePointErrors[day.key]}
            actions={actions}
          />
        ))}
      </div>

      <AddButton onClick={actions.addDay}>Добавить день</AddButton>
    </div>
  )
}
