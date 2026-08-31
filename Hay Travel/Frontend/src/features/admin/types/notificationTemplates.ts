/**
 * Wire-типы `api/NotificationTemplates` — экран «Notification Templates» (2026-08-31),
 * открытая CRUD-библиотека шаблонов Email/Telegram. Отдельно от `types/notifications.ts`
 * (закрытые 5 событий «Настроек уведомлений», которые теперь лишь ССЫЛАЮТСЯ на шаблон
 * отсюда по id) — та же причина разделения, что у `types/roles.ts` vs `types/users.ts`.
 */

import { NotificationPlatform, EmailActionKey } from './notifications'

export { NotificationPlatform }

/** Сущность, чьи поля доступны как мердж-поля (Data Fields) в редакторе — определяет, какой
 * каталог `availablePlaceholders` отдаст сервер. `None` — свой фиксированный набор токенов
 * (auth-письма, см. `trigger`), не связанный с полями сущности. */
export const NotificationTemplateEntity = {
  None: 0,
  Order: 1,
  User: 2,
  Tour: 3,
  Employee: 4,
} as const
export type NotificationTemplateEntity =
  (typeof NotificationTemplateEntity)[keyof typeof NotificationTemplateEntity]

/** Привязка к auth-потоку, который использует этот шаблон (AuthService ищет по этому полю,
 * не по id). Обычное поле формы — НЕ признак «системного»/защищённого шаблона: имя/канал/
 * сущность редактируются свободно, единственный эффект — защита от удаления, пока назначен. */
export const NotificationTemplateTrigger = {
  None: 0,
  VerifyEmail: 1,
  ResetPassword: 2,
  EmailChangeCode: 3,
  EmailChangeConfirm: 4,
} as const
export type NotificationTemplateTrigger =
  (typeof NotificationTemplateTrigger)[keyof typeof NotificationTemplateTrigger]

/** Один пункт «Используется в» — структурные данные, не готовая строка: текст и ссылку
 * (`/admin/notifications/{eventKey}`) строит фронт из своих билингвальных copy-словарей
 * (`adminEnumsCopy.emailActionKey`/`notificationPlatform`), как и остальные подписи енамов
 * в проекте (ADR 021). `eventKey` задан -> строка события «Настроек уведомлений»; `trigger`
 * задан (и не `None`) -> auth-триггер, ссылаться некуда (нет отдельного экрана-события). */
export interface NotificationTemplateUsageInfoModel {
  eventKey: EmailActionKey | null
  platform: NotificationPlatform | null
  trigger: NotificationTemplateTrigger | null
}

export interface NotificationTemplateInfoModel {
  id: number
  name: string
  description: string | null
  channel: NotificationPlatform
  boundEntity: NotificationTemplateEntity
  trigger: NotificationTemplateTrigger
  isActive: boolean
  /** Только у `channel === Email`; у Telegram всегда пусто. */
  subject: string
  subjectEn: string
  bodyHtml: string
  bodyHtmlEn: string
  /** Только у `channel === Email` (решение 2026-08-31: JS не делаем вообще). */
  customCss: string
  /** Уже в фигурных скобках — редактор вставляет строку как есть. Каталог — по
   * `boundEntity`, не по конкретному событию: шаблон переиспользуемый. */
  availablePlaceholders: string[]
  usages: NotificationTemplateUsageInfoModel[]
}

/** Тело POST (создание) и PUT (правка) — один тип на оба случая, id приходит из маршрута. */
export interface NotificationTemplateUpdateModel {
  name: string
  description: string | null
  channel: NotificationPlatform
  boundEntity: NotificationTemplateEntity
  trigger: NotificationTemplateTrigger
  isActive: boolean
  subject: string | null
  subjectEn: string | null
  bodyHtml: string | null
  bodyHtmlEn: string | null
  customCss: string | null
}
