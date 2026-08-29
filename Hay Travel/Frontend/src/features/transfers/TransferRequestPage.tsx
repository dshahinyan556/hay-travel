import { useId, useMemo, useState } from 'react'
import { useLoaderData, useSearchParams } from 'react-router'
import { createTransferRequest, getPlaceSuggestions, getTransferTypeClosedDates, getVehicleClasses } from '@/shared/api/transfers'
import { getAuthState } from '@/shared/auth'
import { getBookingWindow, toWireTime } from '@/shared/booking'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { formatShortDate } from '@/shared/lib/format'
import type { VehicleClass } from '@/shared/types/transfer'
import { DatePicker, GuestStepper, Select, TimeField, type SelectOption } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { HelpButtonSlot } from './components/HelpButtonSlot'
import { LuggageFields } from './components/LuggageFields'
import { RequestAuthNotice } from './components/RequestAuthNotice'
import { RequestResultPanel } from './components/RequestResultPanel'
import { ReturnLegFields } from './components/ReturnLegFields'
import { RoutePointField } from './components/RoutePointField'
import { RouteStopsEditor } from './components/RouteStopsEditor'
import { createRouteStop, type RouteStop } from './lib/routeStops'
import { luggageOverflow, luggageUnits } from './lib/luggage'
import {
  clearTransferRequestDraft,
  MAX_STOPS,
  readTransferRequestDraft,
  writeTransferRequestDraft,
} from './lib/transferRequestDraft'
import { isSessionFailure, transferRequestMessage } from './lib/transferRequestErrors'

/**
 * `/transfers/custom` — конструктор собственного трансфера (пункты 6.3-6.7).
 *
 * Здесь НЕТ цены: это заявка, а не покупка. Значит, главная задача экрана — не «продать», а не
 * потерять человека на середине формы. Отсюда вся раскладка: ОДНА колонка 720px по центру,
 * четыре пронумерованных шага и ни одного лишнего поля на виду. Пронумерованные панели дают
 * ощущение конечности — видно, что форма кончится.
 *
 * Обязательное сверху, необязательное снизу: багаж, класс и комментарий стоят в конце, и
 * «не обязательно» написано в подписи блока, а не мелким шрифтом внизу.
 *
 * ── Маршрут может прийти из фильтров ──────────────────────────────────────────────────────────
 * Если посетитель попал сюда из пустого результата `/transfers?from=…&to=…`, «откуда» и «куда»
 * уже заполнены его выбором. Переспрашивать то, что он только что указал, нельзя.
 *
 * ── Черновик и логин (пункт 6.6) ──────────────────────────────────────────────────────────────
 * Отправка требует логина. Логин — это НАВИГАЦИЯ на `/auth` и обратно, то есть полный размонтаж
 * формы из четырёх шагов. Поэтому перед показом блока входа всё заполненное уезжает в
 * `localStorage` (`lib/transferRequestDraft.ts`), а `?returnTo=/transfers/custom` возвращает
 * ровно сюда, где черновик читается ленивым инициализатором — без вспышки пустой формы.
 *
 * ── Что валидируется ──────────────────────────────────────────────────────────────────────────
 * Ровно то, что валидирует сервер (правило 0.29): маршрут (2053), дата и время подачи (2016/2045),
 * обратный рейс (2058), вместимость желаемого класса (2049) и багаж против его лимита (2048,
 * только если багаж заполнен — решение 0.13).
 */

export interface TransferRequestLoaderData {
  vehicleClasses: readonly VehicleClass[]
  suggestions: readonly string[]
  closedDates: readonly string[]
}

export async function transferRequestLoader(): Promise<TransferRequestLoaderData> {
  const window = getBookingWindow()
  /* Ни один из трёх запросов не имеет права уронить экран: без справочника классов заявка
     отправляется «подберите сами», без подсказок точка вводится руками, без списка закрытых дат
     дату проверит сервер. Поэтому все три с `catch` в пустое значение. */
  const [vehicleClasses, suggestions, closedDates] = await Promise.all([
    getVehicleClasses().catch(() => [] as readonly VehicleClass[]),
    getPlaceSuggestions().catch(() => [] as readonly string[]),
    getTransferTypeClosedDates(window.fromISO, window.toISO).catch(() => [] as string[]),
  ])
  return { vehicleClasses, suggestions, closedDates }
}

export function TransferRequestPage() {
  const { vehicleClasses, suggestions, closedDates } = useLoaderData() as TransferRequestLoaderData
  const { locale, t } = useLocale()
  const [params] = useSearchParams()

  const fromId = useId()
  const toId = useId()
  const dateId = useId()
  const dateLabelId = `${dateId}-label`
  const timeId = useId()
  const timeLabelId = `${timeId}-label`
  const vehicleId = useId()
  const vehicleLabelId = `${vehicleId}-label`
  const commentId = useId()
  const errorId = `${dateId}-error`

  const bookingWindow = useMemo(() => getBookingWindow(), [])
  const disabledDates = useMemo(() => new Set(closedDates), [closedDates])

  /* Черновик конструктора (`owner === null`) — один раз, ленивым инициализатором. Значения из
     адреса имеют приоритет: посетитель только что выбрал этот маршрут в фильтрах, и это решение
     свежее всего, что лежало в черновике. */
  const draft = useMemo(() => readTransferRequestDraft(null), [])

  const [from, setFrom] = useState(params.get('from') ?? draft?.from ?? '')
  const [to, setTo] = useState(params.get('to') ?? draft?.to ?? '')
  const [stops, setStops] = useState<RouteStop[]>(() =>
    (draft?.stops ?? []).map((text) => createRouteStop(text)),
  )
  const [date, setDate] = useState(draft?.date ?? '')
  const [pickupTime, setPickupTime] = useState(draft?.time ?? '')
  const [isRoundTrip, setIsRoundTrip] = useState(draft?.isRoundTrip ?? false)
  const [returnDate, setReturnDate] = useState(draft?.returnDate ?? '')
  const [returnTime, setReturnTime] = useState(draft?.returnTime ?? '')
  const [passengers, setPassengers] = useState(draft?.passengers ?? 2)
  const [luggageMedium, setLuggageMedium] = useState(draft?.luggageMedium ?? 0)
  const [luggageLarge, setLuggageLarge] = useState(draft?.luggageLarge ?? 0)
  const [luggageOther, setLuggageOther] = useState(draft?.luggageOther ?? '')
  const [vehicleClassId, setVehicleClassId] = useState<number | null>(draft?.vehicleClassId ?? null)
  const [comment, setComment] = useState(draft?.comment ?? '')

  const [showErrors, setShowErrors] = useState(false)
  const [authNotice, setAuthNotice] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<{ number: string } | null>(null)

  const chosenClass = vehicleClasses.find((item) => item.id === vehicleClassId) ?? null
  const luggageShortfall =
    chosenClass === null
      ? 0
      : luggageOverflow({ medium: luggageMedium, large: luggageLarge }, chosenClass.luggageCapacity)

  const returnLegMissing = isRoundTrip && (returnDate === '' || returnTime === '')
  const returnLegInvalid =
    isRoundTrip &&
    !returnLegMissing &&
    (returnDate < date || (returnDate === date && returnTime < pickupTime))
  const emptyStop = stops.some((stop) => stop.text.trim() === '')

  /** Первая незакрытая причина — сверху вниз по форме, ровно в том порядке, в каком человек её
   * заполняет. Сообщение на экране всегда одно: список из четырёх претензий не читают. */
  const blocker =
    from.trim() === ''
      ? t('transfers.request.fromMissing')
      : to.trim() === ''
        ? t('transfers.request.toMissing')
        : emptyStop
          ? t('transfers.request.stopEmpty')
          : date === ''
            ? t('transfers.detail.dateMissing')
            : pickupTime === ''
              ? t('transfers.detail.timeMissing')
              : returnLegMissing
                ? t('transfers.detail.returnMissing')
                : returnLegInvalid
                  ? t('transfers.detail.returnInvalid')
                  : chosenClass !== null && passengers > chosenClass.capacity
                    ? t('transfers.request.capacityTooSmall')
                    : luggageShortfall > 0 && chosenClass !== null
                      ? t('transfers.request.luggageTooMuchTitle', { vehicle: chosenClass.name })
                      : null

  function touch() {
    setFormError(null)
    setShowErrors(false)
  }

  const routeText = [from, ...stops.map((stop) => stop.text), to]
    .map((point) => point.trim())
    .filter((point) => point !== '')
    .join(' → ')

  const vehicleOptions: SelectOption[] = [
    { value: '', label: t('transfers.request.vehicleAny') },
    ...vehicleClasses.map((item) => ({
      value: String(item.id),
      label: item.name,
      meta: t('transfers.detail.capacity', { count: item.capacity }),
    })),
  ]

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    if (blocker !== null) {
      setShowErrors(true)
      return
    }

    const currentDraft = {
      transferId: null,
      from,
      to,
      stops: stops.map((stop) => stop.text),
      date,
      time: pickupTime,
      isRoundTrip,
      returnDate,
      returnTime,
      passengers,
      luggageMedium,
      luggageLarge,
      luggageOther,
      vehicleClassId,
      comment,
    }

    const { status } = getAuthState()
    // `'idle' | 'loading'` — сессия ещё резолвится: это «неизвестно», а не «аноним».
    if (status !== 'authenticated' && status !== 'anonymous') return
    if (status === 'anonymous') {
      // Сеть не трогается: запроса не было, значит наполовину созданной заявки не существует.
      writeTransferRequestDraft(currentDraft)
      setAuthNotice(true)
      return
    }

    setSending(true)
    setFormError(null)
    try {
      const order = await createTransferRequest({
        pickupDate: date,
        pickupTime: toWireTime(pickupTime),
        isRoundTrip,
        returnDate: isRoundTrip ? returnDate : null,
        returnTime: isRoundTrip ? toWireTime(returnTime) : null,
        passengerCount: passengers,
        luggageMediumCount: luggageMedium,
        luggageLargeCount: luggageLarge,
        luggageOther,
        desiredVehicleClassId: vehicleClassId,
        comment,
        /* `sortOrder` считается по промежуточным точкам; порядок всё равно пересобирает сервер
           («откуда» первым, стопы по `sortOrder`, «куда» последним) — доверять клиентскому
           порядку он не имеет права, от этого зависит, как маршрут прочитает водитель. */
        stops: [
          { kind: 1, sortOrder: 0, text: from.trim() },
          ...stops.map((stop, index) => ({ kind: 2, sortOrder: index, text: stop.text.trim() })),
          { kind: 3, sortOrder: 0, text: to.trim() },
        ],
      })
      // Заявка создана — черновик больше не про «я вернусь», и повторное открытие конструктора
      // не должно предлагать отправить её второй раз.
      clearTransferRequestDraft()
      setResult({ number: order.number })
    } catch (err) {
      if (isSessionFailure(err)) {
        writeTransferRequestDraft(currentDraft)
        setAuthNotice(true)
      }
      setFormError(transferRequestMessage(err, t))
    } finally {
      setSending(false)
    }
  }

  if (result !== null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-20 pb-16 sm:px-6">
        <RequestResultPanel
          orderNumber={result.number}
          route={routeText}
          date={formatShortDate(date, locale)}
          time={pickupTime}
          passengers={passengers}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="ribbon-veil relative w-full overflow-hidden pt-24 pb-8">
        <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6">
          <p className="section-eyebrow">{t('transfers.request.eyebrow')}</p>
          <h1 className="text-gold-sheen h1-page mt-1.5">{t('transfers.request.title')}</h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`mx-auto w-full max-w-[720px] px-4 pb-16 sm:px-6 ${
          sending ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {/* Одна строка про цену, не абзац; подробности — за «?». Второе такое же напоминание
            стоит у самой кнопки, где принимается решение. */}
        <div className="flex items-start gap-3 rounded-xl bg-panel-raised p-3.5 ring-1 ring-edge-strong">
          <span className="mt-0.5 shrink-0 text-gold-ink">
            <AlertIcon size={19} />
          </span>
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-dim sm:text-[13.5px]">
            {t('transfers.request.notice')}
          </p>
          <HelpButtonSlot
            title={t('transfers.request.noticeHelpTitle')}
            body={t('transfers.request.noticeHelpBody')}
          />
        </div>

        {/* ── Шаг 1 · Маршрут ── */}
        <section className="mt-6 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
          <StepHeading n={1} title={t('transfers.request.step1')} />

          <div className="mt-4">
            <label htmlFor={fromId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.request.fromLabel')}
            </label>
            <div className="mt-1.5">
              <RoutePointField
                id={fromId}
                value={from}
                onChange={(value) => {
                  setFrom(value)
                  touch()
                }}
                suggestions={suggestions}
                noResultsText={t('transfers.request.suggestionsEmpty')}
                error={showErrors && from.trim() === ''}
                disabled={sending}
                placeholder={t('transfers.request.fromPlaceholder')}
              />
            </div>
          </div>

          {/* Остановок по умолчанию НЕТ: большинству нужен маршрут A → B, и пустая строка,
              которую надо удалить, — это работа, навязанная всем ради меньшинства. */}
          <div className="mt-4">
            <RouteStopsEditor
              stops={stops}
              onChange={(next) => {
                setStops(next)
                touch()
              }}
              suggestions={suggestions}
              max={MAX_STOPS}
              disabled={sending}
              showErrors={showErrors}
            />
          </div>

          <div className="mt-4">
            <label htmlFor={toId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.request.toLabel')}
            </label>
            <div className="mt-1.5">
              <RoutePointField
                id={toId}
                value={to}
                onChange={(value) => {
                  setTo(value)
                  touch()
                }}
                suggestions={suggestions}
                noResultsText={t('transfers.request.suggestionsEmpty')}
                error={showErrors && to.trim() === ''}
                disabled={sending}
                placeholder={t('transfers.request.toPlaceholder')}
              />
            </div>
          </div>
        </section>

        {/* ── Шаг 2 · Когда ── */}
        <section className="mt-6 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
          <StepHeading n={2} title={t('transfers.request.step2')} />

          {/* Та же вертикаль, что у обратного рейса ниже (решение 0.24): одна сетка, одна левая
              граница, без рамки и без отступа под галочкой. */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={dateId} id={dateLabelId} className="block text-[11.5px] text-ink-muted">
                {t('transfers.request.dateLabel')}
              </label>
              <DatePicker
                id={dateId}
                value={date}
                onChange={(value) => {
                  setDate(value)
                  touch()
                }}
                max={bookingWindow.toISO}
                disabledDates={disabledDates}
                surface="public"
                required
                error={showErrors && date === ''}
                aria-labelledby={dateLabelId}
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor={timeId} id={timeLabelId} className="block text-[11.5px] text-ink-muted">
                {t('transfers.detail.pickupTimeLabel')}
              </label>
              <TimeField
                id={timeId}
                value={pickupTime}
                onChange={(value) => {
                  setPickupTime(value)
                  touch()
                }}
                placeholder={t('transfers.detail.pickupTimePlaceholder')}
                error={showErrors && pickupTime === ''}
                aria-labelledby={timeLabelId}
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="mt-4">
            <ReturnLegFields
              enabled={isRoundTrip}
              onToggle={(next) => {
                setIsRoundTrip(next)
                touch()
              }}
              date={returnDate}
              onDateChange={(value) => {
                setReturnDate(value)
                touch()
              }}
              time={returnTime}
              onTimeChange={(value) => {
                setReturnTime(value)
                touch()
              }}
              minDate={date === '' ? bookingWindow.fromISO : date}
              maxDate={bookingWindow.toISO}
              disabledDates={disabledDates}
              error={showErrors && (returnLegMissing || returnLegInvalid)}
              errorId={errorId}
              disabled={sending}
            />
          </div>
        </section>

        {/* ── Шаг 3 · Пассажиры и багаж ── */}
        <section className="mt-6 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
          <StepHeading n={3} title={t('transfers.request.step3')} />

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-ink-muted">{t('transfers.detail.passengers')}</span>
            <GuestStepper
              value={passengers}
              onChange={(value) => {
                setPassengers(value)
                touch()
              }}
              min={1}
              // Потолка гостей у заявки нет (решение 0.14): именно сюда приходят те, кому не
              // хватило вместимости готовых классов. Верхняя граница — только защита от опечатки.
              max={99}
              valueLabel={t('transfers.detail.passengers')}
              labelFewer={t('transfers.detail.passengersFewer')}
              labelMore={t('transfers.detail.passengersMore')}
            />
          </div>

          <div className="my-4 h-px bg-edge" />

          <LuggageFields
            medium={luggageMedium}
            large={luggageLarge}
            other={luggageOther}
            onMediumChange={(value) => {
              setLuggageMedium(value)
              touch()
            }}
            onLargeChange={(value) => {
              setLuggageLarge(value)
              touch()
            }}
            onOtherChange={setLuggageOther}
            // Единицы называются рядом со счётчиками ровно тогда, когда они начали иметь
            // значение: класс выбран и его лимит уже нарушен.
            showUnits={luggageShortfall > 0}
            disabled={sending}
          />

          {/* Ошибка багажа живёт РЯДОМ С БАГАЖОМ, а не у кнопки: ошибка внизу формы заставляет
              искать причину, здесь она стоит там, где её можно исправить. */}
          {luggageShortfall > 0 && chosenClass !== null && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger-soft p-3.5 ring-1 ring-danger/45"
            >
              <span className="mt-0.5 shrink-0 text-danger">
                <AlertIcon size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {t('transfers.request.luggageTooMuchTitle', { vehicle: chosenClass.name })}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-ink-dim">
                  {t('transfers.request.luggageTooMuchBody', {
                    units: luggageUnits({ medium: luggageMedium, large: luggageLarge }),
                    medium: luggageMedium,
                    large: luggageLarge,
                    capacity: chosenClass.luggageCapacity,
                  })}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Шаг 4 · Пожелания ── */}
        <section className="mt-6 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
          <StepHeading n={4} title={t('transfers.request.step4')} />

          {/* Справочник классов мог не загрузиться (loader глушит ошибку) — тогда поля выбора
              просто нет, а заявка уходит как «подберите сами». Пустой селект был бы хуже. */}
          {vehicleClasses.length > 0 && (
            <div className="mt-4">
              <span id={vehicleLabelId} className="block text-[11.5px] text-ink-muted">
                {t('transfers.request.vehicleLabel')}
              </span>
              <Select
                id={vehicleId}
                value={vehicleClassId === null ? '' : String(vehicleClassId)}
                onChange={(value) => {
                  setVehicleClassId(value === '' ? null : Number(value))
                  touch()
                }}
                options={vehicleOptions}
                placeholder={t('transfers.request.vehicleAny')}
                surface="public"
                error={showErrors && chosenClass !== null && passengers > chosenClass.capacity}
                aria-labelledby={vehicleLabelId}
                className="mt-1.5"
              />
              {chosenClass !== null && passengers > chosenClass.capacity && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-danger">
                  <AlertIcon size={13} className="shrink-0" />
                  {t('transfers.request.capacityTooSmall')}
                </p>
              )}
            </div>
          )}

          <div className="mt-4">
            <label htmlFor={commentId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.request.commentLabel')}
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              rows={4}
              maxLength={2000}
              placeholder={t('transfers.request.commentPlaceholder')}
              className="mt-1.5 w-full rounded-lg border border-edge-strong bg-panel-raised px-3 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-gold-line focus:ring-2 focus:ring-focus focus:outline-none"
            />
          </div>
        </section>

        {authNotice ? (
          <div className="mt-6">
            <RequestAuthNotice returnTo="/transfers/custom" />
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
            <button
              type="submit"
              disabled={sending}
              className="btn-sheen w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
            >
              {sending ? t('transfers.request.submitting') : t('transfers.request.submit')}
            </button>
            <p className="text-center text-[12.5px] leading-snug text-ink-muted sm:flex-1 sm:text-left">
              {sending ? t('transfers.request.submitLock') : t('transfers.request.submitHint')}
            </p>
          </div>
        )}

        {showErrors && blocker !== null && (
          <p
            id={errorId}
            role="alert"
            className="mt-3 flex items-start gap-2 text-[13px] leading-snug font-medium text-danger"
          >
            <span className="mt-0.5 shrink-0">
              <AlertIcon size={15} />
            </span>
            {blocker}
          </p>
        )}

        {formError !== null && (
          <p role="alert" className="mt-3 text-[13.5px] leading-snug break-words text-danger">
            {formError}
          </p>
        )}
      </form>
    </div>
  )
}

/** Заголовок шага: номер в кружке + название. Нумерация — не украшение, она и создаёт ощущение
 * конечности формы. */
function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[12px] tracking-[0.14em] text-gold-ink uppercase">
      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] ring-1 ring-edge-strong">
        {n}
      </span>
      {title}
    </h2>
  )
}
