import { useMemo } from 'react'
import { Select, type SelectOption } from './Select'
import { ClockIcon } from './icons'

/**
 * Пикер времени `HH:mm` с шагом 15 минут — единственный публичный контрол времени на сайте.
 *
 * Зачем свой, а не `<input type="time">`: нативное поле рисует ОС, и на телефоне это выпадающий
 * барабан с 1440 позициями и своей палитрой — ровно то, из-за чего в проекте уже заменён
 * `<input type="date">` на `DatePicker` (см. его доккоммент и `docs/audit/bugs-2026-07-27.md`).
 *
 * Реализован как тонкая обёртка над `Select`, а не как новый оверлей: `Select` уже умеет обе
 * палитры, поповер на десктопе, шторку `Sheet` на телефоне, клавиатуру и typeahead («09» →
 * прыжок к 09:00). Дублировать это ради списка времён значило бы завести второй, отстающий
 * листбокс.
 *
 * Шаг 15 минут — продуктовое решение, а не техническое ограничение: время ПОДАЧИ машины
 * согласуется с водителем, и минутная точность в нём ложная. 96 вариантов помещаются в один
 * прокручиваемый список без поиска.
 *
 * Значение — каноничный `HH:mm` (`shared/booking/startTime.ts`), тот же формат, что у времени
 * старта продукта. Пустая строка = «не выбрано», ровно как у `DatePicker`.
 */

/** Минут в шаге. Меняя, проверить, что 60 делится нацело — иначе список уедет с круглых часов. */
const STEP_MINUTES = 15

function buildOptions(): SelectOption[] {
  const options: SelectOption[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += STEP_MINUTES) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
    const mm = String(minutes % 60).padStart(2, '0')
    options.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` })
  }
  return options
}

/** Построен один раз на модуль: список не зависит ни от локали (цифры), ни от пропсов. */
const TIME_OPTIONS = buildOptions()

export interface TimeFieldProps {
  id?: string
  /** Каноничный `HH:mm`, либо `''` — не выбрано. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

export function TimeField({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: TimeFieldProps) {
  /*
    Время, пришедшее не по шагу (админ завёл 09:05, посетитель вернулся по deep link), обязано
    остаться видимым и выбранным: подменить его ближайшей четвертью значило бы молча изменить
    договорённость. Такой вариант добавляется в список ровно на своё место по возрастанию.
  */
  const options = useMemo(() => {
    if (value === '' || TIME_OPTIONS.some((option) => option.value === value)) return TIME_OPTIONS
    const merged = [...TIME_OPTIONS, { value, label: value }]
    merged.sort((a, b) => a.value.localeCompare(b.value))
    return merged
  }, [value])

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      error={error}
      surface="public"
      className={className}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      triggerPrefix={<ClockIcon size={16} />}
    />
  )
}
