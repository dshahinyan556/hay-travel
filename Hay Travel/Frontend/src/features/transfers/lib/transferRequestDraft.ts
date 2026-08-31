/**
 * Черновик кастомной заявки в `localStorage` (пункт 6.6).
 *
 * Зачем вообще: отправка заявки требует логина, а логин — это НАВИГАЦИЯ на `/auth` и обратно
 * (`?returnTo=`), то есть полный размонтаж конструктора. Форма, которую приходится заполнять
 * заново после входа, — это форма, которую бросают.
 *
 * С переходом конструктора на мастер (2026-08-29) черновик хранит ещё и НОМЕР ШАГА: вернуться со
 * входа на первый шаг, когда человек ушёл с третьего, — это заставить его трижды нажать «Далее»
 * по уже заполненным полям, то есть ровно то, ради чего черновик и заводился.
 *
 * Тот же приём, что у корзины (ADR 022): модуль-хранилище вне React, снимок целиком, санитайзер
 * на чтении. Отличия — по существу задачи, а не по вкусу:
 *  - здесь НЕТ версии и `subscribe`: черновик читает ровно один экран и ровно один раз, при
 *    монтировании. Подписка была бы механизмом без потребителя;
 *  - черновик живёт часами, а не месяц: он про «я сейчас вернусь со входа», а не про «я подумаю
 *    неделю». Просроченный читается как пустой;
 *  - успешная отправка его СТИРАЕТ. Заявка уже создана, и повторное открытие конструктора не
 *    должно предлагать отправить её второй раз.
 *
 * Дата в черновике может протухнуть, пока посетитель ходил логиниться через полночь — прошедшая
 * дата отбрасывается (сервер отбил бы её как `OrderDateInPast`/2016), остальное сохраняется:
 * потерять весь маршрут из-за одной даты хуже, чем попросить выбрать её заново.
 */

import { formatISODate, stripTime } from '@/shared/lib/date'
import { isDisplayTime } from '@/shared/booking'
import { ContactLimits, ContactMethodType, type OrderContactInput } from '@/shared/types/contact'
import { WIZARD_STEP_COUNT } from './transferWizard'

export const TRANSFER_DRAFT_STORAGE_KEY = 'hay-travel-transfer-request'

/** Дольше этого черновик перестаёт быть «я вернусь со входа» и становится мусором. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Больше стопов — это уже не трансфер, а тур (решение 0.12 / мокап). Держится здесь, рядом с
 * санитайзером, чтобы подделанный `localStorage` не смог вернуть в форму список на 50 строк. */
export const MAX_STOPS = 6

export interface TransferRequestDraft {
  /**
   * Кому принадлежит черновик: `null` — конструктору `/transfers/custom`, строка с id — панели
   * брони КОНКРЕТНОГО трансфера, которая перешла в режим заявки (решение 0.14, пассажиров больше
   * вместимости любого класса).
   *
   * Ключ один на оба экрана намеренно: черновик всегда ровно один, и вернуться со входа можно
   * только туда, откуда ушёл. Владелец сверяется при чтении — иначе заявка, начатая на странице
   * трансфера, всплыла бы в конструкторе чужим маршрутом.
   */
  transferId: string | null
  from: string
  to: string
  stops: string[]
  /** `YYYY-MM-DD`, либо `''` — не выбрана. */
  date: string
  /** `HH:mm`, либо `''`. */
  time: string
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
  /**
   * Контакты для связи, выбранные на последнем шаге мастера. Снимок значений, а не ссылки на
   * записи справочника: в заказ уезжает именно снимок (ADR 032 Р1), и черновик обязан хранить
   * то же самое — иначе после входа в форму вернулись бы уже другие данные.
   *
   * Необязательное поле: панель брони готового трансфера пишет черновик без него.
   */
  contacts?: readonly OrderContactInput[]
  /**
   * Шаг мастера (0..2), на котором черновик был сохранён. Необязателен: у панели брони шагов
   * нет, и придумывать ей нулевой шаг незачем.
   */
  step?: number
}

interface StoredDraft extends TransferRequestDraft {
  savedAt: number
}

function toText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function toCount(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.trunc(value), 0), max)
}

function toDate(value: unknown, todayISO: string): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return ''
  return value < todayISO ? '' : value
}

function toTime(value: unknown): string {
  return typeof value === 'string' && isDisplayTime(value) ? value : ''
}

const CONTACT_TYPES: readonly number[] = Object.values(ContactMethodType)

/**
 * Контакты из хранилища. Санитайзер здесь ГРУБЫЙ по существу задачи: формат значения по типу
 * (номер с `+`, e-mail, `@username`) проверяет форма контактов и, окончательно, сервер (2063).
 * Задача этого места — не пустить в состояние React то, что сломает рендер: не-объект, лишние
 * поля, четвёртый контакт при лимите в три.
 */
function toContacts(value: unknown): OrderContactInput[] {
  if (!Array.isArray(value)) return []
  const contacts: OrderContactInput[] = []
  for (const item of value.slice(0, ContactLimits.maxOrderContacts)) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    if (typeof record.type !== 'number' || !CONTACT_TYPES.includes(record.type)) continue
    const contactValue = toText(record.value, ContactLimits.maxValueLength)
    const firstName = toText(record.firstName, ContactLimits.maxNameLength)
    if (contactValue === '' || firstName === '') continue
    contacts.push({
      type: record.type as OrderContactInput['type'],
      value: contactValue,
      firstName,
      lastName:
        typeof record.lastName === 'string' && record.lastName.trim() !== ''
          ? record.lastName.slice(0, ContactLimits.maxNameLength)
          : null,
      isPrimary: record.isPrimary === true,
    })
  }
  /* «Ровно один основной» — правило заказа (2062), и восстановленный черновик обязан ему
     подчиняться: подделанный список из трёх основных иначе вернулся бы в форму как есть. */
  if (contacts.length > 0 && contacts.filter((contact) => contact.isPrimary).length !== 1) {
    return contacts.map((contact, index) => ({ ...contact, isPrimary: index === 0 }))
  }
  return contacts
}

function toStep(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.trunc(value), 0), WIZARD_STEP_COUNT - 1)
}

/**
 * @param owner `null` — читает конструктор, строка — панель трансфера с этим id. Черновик чужого
 * владельца читается как «черновика нет»: подставить его значило бы показать посетителю форму,
 * которую он заполнял на другом экране и про другой маршрут.
 */
export function readTransferRequestDraft(owner: string | null): TransferRequestDraft | null {
  try {
    const raw = localStorage.getItem(TRANSFER_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    if (typeof parsed?.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) return null
    const storedOwner = typeof parsed.transferId === 'string' ? parsed.transferId : null
    if (storedOwner !== owner) return null

    const todayISO = formatISODate(stripTime(new Date()))
    const stops = Array.isArray(parsed.stops)
      ? parsed.stops.map((stop) => toText(stop, 200)).slice(0, MAX_STOPS)
      : []

    return {
      transferId: storedOwner,
      from: toText(parsed.from, 200),
      to: toText(parsed.to, 200),
      stops,
      date: toDate(parsed.date, todayISO),
      time: toTime(parsed.time),
      isRoundTrip: parsed.isRoundTrip === true,
      returnDate: toDate(parsed.returnDate, todayISO),
      returnTime: toTime(parsed.returnTime),
      // Пассажиров минимум один: заявка на ноль человек не имеет смысла, и счётчик в форме
      // ниже единицы не опускается.
      passengers: Math.max(toCount(parsed.passengers, 99), 1),
      luggageMedium: toCount(parsed.luggageMedium, 99),
      luggageLarge: toCount(parsed.luggageLarge, 99),
      luggageOther: toText(parsed.luggageOther, 500),
      vehicleClassId:
        typeof parsed.vehicleClassId === 'number' && Number.isFinite(parsed.vehicleClassId)
          ? parsed.vehicleClassId
          : null,
      comment: toText(parsed.comment, 2000),
      contacts: toContacts(parsed.contacts),
      step: toStep(parsed.step),
    }
  } catch {
    return null
  }
}

export function writeTransferRequestDraft(draft: TransferRequestDraft): void {
  try {
    localStorage.setItem(
      TRANSFER_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() } satisfies StoredDraft),
    )
  } catch {
    /* ignore — приватный режим Safari и т.п.: черновик деградирует до «только эта вкладка»,
       но конструктор продолжает работать. */
  }
}

export function clearTransferRequestDraft(): void {
  try {
    localStorage.removeItem(TRANSFER_DRAFT_STORAGE_KEY)
  } catch {
    /* ignore — см. выше */
  }
}
