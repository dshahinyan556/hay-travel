/**
 * Правила НАБОРА контактов заказа: как из справочника/формы получается список, который уедет в
 * тело запроса, и как между запросами помнится последний использованный набор.
 *
 * Отдельно от `contactValidation.ts` намеренно: тот отвечает за ОДИН контакт («это вообще похоже
 * на номер?»), этот — за агрегат («их 1..3 и основной ровно один»). Серверные правила тоже
 * разнесены ровно так же: `ContactMethodValidator` против `OrderValidationService` (коды
 * 2060-2062), и повторять их границу здесь дешевле, чем однажды искать, в каком из двух файлов
 * живёт «максимум три».
 *
 * Инвариант, который держит весь модуль: в непустом списке РОВНО ОДИН контакт с `isPrimary`.
 * Каждая функция здесь его сохраняет — поэтому вызывающему не нужно проверять это перед отправкой,
 * и поэтому 2062 с сервера означает не «пользователь ошибся», а расхождение фронта с сервером.
 */

import { ContactLimits, type ContactMethodModel, type OrderContactInput } from '@/shared/types/contact'
import {
  CONTACT_METHOD_ORDER,
  contactFirstNameErrorKey,
  contactValueErrorKey,
  normalizeContactValue,
} from './contactValidation'

/**
 * Ключ памяти последнего набора. Свой, а не поле внутри `hay-travel-cart`: набор переживает
 * очистку корзины (её опустошает успешная отправка — ровно тот момент, после которого набор и
 * становится «последним использованным») и нужен ещё и конструктору трансфера, у которого корзины
 * нет вовсе.
 */
const STORAGE_KEY = 'hay-travel-order-contacts'

/** Один контакт справочника → снимок для заказа. `id` намеренно теряется (ADR 032 Р1). */
export function toOrderContact(contact: ContactMethodModel, isPrimary: boolean): OrderContactInput {
  return {
    type: contact.type,
    value: contact.value,
    firstName: contact.firstName,
    lastName: emptyToNull(contact.lastName),
    isPrimary,
  }
}

/** Пустая фамилия и «не указана» — одно и то же состояние, и в теле запроса оно одно: `null`. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Совпадают ли два контакта «для человека»: способ + нормализованное значение.
 *
 * Имя в сравнение НЕ входит: «Ани» и «Ани Саргсян» с одним и тем же номером — один и тот же
 * телефон, и предлагать его вторым пунктом списка значило бы предлагать позвонить дважды.
 */
export function isSameContact(
  a: Pick<OrderContactInput, 'type' | 'value'>,
  b: Pick<OrderContactInput, 'type' | 'value'>,
): boolean {
  return a.type === b.type && normalizeContactValue(a.type, a.value) === normalizeContactValue(b.type, b.value)
}

/**
 * Добавить контакт в набор.
 *
 * НЕ проверяет ни потолок, ни дубли — их проверяет вызывающий ДО вызова, потому что «уже
 * добавлен» и «больше трёх нельзя» это два разных ответа человеку, а функция, молча вернувшая
 * прежний массив, не сказала бы ни одного из них.
 */
export function addOrderContact(
  contacts: readonly OrderContactInput[],
  next: OrderContactInput,
): OrderContactInput[] {
  // Первый добавленный становится основным: набор без основного невалиден (2062), а спрашивать
  // «сделать ли основным» у единственного контакта не о чем.
  const isPrimary = contacts.length === 0
  return [...contacts, { ...next, lastName: emptyToNull(next.lastName), isPrimary }]
}

/**
 * Убрать контакт по индексу. Если убрали основного — метка переходит ПЕРВОМУ оставшемуся, иначе
 * заказ остался бы без основного и сервер отбил бы его целиком (2062).
 */
export function removeOrderContact(
  contacts: readonly OrderContactInput[],
  index: number,
): OrderContactInput[] {
  const next = contacts.filter((_, i) => i !== index)
  return ensureSinglePrimary(next)
}

/** Назначить основного по индексу. Ровно один `true`, остальные `false`. */
export function setPrimaryOrderContact(
  contacts: readonly OrderContactInput[],
  index: number,
): OrderContactInput[] {
  return contacts.map((contact, i) => ({ ...contact, isPrimary: i === index }))
}

/**
 * Привести набор к инварианту: ровно один основной.
 *
 * Нужна не только внутри модуля — ею же чистится набор, прочитанный из `localStorage`, где он мог
 * пролежать с прошлой версии формата.
 */
export function ensureSinglePrimary(contacts: readonly OrderContactInput[]): OrderContactInput[] {
  if (contacts.length === 0) return []
  const primaryIndex = contacts.findIndex((contact) => contact.isPrimary)
  const winner = primaryIndex === -1 ? 0 : primaryIndex
  return contacts.map((contact, i) => ({ ...contact, isPrimary: i === winner }))
}

/**
 * Годен ли набор к отправке. Ровно то же, что проверит сервер (2060/2061/2062) — здесь ради того,
 * чтобы кнопка гасла ДО запроса, а не вместо серверной проверки.
 */
export function isOrderContactsValid(contacts: readonly OrderContactInput[]): boolean {
  if (contacts.length < ContactLimits.minOrderContacts) return false
  if (contacts.length > ContactLimits.maxOrderContacts) return false
  return contacts.filter((contact) => contact.isPrimary).length === 1
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
   Память последнего использованного набора
   ──────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Запомнить набор, которым только что был создан заказ.
 *
 * Вызывается ПОСЛЕ успешного ответа сервера, а не на каждое изменение выбора: «последний
 * использованный» — это тот, по которому реально договаривались, а не тот, который человек начал
 * набирать и передумал. Точка вызова — оформление (корзина, конструктор трансфера), потому что
 * только оно знает про успех; сам блок выбора об отправке ничего не знает.
 */
export function rememberOrderContacts(contacts: readonly OrderContactInput[]): void {
  try {
    if (contacts.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts.slice(0, ContactLimits.maxOrderContacts)))
  } catch {
    // Приватный режим/переполненное хранилище: подсказка на следующий заказ не стоит того, чтобы
    // из-за неё падало оформление уже созданного.
  }
}

/**
 * Последний использованный набор, приведённый к инварианту, либо `[]`.
 *
 * Читается СТРОГО: каждый контакт проходит ту же валидацию, что и введённый руками. Хранилище
 * переживает и смену формата, и правку руками через devtools, и просто протухание (номер, который
 * год назад проходил, сегодня может не пройти) — подставить оттуда мусор значило бы предложить
 * человеку отправить заявку с заведомо неверным номером.
 */
export function readLastOrderContacts(): OrderContactInput[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const sane = parsed
      .flatMap((row) => {
        const contact = sanitizeStoredContact(row)
        return contact ? [contact] : []
      })
      .slice(0, ContactLimits.maxOrderContacts)

    return ensureSinglePrimary(sane)
  } catch {
    return []
  }
}

function sanitizeStoredContact(row: unknown): OrderContactInput | null {
  if (typeof row !== 'object' || row === null) return null
  const record = row as Record<string, unknown>

  const type = record.type
  const value = record.value
  const firstName = record.firstName
  if (typeof type !== 'number' || typeof value !== 'string' || typeof firstName !== 'string') return null
  // Способ проверяется ЯВНО, а не через `contactValueErrorKey`: тот на неизвестный номер способа
  // уходит в телефонную ветку, и запись с `type: 99` и валидным номером прошла бы проверку здесь,
  // чтобы быть отбитой сервером.
  const method = CONTACT_METHOD_ORDER.find((known) => known === type)
  if (method === undefined) return null
  if (contactFirstNameErrorKey(firstName) !== null) return null
  if (contactValueErrorKey(method, value) !== null) return null

  return {
    type: method,
    value: normalizeContactValue(method, value),
    firstName: firstName.trim(),
    lastName: typeof record.lastName === 'string' ? emptyToNull(record.lastName) : null,
    isPrimary: record.isPrimary === true,
  }
}
