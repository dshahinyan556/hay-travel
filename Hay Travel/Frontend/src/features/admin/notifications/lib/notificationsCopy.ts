/**
 * Copy и разбор ошибок раздела «Настройки уведомлений» (редизайн 2026-08-23) — форма та же, что
 * у `orders/lib/ordersCopy.ts`: `defineCopy(ru, en)` + чистая функция маппинга кодов ошибок.
 *
 * Здесь живёт ТОЛЬКО интерфейс. Сами шаблоны — тема, текст письма, токены-плейсхолдеры, адреса
 * получателей — приходят с сервера и являются контентом администратора; этот файл их не трогает.
 *
 * Подписи событий/платформ/типов получателей — не здесь, а в `lib/adminEnumsCopy.ts`: это
 * подписи енамов, у них своё место (то же правило, что у `employeeJobRole`).
 */

import { ApiError } from '@/shared/lib/http'
import { defineCopy } from '@/shared/i18n/defineCopy'

/** Пустая тема/тело письма ИЛИ неизвестный ключ события. */
const EMAIL_TEMPLATE_INVALID = 2030
/** Невалидная строка получателя или дубликат внутри платформы. */
const NOTIFICATION_RECIPIENT_INVALID = 2038

const ru = {
  /* ------------------------------- Список событий ------------------------------ */
  title: 'Настройки уведомлений',
  subtitle:
    'По каждому действию с заказом: какими каналами уходит уведомление, кому именно и с каким ' +
    'текстом. Откройте событие, чтобы настроить его.',
  columnEvent: 'Событие',
  columnPlatforms: 'Платформы',
  columnRecipients: 'Получателей',
  platformsNone: '—',
  rowOpenAria: (name: string) => `Открыть настройки события «${name}»`,

  /* ------------------------------ Карточка события ----------------------------- */
  breadcrumbAria: 'Хлебные крошки',
  eventSubtitle:
    'Каналы доставки, получатели и текст письма для этого события. Сохранение записывает всю ' +
    'карточку целиком.',
  tabsLabel: 'Разделы настроек события',
  tabPlatforms: 'Платформы',
  tabEmailSettings: 'Настройки Email',
  tabTelegramSettings: 'Настройки Telegram',
  save: 'Сохранить',
  saving: 'Сохраняем…',
  saved: 'Сохранено.',
  cancelEdits: 'Отменить правки',
  dirtyHint: 'Есть несохранённые изменения.',
  readOnlyHint: 'У вас нет права на изменение этого раздела — карточку можно только смотреть.',

  /* -------------------------------- Платформы ---------------------------------- */
  platformColumnActive: 'Включено',
  platformColumnName: 'Платформа',
  platformColumnStatus: 'Состояние',
  platformWorking: 'Отправка работает',
  platformSetupOnly: 'Настраивается, сообщения пока не отправляются',
  platformToggleAria: (name: string) => `Включить платформу «${name}»`,
  telegramNotImplementedBanner:
    'Telegram сейчас только настраивается: получатели сохраняются, но сообщения не уходят.',

  /* -------------------------------- Получатели --------------------------------- */
  recipientsTitle: 'Получатели',
  colActive: 'Активен',
  colType: 'Тип',
  colSource: 'Источник',
  colRecipient: 'Получатель',
  rowTitle: (index: number) => `Получатель ${index}`,
  rowActiveAria: (index: number) => `Получатель ${index}: активен`,
  rowTypeAria: (index: number) => `Получатель ${index}: тип адреса`,
  rowSourceAria: (index: number) => `Получатель ${index}: источник адреса`,
  rowRecipientAria: (index: number) => `Получатель ${index}: кому`,
  addRecipient: 'Добавить получателя',
  removeRow: 'Удалить',
  removeRowAria: (index: number) => `Удалить получателя ${index}`,
  recipientsEmptyTitle: 'Получателей нет',
  recipientsEmptyBody:
    'Ни одного активного получателя — по этому событию сообщение не уходит вообще.',
  customEmailPlaceholder: 'name@example.com',
  adminMailboxValue: 'Служебный ящик администратора',
  adminMailboxHint:
    'Адрес задаётся в конфигурации сервера (Email:AdminNotificationEmail) и в панели не правится.',
  usersNoAccessHint: 'Нет доступа к списку пользователей — строку видно, но выбрать другого нельзя.',
  userUnavailable: 'Пользователь недоступен',
  orderLinkedEmployeeNote: 'Письмо уйдёт каждому исполнителю строки заказа отдельно.',

  /* --------------------------------- Шаблон ------------------------------------ */
  templateTitle: 'Текст письма',
  subjectLabel: 'Тема письма',
  bodyLabel: 'Текст письма',
  bodyPlaceholder: 'Текст письма. Вставьте нужные поля через «Вставить поле».',
  bodyInLangAria: (lang: string) => `Текст письма, ${lang}`,
  placeholdersHint: 'Доступные поля — через «Вставить поле» в панели редактора.',
  translationFallbackHint:
    'Если английская версия пуста, англоязычному получателю уйдёт русская — по каждому полю ' +
    'отдельно.',
  langRu: 'Русский',
  langEn: 'English',

  /* --------------------------------- Ошибки ------------------------------------ */
  errorActions: {
    saveEvent: (name: string) => `сохранить событие «${name}»`,
  },
  errorInvalidEventKey: 'Неизвестное событие уведомления.',
  errorTemplateInvalid: 'Тема и текст письма не могут быть пустыми.',
  errorRecipientInvalid: 'Один из получателей заполнен неверно или повторяется.',
  errorFixRowsBeforeSave: 'Исправьте отмеченные строки — до этого сохранить не получится.',
  rowErrorTypeRequired: 'Укажите тип адреса: Кому, Копия или Скрытая копия.',
  rowErrorUserRequired: 'Выберите пользователя.',
  rowErrorRoleRequired: 'Выберите роль, привязанную к заказу.',
  rowErrorEmailInvalid: 'Укажите корректный адрес электронной почты.',
  rowErrorDuplicate: 'Такой получатель уже есть в списке этой платформы.',
  errorForbidden: (action: string) => `Не удалось ${action}: недостаточно прав.`,
  errorServer: (action: string, status: number) =>
    `Не удалось ${action}: сервер вернул ошибку (${status}).`,
  errorNetwork: (action: string) =>
    `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
}

const en: { [K in keyof typeof ru]: (typeof ru)[K] } = {
  title: 'Notification settings',
  subtitle:
    'For every order action: which channels deliver the notification, who exactly receives it ' +
    'and what it says. Open an event to configure it.',
  columnEvent: 'Event',
  columnPlatforms: 'Platforms',
  columnRecipients: 'Recipients',
  platformsNone: '—',
  rowOpenAria: (name: string) => `Open the “${name}” event settings`,

  breadcrumbAria: 'Breadcrumbs',
  eventSubtitle:
    'Delivery channels, recipients and the email text for this event. Saving writes the whole ' +
    'card at once.',
  tabsLabel: 'Event settings sections',
  tabPlatforms: 'Platforms',
  tabEmailSettings: 'Email settings',
  tabTelegramSettings: 'Telegram settings',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved.',
  cancelEdits: 'Discard edits',
  dirtyHint: 'You have unsaved changes.',
  readOnlyHint: 'You cannot edit this section — the card is read-only for you.',

  platformColumnActive: 'Enabled',
  platformColumnName: 'Platform',
  platformColumnStatus: 'Status',
  platformWorking: 'Delivery works',
  platformSetupOnly: 'Being set up, messages are not sent yet',
  platformToggleAria: (name: string) => `Enable the “${name}” platform`,
  telegramNotImplementedBanner:
    'Telegram is still being set up: recipients are stored, but no messages are sent.',

  recipientsTitle: 'Recipients',
  colActive: 'Active',
  colType: 'Type',
  colSource: 'Source',
  colRecipient: 'Recipient',
  rowTitle: (index: number) => `Recipient ${index}`,
  rowActiveAria: (index: number) => `Recipient ${index}: active`,
  rowTypeAria: (index: number) => `Recipient ${index}: address type`,
  rowSourceAria: (index: number) => `Recipient ${index}: address source`,
  rowRecipientAria: (index: number) => `Recipient ${index}: who`,
  addRecipient: 'Add a recipient',
  removeRow: 'Remove',
  removeRowAria: (index: number) => `Remove recipient ${index}`,
  recipientsEmptyTitle: 'No recipients',
  recipientsEmptyBody: 'No active recipient — nothing is sent for this event at all.',
  customEmailPlaceholder: 'name@example.com',
  adminMailboxValue: 'Administrator’s service mailbox',
  adminMailboxHint:
    'The address comes from the server configuration (Email:AdminNotificationEmail) and is not ' +
    'editable in the panel.',
  usersNoAccessHint: 'No access to the user list — the row is visible, but nobody else can be picked.',
  userUnavailable: 'User unavailable',
  orderLinkedEmployeeNote: 'The email goes to every employee of the order line separately.',

  templateTitle: 'Email body',
  subjectLabel: 'Email subject',
  bodyLabel: 'Email body',
  bodyPlaceholder: 'Email body. Insert the fields you need with “Insert a field”.',
  bodyInLangAria: (lang: string) => `Email body, ${lang}`,
  placeholdersHint: 'Available fields — through “Insert a field” in the editor toolbar.',
  translationFallbackHint:
    'When the English version is empty, an English-speaking recipient gets the Russian one — ' +
    'field by field.',
  langRu: 'Русский',
  langEn: 'English',

  errorActions: {
    saveEvent: (name: string) => `save the “${name}” event`,
  },
  errorInvalidEventKey: 'Unknown notification event.',
  errorTemplateInvalid: 'The subject and the body of the email cannot be empty.',
  errorRecipientInvalid: 'One of the recipients is filled in incorrectly or listed twice.',
  errorFixRowsBeforeSave: 'Fix the marked rows — saving is blocked until then.',
  rowErrorTypeRequired: 'Pick the address type: To, Cc or Bcc.',
  rowErrorUserRequired: 'Pick a user.',
  rowErrorRoleRequired: 'Pick an order-linked role.',
  rowErrorEmailInvalid: 'Enter a valid email address.',
  rowErrorDuplicate: 'This recipient is already listed for this platform.',
  errorForbidden: (action: string) => `Could not ${action}: you do not have permission.`,
  errorServer: (action: string, status: number) =>
    `Could not ${action}: the server returned an error (${status}).`,
  errorNetwork: (action: string) =>
    `Could not ${action}: check your connection and try again.`,
}

export const notificationsCopy = defineCopy(ru, en)
export type NotificationsCopy = ReturnType<typeof notificationsCopy>

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/** Pure — the caller resolves `copy` against the current locale and passes it in. */
export function notificationsErrorMessage(
  copy: NotificationsCopy,
  err: unknown,
  action: string,
): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === EMAIL_TEMPLATE_INVALID) return copy.errorTemplateInvalid
    if (code === NOTIFICATION_RECIPIENT_INVALID) return copy.errorRecipientInvalid
    if (err.status === 403) return copy.errorForbidden(action)
    return copy.errorServer(action, err.status)
  }
  return copy.errorNetwork(action)
}
