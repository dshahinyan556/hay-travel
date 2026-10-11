/**
 * Copy и разбор ошибок экрана «Notification Templates» (2026-08-31) — открытая CRUD-библиотека
 * шаблонов, Data Entry Form по образцу `roles/lib/rolesCopy.ts`.
 */

import { ApiError } from '@/shared/lib/http'
import { defineCopy } from '@/shared/i18n/defineCopy'

const NOTIFICATION_TEMPLATE_INVALID = 2071
const NOTIFICATION_TEMPLATE_NOT_FOUND = 2072
const NOTIFICATION_TEMPLATE_IN_USE = 2073

const ru = {
  title: 'Шаблоны уведомлений',
  subtitle:
    'Библиотека текстов писем и Telegram-сообщений. «Настройки уведомлений» ссылаются на шаблон ' +
    'отсюда — редактировать текст нужно здесь.',
  create: 'Создать шаблон',
  columnName: 'Название',
  columnChannel: 'Канал',
  columnEntity: 'Сущность',
  columnActive: 'Активен',
  columnActions: 'Действия',
  rowActionsLabel: (name: string) => `Действия для шаблона «${name}»`,
  open: 'Открыть',
  delete: 'Удалить',
  deleting: 'Удаляем…',
  deleteTitle: (name: string) => `Удалить шаблон «${name}»?`,
  deleteBody: 'Действие необратимо.',
  deleteInUseHint: 'назначен событию или auth-триггеру — сначала снимите назначение',
  cancel: 'Отмена',

  breadcrumbAria: 'Хлебные крошки',
  newTemplateTitle: 'Новый шаблон',
  subtitleDetail: 'Название, канал, привязка к сущности и текст сообщения.',
  save: 'Сохранить',
  saving: 'Сохраняем…',
  saved: 'Сохранено.',
  cancelEdits: 'Отменить правки',
  dirtyHint: 'Есть несохранённые изменения.',
  readOnlyHint: 'У вас нет права на изменение — карточку можно только смотреть.',

  nameLabel: 'Название',
  namePlaceholder: 'Например, «Подтверждение регистрации»',
  descriptionLabel: 'Описание',
  descriptionPlaceholder: 'Заметка для админов — где и зачем используется (необязательно).',
  channelLabel: 'Канал',
  boundEntityLabel: 'Сущность (мердж-поля)',
  triggerLabel: 'Системное назначение',
  triggerHint: 'Обычное поле — если шаблон должен использоваться конкретным auth-потоком.',
  activeLabel: 'Активен',

  subjectLabel: 'Тема письма',
  bodyLabel: 'Текст',
  langButton: (lang: string) => lang,
  langFallbackHint: 'Если английская версия пуста, англоязычному получателю уйдёт русская.',

  customCssLabel: 'Кастомный CSS',
  customCssHint:
    'Только для Email. JS не поддерживается. Опасные конструкции (<script>, url(), @import и т.п.) отклоняются при сохранении.',

  previewButton: 'Предпросмотр',
  previewTitle: 'Предпросмотр письма',

  usagesTitle: 'Используется в',
  usagesEmpty: 'Не назначен ни событию, ни auth-триггеру.',

  errorInvalidId: 'Некорректный идентификатор шаблона.',
  errorNotFound: 'Шаблон не найден.',
  errorActions: {
    saveTemplate: (name: string) => `сохранить шаблон «${name}»`,
    deleteTemplate: (name: string) => `удалить шаблон «${name}»`,
  },
  errorTemplateInvalid: 'Проверьте обязательные поля: название, тема (для Email) и текст.',
  errorTemplateInUse: 'Шаблон назначен событию или auth-триггеру — сначала снимите назначение.',
  errorForbidden: (action: string) => `Не удалось ${action}: недостаточно прав.`,
  errorServer: (action: string, status: number) =>
    `Не удалось ${action}: сервер вернул ошибку (${status}).`,
  errorNetwork: (action: string) =>
    `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
}

const en: { [K in keyof typeof ru]: (typeof ru)[K] } = {
  title: 'Notification templates',
  subtitle:
    'Library of email and Telegram message texts. "Notification settings" reference a template ' +
    'from here — edit the text on this screen.',
  create: 'Create template',
  columnName: 'Name',
  columnChannel: 'Channel',
  columnEntity: 'Entity',
  columnActive: 'Active',
  columnActions: 'Actions',
  rowActionsLabel: (name: string) => `Actions for template "${name}"`,
  open: 'Open',
  delete: 'Delete',
  deleting: 'Deleting…',
  deleteTitle: (name: string) => `Delete template "${name}"?`,
  deleteBody: 'This cannot be undone.',
  deleteInUseHint: 'assigned to an event or auth trigger — unassign it first',
  cancel: 'Cancel',

  breadcrumbAria: 'Breadcrumbs',
  newTemplateTitle: 'New template',
  subtitleDetail: 'Name, channel, bound entity, and the message text.',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved.',
  cancelEdits: 'Discard edits',
  dirtyHint: 'You have unsaved changes.',
  readOnlyHint: 'You cannot edit this — the card is read-only for you.',

  nameLabel: 'Name',
  namePlaceholder: 'E.g. "Registration confirmation"',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'A note for admins — where and why it is used (optional).',
  channelLabel: 'Channel',
  boundEntityLabel: 'Entity (merge fields)',
  triggerLabel: 'System assignment',
  triggerHint: 'A regular field — set it when the template should back a specific auth flow.',
  activeLabel: 'Active',

  subjectLabel: 'Email subject',
  bodyLabel: 'Body',
  langButton: (lang: string) => lang,
  langFallbackHint: 'When the English version is empty, an English-speaking recipient gets the Russian one.',

  customCssLabel: 'Custom CSS',
  customCssHint:
    'Email only. JS is not supported. Dangerous constructs (<script>, url(), @import, etc.) are rejected on save.',

  previewButton: 'Preview',
  previewTitle: 'Email preview',

  usagesTitle: 'Used in',
  usagesEmpty: 'Not assigned to any event or auth trigger.',

  errorInvalidId: 'Invalid template id.',
  errorNotFound: 'Template not found.',
  errorActions: {
    saveTemplate: (name: string) => `save the "${name}" template`,
    deleteTemplate: (name: string) => `delete the "${name}" template`,
  },
  errorTemplateInvalid: 'Check the required fields: name, subject (for Email), and body.',
  errorTemplateInUse: 'The template is assigned to an event or auth trigger — unassign it first.',
  errorForbidden: (action: string) => `Could not ${action}: you do not have permission.`,
  errorServer: (action: string, status: number) =>
    `Could not ${action}: the server returned an error (${status}).`,
  errorNetwork: (action: string) =>
    `Could not ${action}: check your connection and try again.`,
}

export const notificationTemplatesCopy = defineCopy(ru, en)
export type NotificationTemplatesCopy = ReturnType<typeof notificationTemplatesCopy>

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

export function notificationTemplatesErrorMessage(
  copy: NotificationTemplatesCopy,
  err: unknown,
  action: string,
): string {
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === NOTIFICATION_TEMPLATE_INVALID) return copy.errorTemplateInvalid
    if (code === NOTIFICATION_TEMPLATE_IN_USE) return copy.errorTemplateInUse
    if (code === NOTIFICATION_TEMPLATE_NOT_FOUND) return copy.errorNotFound
    if (err.status === 403) return copy.errorForbidden(action)
    return copy.errorServer(action, err.status)
  }
  return copy.errorNetwork(action)
}
