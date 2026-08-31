import { useId } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { VehicleClass } from '@/shared/types/transfer'
import { GuestStepper, Select, type SelectOption } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { LuggageFields } from './LuggageFields'
import { RequestFieldError } from './RequestFieldError'
import { luggageOverflow, luggageUnits } from '../lib/luggage'
import type {
  TransferRequestErrors,
  TransferRequestFormState,
  TransferRequestPatch,
} from '../lib/transferWizard'

/**
 * Шаг 2 мастера: сколько людей, сколько багажа, какая машина и что сказать менеджеру.
 *
 * Порядок панелей — «обязательное сверху, необязательное снизу»: пассажиры это единственное, без
 * чего заявку не посчитать, а багаж, класс и комментарий заполнять НЕ обязательно, и это сказано
 * прямо в подписи блока, а не мелким шрифтом внизу. Человек, решивший, что обязан заполнить всё,
 * бросает форму.
 *
 * Ошибки этого шага не «поля не заполнены», а противоречия: пассажиров больше вместимости
 * выбранного класса (2049) и багаж сверх его лимита (2048). Поэтому обе стоят рядом со своим
 * блоком — исправляют их изменением ЧУЖОГО поля (выбрать класс просторнее либо убавить багаж), и
 * ошибка внизу шага заставила бы искать, о чём речь.
 */
export interface RequestDetailsStepProps {
  values: TransferRequestFormState
  onChange: (patch: TransferRequestPatch) => void
  /** Справочник классов. Пустой — loader не смог его загрузить, поле выбора не рисуется вовсе. */
  vehicleClasses: readonly VehicleClass[]
  /** Выбранный класс, уже найденный экраном. `null` — «подберите сами». */
  chosenClass: VehicleClass | null
  errors: TransferRequestErrors
  /** Идентификатор поля класса — по нему экран ставит фокус на ошибку вместимости. */
  vehicleFieldId: string
  disabled?: boolean
}

export function RequestDetailsStep({
  values,
  onChange,
  vehicleClasses,
  chosenClass,
  errors,
  vehicleFieldId,
  disabled = false,
}: RequestDetailsStepProps) {
  const { t } = useLocale()
  const commentId = useId()
  const vehicleLabelId = `${vehicleFieldId}-label`

  const luggageShortfall =
    chosenClass === null
      ? 0
      : luggageOverflow(
          { medium: values.luggageMedium, large: values.luggageLarge },
          chosenClass.luggageCapacity,
        )

  const vehicleOptions: SelectOption[] = [
    { value: '', label: t('transfers.request.vehicleAny') },
    ...vehicleClasses.map((item) => ({
      value: String(item.id),
      label: item.name,
      meta: t('transfers.detail.capacity', { count: item.capacity }),
    })),
  ]

  return (
    <>
      <section className="rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
        <h2 className="text-[12px] tracking-[0.14em] text-gold-ink uppercase">
          {t('transfers.request.step3')}
        </h2>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-ink-muted">{t('transfers.detail.passengers')}</span>
          <GuestStepper
            value={values.passengers}
            onChange={(passengers) => onChange({ passengers })}
            min={1}
            // Потолка гостей у заявки нет (решение 0.14): именно сюда приходят те, кому не
            // хватило вместимости готовых классов. Верхняя граница — только защита от опечатки.
            max={99}
            disabled={disabled}
            valueLabel={t('transfers.detail.passengers')}
            labelFewer={t('transfers.detail.passengersFewer')}
            labelMore={t('transfers.detail.passengersMore')}
          />
        </div>

        <div className="my-4 h-px bg-edge" />

        <LuggageFields
          medium={values.luggageMedium}
          large={values.luggageLarge}
          other={values.luggageOther}
          onMediumChange={(luggageMedium) => onChange({ luggageMedium })}
          onLargeChange={(luggageLarge) => onChange({ luggageLarge })}
          onOtherChange={(luggageOther) => onChange({ luggageOther })}
          // Единицы называются рядом со счётчиками ровно тогда, когда они начали иметь значение:
          // класс выбран и его лимит уже нарушен.
          showUnits={luggageShortfall > 0}
          disabled={disabled}
        />

        {/* Ошибка багажа живёт РЯДОМ С БАГАЖОМ, а не у кнопки: развёрнутая, потому что «указано
            11 единиц против 8» невозможно проверить глазами без чисел. */}
        {errors.luggage !== undefined && chosenClass !== null && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger-soft p-3.5 ring-1 ring-danger/45">
            <span className="mt-0.5 shrink-0 text-danger">
              <AlertIcon size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{errors.luggage}</p>
              <p className="mt-1 text-[13px] leading-snug text-ink-dim">
                {t('transfers.request.luggageTooMuchBody', {
                  units: luggageUnits({
                    medium: values.luggageMedium,
                    large: values.luggageLarge,
                  }),
                  medium: values.luggageMedium,
                  large: values.luggageLarge,
                  capacity: chosenClass.luggageCapacity,
                })}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
        <h2 className="text-[12px] tracking-[0.14em] text-gold-ink uppercase">
          {t('transfers.request.step4')}
        </h2>

        {/* Справочник классов мог не загрузиться (loader глушит ошибку) — тогда поля выбора
            просто нет, а заявка уходит как «подберите сами». Пустой селект был бы хуже. */}
        {vehicleClasses.length > 0 && (
          <div className="mt-4">
            <span id={vehicleLabelId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.request.vehicleLabel')}
            </span>
            <Select
              id={vehicleFieldId}
              value={values.vehicleClassId === null ? '' : String(values.vehicleClassId)}
              onChange={(value) =>
                onChange({ vehicleClassId: value === '' ? null : Number(value) })
              }
              options={vehicleOptions}
              placeholder={t('transfers.request.vehicleAny')}
              surface="public"
              disabled={disabled}
              error={errors.vehicle !== undefined}
              aria-labelledby={vehicleLabelId}
              className="mt-1.5"
            />
            {errors.vehicle !== undefined && <RequestFieldError>{errors.vehicle}</RequestFieldError>}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor={commentId} className="block text-[11.5px] text-ink-muted">
            {t('transfers.request.commentLabel')}
          </label>
          <textarea
            id={commentId}
            value={values.comment}
            onChange={(event) => onChange({ comment: event.currentTarget.value })}
            rows={4}
            maxLength={2000}
            disabled={disabled}
            placeholder={t('transfers.request.commentPlaceholder')}
            className="mt-1.5 w-full rounded-lg border border-edge-strong bg-panel-raised px-3 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-gold-line focus:ring-2 focus:ring-focus focus:outline-none"
          />
        </div>
      </section>
    </>
  )
}
