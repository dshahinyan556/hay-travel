import { useId } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { DatePicker, TimeField } from '@/shared/ui'
import { CheckIcon } from '@/shared/ui/icons'

/**
 * Галочка «нужен обратный трансфер» + пара «дата / время» под ней.
 *
 * ОДИН компонент на оба экрана (страница трансфера и конструктор заявки) — и это его главная
 * причина существовать. Он гарантирует то, что владелец потребовал отдельной правкой мокапа
 * (решение 0.24): нижняя пара полей стоит РОВНО на той же вертикали, что «дата поездки» и «время
 * подачи» — та же сетка `1fr 1fr`, та же ширина, та же левая граница.
 *
 * Ни рамки-подложки, ни `padding-left` от галочки здесь нет намеренно: раньше рамка блока плюс
 * отступ под галочкой сдвигали нижнюю пару вправо на 31px и делали поля уже верхних — две пары
 * читались как из разных форм. Связь с галочкой держится РАССТОЯНИЕМ (12px против 18px до
 * следующего блока), а не подложкой.
 *
 * Ниже `sm` поля идут одно под другим, а не в две колонки: на 375px пара «дата + время» рядом
 * сжала бы каждое поле до ~150px, и дата с названием месяца в него не помещается. Правило при
 * этом то же — все четыре поля во всю ширину панели, одна левая граница.
 */
export interface ReturnLegFieldsProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  /** `YYYY-MM-DD`, либо `''`. */
  date: string
  onDateChange: (value: string) => void
  /** `HH:mm`, либо `''`. */
  time: string
  onTimeChange: (value: string) => void
  /** Нижняя граница календаря — дата самой поездки: раньше неё обратный рейс не бывает. */
  minDate: string
  maxDate: string
  disabledDates: ReadonlySet<string>
  /** Подсветить оба поля красным и повесить `aria-describedby`. */
  error: boolean
  errorId?: string
  disabled?: boolean
}

export function ReturnLegFields({
  enabled,
  onToggle,
  date,
  onDateChange,
  time,
  onTimeChange,
  minDate,
  maxDate,
  disabledDates,
  error,
  errorId,
  disabled = false,
}: ReturnLegFieldsProps) {
  const { t } = useLocale()
  const dateId = useId()
  const dateLabelId = `${dateId}-label`
  const timeId = useId()
  const timeLabelId = `${timeId}-label`

  return (
    <>
      {/* Своя коробочка чекбокса по той же причине, что у радио класса авто: нативный контрол
          рисуется системой мимо палитры сайта. Настоящий `input` остаётся в DOM. */}
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.currentTarget.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-focus ${
            enabled ? 'border-gold-line bg-gold-fill text-gold-on' : 'border-edge-strong bg-panel-raised'
          }`}
        >
          {enabled && <CheckIcon size={14} strokeWidth={2.4} />}
        </span>
        <span className="text-sm text-ink">{t('transfers.detail.returnToggle')}</span>
      </label>

      {enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={dateId} id={dateLabelId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.detail.returnDateLabel')}
            </label>
            <DatePicker
              id={dateId}
              value={date}
              onChange={onDateChange}
              min={minDate}
              max={maxDate}
              disabledDates={disabledDates}
              surface="public"
              error={error}
              disabled={disabled}
              aria-labelledby={dateLabelId}
              aria-describedby={error ? errorId : undefined}
              className="mt-1.5"
            />
          </div>
          <div>
            <label htmlFor={timeId} id={timeLabelId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.detail.returnTimeLabel')}
            </label>
            <TimeField
              id={timeId}
              value={time}
              onChange={onTimeChange}
              placeholder={t('transfers.detail.pickupTimePlaceholder')}
              error={error}
              disabled={disabled}
              aria-labelledby={timeLabelId}
              aria-describedby={error ? errorId : undefined}
              className="mt-1.5"
            />
          </div>
        </div>
      )}
    </>
  )
}
