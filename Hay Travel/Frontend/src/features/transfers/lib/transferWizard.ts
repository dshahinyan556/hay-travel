/**
 * Модель мастера `/transfers/custom`: три шага и правила перехода между ними.
 *
 * Вынесено из экрана в отдельный модуль по одной причине: «можно ли уйти вперёд» — это ПРАВИЛО,
 * а не разметка. Пока проверка жила прямо в форме одной лесенкой `?:`, у неё был ровно один
 * потребитель — надпись под кнопкой. У мастера потребителей четыре: кнопка «Далее», рельс шагов
 * (какой шаг уже пройден), отправка (нельзя отправить с ошибкой на первом шаге, если человек
 * вернулся туда и всё стёр) и восстановление черновика (шаг из `localStorage` может оказаться
 * недостижимым). Четыре разных чтения одного правила обязаны читать одну функцию.
 *
 * Отсюда же и форма результата: не «первая незакрытая причина одной строкой», как было в
 * форме-простыне, а СЛОВАРЬ «поле → сообщение». Мастер обязан показать ошибку у поля, а не
 * общим списком внизу, и для этого ему нужно знать, какое именно поле виновато.
 *
 * Проверяется ровно то, что проверяет сервер (правило 0.29): маршрут (2053), дата и время
 * подачи (2016/2045), обратный рейс (2058), вместимость класса (2049), багаж против лимита
 * (2048, только если багаж заполнен — решение 0.13) и контакты (2060-2062).
 */

import { isOrderContactsValid } from '@/shared/contacts'
import type { TranslationKey } from '@/shared/i18n/translate'
import { ContactLimits, type OrderContactInput } from '@/shared/types/contact'
import type { VehicleClass } from '@/shared/types/transfer'
import { luggageOverflow } from './luggage'
import type { RouteStop } from './routeStops'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/** Шагов ровно три — решение владельца, не параметр. Константа существует, чтобы «Шаг 2 из 3»
 * и санитайзер черновика не считали это число каждый по-своему. */
export const WIZARD_STEP_COUNT = 3

/** Индекс шага. Литеральный union, а не `number`: перебор шагов в рельсе и чтение шага из
 * черновика обязаны быть исчерпывающими. */
export type WizardStep = 0 | 1 | 2

export const WIZARD_STEPS: readonly WizardStep[] = [0, 1, 2]

/** Заголовки шагов для рельса. Здесь же, а не в компоненте: рельс и «Шаг 2 из 3» называют шаг
 * одинаково, иначе на телефоне и на десктопе форма выглядит как две разные. */
export const WIZARD_STEP_TITLES: Record<WizardStep, TranslationKey> = {
  0: 'transfers.request.wizardStep1',
  1: 'transfers.request.wizardStep2',
  2: 'transfers.request.wizardStep3',
}

/** Поля, у которых бывает своя ошибка. Не все поля формы — только те, что валидируются. */
export type TransferRequestField =
  | 'from'
  | 'to'
  | 'stops'
  | 'date'
  | 'time'
  | 'returnLeg'
  | 'vehicle'
  | 'luggage'
  | 'contacts'

export type TransferRequestErrors = Partial<Record<TransferRequestField, string>>

/**
 * Какое поле на каком шаге. Единственный источник этого знания: и «Далее» с первого шага, и
 * прыжок на шаг с ошибкой при отправке читают отсюда.
 */
const STEP_FIELDS: Record<WizardStep, readonly TransferRequestField[]> = {
  0: ['from', 'to', 'stops', 'date', 'time', 'returnLeg'],
  1: ['vehicle', 'luggage'],
  2: ['contacts'],
}

/**
 * Всё, что человек заполняет в мастере, ОДНИМ объектом.
 *
 * Не пятнадцать `useState`, как было в форме-простыне: у мастера появились два потребителя,
 * которым нужен снимок целиком, — автосохранение черновика и сводка на третьем шаге. С
 * отдельными состояниями оба собирали бы этот снимок руками, и любое новое поле пришлось бы
 * дописывать в трёх местах вместо одного.
 */
export interface TransferRequestFormState {
  from: string
  to: string
  /** Промежуточные остановки со своими id — id нужен `SortableList`, см. `lib/routeStops.ts`. */
  stops: readonly RouteStop[]
  /** `YYYY-MM-DD`, либо `''`. */
  date: string
  /** `HH:mm`, либо `''`. */
  pickupTime: string
  isRoundTrip: boolean
  returnDate: string
  returnTime: string
  passengers: number
  luggageMedium: number
  luggageLarge: number
  luggageOther: string
  /** `null` — «не важно, подберите сами». */
  vehicleClassId: number | null
  comment: string
  contacts: readonly OrderContactInput[]
}

/** Частичное изменение формы: шаги отдают наверх ровно то, что поменялось. */
export type TransferRequestPatch = Partial<TransferRequestFormState>

/**
 * @param vehicleClass уже найденный класс (а не id): вместимость и лимит багажа нужны прямо
 * здесь, а справочник классов живёт в loader'е экрана.
 */
export function validateTransferRequest(
  values: TransferRequestFormState,
  vehicleClass: VehicleClass | null,
  t: Translate,
): TransferRequestErrors {
  const errors: TransferRequestErrors = {}

  if (values.from.trim() === '') errors.from = t('transfers.request.fromMissing')
  if (values.to.trim() === '') errors.to = t('transfers.request.toMissing')
  if (values.stops.some((stop) => stop.text.trim() === '')) {
    errors.stops = t('transfers.request.stopEmpty')
  }
  if (values.date === '') errors.date = t('transfers.detail.dateMissing')
  if (values.pickupTime === '') errors.time = t('transfers.detail.timeMissing')

  if (values.isRoundTrip) {
    if (values.returnDate === '' || values.returnTime === '') {
      errors.returnLeg = t('transfers.detail.returnMissing')
    } else if (
      values.returnDate < values.date ||
      (values.returnDate === values.date && values.returnTime < values.pickupTime)
    ) {
      errors.returnLeg = t('transfers.detail.returnInvalid')
    }
  }

  /* Класс авто — ПОЖЕЛАНИЕ и может быть не выбран вовсе; обе проверки ниже имеют смысл только
     когда он выбран, ровно как на сервере. */
  if (vehicleClass !== null) {
    if (values.passengers > vehicleClass.capacity) {
      errors.vehicle = t('transfers.request.capacityTooSmall')
    }
    const shortfall = luggageOverflow(
      { medium: values.luggageMedium, large: values.luggageLarge },
      vehicleClass.luggageCapacity,
    )
    if (shortfall > 0) {
      errors.luggage = t('transfers.request.luggageTooMuchTitle', { vehicle: vehicleClass.name })
    }
  }

  /* Само ПРАВИЛО «1..3, ровно один основной» не переписывается здесь: его знает общий контактный
     домен (`isOrderContactsValid`), и вторая копия разъехалась бы с корзиной. Локально остаётся
     только выбор формулировки — какой из трёх случаев сработал; тексты те же `orderContacts.*`,
     которыми говорит сам блок и отвечает сервер (2060-2062). */
  if (!isOrderContactsValid(values.contacts)) {
    errors.contacts =
      values.contacts.length < ContactLimits.minOrderContacts
        ? t('orderContacts.error.required')
        : values.contacts.length > ContactLimits.maxOrderContacts
          ? t('orderContacts.error.tooMany', { max: ContactLimits.maxOrderContacts })
          : t('orderContacts.error.primary')
  }

  return errors
}

/**
 * Ошибки-ПРОТИВОРЕЧИЯ: их видно сразу, не дожидаясь нажатия «Далее».
 *
 * Разница по существу, а не по вкусу. «Укажите, куда ехать» — претензия к человеку, который ещё
 * не дошёл до поля, и показывать её заранее нельзя. А «в этот класс не влезут восемь человек» —
 * следствие того, что он ТОЛЬКО ЧТО выбрал сам, и молчать о нём до конца шага значит дать
 * спокойно доехать до отправки с заведомо невыполнимой заявкой.
 */
const IMMEDIATE_FIELDS: readonly TransferRequestField[] = ['vehicle', 'luggage']

/**
 * Ошибки, которые шаг имеет право показать прямо сейчас: свои, и только те, о которых человека
 * уже уместно предупреждать.
 *
 * @param attempted человек уже нажимал «Далее» на этом шаге.
 */
export function visibleStepErrors(
  step: WizardStep,
  errors: TransferRequestErrors,
  attempted: boolean,
): TransferRequestErrors {
  const visible: TransferRequestErrors = {}
  for (const field of STEP_FIELDS[step]) {
    const message = errors[field]
    if (message === undefined) continue
    if (attempted || IMMEDIATE_FIELDS.includes(field)) visible[field] = message
  }
  return visible
}

/** Есть ли на шаге хоть одна незакрытая ошибка. */
export function stepHasErrors(step: WizardStep, errors: TransferRequestErrors): boolean {
  return STEP_FIELDS[step].some((field) => errors[field] !== undefined)
}

/**
 * Первый слева направо шаг с ошибкой, либо `null`. Нужен отправке: человек мог вернуться на
 * первый шаг, стереть «куда» и уйти вперёд по рельсу — молча отправлять такое нельзя, а
 * показывать ошибку на третьем шаге бессмысленно, исправлять её надо на первом.
 */
export function firstInvalidStep(errors: TransferRequestErrors): WizardStep | null {
  return WIZARD_STEPS.find((step) => stepHasErrors(step, errors)) ?? null
}

/** Первое поле с ошибкой на шаге — на нём мастер ставит фокус после неудачного «Далее». */
export function firstInvalidField(
  step: WizardStep,
  errors: TransferRequestErrors,
): TransferRequestField | null {
  return STEP_FIELDS[step].find((field) => errors[field] !== undefined) ?? null
}

/** Приводит произвольное число (черновик из `localStorage`) к существующему шагу. */
export function toWizardStep(value: number): WizardStep {
  if (value <= 0) return 0
  if (value >= WIZARD_STEP_COUNT - 1) return 2
  return 1
}
