import { Select } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { PlaceOption, RoutePointFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

interface RoutePointPlaceSelectProps {
  dayKey: string
  item: RoutePointFormState
  placeOptions: PlaceOption[]
  actions: TourFormActions
}

const NO_LINK = ''

/**
 * Hard-links a route point to a Place catalog entry (F13 gap closure, 2026-08). Picking an
 * option sets `placeId`, fills RU/EN from the Place's own name, AND swaps the Place's own photos
 * into the day's gallery live — in place of whatever this route point had put there before, if
 * anything (see `tourFormReducer`'s `setRoutePointPlace` case). The text stays editable
 * afterwards without breaking the link (see `RoutePointFormState`'s doc comment). Picking "Без
 * привязки" clears the link — the row falls back to a plain free-text point, and any images this
 * route point is known to have added are removed with it.
 */
export function RoutePointPlaceSelect({ dayKey, item, placeOptions, actions }: RoutePointPlaceSelectProps) {
  const copy = useCopy(tourFormCopy)

  return (
    <Select
      value={item.placeId != null ? String(item.placeId) : NO_LINK}
      onChange={(value) => {
        if (value === NO_LINK) {
          actions.setRoutePointPlace(dayKey, item.key, null)
          return
        }
        const placeId = Number(value)
        const picked = placeOptions.find((p) => p.id === placeId)
        actions.setRoutePointPlace(dayKey, item.key, placeId, picked?.name, picked?.images)
      }}
      options={[
        { value: NO_LINK, label: copy.placeSelect.noLink },
        ...placeOptions.map((p) => ({
          value: String(p.id),
          // A place's name is content — shown in the panel's language when it has one
          // (ADR 021, decision 5), by id when the catalog entry is untranslated.
          label: copy.localizedName(p.name) || `#${p.id}`,
        })),
      ]}
      placeholder={copy.placeSelect.placeholder}
      searchable
      searchPlaceholder={copy.placeSelect.search}
      surface="admin"
      className="w-full sm:max-w-xs"
    />
  )
}
