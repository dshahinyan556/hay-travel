import { useId } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { GuestStepper, Input } from '@/shared/ui'
import { BagIcon } from '@/shared/ui/icons'
import { HelpButtonSlot } from './HelpButtonSlot'

/**
 * Багаж заявки: два счётчика (средний / большой) + «другое» свободным текстом.
 *
 * Один компонент на оба места, где багаж спрашивается, — конструктор и панель трансфера,
 * перешедшая в режим заявки (решение 0.14). Два разных набора счётчиков рано или поздно
 * разошлись бы в единицах, а единицы здесь — договор с сервером.
 *
 * Заполнять багаж НЕ обязательно (решение 0.13), и это сказано в подписи блока, а не мелким
 * шрифтом внизу: человек, решивший, что обязан заполнить всё, бросает форму.
 *
 * Курс «средний = 3, большой = 5» назван прямо у счётчиков (`…Units`-подписи), а не спрятан за
 * «?»: без него текст ошибки «указано 11 единиц» невозможно проверить глазами. За «?» уходит
 * только объяснение, зачем эти единицы вообще нужны.
 */
export interface LuggageFieldsProps {
  medium: number
  large: number
  other: string
  onMediumChange: (value: number) => void
  onLargeChange: (value: number) => void
  onOtherChange: (value: string) => void
  /** Показывать ли «3 ед. каждый» рядом с названием. Включается, когда лимит класса уже
   * нарушен: до этого момента единицы — лишний шум. */
  showUnits: boolean
  disabled?: boolean
}

export function LuggageFields({
  medium,
  large,
  other,
  onMediumChange,
  onLargeChange,
  onOtherChange,
  showUnits,
  disabled = false,
}: LuggageFieldsProps) {
  const { t } = useLocale()
  const otherId = useId()

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-ink-muted">{t('transfers.request.luggageLabel')}</span>
        <HelpButtonSlot
          title={t('transfers.request.luggageHelpTitle')}
          body={t('transfers.request.luggageHelpBody')}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 py-2">
        <span className="flex min-w-0 items-center gap-2.5 text-sm text-ink">
          <BagIcon size={18} className="shrink-0 text-ink-dim" />
          <span className="truncate">
            {showUnits ? t('transfers.request.luggageMediumUnits') : t('transfers.request.luggageMedium')}
          </span>
        </span>
        {/* `min={0}`: багаж, в отличие от гостей, честно бывает нулевым. Именно ради этого в
            `GuestStepper` починен порядок клампа (раньше нижняя граница жёстко упиралась в 1). */}
        <GuestStepper
          value={medium}
          onChange={onMediumChange}
          min={0}
          max={20}
          size="sm"
          disabled={disabled}
          valueLabel={t('transfers.request.luggageMedium')}
          labelFewer={t('transfers.request.luggageFewer')}
          labelMore={t('transfers.request.luggageMore')}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-edge py-2">
        <span className="flex min-w-0 items-center gap-2.5 text-sm text-ink">
          <BagIcon size={20} className="shrink-0 text-ink-dim" />
          <span className="truncate">
            {showUnits ? t('transfers.request.luggageLargeUnits') : t('transfers.request.luggageLarge')}
          </span>
        </span>
        <GuestStepper
          value={large}
          onChange={onLargeChange}
          min={0}
          max={20}
          size="sm"
          disabled={disabled}
          valueLabel={t('transfers.request.luggageLarge')}
          labelFewer={t('transfers.request.luggageFewer')}
          labelMore={t('transfers.request.luggageMore')}
        />
      </div>

      <div className="mt-3">
        <label htmlFor={otherId} className="block text-[11.5px] text-ink-muted">
          {t('transfers.request.luggageOtherLabel')}
        </label>
        <Input
          id={otherId}
          surface="public"
          value={other}
          onChange={(event) => onOtherChange(event.currentTarget.value)}
          placeholder={t('transfers.request.luggageOtherPlaceholder')}
          maxLength={500}
          disabled={disabled}
          className="mt-1.5"
        />
      </div>
    </div>
  )
}
