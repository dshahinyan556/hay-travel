/**
 * Как контакт называется словами. Один модуль на два раздела кабинета: справочник («Способы
 * связи») и заказы, где основной контакт назван в тексте про заявку.
 *
 * Структурный тип параметра, а не `ContactMethodModel`: у контакта в заказе
 * (`OrderContactModel`) те же четыре поля, но это СНИМОК, а не строка справочника, и объединять
 * их одним номинальным типом было бы неправдой (ADR 032 Р1).
 */

import type { TranslationKey } from '@/shared/i18n/dictionary'
import type { ContactMethodType } from '@/shared/types/contact'
import { CONTACT_METHOD_LABEL_KEY } from './contactValidation'

export interface ContactLike {
  type: ContactMethodType
  value: string
  firstName: string
  /** Фамилия необязательна (решение заказчика 2026-08-29) — приходит пустой либо `null`. */
  lastName: string | null
}

/** «Ани Саргсян» либо просто «Ани». Склейка через фильтр непустых — та же, что в
 * `ProfileSummary`: без неё контакт без фамилии давал бы висящий пробел в конце имени. */
export function contactFullName(contact: ContactLike): string {
  return [contact.firstName, contact.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ')
}

/**
 * «Давид Саргсян · Telegram · @dsargsyan» — полное имя контакта для подтверждения удаления и
 * для сообщений об успехе.
 *
 * Именно словами, а не «этот элемент»: удаление необратимо, и человек должен видеть, что именно
 * исчезнет, не сверяясь со списком за спиной модального окна.
 */
export function describeContact(
  contact: ContactLike,
  t: (key: TranslationKey) => string,
): string {
  return [contactFullName(contact), t(CONTACT_METHOD_LABEL_KEY[contact.type]), contact.value]
    .filter((part) => part !== '')
    .join(' · ')
}

/** «Ани Саргсян, +374 91 23 45 67» — короткая форма для строки «менеджер свяжется по …»,
 * без названия способа: в этой фразе важно, КУДА звонить, а не как называется канал. */
export function contactNameAndValue(contact: ContactLike): string {
  const name = contactFullName(contact)
  return name === '' ? contact.value : `${name}, ${contact.value}`
}
