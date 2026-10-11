import { useLocale } from '@/shared/i18n/LocaleProvider'
import { DatePicker, TimeField } from '@/shared/ui'
import { RequestFieldError } from './RequestFieldError'
import { ReturnLegFields } from './ReturnLegFields'
import { RoutePointField } from './RoutePointField'
import { RouteStopsEditor } from './RouteStopsEditor'
import { MAX_STOPS } from '../lib/transferRequestDraft'
import type {
  TransferRequestErrors,
  TransferRequestFormState,
  TransferRequestPatch,
} from '../lib/transferWizard'

/**
 * Шаг 1 мастера: маршрут и время подачи — всё, без чего заявки не существует.
 *
 * Почему маршрут и дата на ОДНОМ шаге, а не на двух: три шага — решение владельца, и разбивать
 * «куда» и «когда» значило бы сделать четвёртый. Они и связаны сильнее всего: человек, который
 * уже написал «Звартноц → Дилижан», держит в голове и рейс, ради которого это делает.
 *
 * Компонент презентационный: ни состояния, ни запросов. Он получает значения и возвращает
 * изменения одним `onChange(patch)` — снимок формы целиком нужен экрану для черновика и сводки,
 * и собирать его из пятнадцати отдельных колбэков было бы работой ради формы вызова.
 */
export interface RequestRouteStepProps {
  values: TransferRequestFormState
  onChange: (patch: TransferRequestPatch) => void
  /** Названия точек из каталога `Place` — только подсказки, значение остаётся свободным текстом. */
  suggestions: readonly string[]
  /** Дни, закрытые правилами для трансферов как типа продукта. */
  disabledDates: ReadonlySet<string>
  /** Границы окна бронирования: `YYYY-MM-DD`. */
  minDate: string
  maxDate: string
  /** Ошибки шага. Пустой объект — показывать нечего. */
  errors: TransferRequestErrors
  /** Идентификаторы полей: экран ставит по ним фокус на первую ошибку. */
  fieldIds: { from: string; to: string; date: string; time: string }
  disabled?: boolean
}

export function RequestRouteStep({
  values,
  onChange,
  suggestions,
  disabledDates,
  minDate,
  maxDate,
  errors,
  fieldIds,
  disabled = false,
}: RequestRouteStepProps) {
  const { t } = useLocale()

  const dateLabelId = `${fieldIds.date}-label`
  const timeLabelId = `${fieldIds.time}-label`
  const returnErrorId = `${fieldIds.date}-return-error`

  return (
    <>
      <section className="rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
        <h2 className="text-[12px] tracking-[0.14em] text-gold-ink uppercase">
          {t('transfers.request.step1')}
        </h2>

        <div className="mt-4">
          <label htmlFor={fieldIds.from} className="block text-[11.5px] text-ink-muted">
            {t('transfers.request.fromLabel')}
          </label>
          <div className="mt-1.5">
            <RoutePointField
              id={fieldIds.from}
              value={values.from}
              onChange={(from) => onChange({ from })}
              suggestions={suggestions}
              noResultsText={t('transfers.request.suggestionsEmpty')}
              error={errors.from !== undefined}
              disabled={disabled}
              placeholder={t('transfers.request.fromPlaceholder')}
            />
          </div>
          {errors.from !== undefined && <RequestFieldError>{errors.from}</RequestFieldError>}
        </div>

        {/* Остановок по умолчанию НЕТ: большинству нужен маршрут A → B, и пустая строка, которую
            надо удалить, — это работа, навязанная всем ради меньшинства. */}
        <div className="mt-4">
          <RouteStopsEditor
            stops={values.stops}
            onChange={(stops) => onChange({ stops })}
            suggestions={suggestions}
            max={MAX_STOPS}
            disabled={disabled}
            showErrors={errors.stops !== undefined}
          />
          {errors.stops !== undefined && <RequestFieldError>{errors.stops}</RequestFieldError>}
        </div>

        <div className="mt-4">
          <label htmlFor={fieldIds.to} className="block text-[11.5px] text-ink-muted">
            {t('transfers.request.toLabel')}
          </label>
          <div className="mt-1.5">
            <RoutePointField
              id={fieldIds.to}
              value={values.to}
              onChange={(to) => onChange({ to })}
              suggestions={suggestions}
              noResultsText={t('transfers.request.suggestionsEmpty')}
              error={errors.to !== undefined}
              disabled={disabled}
              placeholder={t('transfers.request.toPlaceholder')}
            />
          </div>
          {errors.to !== undefined && <RequestFieldError>{errors.to}</RequestFieldError>}
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
        <h2 className="text-[12px] tracking-[0.14em] text-gold-ink uppercase">
          {t('transfers.request.step2')}
        </h2>

        {/* Та же вертикаль, что у обратного рейса ниже (решение 0.24): одна сетка, одна левая
            граница, без рамки и без отступа под галочкой. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={fieldIds.date}
              id={dateLabelId}
              className="block text-[11.5px] text-ink-muted"
            >
              {t('transfers.request.dateLabel')}
            </label>
            <DatePicker
              id={fieldIds.date}
              value={values.date}
              onChange={(date) => onChange({ date })}
              max={maxDate}
              disabledDates={disabledDates}
              surface="public"
              required
              disabled={disabled}
              error={errors.date !== undefined}
              aria-labelledby={dateLabelId}
              className="mt-1.5"
            />
            {errors.date !== undefined && <RequestFieldError>{errors.date}</RequestFieldError>}
          </div>
          <div>
            <label
              htmlFor={fieldIds.time}
              id={timeLabelId}
              className="block text-[11.5px] text-ink-muted"
            >
              {t('transfers.detail.pickupTimeLabel')}
            </label>
            <TimeField
              id={fieldIds.time}
              value={values.pickupTime}
              onChange={(pickupTime) => onChange({ pickupTime })}
              placeholder={t('transfers.detail.pickupTimePlaceholder')}
              disabled={disabled}
              error={errors.time !== undefined}
              aria-labelledby={timeLabelId}
              className="mt-1.5"
            />
            {errors.time !== undefined && <RequestFieldError>{errors.time}</RequestFieldError>}
          </div>
        </div>

        <div className="mt-4">
          <ReturnLegFields
            enabled={values.isRoundTrip}
            onToggle={(isRoundTrip) => onChange({ isRoundTrip })}
            date={values.returnDate}
            onDateChange={(returnDate) => onChange({ returnDate })}
            time={values.returnTime}
            onTimeChange={(returnTime) => onChange({ returnTime })}
            minDate={values.date === '' ? minDate : values.date}
            maxDate={maxDate}
            disabledDates={disabledDates}
            error={errors.returnLeg !== undefined}
            errorId={returnErrorId}
            disabled={disabled}
          />
          {errors.returnLeg !== undefined && (
            <RequestFieldError id={returnErrorId}>{errors.returnLeg}</RequestFieldError>
          )}
        </div>
      </section>
    </>
  )
}

