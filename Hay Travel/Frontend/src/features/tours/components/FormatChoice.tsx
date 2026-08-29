import { useId } from 'react'
import { TourFormat, type EffectiveTourFormat } from '@/shared/types/tourFormat'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { GuideIcon, UsersIcon } from '@/shared/ui/icons'

/**
 * Переключатель формата для продукта, который продаётся В ОБОИХ (`TourFormat.Both`, решение
 * 0.16) — блок брони, публичный сайт.
 *
 * Показывается ТОЛЬКО при `Both`: у продукта с фиксированным форматом выбирать нечего, и
 * переключатель из одной кнопки был бы обманом — бэк всё равно игнорирует присланный формат
 * (`OrderLinePricing.ResolveEffectiveFormat`).
 *
 * Выбор меняет ЦЕНУ, поэтому у каждого варианта есть строка-пояснение, а не только название:
 * «индивидуальный» и «групповой» сами по себе не говорят, что в одном случае платят за бронь,
 * а в другом — за человека. Это не декоративная подсказка, а условие сделки.
 *
 * Две карточки-радио в столбик, а не сегмент-контрол в строку: на 375px две подписи с
 * пояснениями в одну строку не помещаются, а ломать сетку под брейкпоинт ради формы контрола
 * значит иметь два разных DOM-порядка для одного и того же выбора.
 */

export interface FormatChoiceProps {
  value: EffectiveTourFormat
  onChange: (format: EffectiveTourFormat) => void
  /** `id` подписи «Формат» — имя группы. */
  labelledBy: string
  disabled?: boolean
}

const OPTIONS: readonly {
  format: EffectiveTourFormat
  labelKey: 'chip.formatIndividual' | 'chip.formatGroup'
  hintKey: 'booking.formatIndividualHint' | 'booking.formatGroupHint'
  Glyph: typeof GuideIcon
}[] = [
  {
    format: TourFormat.Individual,
    labelKey: 'chip.formatIndividual',
    hintKey: 'booking.formatIndividualHint',
    Glyph: GuideIcon,
  },
  {
    format: TourFormat.Group,
    labelKey: 'chip.formatGroup',
    hintKey: 'booking.formatGroupHint',
    Glyph: UsersIcon,
  },
]

export function FormatChoice({ value, onChange, labelledBy, disabled = false }: FormatChoiceProps) {
  const { t } = useLocale()
  const groupName = useId()

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2">
      {OPTIONS.map(({ format, labelKey, hintKey, Glyph }) => {
        const selected = format === value
        return (
          <label key={format} className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
            <input
              type="radio"
              name={groupName}
              value={format}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(format)}
              className="peer sr-only"
            />
            <span
              className={[
                'flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 ring-1 transition-colors',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-panel',
                selected ? 'bg-accent-soft ring-gold-line' : 'bg-panel-raised ring-edge hover:bg-accent-soft',
                disabled ? 'opacity-60' : '',
              ].join(' ')}
            >
              <span className={selected ? 'shrink-0 text-gold-ink' : 'shrink-0 text-ink-muted'}>
                <Glyph size={16} />
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${selected ? 'text-ink' : 'text-ink-dim'}`}>
                  {t(labelKey)}
                </span>
                <span className="block text-xs leading-snug text-ink-muted">{t(hintKey)}</span>
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
