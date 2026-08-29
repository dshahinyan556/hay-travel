import { useMemo, useState } from 'react'
import { Card, Tabs } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { TourFormat, TourType } from '@/features/admin/lib/enums'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import type { CatalogSuggestions, TourFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import type { TourFormValidation } from '@/features/admin/tour-form/lib/validation'
import type { RegionInfoModel, TagInfoModel } from '@/shared/types/attours'
import { ImageListEditor } from '@/features/admin/ui/ImageListEditor'
import type { RoutePointFormState } from '@/features/admin/types/form'
import type { DaySource, VehicleClassOption } from '@/features/admin/lib/tourMapper'
import { hasFillableDayContent } from '@/features/admin/lib/tourMapper'
import { TourFormHeader } from './TourFormHeader'
import { TourDaysEditor } from './TourDaysEditor'
import { LocalizedListEditor } from './LocalizedListEditor'
import { RoutePointPlaceSelect } from './RoutePointPlaceSelect'
import { DayFillTrigger } from './DayFillTrigger'
import { AdditionalExpensesEditor } from './AdditionalExpensesEditor'
import { TourStartTimesEditor } from './TourStartTimesEditor'
import { TransferPricesEditor } from './TransferPricesEditor'
import { TransferRouteEditor } from './TransferRouteEditor'

interface TourFormProps {
  state: TourFormState
  actions: TourFormActions
  validation: TourFormValidation
  /** True in edit mode — locks the tour/excursion type toggle (type is immutable after creation). */
  typeLocked?: boolean
  /** Existing catalog entries offered as autocomplete — see `CatalogSuggestions`. */
  catalogSuggestions: CatalogSuggestions
  /** The fixed 11-region reference list, for the region picker (4.4). */
  regions: RegionInfoModel[]
  /** The tag catalog, for the tag picker. */
  tags: TagInfoModel[]
  /** Other products' days offered as a "заполнить из другого продукта" source (F13, part 2). */
  daySources: DaySource[]
  /** The vehicle-class catalog, for the transfer's price table. Empty is a legitimate state —
   * the catalog may simply not have been filled in yet (the editor says so). */
  vehicleClasses: VehicleClassOption[]
  /** Submitting the form (Enter inside a field) — the same action the toolbar's Save runs. */
  onSubmit: () => void
}

type TabId = 'days' | 'org' | 'restrictions' | 'included' | 'notIncluded' | 'expenses'

/**
 * Presentational orchestrator. Always shows `TourFormHeader` (type, image, price, the tour's
 * texts). What follows depends on the type:
 *
 *  - Tour: a tabbed card whose first tab is "Дни" (the multi-day accordion), then the optional
 *    lists.
 *  - Excursion: no "Дни" tab — its single day IS the tour. Its route points and gallery render
 *    as flat sections directly under the header, and the tabbed card holds only the optional
 *    lists (organizational details, restrictions, expenses).
 *  - Transfer (батч 2026-08-29): no tabs AT ALL. A transfer has no days, gallery, regions, tags,
 *    discount, organizational details, restrictions, extra costs, start times or format — only
 *    the header's identity fields plus its own route and price table. Rendering the tabbed card
 *    with every tab hidden would leave an empty chrome; the branch returns a different body
 *    instead (решение 0.4).
 *
 * Holds no domain state; only the active tab is local UI state. The screen chrome around it —
 * заголовок, тулбар Save/Отмена/«В архив» и слот сообщений — принадлежит `TourFormScreen`
 * (шаблон A), а не этой форме.
 */
export function TourForm({
  state,
  actions,
  validation,
  typeLocked,
  catalogSuggestions,
  regions,
  tags,
  daySources,
  vehicleClasses,
  onSubmit,
}: TourFormProps) {
  const copy = useCopy(tourFormCopy)
  const isExcursion = state.type === TourType.Excursion
  const isTransfer = state.type === TourType.Transfer
  // При «Групповом» продаётся только цена за человека: «Цена за группу» в шапке спрятана
  // (решение 0.26), а вместе с ней и цены дней, которые её и составляют. Данные при этом целы —
  // см. доккомментарий `TourDayFields.showPrice`. При «Оба» цена за группу нужна, и всё видно.
  const isGroupOnly = state.format === TourFormat.Group
  const singleDay = state.days[0]
  // placeId -> image urls, for the excursion's own "заполнить из другого продукта" gallery
  // autofill — same lookup `TourDayFields` builds for the multi-day accordion.
  const placeImagesById = useMemo(
    () => Object.fromEntries(catalogSuggestions.placeOptions.map((p) => [p.id, p.images])),
    [catalogSuggestions.placeOptions],
  )

  const tabs: TabItem[] = [
    ...(isExcursion || isTransfer
      ? []
      : [{ id: 'days', label: copy.tabs.days, badge: state.days.length } as TabItem]),
    { id: 'org', label: copy.tabs.org },
    { id: 'restrictions', label: copy.tabs.restrictions },
    { id: 'included', label: copy.tabs.included },
    { id: 'notIncluded', label: copy.tabs.notIncluded },
    { id: 'expenses', label: copy.tabs.expenses },
  ]

  const [activeTab, setActiveTab] = useState<TabId>('days')
  // The "days" tab disappears for an excursion; if the current selection no longer exists
  // (e.g. after flipping the type on create), fall back to the first available tab.
  const effectiveTab = tabs.some((t) => t.id === activeTab) ? activeTab : (tabs[0].id as TabId)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <TourFormHeader
        state={state}
        actions={actions}
        mainImageUrlError={validation.mainImageUrl}
        titleRuError={validation.titleRu}
        excursionPriceError={singleDay ? validation.dayPriceErrors[singleDay.key] : undefined}
        discountPercentError={validation.discountPercent}
        discountStartDateError={validation.discountStartDate}
        discountValidUntilError={validation.discountValidUntil}
        formatError={validation.format}
        groupPricePerPersonError={validation.groupPricePerPerson}
        groupCapacityError={validation.groupCapacity}
        typeLocked={typeLocked}
        regions={regions}
        tags={tags}
      />

      {isTransfer && (
        <Card padding="lg">
          <div className="flex flex-col gap-5">
            <TransferRouteEditor
              from={state.transferFrom}
              stops={state.transferStops}
              to={state.transferTo}
              suggestions={catalogSuggestions.routePoints}
              fromError={validation.transferFrom}
              toError={validation.transferTo}
              stopErrors={validation.transferStopErrors}
              onChangeEndpointText={actions.setTransferEndpointText}
              onAddStop={actions.addTransferStop}
              onRemoveStop={actions.removeTransferStop}
              onReorderStops={actions.moveTransferStop}
              onChangeStopText={actions.setTransferStopText}
            />

            <TransferPricesEditor
              items={state.transferPrices}
              vehicleClasses={vehicleClasses}
              error={validation.transferPrices}
              rowErrors={validation.transferPriceErrors}
              onAdd={actions.addTransferPrice}
              onRemove={actions.removeTransferPrice}
              onChangeClass={actions.setTransferPriceClass}
              onChangeAmount={actions.setTransferPriceAmount}
            />
          </div>
        </Card>
      )}

      {/* Времена старта — у тура и экскурсии, но не у трансфера: время подачи трансфера
          выбирает клиент при бронировании, у продукта его нет (решение 0.21). */}
      {!isTransfer && (
        <Card padding="lg">
          <TourStartTimesEditor
            items={state.startTimes}
            error={validation.startTimes}
            rowErrors={validation.startTimeErrors}
            onAdd={actions.addStartTime}
            onRemove={actions.removeStartTime}
            onChange={actions.setStartTime}
            onSort={actions.sortStartTimes}
          />
        </Card>
      )}

      {isExcursion && singleDay && (
        <Card padding="lg">
          <div className="flex flex-col gap-5">
            <div>
              <DayFillTrigger
                sources={daySources}
                hasContent={hasFillableDayContent({
                  title: state.title,
                  shortDescription: state.shortDescription,
                  description: state.description,
                  duration: state.duration,
                  routePoints: singleDay.routePoints,
                })}
                onFill={(content) => actions.fillDayFromSource(singleDay.key, content, placeImagesById)}
              />
            </div>

            <LocalizedListEditor
              title={copy.routePoints.title}
              hint={copy.routePoints.hintExcursion}
              emptyText={copy.routePoints.empty}
              addLabel={copy.routePoints.add}
              itemNoun={copy.routePoints.noun}
              itemLabel={copy.routePoints.label}
              error={validation.dayRoutePointErrors[singleDay.key]}
              items={singleDay.routePoints}
              suggestions={catalogSuggestions.routePoints}
              onAdd={() => actions.addRoutePoint(singleDay.key)}
              onRemove={(key) => actions.removeRoutePoint(singleDay.key, key)}
              onReorder={(fromIndex, toIndex) =>
                actions.moveRoutePoint(singleDay.key, fromIndex, toIndex)
              }
              onChangeText={(key, lang, value) =>
                actions.setRoutePointText(singleDay.key, key, lang, value)
              }
              renderExtra={(item) => (
                <RoutePointPlaceSelect
                  dayKey={singleDay.key}
                  item={item as RoutePointFormState}
                  placeOptions={catalogSuggestions.placeOptions}
                  actions={actions}
                />
              )}
            />
            {singleDay.routePoints.some(
              (rp) => rp.placeId == null && (rp.text.ru.trim() || rp.text.en.trim()),
            ) && (
              <p className="text-xs text-neutral-400">{copy.routePoints.unlinkedNoteExcursion}</p>
            )}

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-neutral-800">{copy.excursion.gallery}</h4>
              <ImageListEditor
                items={singleDay.gallery}
                onAdd={() => actions.addGallery(singleDay.key)}
                onRemove={(key) => actions.removeGallery(singleDay.key, key)}
                onReorder={(fromIndex, toIndex) =>
                  actions.moveGallery(singleDay.key, fromIndex, toIndex)
                }
                onChangeUrl={(key, value) => actions.setGalleryUrl(singleDay.key, key, value)}
              />
            </div>
          </div>
        </Card>
      )}

      {!isTransfer && (
      <Card className="!p-0">
        <Tabs
          tabs={tabs}
          activeId={effectiveTab}
          onChange={(id) => setActiveTab(id as TabId)}
          label={copy.tabs.label}
        />

        <div className="p-6">
          {effectiveTab === 'days' && !isExcursion && (
            <TourDaysEditor
              type={state.type}
              days={state.days}
              dayTitleErrors={validation.dayTitleErrors}
              dayPriceErrors={validation.dayPriceErrors}
              dayRoutePointErrors={validation.dayRoutePointErrors}
              daysError={validation.days}
              actions={actions}
              showDayPrice={!isGroupOnly}
              routePointSuggestions={catalogSuggestions.routePoints}
              placeOptions={catalogSuggestions.placeOptions}
              daySources={daySources}
            />
          )}

          {effectiveTab === 'org' && (
            <LocalizedListEditor
              title={copy.org.title}
              hint={copy.org.hint}
              emptyText={copy.org.empty}
              addLabel={copy.org.add}
              itemNoun={copy.org.noun}
              itemLabel={copy.org.label}
              items={state.organizationalDetails}
              suggestions={catalogSuggestions.orgDetails}
              onAdd={actions.addOrgDetail}
              onRemove={actions.removeOrgDetail}
              onReorder={actions.moveOrgDetail}
              onChangeText={actions.setOrgDetailText}
            />
          )}

          {effectiveTab === 'restrictions' && (
            <LocalizedListEditor
              title={copy.restrictions.title}
              hint={copy.restrictions.hint}
              emptyText={copy.restrictions.empty}
              addLabel={copy.restrictions.add}
              itemNoun={copy.restrictions.noun}
              itemLabel={copy.restrictions.label}
              items={state.restrictions}
              suggestions={catalogSuggestions.restrictions}
              onAdd={actions.addRestriction}
              onRemove={actions.removeRestriction}
              onReorder={actions.moveRestriction}
              onChangeText={actions.setRestrictionText}
            />
          )}

          {effectiveTab === 'included' && (
            <LocalizedListEditor
              title={copy.included.title}
              hint={copy.included.hint}
              emptyText={copy.included.empty}
              addLabel={copy.included.add}
              itemNoun={copy.included.noun}
              itemLabel={copy.included.label}
              items={state.included}
              suggestions={catalogSuggestions.included}
              onAdd={actions.addIncluded}
              onRemove={actions.removeIncluded}
              onReorder={actions.moveIncluded}
              onChangeText={actions.setIncludedText}
            />
          )}

          {effectiveTab === 'notIncluded' && (
            <LocalizedListEditor
              title={copy.notIncluded.title}
              hint={copy.notIncluded.hint}
              emptyText={copy.notIncluded.empty}
              addLabel={copy.notIncluded.add}
              itemNoun={copy.notIncluded.noun}
              itemLabel={copy.notIncluded.label}
              items={state.notIncluded}
              suggestions={catalogSuggestions.notIncluded}
              onAdd={actions.addNotIncluded}
              onRemove={actions.removeNotIncluded}
              onReorder={actions.moveNotIncluded}
              onChangeText={actions.setNotIncludedText}
            />
          )}

          {effectiveTab === 'expenses' && (
            <AdditionalExpensesEditor
              items={state.additionalExpenses}
              suggestions={catalogSuggestions.expenses}
              onAdd={actions.addExpense}
              onRemove={actions.removeExpense}
              onChangeAmount={actions.setExpenseAmount}
              onChangeDescription={actions.setExpenseDescription}
            />
          )}
        </div>
      </Card>
      )}
    </form>
  )
}
