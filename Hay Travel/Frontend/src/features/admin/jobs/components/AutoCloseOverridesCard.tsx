import { useState } from 'react'
import { Input, Select } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { AddButton, RemoveButton } from '@/features/admin/ui/RepeaterControls'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TourInfoModel } from '@/shared/types/attours'
import { jobsCopy } from '../lib/jobsCopy'
import { isValidLeadTimeHours, tourTitleResolver, type TourAutoCloseOverrideDraftRow } from '../lib/jobsModel'

export interface AutoCloseOverridesCardProps {
  rows: TourAutoCloseOverrideDraftRow[]
  /** Продукты для пикера «добавить исключение» — тот же список (`getAllTours`), что и у
   * `AddLineModal`'s tour `Select`. Только неархивные (см. `adminTours.ts#getAllTours`'s doc
   * comment) — архивному продукту новое исключение заводить незачем. */
  tours: TourInfoModel[]
  disabled: boolean
  onAddRow: (tourId: number, tourName: string, leadTimeHours: string) => void
  onChangeHours: (tourId: number, value: string) => void
  onRemoveRow: (tourId: number) => void
}

/**
 * «Исключения по продуктам» — карточка ТОЛЬКО на `tour-date-auto-closure` (checklist
 * `checklist-autoclose-per-tour-2026-08-29.txt`, Р3/F2). Порог задаётся на тур целиком (Р2):
 * добавление — пикер тура + число часов, правка — прямое редактирование числа в уже добавленной
 * строке, без пересоздания. Дубли структурно невозможны — пикер сам исключает уже добавленные
 * туры из своих опций, поэтому отдельная проверка "тур уже есть" в `isValid` не нужна.
 *
 * Часть общего черновика страницы (`JobDetailPage`'s `JobDraft.overrides`) — своей кнопки
 * «Сохранить» у карточки нет, сохраняет общий тулбар вкладки «Обзор» (F3: один экран — одна
 * кнопка сохранения, конвенция Orders).
 */
export function AutoCloseOverridesCard({ rows, tours, disabled, onAddRow, onChangeHours, onRemoveRow }: AutoCloseOverridesCardProps) {
  const fullCopy = useCopy(jobsCopy)
  const copy = fullCopy.overridesCard
  const { locale } = useLocale()
  const titleOf = tourTitleResolver(tours, locale, fullCopy)

  const [pendingTourId, setPendingTourId] = useState('')
  const [pendingHours, setPendingHours] = useState('')
  // Ошибка часов показывается только после попытки добавить — та же конвенция, что у
  // `AddLineModal`: кнопка не гаснет на пустой форме, сообщение появляется по нажатию.
  const [attempted, setAttempted] = useState(false)

  const usedTourIds = new Set(rows.map((row) => row.tourId))
  const pickerOptions = tours
    .filter((tour) => !usedTourIds.has(tour.id))
    .map((tour) => ({ value: String(tour.id), label: titleOf(tour.id) }))

  const pendingHoursInvalid = attempted && pendingTourId !== '' && !isValidLeadTimeHours(pendingHours)

  function handleAdd() {
    if (disabled || pendingTourId === '') return
    if (!isValidLeadTimeHours(pendingHours)) {
      setAttempted(true)
      return
    }
    onAddRow(Number(pendingTourId), titleOf(Number(pendingTourId)), pendingHours)
    setPendingTourId('')
    setPendingHours('')
    setAttempted(false)
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
      <HelpRevealZone
        as="p"
        className="mb-3.5 flex items-center gap-2 text-[11px] font-bold tracking-[.1em] text-neutral-500 uppercase"
      >
        {copy.title}
        <HelpButton surface="admin" title={copy.title}>
          {copy.hint}
        </HelpButton>
      </HelpRevealZone>

      {rows.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
          {copy.empty}
        </p>
      ) : (
        <div className="mb-3 overflow-hidden rounded-lg border border-neutral-200">
          <div className="hidden items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-semibold tracking-[.05em] text-neutral-500 uppercase sm:flex">
            <span className="flex-1">{copy.colTour}</span>
            <span className="w-40">{copy.colHours}</span>
            <span className="w-7" aria-hidden="true" />
          </div>
          <ul>
            {rows.map((row) => {
              const invalid = !isValidLeadTimeHours(row.leadTimeHours)
              return (
                <li
                  key={row.tourId}
                  className="flex flex-col gap-1.5 border-b border-neutral-100 px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-800" title={row.tourName}>
                    {row.tourName}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <Input
                      value={row.leadTimeHours}
                      disabled={disabled}
                      error={invalid}
                      inputMode="numeric"
                      aria-label={copy.hoursFieldAria(row.tourName)}
                      onChange={(e) => onChangeHours(row.tourId, e.target.value)}
                      className="w-24 tabular-nums"
                    />
                    <RemoveButton onClick={() => onRemoveRow(row.tourId)} label={copy.removeAria(row.tourName)} disabled={disabled} />
                  </div>
                  {invalid && <p className="text-xs font-medium text-rose-700">{copy.hoursError}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!disabled && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_140px]">
            <Select
              value={pendingTourId}
              onChange={(value) => {
                setPendingTourId(value)
                setAttempted(false)
              }}
              options={pickerOptions}
              placeholder={copy.addTourPlaceholder}
              disabled={pickerOptions.length === 0}
              searchable
              aria-label={copy.addTourAria}
            />
            <Input
              value={pendingHours}
              disabled={pendingTourId === ''}
              error={pendingHoursInvalid}
              inputMode="numeric"
              placeholder={copy.addHoursPlaceholder}
              aria-label={copy.addHoursAria}
              onChange={(e) => setPendingHours(e.target.value)}
              className="tabular-nums"
            />
          </div>
          {pendingHoursInvalid && <p className="text-xs font-medium text-rose-700">{copy.hoursError}</p>}
          {pickerOptions.length === 0 && tours.length > 0 && (
            <p className="text-xs text-neutral-400">{copy.allToursAdded}</p>
          )}
          <AddButton onClick={handleAdd}>{copy.addButton}</AddButton>
        </div>
      )}
    </div>
  )
}
