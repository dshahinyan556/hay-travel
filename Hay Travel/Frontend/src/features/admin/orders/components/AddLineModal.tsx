import { useMemo, useState } from 'react'
import { Button, Checkbox, DatePicker, Field, Input, Modal, Select } from '@/shared/ui'
import type { TourInfoModel, TourStartTimeInfoModel } from '@/shared/types/attours'
import type { VehicleClassOption } from '@/features/admin/lib/tourMapper'
import { TourFormat, TourType } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { toDisplayTime, toWireTime } from '@/shared/booking'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ordersCopy } from '../lib/ordersCopy'
import { tourTitleResolver } from '../lib/ordersModel'

/** Ровно то, что уходит в `POST api/Order/AddLine` минус `orderId` (его подставляет страница).
 * Времена — уже в проводном виде `"HH:mm:ss"`, даты — `YYYY-MM-DD`. */
export interface NewLineDraft {
  tourId: number
  tourDate: string
  guestCount: number
  requiresPrepayment: boolean
  prepaymentAmount: number
  startTime: string | null
  format: TourFormat | null
  isRoundTrip: boolean
  returnDate: string | null
  returnTime: string | null
  vehicleClassId: number | null
}

export interface AddLineModalProps {
  open: boolean
  tours: TourInfoModel[]
  /** Справочник классов авто — нужен только строке трансфера. Грузится в `orderDetailLoader`
   * вместе с продуктами; пустой список = права на справочник нет (или он пуст), и тогда строку
   * трансфера здесь завести нельзя — об этом сказано в форме. */
  vehicleClasses: VehicleClassOption[]
  pending: boolean
  onClose: () => void
  onSubmit: (draft: NewLineDraft) => void
}

const MIN_GUESTS = 1
const MAX_GUESTS = 99

/** Все поля выбора, которые есть у брони с сайта. Пустая форма — то, к чему модалка возвращается
 * и при закрытии, и после смены продукта. */
interface AddLineFormState {
  tourId: string
  tourDate: string
  guestCount: number
  /** `HH:mm` — внутренняя форма времени на всём фронте (`shared/booking/startTime.ts`). */
  startTime: string
  format: TourFormat | null
  vehicleClassId: string
  isRoundTrip: boolean
  returnDate: string
  returnTime: string
  requiresPrepayment: boolean
  prepaymentAmount: number
}

const EMPTY_FORM: AddLineFormState = {
  tourId: '',
  tourDate: '',
  guestCount: 2,
  startTime: '',
  format: null,
  vehicleClassId: '',
  isRoundTrip: false,
  returnDate: '',
  returnTime: '',
  requiresPrepayment: false,
  prepaymentAmount: 0,
}

/** Времена старта в порядке, который задал админ, уже приведённые к `HH:mm`. Значения, которые не
 * разбираются, выбрасываются — пустой пункт в списке хуже, чем на один пункт меньше. */
function displayStartTimes(startTimes: TourStartTimeInfoModel[] | undefined): string[] {
  return [...(startTimes ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((slot) => toDisplayTime(slot.time))
    .filter((time) => time !== '')
}

/**
 * "+ Добавить строку" form (checklist Фаза 9.4) — a `Modal` rather than an inline expanding row:
 * it needs a product picker, a date, a guest count and an optional prepayment amount, which is more
 * fields than a grid row has room for without pushing every column around while it's open.
 *
 * ── Батч «Трансферы + формат» (2026-08-29, пункт 4.5) ─────────────────────────────────────────
 * Форма научилась тому же выбору, что и бронь с сайта, потому что бэк (`OrderLineService`) стал
 * его требовать и без него отвечает 400:
 *  - ВРЕМЯ. У тура/экскурсии — слот из расписания продукта (`Select`, свой ввести нельзя,
 *    решение 0.21). У трансфера — свободное время подачи, тем же нативным `input[type=time]`,
 *    которым его вводят в форме продукта (`TourStartTimesEditor`), а не вторым контролом.
 *  - ФОРМАТ. Показывается ТОЛЬКО когда продукт продаётся в обоих (`TourFormat.Both`) — в
 *    остальных случаях бэк выбор игнорирует, и спрашивать его значило бы врать, что он на
 *    что-то влияет.
 *  - ТРАНСФЕР. Класс авто из цен ИМЕННО ЭТОГО трансфера (справочник даёт только названия и
 *    вместимость) + обратный рейс со своими датой и временем.
 *
 * Валидация здесь — UX поверх серверной, а не вместо неё (правило 0.29): каждая проверка ниже
 * зеркалит конкретный отказ `OrderLineService`, и при расхождении прав сервер.
 */
export function AddLineModal({
  open,
  tours,
  vehicleClasses,
  pending,
  onClose,
  onSubmit,
}: AddLineModalProps) {
  const copy = useCopy(ordersCopy)
  const formatLabels = useCopy(adminEnumsCopy).tourFormat
  const { locale } = useLocale()
  const tourTitle = tourTitleResolver(tours, locale, copy)
  const [form, setForm] = useState<AddLineFormState>(EMPTY_FORM)
  // Ошибки полей показываются только после первой попытки отправки — та же конвенция, что у формы
  // продукта: подсвечивать незаполненное сразу после открытия модалки не за что.
  const [attempted, setAttempted] = useState(false)

  const selectedTour = useMemo(
    () => (form.tourId === '' ? null : (tours.find((tour) => String(tour.id) === form.tourId) ?? null)),
    [tours, form.tourId],
  )
  const isTransfer = selectedTour?.type === TourType.Transfer
  const startTimes = useMemo(() => displayStartTimes(selectedTour?.startTimes), [selectedTour])
  const needsFormat = selectedTour?.format === TourFormat.Both

  /** Классы авто именно этого трансфера: цена живёт на связке «трансфер × класс», и класс без
   * цены забронировать нельзя (сервер ответит `VehicleClassNotAvailable`). */
  const vehicleOptions = useMemo(() => {
    if (!isTransfer) return []
    const byId = new Map(vehicleClasses.map((vc) => [vc.id, vc]))
    return (selectedTour?.transferPrices ?? []).map((price) => {
      const vehicleClass = byId.get(price.vehicleClassId)
      const name =
        (locale === 'en' ? vehicleClass?.name.en : vehicleClass?.name.ru) ||
        vehicleClass?.name.ru ||
        vehicleClass?.name.en ||
        copy.vehicleClassFallback(price.vehicleClassId)
      return {
        id: price.vehicleClassId,
        // Вместимость рядом с названием: превышение отбивает и форма, и сервер (2049), но
        // выбирать вслепую и получать отказ — плохой обмен.
        label: vehicleClass ? `${name} · ${copy.seatsUnit(vehicleClass.capacity)}` : name,
        capacity: vehicleClass?.capacity ?? null,
      }
    })
  }, [isTransfer, selectedTour, vehicleClasses, locale, copy])

  const selectedVehicle = vehicleOptions.find((option) => String(option.id) === form.vehicleClassId)

  function patch(changes: Partial<AddLineFormState>) {
    setForm((prev) => ({ ...prev, ...changes }))
  }

  /** Смена продукта обнуляет всё, что принадлежало предыдущему: слот чужого расписания, формат,
   * класс авто и обратный рейс. Дата, гости и предоплата — свойства строки, а не продукта, и
   * переживают смену. */
  function selectTour(tourId: string) {
    patch({
      tourId,
      startTime: '',
      format: null,
      vehicleClassId: '',
      isRoundTrip: false,
      returnDate: '',
      returnTime: '',
    })
  }

  function reset() {
    setForm(EMPTY_FORM)
    setAttempted(false)
  }

  function close() {
    reset()
    onClose()
  }

  /** Зеркало отказов `OrderLineService.AddLineAsync`. Ключ — поле, к которому относится сообщение. */
  const errors: Partial<Record<keyof AddLineFormState, string>> = {}
  if (form.tourId === '') errors.tourId = copy.errorTourRequired
  if (form.tourDate === '') errors.tourDate = copy.errorDateRequired
  if (form.guestCount < MIN_GUESTS) errors.guestCount = copy.errors.invalidGuestCount
  if (selectedTour !== null) {
    if (isTransfer) {
      // `InvalidStartTimeSelection`/2045 — у трансфера время подачи обязательно.
      if (form.startTime === '') errors.startTime = copy.errorPickupTimeRequired
      // `VehicleClassNotAvailable`/2047.
      if (form.vehicleClassId === '') errors.vehicleClassId = copy.errorVehicleClassRequired
      // `PassengersExceedVehicleCapacity`/2049.
      if (selectedVehicle?.capacity != null && form.guestCount > selectedVehicle.capacity) {
        errors.guestCount = copy.errorGuestsOverCapacity(selectedVehicle.capacity)
      }
      // `InvalidReturnTrip`/2058 — обратный рейс не может начинаться раньше самой поездки.
      if (form.isRoundTrip) {
        if (form.returnDate === '') errors.returnDate = copy.errorReturnDateRequired
        else if (form.tourDate !== '' && form.returnDate < form.tourDate) {
          errors.returnDate = copy.errorReturnBeforeTrip
        }
        if (form.returnTime === '') errors.returnTime = copy.errorReturnTimeRequired
        else if (
          form.returnDate !== '' &&
          form.returnDate === form.tourDate &&
          form.startTime !== '' &&
          form.returnTime < form.startTime
        ) {
          errors.returnTime = copy.errorReturnBeforeTrip
        }
      }
    } else {
      // Слот обязателен, пока он у продукта есть. У продукта без расписания (заведён до батча)
      // требовать нечего — сервер принимает пустое время у индивидуального формата.
      if (startTimes.length > 0 && form.startTime === '') {
        errors.startTime = copy.errorStartTimeRequired
      }
      // `OrderLineFormatRequired`/2046 — только когда продукт продаётся в обоих форматах.
      if (needsFormat && form.format === null) errors.format = copy.errorFormatRequired
    }
  }
  const isValid = Object.keys(errors).length === 0

  function errorOf(field: keyof AddLineFormState): string | undefined {
    return attempted ? errors[field] : undefined
  }

  function submit() {
    if (pending) return
    if (!isValid) {
      setAttempted(true)
      return
    }
    onSubmit({
      tourId: Number(form.tourId),
      tourDate: form.tourDate,
      guestCount: form.guestCount,
      requiresPrepayment: form.requiresPrepayment,
      prepaymentAmount: form.requiresPrepayment ? form.prepaymentAmount : 0,
      startTime: toWireTime(form.startTime),
      // Формат уходит только там, где он что-то решает: на продукте с одним форматом сервер его
      // и так игнорирует, а слать значение «на всякий случай» — приглашение к расхождению.
      format: needsFormat ? form.format : null,
      isRoundTrip: isTransfer && form.isRoundTrip,
      returnDate: isTransfer && form.isRoundTrip ? form.returnDate : null,
      returnTime: isTransfer && form.isRoundTrip ? toWireTime(form.returnTime) : null,
      vehicleClassId: isTransfer && form.vehicleClassId !== '' ? Number(form.vehicleClassId) : null,
    })
    reset()
  }

  return (
    <Modal open={open} onClose={close} title={copy.addLineTitle} size="lg">
      {/* Поля прокручиваются внутри диалога, кнопки остаются на виду: на 375×667 форма трансфера
          с обратным рейсом выше экрана, а сам `Modal` внутренней прокрутки не имеет. */}
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
        <Field label={copy.fieldTour} htmlFor="new-line-tour" error={errorOf('tourId')} required>
          <Select
            id="new-line-tour"
            surface="admin"
            value={form.tourId}
            onChange={selectTour}
            options={tours.map((tour) => ({ value: String(tour.id), label: tourTitle(tour.id) }))}
            placeholder={copy.fieldTourPlaceholder}
            error={Boolean(errorOf('tourId'))}
            searchable
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.fieldDate} error={errorOf('tourDate')} required>
            <DatePicker
              value={form.tourDate}
              onChange={(value) => patch({ tourDate: value })}
              surface="admin"
              error={Boolean(errorOf('tourDate'))}
              aria-label={copy.fieldDate}
            />
          </Field>
          <Field label={copy.fieldGuests} htmlFor="new-line-guests" error={errorOf('guestCount')}>
            <Input
              id="new-line-guests"
              type="number"
              min={MIN_GUESTS}
              max={MAX_GUESTS}
              value={form.guestCount}
              error={Boolean(errorOf('guestCount'))}
              onChange={(e) => patch({ guestCount: Number(e.target.value) })}
            />
          </Field>
        </div>

        {selectedTour !== null && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Тур/экскурсия — только слот из расписания продукта; трансфер — свободное время
                подачи (решение 0.9), тем же нативным контролом, что и в форме продукта. */}
            {isTransfer ? (
              <Field
                label={copy.fieldPickupTime}
                htmlFor="new-line-pickup-time"
                error={errorOf('startTime')}
                required
              >
                <Input
                  id="new-line-pickup-time"
                  type="time"
                  value={form.startTime}
                  error={Boolean(errorOf('startTime'))}
                  onChange={(e) => patch({ startTime: e.target.value })}
                />
              </Field>
            ) : (
              <Field
                label={copy.fieldStartTime}
                htmlFor="new-line-start-time"
                error={errorOf('startTime')}
                warning={startTimes.length === 0 ? copy.addLineNoStartTimes : undefined}
                required={startTimes.length > 0}
              >
                <Select
                  id="new-line-start-time"
                  surface="admin"
                  value={form.startTime}
                  onChange={(value) => patch({ startTime: value })}
                  options={startTimes.map((time) => ({ value: time, label: time }))}
                  placeholder={copy.fieldStartTimePlaceholder}
                  error={Boolean(errorOf('startTime'))}
                  disabled={startTimes.length === 0}
                />
              </Field>
            )}

            {needsFormat && (
              <Field
                label={copy.fieldFormat}
                htmlFor="new-line-format"
                error={errorOf('format')}
                hint={copy.fieldFormatHint}
                required
              >
                <Select
                  id="new-line-format"
                  surface="admin"
                  value={form.format === null ? '' : String(form.format)}
                  onChange={(value) => patch({ format: Number(value) as TourFormat })}
                  options={[TourFormat.Individual, TourFormat.Group].map((value) => ({
                    value: String(value),
                    label: formatLabels[value],
                  }))}
                  placeholder={copy.fieldFormatPlaceholder}
                  error={Boolean(errorOf('format'))}
                />
              </Field>
            )}

            {isTransfer && (
              <Field
                label={copy.fieldVehicleClass}
                htmlFor="new-line-vehicle-class"
                error={errorOf('vehicleClassId')}
                warning={vehicleOptions.length === 0 ? copy.addLineNoVehicleClasses : undefined}
                required
              >
                <Select
                  id="new-line-vehicle-class"
                  surface="admin"
                  value={form.vehicleClassId}
                  onChange={(value) => patch({ vehicleClassId: value })}
                  options={vehicleOptions.map((option) => ({
                    value: String(option.id),
                    label: option.label,
                  }))}
                  placeholder={copy.fieldVehicleClassPlaceholder}
                  error={Boolean(errorOf('vehicleClassId'))}
                  disabled={vehicleOptions.length === 0}
                />
              </Field>
            )}
          </div>
        )}

        {isTransfer && (
          <div className="flex flex-col gap-3">
            <Checkbox
              label={copy.fieldRoundTrip}
              checked={form.isRoundTrip}
              onChange={(e) =>
                patch({
                  isRoundTrip: e.target.checked,
                  // Снятая галочка не должна оставлять за собой дату и время: сервер их всё
                  // равно не сохранит, а в форме они выглядели бы как действующий выбор.
                  returnDate: e.target.checked ? form.returnDate : '',
                  returnTime: e.target.checked ? form.returnTime : '',
                })
              }
            />
            {form.isRoundTrip && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={copy.fieldReturnDate} error={errorOf('returnDate')} required>
                  <DatePicker
                    value={form.returnDate}
                    onChange={(value) => patch({ returnDate: value })}
                    surface="admin"
                    min={form.tourDate === '' ? undefined : form.tourDate}
                    error={Boolean(errorOf('returnDate'))}
                    aria-label={copy.fieldReturnDate}
                  />
                </Field>
                <Field
                  label={copy.fieldReturnTime}
                  htmlFor="new-line-return-time"
                  error={errorOf('returnTime')}
                  required
                >
                  <Input
                    id="new-line-return-time"
                    type="time"
                    value={form.returnTime}
                    error={Boolean(errorOf('returnTime'))}
                    onChange={(e) => patch({ returnTime: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <Checkbox
          label={copy.fieldRequiresPrepayment}
          checked={form.requiresPrepayment}
          onChange={(e) => patch({ requiresPrepayment: e.target.checked })}
        />

        {form.requiresPrepayment && (
          <Field label={copy.fieldPrepaymentAmount} htmlFor="new-line-prepayment">
            <Input
              id="new-line-prepayment"
              type="number"
              min={0}
              value={form.prepaymentAmount}
              onChange={(e) => patch({ prepaymentAmount: Number(e.target.value) })}
            />
          </Field>
        )}
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={close}
          className="min-h-11 w-full sm:w-auto"
        >
          {copy.addLineCancel}
        </Button>
        {/* Кнопка НЕ гаснет на незаполненной форме: иначе объяснить, чего не хватает, было бы
            нечем — сообщения появляются как раз по нажатию. */}
        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="min-h-11 w-full sm:w-auto"
        >
          {pending ? copy.saving : copy.addLineSubmit}
        </Button>
      </div>
    </Modal>
  )
}
