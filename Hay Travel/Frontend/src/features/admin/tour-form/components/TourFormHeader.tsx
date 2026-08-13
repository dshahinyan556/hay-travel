import { Card, Checkbox, Field, Input } from '@/shared/ui'
import { TourType } from '@/features/admin/lib/enums'
import type { TourFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { computeTotalPrice, formatTotalPrice } from '@/features/admin/tour-form/lib/price'
import { ImageUrlField } from '@/features/admin/ui/ImageUrlField'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { RegionInfoModel } from '@/shared/types/attours'
import { RegionPicker } from './RegionPicker'
import { TourTypeToggle } from './TourTypeToggle'

interface TourFormHeaderProps {
  state: TourFormState
  actions: TourFormActions
  mainImageUrlError?: string
  titleRuError?: string
  /** Negative-price error for the excursion's single-day price shown here. */
  excursionPriceError?: string
  /** When true (edit mode) the type toggle is locked — type is immutable after creation. */
  typeLocked?: boolean
  /** The fixed 11-region reference list, for the region picker (4.4). */
  regions: RegionInfoModel[]
}

/**
 * Always-visible identity card: type, main image, price, and the tour's own bilingual texts.
 *
 * Price rendering depends on type:
 *  - Tour: a read-only, auto-summed total of every day's price (edited per day in the "Дни" tab).
 *  - Excursion: the excursion has exactly one day and no "Дни" tab, so its single price is edited
 *    right here — the header texts already ARE that day's texts (they're unified on save).
 */
export function TourFormHeader({
  state,
  actions,
  mainImageUrlError,
  titleRuError,
  excursionPriceError,
  typeLocked,
  regions,
}: TourFormHeaderProps) {
  const isExcursion = state.type === TourType.Excursion
  const totalPrice = computeTotalPrice(state.days)
  const singleDay = state.days[0]

  return (
    <Card padding="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-neutral-700">
              Тип позиции
              <span aria-hidden="true" className="ml-0.5 text-rose-700">
                *
              </span>
            </span>
            <TourTypeToggle value={state.type} onChange={actions.setType} disabled={typeLocked} />
          </div>

          {isExcursion && singleDay ? (
            <div className="w-40">
              <Field label="Цена, ֏" htmlFor="excursion-price" error={excursionPriceError}>
                <Input
                  id="excursion-price"
                  type="text"
                  inputMode="decimal"
                  value={singleDay.price}
                  onChange={(e) => actions.setDayPrice(singleDay.key, e.target.value)}
                  placeholder="0"
                  error={Boolean(excursionPriceError)}
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-2xl font-bold tabular-nums text-brand-800">
                {formatTotalPrice(totalPrice)}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Цена · сумма дней
              </span>
            </div>
          )}
        </div>

        <ImageUrlField
          label="Главная картинка — URL"
          value={state.mainImageUrl}
          onChange={actions.setMainImageUrl}
          required
          error={mainImageUrlError}
        />

        <TranslationGroup
          label="Заголовок"
          required
          value={state.title}
          error={titleRuError}
          onChange={(lang, value) => actions.setLocalized('title', lang, value)}
        />
        <TranslationGroup
          label="Краткое описание"
          multiline
          value={state.shortDescription}
          onChange={(lang, value) => actions.setLocalized('shortDescription', lang, value)}
        />
        <TranslationGroup
          label="Описание"
          multiline
          value={state.description}
          onChange={(lang, value) => actions.setLocalized('description', lang, value)}
        />
        <TranslationGroup
          label="Длительность"
          value={state.duration}
          onChange={(lang, value) => actions.setLocalized('duration', lang, value)}
        />

        <RegionPicker regions={regions} selected={state.regions} onToggle={actions.toggleRegion} />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-neutral-700">Публикация</span>
          <Checkbox
            label="Активен — виден на сайте"
            checked={state.isActive}
            onChange={(e) => actions.setIsActive(e.target.checked)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-neutral-700">Оплата</span>
          <Checkbox
            label="Требуется предоплата"
            checked={state.requiresPrepayment}
            onChange={(e) => actions.setRequiresPrepayment(e.target.checked)}
          />
        </div>
      </div>
    </Card>
  )
}
