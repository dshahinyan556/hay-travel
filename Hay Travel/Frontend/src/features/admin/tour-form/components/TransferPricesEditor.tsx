import { Input, Select } from '@/shared/ui'
import type { SelectOption } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { TransferPriceFormState } from '@/features/admin/types/form'
import type { VehicleClassOption } from '@/features/admin/lib/tourMapper'
import type { TransferPriceField } from '@/features/admin/tour-form/reducer/tourFormReducer'
import type { TransferPriceRowErrors } from '@/features/admin/tour-form/lib/validation'
import { AddButton, RemoveButton } from '@/features/admin/ui/RepeaterControls'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

export interface TransferPricesEditorProps {
  items: TransferPriceFormState[]
  /** The vehicle-class catalog, already ordered by its own `sortOrder`. */
  vehicleClasses: VehicleClassOption[]
  /** Error for the table as a whole ("add at least one row"). */
  error?: string
  /** Per-row errors keyed by row `key`. */
  rowErrors: Record<string, TransferPriceRowErrors>
  onAdd: () => void
  onRemove: (key: string) => void
  onChangeClass: (key: string, vehicleClassId: number | null) => void
  onChangeAmount: (key: string, field: TransferPriceField, value: string) => void
}

/**
 * Таблица «класс авто → цена в одну сторону / цена туда-обратно» (пункт 3.7).
 *
 * Две цены — ДВА независимых поля: «туда-обратно» не вычисляется как ×2 (решение 0.6), поэтому
 * второе поле никогда не подставляется автоматически и не блокируется.
 *
 * Разметка строки повторяет `AdditionalExpensesEditor`: карточка-строка, на широком экране —
 * сетка «класс | туда | туда-обратно | ✕», на 375px она схлопывается в одну колонку. Подписи
 * колонок живут в `placeholder`/`aria-label`, а не отдельной шапкой таблицы: шапка на узком
 * экране всё равно отрывается от своих ячеек.
 */
export function TransferPricesEditor({
  items,
  vehicleClasses,
  error,
  rowErrors,
  onAdd,
  onRemove,
  onChangeClass,
  onChangeAmount,
}: TransferPricesEditorProps) {
  const copy = useCopy(tourFormCopy).transfer
  const localizedName = useCopy(tourFormCopy).localizedName
  // Справочник пуст и цен ещё нет — задать тут нечего, и «Добавить класс» вело бы в строку с
  // пустым выпадающим списком. Это состояние экрана, а не ошибка формы, поэтому без `role=alert`.
  const catalogEmpty = vehicleClasses.length === 0 && items.length === 0

  /** Опции одной строки: активные классы + тот, что уже выбран в ней (даже если его скрыли в
   * справочнике) — иначе строка молча потеряла бы свой класс при открытии формы. */
  const optionsFor = (selectedId: number | null): SelectOption[] =>
    vehicleClasses
      .filter((vc) => vc.isActive || vc.id === selectedId)
      .map((vc) => ({
        value: String(vc.id),
        label: `${localizedName(vc.name) || copy.vehicleClassFallback(vc.id)} · ${copy.vehicleClassMeta(vc.capacity, vc.luggageCapacity)}`,
      }))

  return (
    <HelpRevealZone className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-neutral-800">
            {copy.pricesTitle}
            <span aria-hidden="true" className="ml-0.5 text-rose-700">
              *
            </span>
          </h4>
          <HelpButton surface="admin" title={copy.pricesTitle}>
            {copy.pricesHelp}
          </HelpButton>
        </div>
        {error && (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {error}
          </p>
        )}
      </div>

      {catalogEmpty ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-500">
          {copy.noVehicleClasses}
        </p>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
              {copy.pricesEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {items.map((row) => {
                const rowError = rowErrors[row.key]
                return (
                  <li
                    key={row.key}
                    className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-2.5"
                  >
                    <div className="grid items-start gap-2.5 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto]">
                      <Select
                        surface="admin"
                        value={row.vehicleClassId == null ? '' : String(row.vehicleClassId)}
                        options={optionsFor(row.vehicleClassId)}
                        placeholder={copy.vehicleClassPlaceholder}
                        aria-label={copy.vehicleClass}
                        error={Boolean(rowError?.vehicleClassId)}
                        onChange={(value) => onChangeClass(row.key, value === '' ? null : Number(value))}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.oneWayPrice}
                        onChange={(e) => onChangeAmount(row.key, 'oneWayPrice', e.target.value)}
                        aria-label={copy.oneWayPrice}
                        placeholder={copy.oneWayPrice}
                        error={Boolean(rowError?.oneWayPrice)}
                        className="text-sm"
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.roundTripPrice}
                        onChange={(e) => onChangeAmount(row.key, 'roundTripPrice', e.target.value)}
                        aria-label={copy.roundTripPrice}
                        placeholder={copy.roundTripPrice}
                        error={Boolean(rowError?.roundTripPrice)}
                        className="text-sm"
                      />
                      <div className="justify-self-end sm:pt-0.5">
                        <RemoveButton onClick={() => onRemove(row.key)} label={copy.priceRemove} />
                      </div>
                    </div>
                    {rowError && (
                      <p role="alert" className="text-xs font-medium text-rose-700">
                        {rowError.vehicleClassId ?? rowError.oneWayPrice ?? rowError.roundTripPrice}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <AddButton onClick={onAdd}>{copy.pricesAdd}</AddButton>
        </>
      )}
    </HelpRevealZone>
  )
}
