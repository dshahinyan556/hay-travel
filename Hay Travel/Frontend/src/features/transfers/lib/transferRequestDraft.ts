/**
 * Черновик кастомной заявки в `localStorage` (пункт 6.6).
 *
 * Зачем вообще: отправка заявки требует логина, а логин — это НАВИГАЦИЯ на `/auth` и обратно
 * (`?returnTo=`), то есть полный размонтаж конструктора. Форма из четырёх шагов, которую
 * приходится заполнять заново после входа, — это форма, которую бросают.
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
