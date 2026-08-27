/**
 * Wire-типы `api/NotificationSettings` — раздел «Настройки уведомлений» (редизайн 2026-08-23).
 * Заменяют плоские `EmailTemplateInfoModel`/`EmailTemplateUpdateModel` удалённого
 * `api/EmailTemplate`.
 *
 * Живут в `features/admin/types`, а не в `shared/types`: раздел админский, никакая другая фича
 * этих типов не потребляет (то же правило, что у `features/admin/types/roles.ts`).
 *
 * `bodyHtml`/`bodyHtmlEn` санитизируются НА СЕРВЕРЕ при сохранении (allow-list, ADR 026), и
 * ответ PUT содержит уже очищенный HTML — его и надо принимать за новый baseline, иначе
 * редактор покажет не то, что легло в БД.
 */

export const EmailActionKey = {
  OrderCreated: 1,
  OrderAssignEmployee: 2,
  OrderUnassignEmployee: 3,
  OrderSendToClient: 4,
} as const
export type EmailActionKey = (typeof EmailActionKey)[keyof typeof EmailActionKey]

/** Порядок строк грида и вкладок — фиксированный, а не по значению енама. */
export const EMAIL_ACTION_KEY_ORDER: readonly EmailActionKey[] = [
  EmailActionKey.OrderCreated,
  EmailActionKey.OrderAssignEmployee,
  EmailActionKey.OrderUnassignEmployee,
  EmailActionKey.OrderSendToClient,
]

/** Гейт лоадера карточки: набор событий закрыт кодом, чужой ключ — 400 ещё до запроса. */
export function isEmailActionKey(value: number): value is EmailActionKey {
  return EMAIL_ACTION_KEY_ORDER.includes(value as EmailActionKey)
}

export const NotificationPlatform = { Email: 1, Telegram: 2 } as const
export type NotificationPlatform = (typeof NotificationPlatform)[keyof typeof NotificationPlatform]

/** Роль адреса в письме. Только для Email: у Telegram копий/скрытых копий не бывает. */
export const NotificationRecipientType = { To: 1, Cc: 2, Bcc: 3 } as const
export type NotificationRecipientType =
  (typeof NotificationRecipientType)[keyof typeof NotificationRecipientType]

/** Откуда берётся адрес. `AdminMailbox` — системный ящик из конфигурации сервера; строка с ним
 * засеяна миграцией на событие «Новая бронь с сайта» и обязана переживать сохранение: PUT —
 * declarative sync, строку, которой нет в payload, сервер удаляет. */
export const NotificationRecipientSource = {
  User: 1,
  OrderLinked: 2,
  CustomEmail: 3,
  AdminMailbox: 4,
} as const
export type NotificationRecipientSource =
  (typeof NotificationRecipientSource)[keyof typeof NotificationRecipientSource]

/** Закрытый список ролей, привязанных к заказу. Админа здесь нет — он выбирается обычной
 * строкой с источником `User`. «Исполнитель заказа» при мульти-исполнителях = письмо КАЖДОМУ
 * активному исполнителю отдельно (это делает сервер). */
export const OrderLinkedRecipient = { Client: 1, Employee: 2 } as const
export type OrderLinkedRecipient = (typeof OrderLinkedRecipient)[keyof typeof OrderLinkedRecipient]

/* ---------------------------------- Info (GET) --------------------------------- */

export interface NotificationTemplateInfoModel {
  subject: string
  /** `null` — перевод не сделан; письмо англоязычному получателю уйдёт RU-версией. */
  subjectEn: string | null
  bodyHtml: string
  bodyHtmlEn: string | null
  /** Уже в фигурных скобках — вставляются в редактор как есть. */
  availablePlaceholders: string[]
}

export interface NotificationRecipientInfoModel {
  id: number
  isActive: boolean
  /** `null` у Telegram. */
  type: NotificationRecipientType | null
  sourceType: NotificationRecipientSource
  userId: number | null
  /** Денормализовано сервером — грид показывает read-only, даже если списка юзеров нет. */
  userFullName: string | null
  userEmail: string | null
  orderLinkedRole: OrderLinkedRecipient | null
  customEmail: string | null
  sortOrder: number
}

export interface NotificationPlatformInfoModel {
  platform: NotificationPlatform
  isEnabled: boolean
  /** `false` у Telegram: канал настраивается, отправки пока нет. */
  isImplemented: boolean
  /** Только у Email; у Telegram `null`. */
  template: NotificationTemplateInfoModel | null
  recipients: NotificationRecipientInfoModel[]
}

export interface NotificationEventInfoModel {
  eventKey: EmailActionKey
  /** Русская подпись из код-реестра сервера. Используется только как фолбэк: панель билингвальна,
   * подписи событий берутся из `adminEnumsCopy.emailActionKey`. */
  displayName: string
  platforms: NotificationPlatformInfoModel[]
}

/* --------------------------------- Update (PUT) -------------------------------- */

export interface NotificationRecipientUpdateModel {
  /** `null` — новая строка. */
  id: number | null
  isActive: boolean
  type: NotificationRecipientType | null
  sourceType: NotificationRecipientSource
  userId: number | null
  orderLinkedRole: OrderLinkedRecipient | null
  customEmail: string | null
  sortOrder: number
}

/** Шаблонные поля для Telegram игнорируются сервером, но для Email присылаются ВСЕГДА,
 * даже когда вкладка Email скрыта выключенным рубильником: `ValidateTemplate` требует непустые
 * `subject`/`bodyHtml` независимо от `IsEnabled`, и `null` тут = 400 (`EmailTemplateInvalid`). */
export interface NotificationPlatformUpdateModel {
  platform: NotificationPlatform
  isEnabled: boolean
  subject: string | null
  subjectEn: string | null
  bodyHtml: string | null
  bodyHtmlEn: string | null
  /** ПОЛНЫЙ набор строк грида: чего нет в списке — сервер удалит. */
  recipients: NotificationRecipientUpdateModel[]
}

export interface NotificationEventUpdateModel {
  eventKey: EmailActionKey
  platforms: NotificationPlatformUpdateModel[]
}
