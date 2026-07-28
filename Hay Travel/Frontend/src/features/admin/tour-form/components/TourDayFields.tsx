import { Field, Input } from '@/shared/ui'
import type { TourDayFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { TranslationGroup } from './TranslationGroup'
import { LocalizedListEditor } from './LocalizedListEditor'
import { GalleryImagesEditor } from './GalleryImagesEditor'

interface TourDayFieldsProps {
  day: TourDayFormState
  /** RU-title error for this day, if any. */
  titleError?: string
  /** Negative-price error for this day, if any. */
  priceError?: string
  /** Missing-route-point error for this day, if any. */
  routePointError?: string
  actions: TourFormActions
  /** "Цена дня, ֏" inside a multi-day accordion vs. plain "Цена, ֏" for a flat single day. */
  priceLabel?: string
}

/**
 * A day's actual field set — price, bilingual title/description/duration, route points and
 * gallery. Shared by `TourDayCard` (one collapsible day inside a Tour's accordion) and
 * `TourDaysEditor`'s flat rendering for an Excursion (which has exactly one day and skips the
 * accordion chrome entirely).
 */
export function TourDayFields({
  day,
  titleError,
  priceError,
  routePointError,
  actions,
  priceLabel = 'Цена дня, ֏',
}: TourDayFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-56">
        <Field label={priceLabel} htmlFor={`day-price-${day.key}`} error={priceError}>
          <Input
            id={`day-price-${day.key}`}
            type="text"
            inputMode="decimal"
            value={day.price}
            onChange={(e) => actions.setDayPrice(day.key, e.target.value)}
            placeholder="0"
            error={Boolean(priceError)}
          />
        </Field>
      </div>

      <TranslationGroup
        label="Заголовок"
        required
        value={day.title}
        error={titleError}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'title', lang, value)}
      />
      <TranslationGroup
        label="Краткое описание"
        value={day.shortDescription}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'shortDescription', lang, value)}
      />
      <TranslationGroup
        label="Описание"
        multiline
        value={day.description}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'description', lang, value)}
      />
      <TranslationGroup
        label="Длительность"
        value={day.duration}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'duration', lang, value)}
      />

      <LocalizedListEditor
        title="Точки маршрута"
        hint="Порядок точек соответствует маршруту дня."
        emptyText="Точек маршрута пока нет."
        addLabel="Добавить точку"
        itemNoun="точку"
        error={routePointError}
        items={day.routePoints}
        onAdd={() => actions.addRoutePoint(day.key)}
        onRemove={(key) => actions.removeRoutePoint(day.key, key)}
        onMove={(key, direction) => actions.moveRoutePoint(day.key, key, direction)}
        onChangeText={(key, lang, value) => actions.setRoutePointText(day.key, key, lang, value)}
      />

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-neutral-800">Галерея дня</h4>
        <GalleryImagesEditor
          items={day.gallery}
          onAdd={() => actions.addGallery(day.key)}
          onRemove={(key) => actions.removeGallery(day.key, key)}
          onMove={(key, direction) => actions.moveGallery(day.key, key, direction)}
          onChangeUrl={(key, value) => actions.setGalleryUrl(day.key, key, value)}
        />
      </div>
    </div>
  )
}
