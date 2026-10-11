/**
 * Чтение отказов `POST api/Order/CreateTransferRequest`.
 *
 * Отказ здесь всегда ПЛОСКИЙ: заявка — это одна строка, и пер-строчный отчёт корзины ей не нужен
 * (`CustomTransferRequestCreationService` валидируется в режиме FailFast). Поэтому здесь нет
 * разбора `lines` — в отличие от `features/cart/lib/checkoutErrors.ts`, где отказ атомарного
 * многострочного заказа обязан указать на конкретную позицию.
 *
 * Каждый код имеет ФРОНТОВОЙ аналог в форме (правило 0.29): маршрут, обратный рейс, вместимость
 * и багаж проверяются до отправки. Сюда они доезжают только при расхождении с сервером — админ
 * поменял класс авто, пока форма была открыта, или день закрыли правилом. Молчать в этом случае
 * нельзя: кнопка вернулась бы в исходное состояние без единого слова.
 */

import { SessionExpiredError } from '@/shared/auth'
import { ApiError } from '@/shared/lib/http'
import { orderContactErrorKey } from '@/shared/contacts'
import { ContactLimits } from '@/shared/types/contact'
import type { TranslationKey } from '@/shared/i18n/translate'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/** `errorCode` в том регистре, в каком его пишет бэк (`ErrorModelExceptionHandler` — camelCase,
 * часть старых обработчиков — PascalCase). Локальная копия, а не импорт из `features/cart`:
 * фича не может зависеть от другой фичи, и это уже сложившаяся конвенция проекта — свой
 * `errorCodeOf` лежит в каждом `*Copy.ts`/`*Errors.ts` админки. */
function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/* `GlobalErrorCode`, локальные числовые константы — та же конвенция, что в `checkoutErrors.ts`. */
const TOUR_DATE_UNAVAILABLE = 2014
const ORDER_DATE_IN_PAST = 2016
const INVALID_START_TIME = 2045
const LUGGAGE_EXCEEDS_CAPACITY = 2048
const PASSENGERS_EXCEED_CAPACITY = 2049
const INVALID_TRANSFER_ROUTE = 2053
const VEHICLE_CLASS_NOT_FOUND = 2057
const INVALID_RETURN_TRIP = 2058

/* Кодов контактов (2060-2063) здесь НЕТ намеренно: их знает общий контактный домен
   (`shared/contacts` → `orderContactErrorKey`), потому что ровно те же отказы разбирает корзина.
   Своя копия читала бы 2062 своими словами, и один и тот же отказ звучал бы на двух экранах
   по-разному. */

/** `true` — виновата сессия, а не заявка: экран показывает блок входа, а не ошибку формы. */
export function isSessionFailure(err: unknown): boolean {
  if (err instanceof SessionExpiredError) return true
  return err instanceof ApiError && err.status === 401
}

/**
 * `true` — виноваты КОНТАКТЫ (2060-2063), а не остальная заявка.
 *
 * Нужно мастеру: такую ошибку нельзя показывать общей строкой под кнопкой отправки, её надо
 * отдать блоку контактов — это единственное место, где её можно исправить. Отдельная функция, а
 * не поле в сообщении, потому что решение «куда положить текст» принимает экран, а не мапперы.
 */
export function isContactFailure(err: unknown): boolean {
  return orderContactErrorKey(err) !== null
}

/** Готовая копия под кнопкой. Заявка НЕ создана ни в одном из этих случаев — черновик формы
 * остаётся нетронутым, и повторная отправка дубля не создаст. */
export function transferRequestMessage(err: unknown, t: Translate): string {
  if (isSessionFailure(err)) return t('transfers.error.session')

  /* Контакты говорят словами общего блока: отказ по ним показывается ВНУТРИ него, и текст,
     отличающийся от его собственных сообщений, читался бы как ошибка другого поля. */
  const contactKey = orderContactErrorKey(err)
  if (contactKey !== null) return t(contactKey, { max: ContactLimits.maxOrderContacts })

  if (!(err instanceof ApiError)) return t('transfers.error.generic')

  switch (errorCodeOf(err.body)) {
    case INVALID_TRANSFER_ROUTE:
      return t('transfers.error.route')
    case INVALID_RETURN_TRIP:
      return t('transfers.error.returnTrip')
    case VEHICLE_CLASS_NOT_FOUND:
      return t('transfers.error.vehicle')
    case PASSENGERS_EXCEED_CAPACITY:
      return t('transfers.error.passengers')
    case LUGGAGE_EXCEEDS_CAPACITY:
      return t('transfers.error.luggage')
    case TOUR_DATE_UNAVAILABLE:
      return t('transfers.error.dateClosed')
    case ORDER_DATE_IN_PAST:
      return t('transfers.error.datePast')
    case INVALID_START_TIME:
      return t('transfers.error.time')
    default:
      return t('transfers.error.generic')
  }
}
