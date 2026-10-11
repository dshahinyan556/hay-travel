import { Card, Checkbox, DatePicker, Field, Input, Tooltip } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { MAX_FEATURED_TOURS } from '@/features/admin/api/adminTours'
import { TourFormat, TourType } from '@/features/admin/lib/enums'
import type { TourFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import { computeTotalPrice, formatTotalPrice } from '@/features/admin/tour-form/lib/price'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { ImageUrlField } from '@/features/admin/ui/ImageUrlField'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import type { RegionInfoModel, TagInfoModel } from '@/shared/types/attours'
import { RegionPicker } from './RegionPicker'
import { TagPicker } from './TagPicker'
import { TourFormatFields } from './TourFormatFields'
import { TourTypeToggle } from './TourTypeToggle'

interface TourFormHeaderProps {
  state: TourFormState
  actions: TourFormActions
  mainImageUrlError?: string
  titleRuError?: string
  /** Negative-price error for the excursion's single-day price shown here. */
  excursionPriceError?: string
  /** Discount percent error (bad range, or a discount date without a percent). */
  discountPercentError?: string
  /** Discount start-date error (missing while the rest is set, or later than the end date). */
  discountStartDateError?: string
  /** Discount valid-until error (missing while a percent is set). */
  discountValidUntilError?: string
  /** Format/group-pricing errors (батч 2026-08-29) — passed through to `TourFormatFields`. */
  formatError?: string
  groupPricePerPersonError?: string
  groupCapacityError?: string
  /** When true (edit mode) the type toggle is locked — type is immutable after creation. */
  typeLocked?: boolean
  /** The fixed 11-region reference list, for the region picker (4.4). */
  regions: RegionInfoModel[]
  /** The tag catalog, for the tag picker. */
  tags: TagInfoModel[]
  /** Why «Показывать в избранном» is locked (no `products.Update` — `SetFeatured` would 403), or
   * `null`/omitted when it is editable. Shown as a tooltip on the still-visible checkbox. */
  featureHint?: string | null
}

/**
 * Always-visible identity card: type, main image, price, and the tour's own bilingual texts.
 *
 * Price rendering depends on type:
 *  - Tour: a read-only, auto-summed total of every day's price (edited per day in the "Дни" tab).
 *  - Excursion: the excursion has exactly one day and no "Дни" tab, so its single price is edited
 *    right here — the header texts already ARE that day's texts (they're unified on save).
 *
 * …и на формате (решение 0.26, 2026-08-29): при формате «Групповой» «Цена за группу» ПРЯЧЕТСЯ —
 * продаётся только цена за человека, и держать на экране вторую, ни на что не влияющую сумму
 * значит предлагать её заполнить. Спрятано ровно отображение: `Tour.TotalPrice` по-прежнему сумма
 * цен дней, мэппер шлёт её как раньше, сохранение проходит без изменений. При «Оба» цена за
 * группу остаётся видимой — там нужны обе.
 */
export function TourFormHeader({
  state,
  actions,
  mainImageUrlError,
  titleRuError,
  excursionPriceError,
  discountPercentError,
  discountStartDateError,
  discountValidUntilError,
  formatError,
  groupPricePerPersonError,
  groupCapacityError,
  typeLocked,
  regions,
  tags,
  featureHint = null,
}: TourFormHeaderProps) {
  const { locale } = useLocale()
  const copy = useCopy(tourFormCopy).header
  const isExcursion = state.type === TourType.Excursion
  // Трансфер использует из этой карточки только тип, картинку, тексты, публикацию и предоплату:
  // цены/формата/регионов/тегов/скидки у него нет вообще (решение 0.4).
  const isTransfer = state.type === TourType.Transfer
  // «Только групповой» — не «групповой или оба»: при «Оба» продукт продаётся ещё и как
  // индивидуальный, и цена за группу ему по-прежнему нужна (решение 0.26).
  const isGroupOnly = state.format === TourFormat.Group
  const totalPrice = computeTotalPrice(state.days)
  const singleDay = state.days[0]

  return (
    <Card padding="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-neutral-700">
              {copy.type}
              <span aria-hidden="true" className="ml-0.5 text-rose-700">
                *
              </span>
            </span>
            <TourTypeToggle value={state.type} onChange={actions.setType} disabled={typeLocked} />
          </div>

          {isTransfer || isGroupOnly ? null : isExcursion && singleDay ? (
            <div className="w-40">
              <Field
                label={copy.price}
                htmlFor="excursion-price"
                hint={copy.priceHint}
                error={excursionPriceError}
              >
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
            <HelpRevealZone className="flex flex-col items-end gap-0.5">
              <span className="text-2xl font-bold tabular-nums text-neutral-900">
                {formatTotalPrice(totalPrice, locale)}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {copy.totalCaption}
                <HelpButton surface="admin" title={copy.price}>
                  {copy.priceHint}
                </HelpButton>
              </span>
            </HelpRevealZone>
          )}
        </div>

        {/* Формат — только у тура/экскурсии; у трансфера этого поля нет вообще (решение 0.16). */}
        {!isTransfer && (
          <TourFormatFields
            value={state.format}
            onChange={actions.setFormat}
            groupPricePerPerson={state.groupPricePerPerson}
            onChangeGroupPricePerPerson={actions.setGroupPricePerPerson}
            groupCapacity={state.groupCapacity}
            onChangeGroupCapacity={actions.setGroupCapacity}
            formatError={formatError}
            groupPricePerPersonError={groupPricePerPersonError}
            groupCapacityError={groupCapacityError}
          />
        )}

        <ImageUrlField
          label={copy.mainImage}
          value={state.mainImageUrl}
          onChange={actions.setMainImageUrl}
          required
          error={mainImageUrlError}
        />

        <TranslationGroup
          label={copy.title}
          required
          value={state.title}
          error={titleRuError}
          onChange={(lang, value) => actions.setLocalized('title', lang, value)}
        />
        <TranslationGroup
          label={copy.shortDescription}
          multiline
          value={state.shortDescription}
          onChange={(lang, value) => actions.setLocalized('shortDescription', lang, value)}
        />
        <TranslationGroup
          label={copy.description}
          multiline
          value={state.description}
          onChange={(lang, value) => actions.setLocalized('description', lang, value)}
        />
        {/* Длительность, регионы и теги — часть «богатства» тура; у трансфера их нет: он всегда
            «из точки А в точку Б», а в общий каталог с фильтрами он не попадает (решение 0.15). */}
        {!isTransfer && (
          <>
            <TranslationGroup
              label={copy.duration}
              value={state.duration}
              onChange={(lang, value) => actions.setLocalized('duration', lang, value)}
            />

            <RegionPicker regions={regions} selected={state.regions} onToggle={actions.toggleRegion} />

            <TagPicker tags={tags} selected={state.tags} onToggle={actions.toggleTag} />
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-neutral-700">{copy.publication}</span>
          <Checkbox
            label={copy.isActive}
            checked={state.isActive}
            onChange={(e) => actions.setIsActive(e.target.checked)}
          />
          {/* Часть того же черновика, что и «Активен»: коммитится общим Save, а `useTourForm`
              досылает `SetFeatured`, только если значение отличается от сохранённого. */}
          <HelpRevealZone className="flex items-center gap-2">
            <Tooltip enabled={featureHint !== null} content={featureHint} cursor="not-allowed">
              <Checkbox
                label={copy.isFeatured}
                checked={state.isFeatured}
                disabled={featureHint !== null}
                onChange={(e) => actions.setIsFeatured(e.target.checked)}
              />
            </Tooltip>
            <HelpButton surface="admin" title={copy.isFeatured}>
              {copy.isFeaturedHint(MAX_FEATURED_TOURS)}
            </HelpButton>
          </HelpRevealZone>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-neutral-700">{copy.payment}</span>
          <Checkbox
            label={copy.requiresPrepayment}
            checked={state.requiresPrepayment}
            onChange={(e) => actions.setRequiresPrepayment(e.target.checked)}
          />
        </div>

        {/* Скидки у трансфера нет (решение 0.4) — бэк отвергает её вместе с днями и галереей. */}
        {!isTransfer && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-neutral-700">{copy.discount}</span>
          <div className="flex flex-wrap items-start gap-3">
            <div className="w-32">
              <Field label={copy.discountPercent} htmlFor="tour-discount-percent" error={discountPercentError}>
                <Input
                  id="tour-discount-percent"
                  type="text"
                  inputMode="decimal"
                  value={state.discountPercent}
                  onChange={(e) => actions.setDiscountPercent(e.target.value)}
                  placeholder="15"
                  error={Boolean(discountPercentError)}
                />
              </Field>
            </div>
            <div className="w-full sm:w-52">
              <Field label={copy.discountStartDate} htmlFor="tour-discount-start-date" error={discountStartDateError}>
                <DatePicker
                  id="tour-discount-start-date"
                  value={state.discountStartDate}
                  onChange={actions.setDiscountStartDate}
                  surface="admin"
                  // Прошедшая дата начала разрешена: акция может уже идти, и при
                  // редактировании тура её начало нужно уметь выбрать заново.
                  disablePast={false}
                  error={Boolean(discountStartDateError)}
                />
              </Field>
            </div>
            <div className="w-full sm:w-52">
              <Field label={copy.discountValidUntil} htmlFor="tour-discount-valid-until" error={discountValidUntilError}>
                <DatePicker
                  id="tour-discount-valid-until"
                  value={state.discountValidUntil}
                  onChange={actions.setDiscountValidUntil}
                  surface="admin"
                  error={Boolean(discountValidUntilError)}
                />
              </Field>
            </div>
          </div>
          <p className="text-xs text-neutral-400">{copy.discountHint}</p>
        </div>
        )}
      </div>
    </Card>
  )
}
