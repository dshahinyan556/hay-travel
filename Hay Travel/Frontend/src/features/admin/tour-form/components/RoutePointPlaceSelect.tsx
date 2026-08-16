import { Select } from '@/shared/ui'
import type { PlaceOption, RoutePointFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'

interface RoutePointPlaceSelectProps {
  dayKey: string
  item: RoutePointFormState
  placeOptions: PlaceOption[]
  actions: TourFormActions
}

const NO_LINK = ''

/**
 * Hard-links a route point to a Place catalog entry (F13 gap closure, 2026-08). Picking an
 * option sets `placeId` and fills RU/EN from the Place's own name; the text stays editable
 * afterwards without breaking the link (see `RoutePointFormState`'s doc comment). Picking "Без
 * привязки" clears the link — the row falls back to a plain free-text point, same as before this
 * feature existed. A route point with a link makes the backend copy that Place's photos into the
 * day's gallery automatically on save (`RoutePointGalleryImageCopier`).
 */
export function RoutePointPlaceSelect({ dayKey, item, placeOptions, actions }: RoutePointPlaceSelectProps) {
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
        actions.setRoutePointPlace(dayKey, item.key, placeId, picked?.name)
      }}
      options={[
        { value: NO_LINK, label: 'Без привязки — свободный текст' },
        ...placeOptions.map((p) => ({
          value: String(p.id),
          label: p.name.ru || p.name.en || `#${p.id}`,
        })),
      ]}
      placeholder="Привязать к точке каталога…"
      className="w-full sm:max-w-xs"
    />
  )
}
