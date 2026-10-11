/**
 * Контакт для связи с клиентом (спека 016 / ADR 032) — зеркало backend `ContactMethodType`
 * (`ATTours.Common/Enums/ContactMethodType.cs`) и обеих его DTO-форм.
 *
 * Зачем контакт вообще существует отдельно от профиля: человек регистрируется с одним номером,
 * прилетает в Армению и покупает местную симку — менеджер не должен гадать, куда звонить. Поэтому
 * контакт обязателен у КАЖДОГО заказа, а не подтягивается молча из `User.PhoneNumber`.
 *
 * Контакт «полный» (имя + фамилия + способ + значение), потому что заказ оформляет не всегда тот,
 * с кем надо связаться: жена бронирует, звонить мужу.
 *
 * Лист-модуль без импортов: на него опираются и корзина, и конструктор трансфера, и личный
 * кабинет — та же причина, что у `employeeRole.ts`.
 */

export const ContactMethodType = {
  Phone: 1,
  WhatsApp: 2,
  Telegram: 3,
  Viber: 4,
  Email: 5,
} as const

export type ContactMethodType = (typeof ContactMethodType)[keyof typeof ContactMethodType]

/**
 * Пределы — зеркало `ATTours.Common/Constants/ContactLimits.cs`. Держим здесь, чтобы форма
 * останавливала человека ДО отправки; сервер проверяет ровно то же самое сам (коды 2060-2065),
 * фронтовая проверка тут ради формулировки ошибки, а не вместо серверной.
 */
export const ContactLimits = {
  minOrderContacts: 1,
  maxOrderContacts: 3,
  maxProfileContacts: 20,
  maxValueLength: 254,
  maxNameLength: 128,
} as const

/** Сохранённый контакт из справочника профиля — `GET api/Account/Contacts`. */
export interface ContactMethodModel {
  id: number
  type: ContactMethodType
  value: string
  /** Обязательно: без имени в заказе стоял бы безымянный номер. */
  firstName: string
  /** НЕОБЯЗАТЕЛЬНА (решение Давида, 2026-08-29). `null` — «не указана», а не «неизвестна»:
   *  в интерфейсе она просто не выводится, и склеивать имя с фамилией надо через отбор
   *  непустых, иначе получится «Ани » с висящим пробелом. */
  lastName: string | null
  /** Основной — тот, кого менеджер видит первым. В профиле он ровно один. */
  isPrimary: boolean
}

/**
 * Контакт, уезжающий в заказ (`OrderCreateModel.Contacts` / `CreateTransferRequest`).
 *
 * Без `id`: в заказ уходит СНИМОК значений, а не ссылка на запись справочника (ADR 032 Р1).
 * Поэтому правка или удаление контакта в профиле не меняет уже созданные заказы — там остаётся
 * тот номер, по которому реально договаривались.
 */
export interface OrderContactInput {
  type: ContactMethodType
  value: string
  firstName: string
  /** Как и в справочнике — необязательна. */
  lastName: string | null
  isPrimary: boolean
}

/** Контакт в уже созданном заказе — приходит в `OrderInfoModel.contacts`, основной первым. */
export interface OrderContactModel extends OrderContactInput {
  id: number
  sortOrder: number
}
