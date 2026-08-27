/**
 * Черновик карточки события и его перевод в/из wire-модели `api/NotificationSettings`.
 *
 * Черновик отличается от wire-модели тремя вещами:
 *  - у только что добавленных строк нет `id`, а React и патчи требуют стабильный ключ (`rowKey`);
 *  - `sortOrder` не хранится, а ВЫВОДИТСЯ из порядка строк на сохранении;
 *  - текстовые поля здесь `string`, а не `string | null` — контролируемые инпуты не любят `null`.
 *
 * Правила валидации ниже — зеркало `NotificationSettingsValidationService`: они существуют не
 * вместо серверных, а чтобы не отправлять заведомо 400-й запрос и показать ошибку у виновной
 * строки, а не общим баннером.
 */

import {
  NotificationPlatform,
  NotificationRecipientSource,
  NotificationRecipientType,
  type EmailActionKey,
  type NotificationEventInfoModel,
  type NotificationEventUpdateModel,
  type NotificationPlatformInfoModel,
  type NotificationRecipientInfoModel,
  type NotificationRecipientUpdateModel,
  type OrderLinkedRecipient,
} from '@/features/admin/types/notifications'
import type { NotificationsCopy } from './notificationsCopy'

/** Пустой документ WYSIWYG-редактора. `RichTextEditor` отдаёт `''`, но пришедший с сервера
 * шаблон вполне может содержать именно такой абзац — считаем его пустым в обе стороны. */
const EMPTY_DOCUMENT = '<p></p>'

export interface RecipientDraft {
  /** Стабильный ключ строки на время жизни формы: `row-<id>` для пришедших с сервера,
   * `new-<n>` для добавленных. НЕ уходит на сервер. */
  rowKey: string
  /** `null` — строки ещё нет в БД. */
  id: number | null
  isActive: boolean
  type: NotificationRecipientType | null
  sourceType: NotificationRecipientSource
  userId: number | null
  orderLinkedRole: OrderLinkedRecipient | null
  customEmail: string
  /** Read-only подписи с сервера (для строк с источником User, когда списка юзеров нет). */
  userFullName: string | null
  userEmail: string | null
}

export interface PlatformDraft {
  platform: NotificationPlatform
  isEnabled: boolean
  isImplemented: boolean
  /** Пустые строки у Telegram — в PUT для него всё равно поедет `null`. */
  subject: string
  subjectEn: string
  bodyHtml: string
  bodyHtmlEn: string
  availablePlaceholders: string[]
  recipients: RecipientDraft[]
}

export interface EventDraft {
  eventKey: EmailActionKey
  /** Порядок как пришёл с сервера: Email, затем Telegram. */
  platforms: PlatformDraft[]
}

/** Поля шаблона — единственная группа, которую патчат одним вызовом. */
export type TemplatePatch = Partial<Pick<PlatformDraft, 'subject' | 'subjectEn' | 'bodyHtml' | 'bodyHtmlEn'>>

/** Счётчик ключей новых строк. Модульный, а не пер-форменный: `rowKey` должен быть уникален
 * только внутри одной формы, а монотонность гарантируется дешевле любого проброса состояния. */
let newRowCounter = 0

function toRecipientDraft(recipient: NotificationRecipientInfoModel): RecipientDraft {
  return {
    rowKey: `row-${recipient.id}`,
    id: recipient.id,
    isActive: recipient.isActive,
    type: recipient.type,
    sourceType: recipient.sourceType,
    userId: recipient.userId,
    orderLinkedRole: recipient.orderLinkedRole,
    customEmail: recipient.customEmail ?? '',
    userFullName: recipient.userFullName,
    userEmail: recipient.userEmail,
  }
}

function toPlatformDraft(platform: NotificationPlatformInfoModel): PlatformDraft {
  return {
    platform: platform.platform,
    isEnabled: platform.isEnabled,
    isImplemented: platform.isImplemented,
    subject: platform.template?.subject ?? '',
    subjectEn: platform.template?.subjectEn ?? '',
    bodyHtml: platform.template?.bodyHtml ?? '',
    bodyHtmlEn: platform.template?.bodyHtmlEn ?? '',
    availablePlaceholders: platform.template?.availablePlaceholders ?? [],
    // ВСЕ строки, пришедшие с сервера, включая источники, которых нет в UI-чек-листе
    // (`AdminMailbox`): PUT — declarative sync, потерянная здесь строка будет удалена.
    recipients: platform.recipients.map(toRecipientDraft),
  }
}

export function toDraft(event: NotificationEventInfoModel): EventDraft {
  return {
    eventKey: event.eventKey,
    platforms: event.platforms.map(toPlatformDraft),
  }
}

/** `''` / `'<p></p>'` → `null`: иначе сервер сохранит пустой абзац как «перевод есть» и сломает
 * фолбэк на русскую версию. */
function htmlOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' || trimmed === EMPTY_DOCUMENT ? null : value
}

export function isEmptyHtml(value: string): boolean {
  return htmlOrNull(value) === null
}

function toRecipientUpdate(row: RecipientDraft, index: number, platform: NotificationPlatform): NotificationRecipientUpdateModel {
  return {
    id: row.id,
    isActive: row.isActive,
    // У Telegram копий/скрытых копий не бывает — сервер отбивает непустой `type` как 400.
    type: platform === NotificationPlatform.Telegram ? null : row.type,
    sourceType: row.sourceType,
    userId: row.sourceType === NotificationRecipientSource.User ? row.userId : null,
    orderLinkedRole:
      row.sourceType === NotificationRecipientSource.OrderLinked ? row.orderLinkedRole : null,
    customEmail:
      row.sourceType === NotificationRecipientSource.CustomEmail
        ? (row.customEmail.trim() || null)
        : null,
    // Порядок грида — и есть порядок; отдельного поля в UI нет.
    sortOrder: index,
  }
}

export function toUpdateModel(draft: EventDraft): NotificationEventUpdateModel {
  return {
    eventKey: draft.eventKey,
    platforms: draft.platforms.map((platform) => {
      const isEmail = platform.platform === NotificationPlatform.Email
      return {
        platform: platform.platform,
        isEnabled: platform.isEnabled,
        // Для Email поля шаблона уходят ВСЕГДА, даже когда вкладка скрыта выключенным
        // рубильником: `ValidateTemplate` не смотрит на `IsEnabled`, и `null` тут = 400.
        subject: isEmail ? platform.subject.trim() : null,
        subjectEn: isEmail ? (platform.subjectEn.trim() || null) : null,
        bodyHtml: isEmail ? platform.bodyHtml : null,
        bodyHtmlEn: isEmail ? htmlOrNull(platform.bodyHtmlEn) : null,
        recipients: platform.recipients.map((row, index) =>
          toRecipientUpdate(row, index, platform.platform),
        ),
      }
    }),
  }
}

function isRecipientEqual(a: RecipientDraft, b: RecipientDraft): boolean {
  return (
    a.id === b.id &&
    a.isActive === b.isActive &&
    a.type === b.type &&
    a.sourceType === b.sourceType &&
    a.userId === b.userId &&
    a.orderLinkedRole === b.orderLinkedRole &&
    a.customEmail === b.customEmail
  )
}

function isPlatformEqual(a: PlatformDraft, b: PlatformDraft): boolean {
  return (
    a.platform === b.platform &&
    a.isEnabled === b.isEnabled &&
    a.subject === b.subject &&
    a.subjectEn === b.subjectEn &&
    a.bodyHtml === b.bodyHtml &&
    a.bodyHtmlEn === b.bodyHtmlEn &&
    a.recipients.length === b.recipients.length &&
    a.recipients.every((row, index) => isRecipientEqual(row, b.recipients[index]))
  )
}

/** Структурное сравнение вместо `JSON.stringify`: порядок ключей в объекте не должен решать,
 * грязная форма или нет, а `availablePlaceholders`/`isImplemented` меняться не могут вовсе. */
export function isEventDraftEqual(a: EventDraft, b: EventDraft): boolean {
  return (
    a.eventKey === b.eventKey &&
    a.platforms.length === b.platforms.length &&
    a.platforms.every((platform, index) => isPlatformEqual(platform, b.platforms[index]))
  )
}

/** Новая строка грида. Для Email — `To` по умолчанию (единственное осмысленное значение
 * обязательного поля), у Telegram `type` не существует. */
export function newRecipientRow(platform: NotificationPlatform): RecipientDraft {
  newRowCounter += 1
  return {
    rowKey: `new-${newRowCounter}`,
    id: null,
    isActive: true,
    type: platform === NotificationPlatform.Email ? NotificationRecipientType.To : null,
    sourceType: NotificationRecipientSource.User,
    userId: null,
    orderLinkedRole: null,
    customEmail: '',
    userFullName: null,
    userEmail: null,
  }
}

/** Ключ дедупликации — тот же, что считает `EnsureNoDuplicates` на сервере. */
function duplicateKeyOf(row: RecipientDraft): string {
  const source =
    row.sourceType === NotificationRecipientSource.User
      ? (row.userId?.toString() ?? '')
      : row.sourceType === NotificationRecipientSource.OrderLinked
        ? (row.orderLinkedRole?.toString() ?? '')
        : row.sourceType === NotificationRecipientSource.CustomEmail
          ? row.customEmail.trim().toLowerCase()
          : ''
  return `${row.sourceType}|${source}|${row.type ?? ''}`
}

/** `null` — строка валидна. Правила зеркалят `NotificationSettingsValidationService`. */
export function recipientRowError(
  row: RecipientDraft,
  platform: NotificationPlatform,
  copy: NotificationsCopy,
): string | null {
  if (platform === NotificationPlatform.Email && row.type === null) return copy.rowErrorTypeRequired

  switch (row.sourceType) {
    case NotificationRecipientSource.User:
      return row.userId === null ? copy.rowErrorUserRequired : null
    case NotificationRecipientSource.OrderLinked:
      return row.orderLinkedRole === null ? copy.rowErrorRoleRequired : null
    case NotificationRecipientSource.CustomEmail: {
      const value = row.customEmail.trim()
      return value === '' || !value.includes('@') ? copy.rowErrorEmailInvalid : null
    }
    case NotificationRecipientSource.AdminMailbox:
      // Адрес берётся из конфигурации сервера — проверять нечего.
      return null
  }
}

export interface DraftValidation {
  /** Пер-строчные ошибки всех платформ, ключ — `rowKey`. */
  rowErrors: Record<string, string>
  /** Ошибка шаблона Email или `null`. Проверяется НЕЗАВИСИМО от `isEnabled`. */
  templateError: string | null
}

export function validateDraft(draft: EventDraft, copy: NotificationsCopy): DraftValidation {
  const rowErrors: Record<string, string> = {}
  let templateError: string | null = null

  for (const platform of draft.platforms) {
    if (platform.platform === NotificationPlatform.Email) {
      if (platform.subject.trim() === '' || isEmptyHtml(platform.bodyHtml)) {
        templateError = copy.errorTemplateInvalid
      }
    }

    const seen = new Set<string>()
    for (const row of platform.recipients) {
      const error = recipientRowError(row, platform.platform, copy)
      if (error !== null) {
        rowErrors[row.rowKey] = error
        continue
      }
      const key = duplicateKeyOf(row)
      if (seen.has(key)) rowErrors[row.rowKey] = copy.rowErrorDuplicate
      else seen.add(key)
    }
  }

  return { rowErrors, templateError }
}

/**
 * Подпись события. Берётся из своего словаря (`adminEnumsCopy.emailActionKey`), потому что панель
 * билингвальна, а серверный `DisplayName` приходит по-русски всегда; он остаётся фолбэком на
 * случай, если бэкенд заведёт пятое событие раньше фронта.
 */
export function eventLabelOf(
  event: Pick<NotificationEventInfoModel, 'eventKey' | 'displayName'>,
  labels: Record<number, string>,
): string {
  return labels[event.eventKey] ?? event.displayName
}

/** Активных получателей во всех платформах события — колонка списка. */
export function activeRecipientCount(event: NotificationEventInfoModel): number {
  return event.platforms.reduce(
    (total, platform) => total + platform.recipients.filter((row) => row.isActive).length,
    0,
  )
}

/** Черновик одной платформы или `undefined`, если сервер её не прислал. */
export function platformOf(draft: EventDraft, platform: NotificationPlatform): PlatformDraft | undefined {
  return draft.platforms.find((candidate) => candidate.platform === platform)
}
