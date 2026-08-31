/**
 * `api/Account/Contacts` — справочник способов связи в личном кабинете (спека 016 / ADR 032).
 *
 * Отдельный модуль, а не пять функций в `api/account.ts` — по той же причине, что `telegram.ts` и
 * `emailChange.ts`: это самостоятельный CRUD со своими формами ответа, а `account.ts` остаётся
 * двухвызовной поверхностью профиля, как обещает его собственный комментарий.
 *
 * Все пять эндпоинтов self-service: id пользователя сервер берёт из токена и в теле/квери его нет,
 * поэтому чужой контакт отсюда не достать (та же гарантия, что у остального `AccountController`).
 *
 * Порядок списка задаёт СЕРВЕР (основной первым) и фронт его не пересортировывает: тот же
 * справочник в том же порядке предзаполняет форму заказа, и два разных порядка на двух экранах
 * читались бы как разные данные.
 */

import { authFetch } from '@/shared/auth'
import type { ContactMethodModel, ContactMethodType } from '@/shared/types/contact'

/** Тело создания/правки. `isPrimary: true` снимает флаг у остальных строк — это делает сервер. */
export interface ContactMethodInput {
  type: ContactMethodType
  value: string
  firstName: string
  lastName: string
  isPrimary: boolean
}

/** `GET api/Account/Contacts` — весь справочник, основной первым. */
export function getContacts(): Promise<ContactMethodModel[]> {
  return authFetch<ContactMethodModel[]>('api/Account/Contacts')
}

/** `POST api/Account/Contacts` — возвращает созданную строку уже нормализованной сервером. */
export function createContact(input: ContactMethodInput): Promise<ContactMethodModel> {
  return authFetch<ContactMethodModel>('api/Account/Contacts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * `PUT api/Account/Contacts`.
 *
 * Снять флаг «основной» этим вызовом НЕЛЬЗЯ (сервер обрабатывает только переход false -> true):
 * иначе в справочнике не осталось бы основного вовсе. Понижение делается повышением другого —
 * `setPrimaryContact`.
 */
export function updateContact(id: number, input: ContactMethodInput): Promise<ContactMethodModel> {
  return authFetch<ContactMethodModel>('api/Account/Contacts', {
    method: 'PUT',
    body: JSON.stringify({ id, ...input }),
  })
}

/**
 * `DELETE api/Account/Contacts?id=`.
 *
 * Удаление физическое, и это безопасно: в заказах лежит снимок значений, а не ссылка на эту
 * строку (ADR 032 Р1) — уже созданные заказы удаление не трогает.
 */
export function deleteContact(id: number): Promise<void> {
  return authFetch<void>(`api/Account/Contacts?id=${id}`, { method: 'DELETE' })
}

/**
 * `PATCH api/Account/Contacts/SetPrimary?id=` — возвращает справочник ЦЕЛИКОМ.
 *
 * Смена основного меняет флаг сразу у двух записей и порядок всего списка, поэтому сервер отдаёт
 * новый список: экрану не нужен второй запрос «а кто теперь основной».
 */
export function setPrimaryContact(id: number): Promise<ContactMethodModel[]> {
  return authFetch<ContactMethodModel[]>(`api/Account/Contacts/SetPrimary?id=${id}`, {
    method: 'PATCH',
  })
}

/**
 * Профиль владельца аккаунта — РОВНО те четыре поля, которые нужны кнопке «Заполнить из профиля».
 *
 * Узкий структурный тип, а не `UserInfoModel`: блоку контактов не нужны ни роли, ни флаги, а
 * узкая форма делает его пригодным и для кабинета (`UserInfoModel` ей соответствует и передаётся
 * как есть), и для корзины, которая профиль догружает сама.
 */
export interface ContactProfile {
  firstName: string
  /** Как и у контакта — может отсутствовать. */
  lastName: string | null
  email: string
  /** В формате бэкенда, БЕЗ ведущего «+» (`api/Account/Phone`). Пустая строка — номера нет. */
  phoneNumber: string
}

/**
 * `GET api/Account/Me`, суженный до `ContactProfile`.
 *
 * Да, это второй вызов того же эндпоинта, что и `features/auth/account/api/account.ts#getMe`, и
 * это сознательно: `shared` не может импортировать `features`, а профильный вызов кабинета
 * возвращает всю `UserInfoModel` целиком. Дублируется здесь ОДНА строка адреса, а не разбор
 * ответа, — и сужение типа гарантирует, что блок контактов не начнёт зависеть от полей, которые
 * его не касаются.
 *
 * Требует сессии: у анонимного посетителя корзины он не вызывается вовсе.
 */
export function getContactProfile(): Promise<ContactProfile> {
  return authFetch<ContactProfile>('api/Account/Me')
}
