import { useMemo } from 'react'
import { Field, Input } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { Localized, PlaceOption, RoutePointFormState, TourDayFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import type { DaySource } from '@/features/admin/lib/tourMapper'
import { hasFillableDayContent } from '@/features/admin/lib/tourMapper'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import { ImageListEditor } from '@/features/admin/ui/ImageListEditor'
import { LocalizedListEditor } from './LocalizedListEditor'
import { RoutePointPlaceSelect } from './RoutePointPlaceSelect'
import { DayFillTrigger } from './DayFillTrigger'

interface TourDayFieldsProps {
  day: TourDayFormState
  /** RU-title error for this day, if any. */
  titleError?: string
  /** Negative-price error for this day, if any. */
  priceError?: string
  /** Missing-route-point error for this day, if any. */
  routePointError?: string
  actions: TourFormActions
  /** Overrides the day-price caption. Defaults to the accordion's "Цена дня, ֏"/"Day price, ֏";
   * a flat single day passes the plain "Цена, ֏"/"Price, ֏" instead. */
  priceLabel?: string
  /** `false` при формате «Групповой» (решение 0.26): цена дня существует ТОЛЬКО чтобы сложиться
   * в «Цену за группу», а она при этом формате спрятана — просить заполнить слагаемые скрытой
   * суммы было бы хуже, чем не показывать их. Значение остаётся в состоянии формы и уходит на
   * сервер как есть: `Tour.TotalPrice` не меняется, сохранение не ломается, а возврат формата
   * в «Индивидуальный»/«Оба» показывает прежние цифры нетронутыми.
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
  priceLabel,
  showPrice = true,
  routePointSuggestions,
  placeOptions,
  daySources,
}: TourDayFieldsProps) {
  const copy = useCopy(tourFormCopy)
  const hasUnlinkedPoint = day.routePoints.some(
    (rp) => rp.placeId == null && (rp.text.ru.trim() || rp.text.en.trim()),
  )
  // placeId -> image urls, for the fill's own gallery autofill (same live swap a manual pick in
  // `RoutePointPlaceSelect` triggers) — built once per `placeOptions` change, not per fill.
  const placeImagesById = useMemo(
    () => Object.fromEntries(placeOptions.map((p) => [p.id, p.images])),
    [placeOptions],
  )
  return (
    <div className="flex flex-col gap-4">
      <div>
        <DayFillTrigger
          sources={daySources}
          hasContent={hasFillableDayContent(day)}
          onFill={(content) => actions.fillDayFromSource(day.key, content, placeImagesById)}
        />
      </div>

      {showPrice && (
        <div className="max-w-56">
          <Field label={priceLabel ?? copy.days.price} htmlFor={`day-price-${day.key}`} error={priceError}>
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
      )}

      <TranslationGroup
        label={copy.header.title}
        required
        value={day.title}
        error={titleError}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'title', lang, value)}
      />
      <TranslationGroup
        label={copy.header.shortDescription}
        value={day.shortDescription}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'shortDescription', lang, value)}
      />
      <TranslationGroup
        label={copy.header.description}
        multiline
        value={day.description}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'description', lang, value)}
      />
      <TranslationGroup
        label={copy.header.duration}
        value={day.duration}
        onChange={(lang, value) => actions.setDayLocalized(day.key, 'duration', lang, value)}
      />

      <LocalizedListEditor
        title={copy.routePoints.title}
        hint={copy.routePoints.hintDay}
        emptyText={copy.routePoints.empty}
        addLabel={copy.routePoints.add}
        itemNoun={copy.routePoints.noun}
        itemLabel={copy.routePoints.label}
        error={routePointError}
        items={day.routePoints}
        suggestions={routePointSuggestions}
        onAdd={() => actions.addRoutePoint(day.key)}
        onRemove={(key) => actions.removeRoutePoint(day.key, key)}
        onReorder={(fromIndex, toIndex) => actions.moveRoutePoint(day.key, fromIndex, toIndex)}
        onChangeText={(key, lang, value) => actions.setRoutePointText(day.key, key, lang, value)}
        renderExtra={(item) => (
          <RoutePointPlaceSelect
            dayKey={day.key}
            item={item as RoutePointFormState}
            placeOptions={placeOptions}
            actions={actions}
          />
        )}
      />
      {hasUnlinkedPoint && (
        <p className="text-xs text-neutral-400">{copy.routePoints.unlinkedNoteDay}</p>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-neutral-800">{copy.days.gallery}</h4>
        <ImageListEditor
          items={day.gallery}
          onAdd={() => actions.addGallery(day.key)}
          onRemove={(key) => actions.removeGallery(day.key, key)}
          onReorder={(fromIndex, toIndex) => actions.moveGallery(day.key, fromIndex, toIndex)}
          onChangeUrl={(key, value) => actions.setGalleryUrl(day.key, key, value)}
        />
      </div>
    </div>
  )
}
