import { useState } from 'react'
import { Card, Tabs } from '@/shared/ui'
import type { TabItem } from '@/shared/ui'
import { TourType } from '@/features/admin/lib/enums'
import type { TourFormState } from '@/features/admin/types/form'
import type { TourFormActions } from '@/features/admin/tour-form/hooks/useTourForm'
import type { TourFormValidation } from '@/features/admin/tour-form/lib/validation'
import { TourFormHeader } from './TourFormHeader'
import { TourDaysEditor } from './TourDaysEditor'
import { LocalizedListEditor } from './LocalizedListEditor'
import { GalleryImagesEditor } from './GalleryImagesEditor'
import { AdditionalExpensesEditor } from './AdditionalExpensesEditor'
import { FormActions } from './FormActions'

interface TourFormProps {
  state: TourFormState
  actions: TourFormActions
  validation: TourFormValidation
  hasAttemptedSubmit: boolean
  isSubmitting: boolean
  submitError: string | null
  /** True in edit mode — locks the tour/excursion type toggle (type is immutable after creation). */
  typeLocked?: boolean
  onSubmit: () => void
}

type TabId = 'days' | 'org' | 'restrictions' | 'expenses'

/**
 * Presentational orchestrator. Always shows `TourFormHeader` (type, image, price, the tour's
 * texts). What follows depends on the type:
 *
 *  - Tour: a tabbed card whose first tab is "Дни" (the multi-day accordion), then the optional
 *    lists.
 *  - Excursion: no "Дни" tab — its single day IS the tour. Its route points and gallery render
 *    as flat sections directly under the header, and the tabbed card holds only the optional
 *    lists (organizational details, restrictions, expenses).
 *
 * Holds no domain state; only the active tab is local UI state.
 */
export function TourForm({
  state,
  actions,
  validation,
  hasAttemptedSubmit,
  isSubmitting,
  submitError,
  typeLocked,
  onSubmit,
}: TourFormProps) {
  const isExcursion = state.type === TourType.Excursion
  const singleDay = state.days[0]

  const tabs: TabItem[] = [
    ...(isExcursion ? [] : [{ id: 'days', label: 'Дни', badge: state.days.length } as TabItem]),
    { id: 'org', label: 'Организационные детали' },
    { id: 'restrictions', label: 'Ограничения' },
    { id: 'expenses', label: 'Доп. расходы' },
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
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{submitError}</span>
        </div>
      )}

      <TourFormHeader
        state={state}
        actions={actions}
        mainImageUrlError={validation.mainImageUrl}
        titleRuError={validation.titleRu}
        excursionPriceError={singleDay ? validation.dayPriceErrors[singleDay.key] : undefined}
        typeLocked={typeLocked}
      />

      {isExcursion && singleDay && (
        <Card padding="lg">
          <div className="flex flex-col gap-5">
            <LocalizedListEditor
              title="Точки маршрута"
              hint="Порядок точек соответствует маршруту экскурсии."
              emptyText="Точек маршрута пока нет."
              addLabel="Добавить точку"
              itemNoun="точку"
              error={validation.dayRoutePointErrors[singleDay.key]}
              items={singleDay.routePoints}
              onAdd={() => actions.addRoutePoint(singleDay.key)}
              onRemove={(key) => actions.removeRoutePoint(singleDay.key, key)}
              onMove={(key, direction) => actions.moveRoutePoint(singleDay.key, key, direction)}
              onChangeText={(key, lang, value) =>
                actions.setRoutePointText(singleDay.key, key, lang, value)
              }
            />

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-neutral-800">Галерея</h4>
              <GalleryImagesEditor
                items={singleDay.gallery}
                onAdd={() => actions.addGallery(singleDay.key)}
                onRemove={(key) => actions.removeGallery(singleDay.key, key)}
                onMove={(key, direction) => actions.moveGallery(singleDay.key, key, direction)}
                onChangeUrl={(key, value) => actions.setGalleryUrl(singleDay.key, key, value)}
              />
            </div>
          </div>
        </Card>
      )}

      <Card className="!p-0">
        <Tabs
          tabs={tabs}
          activeId={effectiveTab}
          onChange={(id) => setActiveTab(id as TabId)}
          label="Разделы тура"
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
            />
          )}

          {effectiveTab === 'org' && (
            <LocalizedListEditor
              title="Организационные детали"
              hint="Например: «Гид на русском», «Трансфер включён»."
              emptyText="Организационных деталей пока нет."
              addLabel="Добавить деталь"
              itemNoun="деталь"
              items={state.organizationalDetails}
              onAdd={actions.addOrgDetail}
              onRemove={actions.removeOrgDetail}
              onMove={actions.moveOrgDetail}
              onChangeText={actions.setOrgDetailText}
            />
          )}

          {effectiveTab === 'restrictions' && (
            <LocalizedListEditor
              title="Ограничения"
              hint="Например: «Возраст 6+», «Не для маломобильных гостей»."
              emptyText="Ограничений пока нет."
              addLabel="Добавить ограничение"
              itemNoun="ограничение"
              items={state.restrictions}
              onAdd={actions.addRestriction}
              onRemove={actions.removeRestriction}
              onMove={actions.moveRestriction}
              onChangeText={actions.setRestrictionText}
            />
          )}

          {effectiveTab === 'expenses' && (
            <AdditionalExpensesEditor
              items={state.additionalExpenses}
              onAdd={actions.addExpense}
              onRemove={actions.removeExpense}
              onChangeAmount={actions.setExpenseAmount}
              onChangeDescription={actions.setExpenseDescription}
            />
          )}
        </div>
      </Card>

      <FormActions
        isSubmitting={isSubmitting}
        isValid={validation.isValid}
        hasAttemptedSubmit={hasAttemptedSubmit}
        submitError={submitError}
        onSubmit={onSubmit}
      />
    </form>
  )
}
