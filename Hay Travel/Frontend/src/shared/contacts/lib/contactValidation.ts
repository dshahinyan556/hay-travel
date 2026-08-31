/**
 * Правила «как выглядит корректный контакт» на фронте — ЗЕРКАЛО серверного
 * `ATTours.Service/Services/Shared/ContactMethodValidator.cs` (батч 2026-08-29).
 *
 * Зеркало, а не замена: сервер проверяет ровно то же самое сам и отвечает `InvalidContactValue`
 * (2063) на прямой запрос к API. Здесь это ради формулировки — человек должен узнать о неверном
 * номере рядом с полем, а не общей ошибкой после отправки формы.
 *
 * Регулярки скопированы из бэкенда СИМВОЛ В СИМВОЛ и должны меняться только вместе с ним:
 * разъехавшаяся пара «фронт мягче сервера» даёт форму, которая отправляется и тут же получает
 * отказ, а «фронт строже сервера» — поле, которое невозможно заполнить.
 *
 * Нормализация тоже дублируется, и по той же причине, что на сервере она идёт ДО валидации:
 * «+374 (91) 23-45-67» и «+37491234567» — один и тот же номер, и отбивать первый как неверный
 * было бы враньём.
 */

import type { TranslationKey } from '@/shared/i18n/dictionary'
import { ContactLimits, ContactMethodType } from '@/shared/types/contact'

/** Пробелы, скобки, дефисы и точки — разделители номера, значения не несут. */
const PHONE_SEPARATORS = /[\s()\-.]/g
/** Ведущий «+» обязателен и сервером не дописывается: «89261234567» — это не «+8…» (ADR 032). */
const INTERNATIONAL_PHONE = /^\+\d{8,15}$/
/** Намеренно грубее RFC 5322 — задача отсеять мусор, а не доказать доставляемость. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Правила Telegram: 5–32 символа, первый — буква, дальше буквы/цифры/подчёркивание. */
const TELEGRAM_USERNAME = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/

/** Способы, значение которых — телефонный номер. */
export function isPhoneLike(type: ContactMethodType): boolean {
  return (
    type === ContactMethodType.Phone ||
    type === ContactMethodType.WhatsApp ||
    type === ContactMethodType.Viber
  )
}

/**
 * Приводит значение к тому виду, в котором его сохранит сервер. Вызывается и перед проверкой, и
 * перед отправкой — иначе «прошло валидацию, а уехало другое» стало бы возможным.
 */
export function normalizeContactValue(type: ContactMethodType, value: string): string {
  const trimmed = value.trim()
  if (trimmed === '') return ''

  if (type === ContactMethodType.Email) return trimmed.toLowerCase()
  // У Telegram два законных вида значения, и только один из них — номер: регистр @username
  // сохраняется, разделители из него не вычищаются (подчёркивание — часть имени).
  if (type === ContactMethodType.Telegram) {
    return trimmed.startsWith('@') ? trimmed : trimmed.replace(PHONE_SEPARATORS, '')
  }
  return trimmed.replace(PHONE_SEPARATORS, '')
}

/**
 * Ключ текста ошибки значения либо `null`, если значение подходит способу.
 *
 * Пустая строка — тоже ошибка, но её текст не «заполните поле», а тот же, что у неверного
 * формата: пустое поле и «0 91 23 45 67» человек чинит одним и тем же действием, и две разные
 * формулировки на один и тот же промах ничего не добавляют.
 */
export function contactValueErrorKey(
  type: ContactMethodType,
  value: string,
): TranslationKey | null {
  const normalized = normalizeContactValue(type, value)

  if (normalized.length > ContactLimits.maxValueLength) return contactValueErrorKeyOf(type)

  if (type === ContactMethodType.Email) {
    return EMAIL.test(normalized) ? null : 'account.contacts.errorEmail'
  }
  if (type === ContactMethodType.Telegram) {
    return TELEGRAM_USERNAME.test(normalized) || INTERNATIONAL_PHONE.test(normalized)
      ? null
      : 'account.contacts.errorTelegram'
  }
  return INTERNATIONAL_PHONE.test(normalized) ? null : 'account.contacts.errorPhone'
}

function contactValueErrorKeyOf(type: ContactMethodType): TranslationKey {
  if (type === ContactMethodType.Email) return 'account.contacts.errorEmail'
  if (type === ContactMethodType.Telegram) return 'account.contacts.errorTelegram'
  return 'account.contacts.errorPhone'
}

/**
 * Имя обязательно, ФАМИЛИЯ — НЕТ (решение заказчика от 2026-08-29, серверная проверка снята
 * вместе с этим). Поэтому здесь одно поле, а не пара с флагом: «проверка фамилии, которая всегда
 * возвращает `null`» — это мёртвая ветка, которую кто-нибудь однажды «починит» обратно.
 *
 * Длина отдельного текста ошибки не имеет: её держит `maxLength` поля по
 * `ContactLimits.maxNameLength`, то есть превысить её вводом нельзя.
 */
export function contactFirstNameErrorKey(value: string): TranslationKey | null {
  return value.trim() === '' ? 'account.contacts.errorFirstName' : null
}

/** Порядок в выпадающем списке: телефон первым — им пользуются чаще остальных вместе взятых. */
export const CONTACT_METHOD_ORDER: ContactMethodType[] = [
  ContactMethodType.Phone,
  ContactMethodType.WhatsApp,
  ContactMethodType.Telegram,
  ContactMethodType.Viber,
  ContactMethodType.Email,
]

export const CONTACT_METHOD_LABEL_KEY: Record<ContactMethodType, TranslationKey> = {
  [ContactMethodType.Phone]: 'account.contacts.methodPhone',
  [ContactMethodType.WhatsApp]: 'account.contacts.methodWhatsApp',
  [ContactMethodType.Telegram]: 'account.contacts.methodTelegram',
  [ContactMethodType.Viber]: 'account.contacts.methodViber',
  [ContactMethodType.Email]: 'account.contacts.methodEmail',
}

/** Подпись поля значения меняется вместе со способом: «Номер телефона» → «Адрес почты» →
 * «Имя пользователя Telegram». Общее «Значение» не сказало бы, что именно вводить. */
export const CONTACT_VALUE_LABEL_KEY: Record<ContactMethodType, TranslationKey> = {
  [ContactMethodType.Phone]: 'account.contacts.valueLabelPhone',
  [ContactMethodType.WhatsApp]: 'account.contacts.valueLabelPhone',
  [ContactMethodType.Telegram]: 'account.contacts.valueLabelTelegram',
  [ContactMethodType.Viber]: 'account.contacts.valueLabelPhone',
  [ContactMethodType.Email]: 'account.contacts.valueLabelEmail',
}

/** Мобильная клавиатура под способ: цифровая для номера, почтовая для адреса. */
export function contactInputMode(type: ContactMethodType): 'tel' | 'email' | 'text' {
  if (type === ContactMethodType.Email) return 'email'
  return isPhoneLike(type) ? 'tel' : 'text'
}

/** `autocomplete` — для телефона и почты браузер знает, что подставлять; у мессенджеров такого
 * поля в спецификации нет, и врать ему `name` было бы хуже, чем молчать. */
export function contactAutoComplete(type: ContactMethodType): string {
  if (type === ContactMethodType.Email) return 'email'
  return isPhoneLike(type) ? 'tel' : 'off'
}

/**
 * Значение из профиля для кнопки «Заполнить из профиля»: телефон для телефонных способов и
 * Telegram, почта — для почты.
 *
 * `User.PhoneNumber` хранится БЕЗ «+» (формат `api/Account/Phone`), а контакт требует его —
 * отсюда явная склейка. `null` означает «в профиле этого нет»: поле останется пустым, но имя и
 * фамилия всё равно подставятся, ради них кнопку чаще всего и нажимают.
 */
export function profileValueForType(
  type: ContactMethodType,
  profile: { email: string; phoneNumber: string },
): string | null {
  if (type === ContactMethodType.Email) return profile.email || null
  return profile.phoneNumber ? `+${profile.phoneNumber}` : null
}
