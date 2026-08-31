import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getBookingWindow, MAX_GUESTS, toWireTime } from '@/shared/booking'
import { addCartItem } from '@/shared/cart'
import { getAuthState } from '@/shared/auth'
import { createTransferRequest } from '@/shared/api/transfers'
import { isOrderContactsValid, OrderContactsPicker, rememberOrderContacts } from '@/shared/contacts'
import { useMoney } from '@/shared/currency'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ContactLimits, type OrderContactInput } from '@/shared/types/contact'
import type { TransferDetail } from '@/shared/types/transfer'
import { DatePicker, GuestStepper, TimeField } from '@/shared/ui'
import { AlertIcon, CheckIcon } from '@/shared/ui/icons'
import { isContactFailure, isSessionFailure, transferRequestMessage } from '../lib/transferRequestErrors'
import {
  clearTransferRequestDraft,
  readTransferRequestDraft,
  writeTransferRequestDraft,
} from '../lib/transferRequestDraft'
import { HelpButtonSlot } from './HelpButtonSlot'
import { LuggageFields } from './LuggageFields'
import { RequestAuthNotice } from './RequestAuthNotice'
import { ReturnLegFields } from './ReturnLegFields'
import { VehicleClassOption } from './VehicleClassOption'

/**
 * Блок брони предопределённого трансфера (пункты 6.2 / 6.4 / 6.5).
 *
 * ── Порядок полей = порядок решений ───────────────────────────────────────────────────────────
 * Дата → время подачи → обратный рейс → пассажиры → класс. Каждый следующий шаг зависит от
 * предыдущего: обратный рейс переключает, КАКАЯ из двух цен главная, а число пассажиров отсеивает
 * классы. Поставь класс первым — выбор пришлось бы переделывать.
 *
 * ── Два режима одной панели (решение 0.14) ────────────────────────────────────────────────────
 * Пока пассажиров не больше вместимости самого большого класса, это ПОКУПКА: цена, выбор класса,
 * «в корзину». Как только счётчик переваливает за неё, панель становится ЗАЯВКОЙ: список классов
 * исчезает (выбирать не из чего), цена заменяется словами «согласуем индивидуально», снизу
 * дорисовываются багаж и комментарий, кнопка становится «Оформить заявку».
 *
 * Тон — янтарный, а не красный: человек ничего не сделал неправильно. Красный читался бы как
 * отказ. И путь назад всегда открыт — уменьшил счётчик, вернулась обычная бронь со всеми уже
 * заполненными полями.
 *
 * ── Что здесь НЕ проверяется ─────────────────────────────────────────────────────────────────
 * Ничего, что не проверяет сервер (правило 0.29). Дата/время/обратный рейс/вместимость/багаж —
 * у каждого есть серверный аналог (2014, 2016, 2045, 2058, 2049, 2048), и здесь они существуют
 * ради того, чтобы отказ не прилетал ПОСЛЕ нажатия, а не вместо серверной защиты.
 *
 * ── Корзина против заявки ─────────────────────────────────────────────────────────────────────
 * Бронь уезжает в корзину (решение 0.10) и логина НЕ требует: корзина сама переживает поход на
 * `/auth`. Заявка требует логина здесь и сейчас (решение 0.11), поэтому у неё свой черновик в
 * `localStorage`, привязанный к id этого трансфера.
 */
export interface TransferBookingPanelProps {
  transfer: TransferDetail
  /** Дни, закрытые для ЭТОГО трансфера в пределах окна бронирования (глобальные правила и
   * правило «все трансферы» бэк уже свернул сюда сам). Пустой массив = «ничего не закрыто либо
   * список не загрузился» — неразличимо намеренно, дату всё равно проверит сервер. */
  closedDates: readonly string[]
}

export function TransferBookingPanel({ transfer, closedDates }: TransferBookingPanelProps) {
  const { t } = useLocale()
  const money = useMoney()

  const dateId = useId()
  const dateLabelId = `${dateId}-label`
  const timeId = useId()
  const timeLabelId = `${timeId}-label`
  const commentId = useId()
  const radioName = useId()
  const errorId = `${dateId}-error`

  // `[]`: `new Date()` — новый объект на каждый рендер, и без мемо `DatePicker` пересчитывал бы
  // свои границы на каждое нажатие счётчика. Вкладка не переживает полночь осмысленно — то же
  // допущение, что и в блоке брони тура.
  const bookingWindow = useMemo(() => getBookingWindow(), [])
  const disabledDates = useMemo(() => new Set(closedDates), [closedDates])

  /* Черновик читается ОДИН раз, ленивым инициализатором, а не эффектом: восстановление после
     рендера дало бы вспышку пустой формы. Читается только «свой» — привязанный к id этого
     трансфера (см. `readTransferRequestDraft`). */
  const draft = useMemo(() => readTransferRequestDraft(transfer.id), [transfer.id])

  const [date, setDate] = useState(draft?.date ?? '')
  const [pickupTime, setPickupTime] = useState(draft?.time ?? '')
  const [isRoundTrip, setIsRoundTrip] = useState(draft?.isRoundTrip ?? false)
  const [returnDate, setReturnDate] = useState(draft?.returnDate ?? '')
  const [returnTime, setReturnTime] = useState(draft?.returnTime ?? '')
  const [passengers, setPassengers] = useState(draft?.passengers ?? 2)
  const [vehicleClassId, setVehicleClassId] = useState<number | null>(
    // Единственный класс — это не «выбор по умолчанию», а отсутствие выбора: требовать тап по
    // единственной карточке значит просить работу ради работы. Та же логика, что у времени
    // старта тура при одном слоте.
    transfer.vehicles.length === 1 ? transfer.vehicles[0].vehicleClassId : null,
  )
  const [luggageMedium, setLuggageMedium] = useState(draft?.luggageMedium ?? 0)
  const [luggageLarge, setLuggageLarge] = useState(draft?.luggageLarge ?? 0)
  const [luggageOther, setLuggageOther] = useState(draft?.luggageOther ?? '')
  const [comment, setComment] = useState(draft?.comment ?? '')
  /* Контакты нужны только в режиме ЗАЯВКИ: бронь уезжает в корзину, и контакт у неё спрашивают
     при оформлении корзины, а не здесь. Черновик их помнит по той же причине, что и остальное —
     отправка заявки требует ухода на `/auth`. */
  const [contacts, setContacts] = useState<readonly OrderContactInput[]>(draft?.contacts ?? [])

  const [showErrors, setShowErrors] = useState(false)
  const [added, setAdded] = useState<'added' | 'updated' | null>(null)
  const [cartFull, setCartFull] = useState(false)
  const [authNotice, setAuthNotice] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /** Отказ сервера ИМЕННО по контактам (2060-2063) — уезжает в блок контактов, а не под кнопку. */
  const [serverContactsError, setServerContactsError] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  const maxCapacity = transfer.vehicles.reduce((max, vehicle) => Math.max(max, vehicle.capacity), 0)
  /*
    Потолок ОБЫЧНОЙ брони — не только вместимость машины, но и `MAX_GUESTS` (16): выше него бэк
    отбивает любую строку ПО ПРОДУКТУ (`OrderLimits.MaxGuestsPerLine`, 2015), а корзина всё равно
    подрезала бы число молча. Значит, класс на 20 мест не делает бронь на 18 человек возможной —
    он делает её ЗАЯВКОЙ, у которой этого потолка нет (решение 0.14).
  */
  const bookableCapacity = Math.min(maxCapacity, MAX_GUESTS)
  /* Режим заявки. `vehicles.length > 0` в условии обязателен: у трансфера без цен вместимость
     равна нулю, и без этой проверки экран объявлял бы «нужен транспорт больше» на двух
     пассажирах — при том что настоящая причина совсем другая и названа отдельно. */
  const isRequestMode = transfer.vehicles.length > 0 && passengers > bookableCapacity

  const selectedVehicle =
    transfer.vehicles.find((vehicle) => vehicle.vehicleClassId === vehicleClassId) ?? null

  /* Багаж СВЕРЯЕТСЯ С КЛАССОМ только в конструкторе заявки. Здесь его негде спросить, пока
     панель — покупка (в мокапе поля багажа появляются лишь в режиме заявки), а в режиме заявки
     класс не выбран вовсе. Ровно то же условие стоит на сервере: проверка багажа включается
     только при непустом `DesiredVehicleClassId`. */

  const returnLegMissing = isRoundTrip && (returnDate === '' || returnTime === '')
  const returnLegInvalid =
    isRoundTrip &&
    !returnLegMissing &&
    (returnDate < date || (returnDate === date && returnTime < pickupTime))

  const price = selectedVehicle === null ? null : isRoundTrip ? selectedVehicle.roundTripPrice : selectedVehicle.oneWayPrice

  /* Контакты заявки: 1..3, ровно один основной (2060-2062). У брони их нет — см. состояние выше. */
  const contactsBlocker = isOrderContactsValid(contacts)
    ? null
    : contacts.length < ContactLimits.minOrderContacts
      ? t('orderContacts.error.required')
      : contacts.length > ContactLimits.maxOrderContacts
        ? t('orderContacts.error.tooMany', { max: ContactLimits.maxOrderContacts })
        : t('orderContacts.error.primary')

  /** Первая незакрытая причина: сообщений на экране всегда ровно одно, и порядок задаёт
   * приоритет — сначала то, что выше по форме. */
  const blocker =
    date === ''
      ? t('transfers.detail.dateMissing')
      : pickupTime === ''
        ? t('transfers.detail.timeMissing')
        : returnLegMissing
          ? t('transfers.detail.returnMissing')
          : returnLegInvalid
            ? t('transfers.detail.returnInvalid')
            : isRequestMode
              ? contactsBlocker
              : selectedVehicle === null
                ? t('transfers.detail.vehicleMissing')
                : passengers > Math.min(selectedVehicle.capacity, MAX_GUESTS)
                  ? t('transfers.detail.vehicleTooSmall')
                  : null

  /** Любая правка обесценивает подтверждение «добавлено»: оно относилось к прежнему выбору. */
  function touch() {
    setAdded(null)
    setCartFull(false)
    setFormError(null)
    setServerContactsError(null)
    setShowErrors(false)
  }

  function handleAddToCart() {
    if (blocker !== null) {
      setShowErrors(true)
      return
    }
    if (selectedVehicle === null) return

    setCartFull(false)
    const result = addCartItem({
      tourId: Number(transfer.id),
      tourDate: date,
      guestCount: passengers,
      startTime: pickupTime,
      // Формата у трансфера нет — ни у продукта, ни в теле заказа.
      format: null,
      transfer: {
        vehicleClassId: selectedVehicle.vehicleClassId,
        isRoundTrip,
        returnDate: isRoundTrip ? returnDate : null,
        returnTime: isRoundTrip ? returnTime : null,
      },
      snapshot: {
        title: transfer.title,
        coverImage: transfer.coverImage,
        kind: 'transfer',
        durationDays: 0,
        durationNights: 0,
      },
    })

    if (result === 'full') {
      setCartFull(true)
      return
    }
    setAdded(result)
  }

  async function handleSendRequest() {
    if (blocker !== null) {
      setShowErrors(true)
      return
    }
    if (sending) return

    const currentDraft = {
      transferId: transfer.id,
      from: transfer.route.find((point) => point.kind === 'from')?.text ?? '',
      to: transfer.route.find((point) => point.kind === 'to')?.text ?? '',
      stops: transfer.route.filter((point) => point.kind === 'stop').map((point) => point.text),
      date,
      time: pickupTime,
      isRoundTrip,
      returnDate,
      returnTime,
      passengers,
      luggageMedium,
      luggageLarge,
      luggageOther,
      vehicleClassId: null,
      comment,
      contacts,
    }

    const { status } = getAuthState()
    // `'idle' | 'loading'` — сессия ещё резолвится: это «неизвестно», а не «аноним», и требовать
    // вход в этот момент было бы ложным сообщением.
    if (status !== 'authenticated' && status !== 'anonymous') return
    if (status === 'anonymous') {
      // Сеть не трогается вовсе: запроса не было, значит ничего не осталось наполовину сделанным,
      // пока посетитель ходит логиниться. Черновик уезжает в localStorage — именно это обещает
      // строчка «всё сохранится» в блоке входа.
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
        // Класса нет по определению: ни один не вмещает столько пассажиров — ровно та причина,
        // по которой панель и стала заявкой.
        desiredVehicleClassId: null,
        comment,
        stops: [
          ...transfer.route.map((point, index) => ({
            kind: point.kind === 'from' ? 1 : point.kind === 'to' ? 3 : 2,
            sortOrder: index,
            text: point.text,
          })),
        ],
        contacts: [...contacts],
      })
      clearTransferRequestDraft()
      // Набор запоминается ПОСЛЕ успеха: это тот контакт, по которому реально договорились.
      rememberOrderContacts(contacts)
      setOrderNumber(order.number)
    } catch (err) {
      if (isSessionFailure(err)) {
        writeTransferRequestDraft(currentDraft)
        setAuthNotice(true)
      }
      const message = transferRequestMessage(err, t)
      /* Отказ по контактам показывается ВНУТРИ блока контактов: под кнопкой он выглядел бы
         претензией к дате или классу, а исправлять его надо в другом месте панели. */
      if (isContactFailure(err)) setServerContactsError(message)
      else setFormError(message)
    } finally {
      setSending(false)
    }
  }

  /* Заявка отправлена — панель уступает место результату целиком. Форма под ним не нужна:
     повторная отправка того же создала бы дубль. */
  if (orderNumber !== null) {
    return (
      <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
        <div role="status" className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-success/45">
            <CheckIcon size={22} strokeWidth={2} />
          </span>
          <p className="mt-3 font-display text-xl text-ink">{t('transfers.result.title')}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">{t('transfers.result.body')}</p>
          <p className="mt-3 rounded-xl bg-panel-raised px-4 py-3 ring-1 ring-edge">
            <span className="block text-[11.5px] text-ink-muted">
              {t('transfers.result.numberLabel')}
            </span>
            <span className="mt-0.5 block font-display text-2xl tabular-nums text-gold-ink">
              {t('transfers.result.number', { number: orderNumber })}
            </span>
          </p>
        </div>
        <Link
          to="/account"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {t('transfers.result.orders')}
        </Link>
      </div>
    )
  }

  /* Цен по классам нет вовсе — валидация продукта такого не пропускает, но публичная страница
     обязана пережить старую запись и сказать словами, что бронь недоступна, а не показать
     пустой список и мёртвую кнопку. */
  if (transfer.vehicles.length === 0) {
    return (
      <div className="rounded-2xl bg-panel p-5 ring-1 ring-edge">
        <p className="text-[13.5px] leading-relaxed text-ink-dim">{t('transfers.detail.noVehicles')}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (isRequestMode) void handleSendRequest()
        else handleAddToCart()
      }}
      className={`rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5 ${
        sending ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      {/* Дата и время подачи — одна сетка, и обратный рейс ниже ложится РОВНО на неё
          (решение 0.24). Ниже `sm` обе пары становятся одной колонкой, но левая граница у всех
          четырёх полей по-прежнему общая. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={dateId} id={dateLabelId} className="block text-[11.5px] text-ink-muted">
            {t('transfers.detail.dateLabel')}
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
          // Обратный рейс не может быть раньше самой поездки — то же правило проверяет сервер
          // (2058). Календарь просто не даёт выбрать такой день.
          minDate={date === '' ? bookingWindow.fromISO : date}
          maxDate={bookingWindow.toISO}
          disabledDates={disabledDates}
          error={showErrors && (returnLegMissing || returnLegInvalid)}
          errorId={errorId}
        />
      </div>

      <div className="my-4 h-px bg-edge" />

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-ink-muted">{t('transfers.detail.passengers')}</span>
        <GuestStepper
          value={passengers}
          onChange={(value) => {
            setPassengers(value)
            touch()
          }}
          min={1}
          // Верхняя граница шире вместимости любого класса намеренно: именно перебор и включает
          // режим заявки (решение 0.14). Ограничить счётчик вместимостью значило бы сделать этот
          // сценарий недостижимым.
          max={99}
          valueLabel={t('transfers.detail.passengers')}
          labelFewer={t('transfers.detail.passengersFewer')}
          labelMore={t('transfers.detail.passengersMore')}
        />
      </div>

      {isRequestMode ? (
        <>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 ring-1 ring-warning/45">
            <span className="mt-0.5 shrink-0 text-warning">
              <AlertIcon size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {t('transfers.detail.overCapacityTitle')}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ink-dim">
                {t('transfers.detail.overCapacityBody', {
                  count: bookableCapacity,
                  passengers,
                })}
              </p>
            </div>
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
            showUnits={false}
          />

          <div className="my-4 h-px bg-edge" />

          {/* Тот же общий блок, что в корзине и в конструкторе: заявка без контакта сервером не
              принимается (2060), а менеджеру, называющему цену голосом, звонить некуда. */}
          <OrderContactsPicker
            value={contacts}
            onChange={(next) => {
              setContacts(next)
              touch()
            }}
            error={serverContactsError ?? (showErrors ? contactsBlocker : null)}
            disabled={sending}
          />

          <div className="mt-3">
            <label htmlFor={commentId} className="block text-[11.5px] text-ink-muted">
              {t('transfers.request.commentLabel')}
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('transfers.request.commentPlaceholder')}
              className="mt-1.5 w-full rounded-lg border border-edge-strong bg-panel-raised px-3 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-gold-line focus:ring-2 focus:ring-focus focus:outline-none"
            />
          </div>

          <div className="my-4 h-px bg-edge" />

          <div>
            <span className="text-[11.5px] text-ink-muted">{t('transfers.detail.priceLabel')}</span>
            <p className="mt-0.5 text-[17px] font-semibold text-ink">
              {t('transfers.detail.priceOnRequest')}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="my-4 h-px bg-edge" />

          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-[11.5px] text-ink-muted">{t('transfers.detail.vehicleLabel')}</span>
            <HelpButtonSlot
              title={t('transfers.detail.vehicleHelpTitle')}
              body={t('transfers.detail.vehicleHelpBody')}
            />
          </div>

          <div className="space-y-2.5">
            {transfer.vehicles.map((vehicle) => {
              /* Причина недоступности стоит на САМОМ варианте, а не общей ошибкой внизу формы:
                 «мест меньше, чем пассажиров» чинится счётчиком выше, и вариант не исчезает —
                 иначе посетитель не узнает, что уменьшив число пассажиров, он его вернёт. */
              const issue =
                Math.min(vehicle.capacity, MAX_GUESTS) < passengers
                  ? t('transfers.detail.vehicleTooSmall')
                  : null
              return (
                <VehicleClassOption
                  key={vehicle.vehicleClassId}
                  vehicle={vehicle}
                  name={radioName}
                  selected={vehicle.vehicleClassId === vehicleClassId}
                  onSelect={() => {
                    setVehicleClassId(vehicle.vehicleClassId)
                    touch()
                  }}
                  roundTrip={isRoundTrip}
                  issue={issue}
                />
              )
            })}
          </div>

          <div className="my-4 h-px bg-edge" />

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11.5px] text-ink-muted">
                {isRoundTrip
                  ? t('transfers.detail.totalRoundTrip')
                  : t('transfers.detail.totalOneWay')}
              </span>
              <p className="font-display text-[30px] leading-tight text-gold-ink">
                {price === null ? '—' : money.format(price)}
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                {t('transfers.detail.perCarNote')}
              </p>
            </div>
            {selectedVehicle !== null && (
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] tracking-[0.08em] text-gold-ink uppercase ring-1 ring-edge-strong">
                {selectedVehicle.name}
              </span>
            )}
          </div>
        </>
      )}

      {/* Блок входа встаёт НА МЕСТО кнопки, а не под ней: это ответ на нажатие, и он обязан быть
          там, где рука. */}
      {authNotice ? (
        <div className="mt-4">
          <RequestAuthNotice returnTo={`/transfers/${transfer.id}`} />
        </div>
      ) : added !== null ? (
        /* Подтверждение занимает место кнопки, а не появляется под ней: иначе панель росла бы
           вниз прямо под курсором в момент клика. */
        <div role="status" className="mt-4 rounded-xl bg-panel-raised p-3.5 ring-1 ring-gold-line">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="shrink-0 text-gold-ink">
              <CheckIcon size={17} />
            </span>
            {added === 'updated' ? t('cart.added.titleUpdated') : t('cart.added.title')}
          </p>
          <Link
            to="/cart"
            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {t('cart.added.goToCart')}
          </Link>
          <button
            type="button"
            onClick={() => setAdded(null)}
            className="mt-1 min-h-11 w-full text-[13.5px] font-medium text-gold-ink transition-colors hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {t('cart.added.continue')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="submit"
            disabled={sending}
            className="btn-sheen mt-4 w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending
              ? t('transfers.request.submitting')
              : isRequestMode
                ? t('transfers.detail.requestAction')
                : t('cart.addToCart')}
          </button>
          <p className="mt-2.5 text-center text-[11.5px] leading-snug text-ink-muted">
            {sending
              ? t('transfers.request.submitLock')
              : isRequestMode
                ? t('transfers.detail.requestHint')
                : t('transfers.detail.submitHint')}
          </p>
        </>
      )}

      {/* Причина блокировки показывается ПОСЛЕ первой попытки, а не с порога: панель, которая
          встречает посетителя красным текстом при ещё не заполненной форме, обвиняет его в том,
          чего он не делал. Кнопка при этом остаётся активной — именно нажатие и объясняет, чего
          не хватает. */}
      {showErrors && blocker !== null && (
        <p
          id={errorId}
          role="alert"
          className="mt-2.5 flex items-start gap-2 text-[13px] leading-snug font-medium text-danger"
        >
          <span className="mt-0.5 shrink-0">
            <AlertIcon size={15} />
          </span>
          {blocker}
        </p>
      )}

      {cartFull && (
        <p role="alert" className="mt-2.5 text-sm break-words text-danger">
          {t('cart.error.full')}
        </p>
      )}

      {formError !== null && (
        <p role="alert" className="mt-2.5 text-[13.5px] leading-snug break-words text-danger">
          {formError}
        </p>
      )}
    </form>
  )
}
