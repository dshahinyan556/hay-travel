import { Input } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { StartTimeFormState } from '@/features/admin/types/form'
import { AddButton, RemoveButton } from '@/features/admin/ui/RepeaterControls'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

export interface TourStartTimesEditorProps {
  items: StartTimeFormState[]
  /** Error for the list as a whole ("add at least one"). */
  error?: string
  /** Per-row errors keyed by row `key` — empty slot or duplicate of another row. */
  rowErrors: Record<string, string | undefined>
  onAdd: () => void
  onRemove: (key: string) => void
  onChange: (key: string, value: string) => void
  /** Re-sorts the list chronologically. Called on blur, never while typing. */
  onSort: () => void
}

/**
 * Редактор предопределённых времён начала (решение 0.21, пункт 3.6). Список `HH:mm` с
 * добавлением/удалением; минимум одно время обязательно, дубли запрещены — обе проверки
 * дублируют бэковую `InvalidTourStartTimes`/2052, чтобы ошибка была у поля, а не в 400-ке.
 *
 * Механика ввода — та же, что у единственного существующего в проекте контрола времени
 * (`jobs/components/JobScheduleCard`): нативный `<input type="time">`, значение `'HH:mm'`,
 * без собственного парсера и без маски. Общий контрол в `shared/ui` намеренно не выносится:
 * публичный сайт получит свой, со своей палитрой и своим поведением.
 *
 * СОРТИРОВКА идёт по `onBlur`, а не по `onChange`: нативный time-input докладывает и
 * промежуточные состояния (пустую строку, пока переписывают часы), и перестановка строк прямо
 * под курсором увела бы поле из-под ввода.
 *
 * Ширина строки на 375px: поле времени фиксированное и узкое (`w-32`), кнопка удаления рядом —
 * строка не переполняет экран и не переносится.
 */
export function TourStartTimesEditor({
  items,
  error,
  rowErrors,
  onAdd,
  onRemove,
  onChange,
  onSort,
}: TourStartTimesEditorProps) {
  const copy = useCopy(tourFormCopy).startTimes

  return (
    <HelpRevealZone className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-neutral-800">
            {copy.title}
            <span aria-hidden="true" className="ml-0.5 text-rose-700">
              *
            </span>
          </h4>
          <HelpButton surface="admin" title={copy.title}>
            {copy.help}
          </HelpButton>
        </div>
        {error ? (
          <p role="alert" className="text-xs font-medium text-rose-700">
            {error}
          </p>
        ) : (
          <p className="text-xs text-neutral-500">{copy.hint}</p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-xs text-neutral-400">
          {copy.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((slot, index) => {
            const rowError = rowErrors[slot.key]
            return (
              <li key={slot.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center text-xs tabular-nums text-neutral-400">
                    {index + 1}
                  </span>
                  <Input
                    type="time"
                    className="w-32"
                    value={slot.time}
                    aria-label={copy.label(index + 1)}
                    error={Boolean(rowError)}
                    onChange={(e) => onChange(slot.key, e.target.value)}
                    onBlur={onSort}
                  />
                  <RemoveButton onClick={() => onRemove(slot.key)} label={copy.remove} />
                </div>
                {rowError && (
                  <p role="alert" className="pl-6 text-xs font-medium text-rose-700">
                    {rowError}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AddButton onClick={onAdd}>{copy.add}</AddButton>
    </HelpRevealZone>
  )
}
