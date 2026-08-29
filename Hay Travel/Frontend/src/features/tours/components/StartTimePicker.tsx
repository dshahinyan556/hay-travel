import { useId } from 'react'
import type { TourStartTime } from '@/shared/types/tour'
import { useLocale } from '@/shared/i18n/LocaleProvider'

/**
 * Выбор времени выезда из ПРЕДОПРЕДЕЛЁННОГО списка (решение 0.21) — блок брони, публичный сайт.
 *
 * Ряд радио-кнопок, а не `Select` и тем более не поле ввода времени. Три причины, и все три
 * продуктовые:
 *  1. Своё время ввести нельзя в принципе — бэк отбивает значение не из расписания
 *     (`InvalidStartTimeSelection`/2045). Текстовое поле обещало бы свободу, которой нет.
 *  2. Времён обычно два-три. Выпадающий список превратил бы выбор из одного тапа в два и
 *     спрятал бы варианты за триггером.
 *  3. У группового формата у КАЖДОГО слота свой остаток мест: «14:00 — мест нет» видно сразу,
 *     а не после того, как посетитель туда ткнёт.
 *
 * Под капотом — НАСТОЯЩИЕ `input[type=radio]`, спрятанные через `sr-only`, а не `<button
 * role="radio">`: тогда группа бесплатно получает правильную клавиатуру (стрелки внутри группы,
 * один таб-стоп на всю группу) и корректное поведение `disabled`, а вся визуальная часть
 * остаётся на `peer-*`-классах.
 *
 * Компонент полностью презентационный: ни состояния, ни сети, ни знания о продукте — места
 * считает и решает, что заблокировано, вызывающий (`BookingCard`).
 */

export interface StartTimeOption extends TourStartTime {
  /** Мест на этом слоте, `null` — ограничителя нет (индивидуальный формат) или он неизвестен. */
  seatsLeft: number | null
  /** Слот недоступен: мест не осталось. Вариант остаётся в DOM и озвучивается — исчезнувшую
   * кнопку нельзя ни понять, ни объяснить. */
  disabled: boolean
}

export interface StartTimePickerProps {
  options: readonly StartTimeOption[]
  /** Каноничный `HH:mm`; `''` — ещё не выбрано. */
  value: string
  onChange: (time: string) => void
  /** `id` подписи «Время выезда» — имя группы. */
  labelledBy: string
  describedBy?: string
}

/* Состояния «ошибка» у этого контрола нет намеренно: невыбранное время не ошибка, а
   незаконченный выбор — кнопка брони просто заблокирована, и требование написано под ней.
   Красная рамка на группе, к которой посетитель ещё не прикасался, обвиняла бы его в том,
   чего он не делал. */
export function StartTimePicker({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
}: StartTimePickerProps) {
  const { t } = useLocale()
  const groupName = useId()

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const selected = option.time === value
        return (
          <label
            key={option.id}
            className={option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          >
            <input
              type="radio"
              name={groupName}
              value={option.time}
              checked={selected}
              disabled={option.disabled}
              required
              onChange={() => onChange(option.time)}
              className="peer sr-only"
            />
            <span
              className={[
                // 44px по высоте — то же правило тап-таргета, что у остальных публичных контролов.
                'inline-flex min-h-11 flex-col items-center justify-center rounded-xl px-3.5 py-1.5 text-sm font-medium tabular-nums ring-1 transition-colors',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-panel',
                option.disabled
                  ? 'bg-panel-raised text-ink-muted line-through opacity-60 ring-edge'
                  : selected
                    ? 'bg-gold-fill text-gold-on ring-gold-line'
                    : 'bg-panel-raised text-ink ring-edge hover:bg-accent-soft',
              ].join(' ')}
            >
              <span>{option.time}</span>
              {/* Остаток мест подписан ПОД временем, а не рядом: иначе кнопки в ряду получают
                  разную ширину и ряд перестаёт читаться как один выбор. */}
              {option.seatsLeft !== null && (
                <span className="text-[10px] leading-tight font-normal opacity-80">
                  {t('booking.seatsLeft', { count: option.seatsLeft })}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
