/**
 * Ключи сообщений для отказов, которые может вернуть контактный домен — и справочник профиля
 * (`api/Account/Contacts`), и создание заказа с контактами (батч 2026-08-29).
 *
 * Два набора, потому что это два разных разговора:
 *  - 2059/2063-2065 — про ОДНУ строку справочника: её правит форма кабинета;
 *  - 2060-2063 — про АГРЕГАТ заказа (нет контакта, больше трёх, основной не ровно один): их
 *    показывает блок контактов в корзине и в конструкторе трансфера.
 * Код 2063 попадает в оба: значение, не подходящее способу, отбивается и там, и там.
 *
 * Модуль живёт в `shared`, а не в кабинете: `features/cart` не может импортировать
 * `features/auth`, а формулировка отказа обязана быть одна — иначе один и тот же 2062 читался бы
 * на двух экранах по-разному.
 *
 * Запасной путь — общий `authErrorMessageKey`: «нет сети» и «сессия истекла» написаны в одном
 * месте на весь продукт. Специфичные для кабинета коды 22xx (смена почты, привязка Telegram)
 * сюда не попадают вовсе — ни один из этих эндпоинтов их не возвращает.
 */

import { authErrorCodeOf, authErrorMessageKey } from '@/shared/auth'
import type { TranslationKey } from '@/shared/i18n/dictionary'

/** `GlobalErrorCode` — блок контактов (`ATTours.Helper/Enums/GlobalErrorCode.cs`). */
export const ContactErrorCode = {
  /** Имя или фамилия пустые. На фронте это ловит валидация формы, здесь — защита от гонки. */
  RequiredFieldMissing: 2059,
  /** Значение не подходит способу связи — тот же вывод, что делает форма перед отправкой. */
  InvalidContactValue: 2063,
  /** Строка не найдена: чаще всего её удалили в другой вкладке. */
  ContactMethodNotFound: 2064,
  /** Потолок справочника (`ContactLimits.maxProfileContacts`). */
  TooManyContactMethods: 2065,
} as const

const CODE_TO_KEY: Record<number, TranslationKey> = {
  [ContactErrorCode.RequiredFieldMissing]: 'account.contacts.errorFirstName',
  [ContactErrorCode.InvalidContactValue]: 'account.error.contactValueInvalid',
  [ContactErrorCode.ContactMethodNotFound]: 'account.error.contactNotFound',
  [ContactErrorCode.TooManyContactMethods]: 'account.error.contactLimit',
}

/**
 * Ключ сообщения для любого отказа справочника контактов.
 *
 * Вызывающий передаёт `{ max: ContactLimits.maxProfileContacts }` в `t()` — лишние переменные
 * подстановка игнорирует, а ключ с `{max}` здесь ровно один.
 */
export function contactErrorMessageKey(err: unknown): TranslationKey {
  const code = authErrorCodeOf(err)
  if (code !== undefined && code in CODE_TO_KEY) return CODE_TO_KEY[code]
  return authErrorMessageKey(err)
}

/**
 * Отказы ПРАВИЛА КОНТАКТОВ ЗАКАЗА — `POST api/Order/Create` и `POST api/Order/CreateTransferRequest`.
 *
 * Приходят ПЛОСКО (не в массиве `lines`), как `OrderMustHaveAtLeastOneLine`: контакт — свойство
 * заказа целиком, а не одной его позиции.
 */
export const OrderContactErrorCode = {
  /** 2060 — контактов не прислали вовсе. Фронт до этого доводить не должен: кнопка гасится. */
  OrderContactRequired: 2060,
  /** 2061 — больше `ContactLimits.maxOrderContacts`. */
  OrderTooManyContacts: 2061,
  /** 2062 — основной не ровно один (ни одного либо несколько). */
  OrderPrimaryContactInvalid: 2062,
  /** 2063 — значение не подходит способу связи (тот же код, что у справочника). */
  InvalidContactValue: 2063,
} as const

const ORDER_CODE_TO_KEY: Record<number, TranslationKey> = {
  [OrderContactErrorCode.OrderContactRequired]: 'orderContacts.error.required',
  [OrderContactErrorCode.OrderTooManyContacts]: 'orderContacts.error.tooMany',
  [OrderContactErrorCode.OrderPrimaryContactInvalid]: 'orderContacts.error.primary',
  [OrderContactErrorCode.InvalidContactValue]: 'orderContacts.error.value',
}

/**
 * Ключ сообщения, если создание заказа отбито ИМЕННО ПО КОНТАКТАМ, иначе `null`.
 *
 * `null`, а не общий текст: отказ по датам, местам или сессии — не про контакты, и вызывающий
 * обязан разобрать его своим разбором. Возвращать сюда «что-то пошло не так» значило бы
 * перехватывать чужие ошибки и печатать их рядом с полем контакта.
 *
 * Вызывающий передаёт `{ max: ContactLimits.maxOrderContacts }` в `t()`.
 */
export function orderContactErrorKey(err: unknown): TranslationKey | null {
  const code = authErrorCodeOf(err)
  if (code === undefined) return null
  return ORDER_CODE_TO_KEY[code] ?? null
}
