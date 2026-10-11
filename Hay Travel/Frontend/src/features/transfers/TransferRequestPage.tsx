import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLoaderData, useSearchParams } from 'react-router'
import { createTransferRequest, getPlaceSuggestions, getTransferTypeClosedDates, getVehicleClasses } from '@/shared/api/transfers'
import { getAuthState } from '@/shared/auth'
import { rememberOrderContacts } from '@/shared/contacts'
import { getBookingWindow, toWireTime } from '@/shared/booking'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { formatShortDate } from '@/shared/lib/format'
import type { OrderContactInput } from '@/shared/types/contact'
import type { VehicleClass } from '@/shared/types/transfer'
import { AlertIcon } from '@/shared/ui/icons'
import { HelpButtonSlot } from './components/HelpButtonSlot'
import { RequestAuthNotice } from './components/RequestAuthNotice'
import { RequestContactsStep } from './components/RequestContactsStep'
import { RequestDetailsStep } from './components/RequestDetailsStep'
import { RequestResultPanel } from './components/RequestResultPanel'
import { RequestRouteStep } from './components/RequestRouteStep'
import { RequestStepNav } from './components/RequestStepNav'
import { RequestStepRail } from './components/RequestStepRail'
import { createRouteStop } from './lib/routeStops'
import {
  clearTransferRequestDraft,
  readTransferRequestDraft,
  writeTransferRequestDraft,
  type TransferRequestDraft,
} from './lib/transferRequestDraft'
import { isContactFailure, isSessionFailure, transferRequestMessage } from './lib/transferRequestErrors'
import {
  firstInvalidField,
  firstInvalidStep,
  stepHasErrors,
  toWizardStep,
  validateTransferRequest,
  visibleStepErrors,
  WIZARD_STEP_COUNT,
  type TransferRequestField,
  type TransferRequestFormState,
  type TransferRequestPatch,
  type WizardStep,
} from './lib/transferWizard'

/**
 * `/transfers/custom` — конструктор собственного трансфера (пункты 6.3-6.7), с 2026-08-29
 * МАСТЕР ИЗ ТРЁХ ШАГОВ вместо одной длинной формы.
 *
 * Здесь НЕТ цены: это заявка, а не покупка. Значит, главная задача экрана — не «продать», а не
 * потерять человека на середине формы. Раньше её решали пронумерованные панели на одной странице:
 * видно, что форма кончится. Владелец потребовал пойти дальше и показать ОДИН экран за раз, чтобы
 * «юзер уже не захотел» бросить. Отсюда мастер: рельс шагов сверху, одна карточка на шаг,
 * «Далее»/«Назад», и на каждом шаге видно, сколько осталось.
 *
 * Шагов ровно три (решение владельца, не параметр):
 *  1. маршрут и время подачи, включая обратный рейс — без этого заявки не существует;
 *  2. пассажиры, багаж, класс авто, комментарий — обязательное сверху, необязательное снизу;
 *  3. контакты для связи, сводка и отправка.
 *
 * ── Что этот файл теперь делает, а что нет ────────────────────────────────────────────────────
 * Это КОНТЕЙНЕР: состояние формы, черновик, валидация, переходы между шагами и отправка. Разметка
 * шагов уехала в три презентационных компонента (`RequestRouteStep`/`RequestDetailsStep`/
 * `RequestContactsStep`), правила переходов — в `lib/transferWizard.ts`. Держать 600 строк
 * разметки и правила перехода в одном файле было можно, пока форма была одностраничной и правило
 * читал ровно один потребитель; у мастера их четыре — см. заголовок `transferWizard.ts`.
 *
 * ── Маршрут может прийти из фильтров ──────────────────────────────────────────────────────────
 * Если посетитель попал сюда из пустого результата `/transfers?from=…&to=…`, «откуда» и «куда»
 * уже заполнены его выбором. Переспрашивать то, что он только что указал, нельзя — значения из
 * адреса перекрывают черновик, они свежее.
 *
 * ── Черновик и логин (пункт 6.6) ──────────────────────────────────────────────────────────────
 * Отправка требует логина. Логин — это НАВИГАЦИЯ на `/auth` и обратно, то есть полный размонтаж
 * мастера. Поэтому черновик пишется НЕ только перед показом блока входа, как раньше, а на каждое
 * изменение формы (с задержкой в полсекунды) — вместе с номером текущего шага. Причина ровно в
 * мастере: уйти со страницы теперь можно не только кнопкой «Отправить» (на третьем шаге), но и с
 * любого из трёх — например, нажав «Войти» в шапке сайта на втором. Возврат по
 * `?returnTo=/transfers/custom` поднимает и значения, и шаг, на котором человек остановился.
 *
 * Черновик пишется только когда в форме УЖЕ что-то есть (`isDraftWorthSaving`): ключ хранилища
 * один на конструктор и на панель брони готового трансфера, и просто открытая пустая форма не
 * имеет права затирать чужой черновик.
 *
 * ── Что валидируется ──────────────────────────────────────────────────────────────────────────
 * Ровно то, что валидирует сервер (правило 0.29) — см. `lib/transferWizard.ts`. Ошибка всегда
 * показывается У ПОЛЯ и только на своём шаге; общего списка внизу больше нет, он и не смог бы
 * работать: половина полей на другом экране.
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

/** Пассажиров по умолчанию: пара — самый частый трансфер, и это же значение считается «форма ещё
 * пустая» при решении, писать ли черновик. */
const DEFAULT_PASSENGERS = 2

/** Задержка автосохранения черновика. Полсекунды — это «человек перестал печатать», а не «прошло
 * заметное время»: писать в `localStorage` на каждый символ адреса незачем. */
const DRAFT_SAVE_DELAY_MS = 500

export function TransferRequestPage() {
  const { vehicleClasses, suggestions, closedDates } = useLoaderData() as TransferRequestLoaderData
  const { locale, t } = useLocale()
  const [params] = useSearchParams()

  const fromId = useId()
  const toId = useId()
  const dateId = useId()
  const timeId = useId()
  const vehicleId = useId()

  const bookingWindow = useMemo(() => getBookingWindow(), [])
  const disabledDates = useMemo(() => new Set(closedDates), [closedDates])

  /* Черновик конструктора (`owner === null`) — один раз, ленивым инициализатором: без вспышки
     пустой формы после возврата со входа. */
  const draft = useMemo(() => readTransferRequestDraft(null), [])

  const [form, setForm] = useState<TransferRequestFormState>(() => ({
    from: params.get('from') ?? draft?.from ?? '',
    to: params.get('to') ?? draft?.to ?? '',
    stops: (draft?.stops ?? []).map((text) => createRouteStop(text)),
    date: draft?.date ?? '',
    pickupTime: draft?.time ?? '',
    isRoundTrip: draft?.isRoundTrip ?? false,
    returnDate: draft?.returnDate ?? '',
    returnTime: draft?.returnTime ?? '',
    passengers: draft?.passengers ?? DEFAULT_PASSENGERS,
    luggageMedium: draft?.luggageMedium ?? 0,
    luggageLarge: draft?.luggageLarge ?? 0,
    luggageOther: draft?.luggageOther ?? '',
    vehicleClassId: draft?.vehicleClassId ?? null,
    comment: draft?.comment ?? '',
    contacts: draft?.contacts ?? [],
  }))

  const [step, setStep] = useState<WizardStep>(() => toWizardStep(draft?.step ?? 0))
  /**
   * Шаги, на которых человек УЖЕ нажимал «Далее». Только на них показываются ошибки «поле не
   * заполнено»: подсвечивать красным поля, к которым он ещё не прикасался, — это встречать
   * человека претензией.
   */
  const [attempted, setAttempted] = useState<readonly WizardStep[]>([])

  const [authNotice, setAuthNotice] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /** Отказ сервера ИМЕННО по контактам (2060-2063) — уезжает в блок контактов, а не под кнопку. */
  const [serverContactsError, setServerContactsError] = useState<string | null>(null)
  const [result, setResult] = useState<{ number: string } | null>(null)

  const wizardTopRef = useRef<HTMLDivElement>(null)
  /** id поля, на которое надо встать фокусом после отрисовки (шаг мог смениться). */
  const pendingFocusRef = useRef<string | null>(null)
  const initialRenderRef = useRef(true)

  const chosenClass = vehicleClasses.find((item) => item.id === form.vehicleClassId) ?? null
  const errors = validateTransferRequest(form, chosenClass, t)
  const shownErrors = visibleStepErrors(step, errors, attempted.includes(step))

  const fieldElementIds: Partial<Record<TransferRequestField, string>> = {
    from: fromId,
    to: toId,
    date: dateId,
    time: timeId,
    vehicle: vehicleId,
  }

  const update = useCallback((patch: TransferRequestPatch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    /* Ошибка сервера описывает ПРОШЛУЮ отправку. Как только форма изменилась, она больше ничего
       не описывает — и оставлять её висеть значит спорить с человеком, который уже исправляет. */
    setFormError(null)
    setServerContactsError(null)
  }, [])

  const isLastStep = step === WIZARD_STEP_COUNT - 1

  /* ── Черновик: автосохранение ────────────────────────────────────────────────────────────── */
  const worthSaving = isDraftWorthSaving(form)
  useEffect(() => {
    // Заявка отправлена — черновик уже стёрт, и воскрешать его нельзя: повторное открытие
    // конструктора предложило бы отправить её второй раз.
    if (result !== null || !worthSaving) return
    const timer = window.setTimeout(
      () => writeTransferRequestDraft(toDraft(form, step)),
      DRAFT_SAVE_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [form, step, worthSaving, result])

  /* ── Переход между шагами: к началу мастера ──────────────────────────────────────────────── */
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false
      return
    }
    const node = wizardTopRef.current
    if (node === null) return
    // Не `scrollIntoView`: сверху висит шапка сайта, и «начало» без запаса уехало бы под неё.
    const top = node.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top: Math.max(top, 0) })
  }, [step])

  /* ── Фокус на первое поле с ошибкой ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const id = pendingFocusRef.current
    if (id === null) return
    pendingFocusRef.current = null
    const node = document.getElementById(id)
    if (!(node instanceof HTMLElement)) return
    node.scrollIntoView({ block: 'center' })
    node.focus({ preventScroll: true })
  })

  const goToStep = useCallback((next: WizardStep) => {
    setStep(next)
    setFormError(null)
  }, [])

  /** Показать ошибки шага и увести фокус на первую из них. */
  function revealErrors(target: WizardStep) {
    setAttempted((prev) => (prev.includes(target) ? prev : [...prev, target]))
    const field = firstInvalidField(target, errors)
    // У остановок, обратного рейса, багажа и контактов нет одного «главного» элемента, на который
    // осмысленно ставить фокус, — там ошибку показывает сам блок. Фокус только туда, где он есть.
    pendingFocusRef.current = field === null ? null : (fieldElementIds[field] ?? null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return

    /* Промежуточный шаг: главная кнопка — это «Далее», и дальше пускать нельзя, пока шаг не
       заполнен. Ошибки соседних шагов при этом молчат: до них человек ещё не дошёл. */
    if (!isLastStep) {
      if (stepHasErrors(step, errors)) {
        revealErrors(step)
        return
      }
      goToStep((step + 1) as WizardStep)
      return
    }

    /* Последний шаг: проверяется вся заявка целиком. Вернуться на первый шаг и стереть «куда»
       можно в любой момент — отправлять такое молча нельзя, а показывать эту ошибку здесь
       бессмысленно: исправляют её там. */
    const invalidStep = firstInvalidStep(errors)
    if (invalidStep !== null) {
      revealErrors(invalidStep)
      setStep(invalidStep)
      return
    }

    const currentDraft = toDraft(form, step)

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
    setServerContactsError(null)
    try {
      const order = await createTransferRequest({
        pickupDate: form.date,
        pickupTime: toWireTime(form.pickupTime),
        isRoundTrip: form.isRoundTrip,
        returnDate: form.isRoundTrip ? form.returnDate : null,
        returnTime: form.isRoundTrip ? toWireTime(form.returnTime) : null,
        passengerCount: form.passengers,
        luggageMediumCount: form.luggageMedium,
        luggageLargeCount: form.luggageLarge,
        luggageOther: form.luggageOther,
        desiredVehicleClassId: form.vehicleClassId,
        comment: form.comment,
        /* `sortOrder` считается по промежуточным точкам; порядок всё равно пересобирает сервер
           («откуда» первым, стопы по `sortOrder`, «куда» последним) — доверять клиентскому
           порядку он не имеет права, от этого зависит, как маршрут прочитает водитель. */
        stops: [
          { kind: 1, sortOrder: 0, text: form.from.trim() },
          ...form.stops.map((stop, index) => ({
            kind: 2,
            sortOrder: index,
            text: stop.text.trim(),
          })),
          { kind: 3, sortOrder: 0, text: form.to.trim() },
        ],
        contacts: [...form.contacts],
      })
      // Заявка создана — черновик больше не про «я вернусь», и повторное открытие конструктора
      // не должно предлагать отправить её второй раз.
      clearTransferRequestDraft()
      /* «Последний использованный» набор запоминается ПОСЛЕ успеха, а не на каждое изменение
         выбора: это тот контакт, по которому реально договорились. Точка вызова — оформление,
         сам блок выбора про отправку не знает (см. `rememberOrderContacts`). */
      rememberOrderContacts(form.contacts)
      setResult({ number: order.number })
    } catch (err) {
      if (isSessionFailure(err)) {
        writeTransferRequestDraft(currentDraft)
        setAuthNotice(true)
      }
      const message = transferRequestMessage(err, t)
      /* Отказ по контактам уезжает в блок контактов: это единственное место, где его можно
         исправить, и он стоит ровно на том шаге, где человек сейчас и находится. */
      if (isContactFailure(err)) setServerContactsError(message)
      else setFormError(message)
    } finally {
      setSending(false)
    }
  }

  if (result !== null) {
    const routeText = [form.from, ...form.stops.map((stop) => stop.text), form.to]
      .map((point) => point.trim())
      .filter((point) => point !== '')
      .join(' → ')

    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-20 pb-16 sm:px-6">
        <RequestResultPanel
          orderNumber={result.number}
          route={routeText}
          date={formatShortDate(form.date, locale)}
          time={form.pickupTime}
          passengers={form.passengers}
        />
      </div>
    )
  }

  const contactsError = serverContactsError ?? shownErrors.contacts

  return (
    <div>
      <div className="ribbon-veil relative w-full overflow-hidden pt-24 pb-8">
        <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6">
          <p className="section-eyebrow">{t('transfers.request.eyebrow')}</p>
          <h1 className="text-gold-sheen h1-page mt-1.5">{t('transfers.request.title')}</h1>
        </div>
      </div>

      <div ref={wizardTopRef} className="mx-auto w-full max-w-[720px] px-4 pb-16 sm:px-6">
        {/* Одна строка про цену, не абзац; подробности — за «?». Второе такое же напоминание
            стоит на последнем шаге, у самой кнопки, где принимается решение. */}
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

        <div className="mt-5">
          <RequestStepRail current={step} onGoTo={goToStep} />
        </div>

        <form
          onSubmit={handleSubmit}
          className={`mt-4 ${sending ? 'pointer-events-none opacity-60' : ''}`}
        >
          {step === 0 && (
            <RequestRouteStep
              values={form}
              onChange={update}
              suggestions={suggestions}
              disabledDates={disabledDates}
              minDate={bookingWindow.fromISO}
              maxDate={bookingWindow.toISO}
              errors={shownErrors}
              fieldIds={{ from: fromId, to: toId, date: dateId, time: timeId }}
              disabled={sending}
            />
          )}

          {step === 1 && (
            <RequestDetailsStep
              values={form}
              onChange={update}
              vehicleClasses={vehicleClasses}
              chosenClass={chosenClass}
              errors={shownErrors}
              vehicleFieldId={vehicleId}
              disabled={sending}
            />
          )}

          {step === 2 && (
            <RequestContactsStep
              values={form}
              onContactsChange={(contacts: OrderContactInput[]) => update({ contacts })}
              chosenClass={chosenClass}
              onEdit={goToStep}
              contactsError={contactsError}
              disabled={sending}
            />
          )}

          {authNotice && (
            <div className="mt-4">
              <RequestAuthNotice returnTo="/transfers/custom" />
            </div>
          )}

          {formError !== null && (
            <p role="alert" className="mt-4 text-[13.5px] leading-snug break-words text-danger">
              {formError}
            </p>
          )}

          <RequestStepNav
            onBack={step === 0 ? null : () => goToStep((step - 1) as WizardStep)}
            primaryLabel={
              isLastStep
                ? sending
                  ? t('transfers.request.submitting')
                  : t('transfers.request.submit')
                : t('transfers.request.wizardNext')
            }
            busy={sending}
            // Блок входа занял место кнопки: две кнопки, требующие одного и того же, читались бы
            // как выбор, которого нет.
            primaryHidden={authNotice}
            hint={sending ? t('transfers.request.submitLock') : null}
          />
        </form>
      </div>
    </div>
  )
}

/** Снимок формы для `localStorage`. Собран в одном месте: полей пятнадцать, и разъехаться они
 * могут только здесь. */
function toDraft(form: TransferRequestFormState, step: WizardStep): TransferRequestDraft {
  return {
    transferId: null,
    from: form.from,
    to: form.to,
    stops: form.stops.map((stop) => stop.text),
    date: form.date,
    time: form.pickupTime,
    isRoundTrip: form.isRoundTrip,
    returnDate: form.returnDate,
    returnTime: form.returnTime,
    passengers: form.passengers,
    luggageMedium: form.luggageMedium,
    luggageLarge: form.luggageLarge,
    luggageOther: form.luggageOther,
    vehicleClassId: form.vehicleClassId,
    comment: form.comment,
    contacts: form.contacts,
    step,
  }
}

/**
 * Есть ли в форме хоть что-то, ради чего стоит трогать хранилище.
 *
 * Ключ черновика ОДИН на конструктор и на панель брони готового трансфера (см.
 * `transferRequestDraft.ts`). Открытая, но незаполненная форма не имеет права затирать черновик,
 * начатый на другом экране, — а с автосохранением она бы делала это через полсекунды после
 * загрузки страницы.
 */
function isDraftWorthSaving(form: TransferRequestFormState): boolean {
  return (
    form.from.trim() !== '' ||
    form.to.trim() !== '' ||
    form.stops.length > 0 ||
    form.date !== '' ||
    form.pickupTime !== '' ||
    form.isRoundTrip ||
    form.passengers !== DEFAULT_PASSENGERS ||
    form.luggageMedium > 0 ||
    form.luggageLarge > 0 ||
    form.luggageOther.trim() !== '' ||
    form.vehicleClassId !== null ||
    form.comment.trim() !== '' ||
    form.contacts.length > 0
  )
}
