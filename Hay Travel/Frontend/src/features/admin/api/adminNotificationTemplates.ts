/**
 * Admin Notification Templates API — `api/NotificationTemplates` (2026-08-31), гейтится
 * ключом экрана `notification-templates` (View/Create/Update/Delete). Открытый CRUD —
 * в отличие от `adminNotifications.ts` (закрытые 5 событий, только View/Update).
 */

import { authFetch } from '@/shared/auth'
import type {
  NotificationPlatform,
  NotificationTemplateEntity,
  NotificationTemplateInfoModel,
  NotificationTemplateUpdateModel,
} from '@/features/admin/types/notificationTemplates'

/** GET список, опционально отфильтрованный по каналу/сущности — используется и списком
 * экрана целиком, и пикером выбора шаблона на карточке события «Настроек уведомлений». */
export function getNotificationTemplates(filter?: {
  channel?: NotificationPlatform
  boundEntity?: NotificationTemplateEntity
}): Promise<NotificationTemplateInfoModel[]> {
  const params = new URLSearchParams()
  if (filter?.channel !== undefined) params.set('channel', String(filter.channel))
  if (filter?.boundEntity !== undefined) params.set('boundEntity', String(filter.boundEntity))

  const query = params.toString()
  return authFetch<NotificationTemplateInfoModel[]>(
    `api/NotificationTemplates${query ? `?${query}` : ''}`,
  )
}

/** GET одна запись — карточка. Неизвестный id — 404 (`NotificationTemplateNotFound`), не
 * перехватывается, уходит в `AdminErrorBoundary`, как `getUserDetail`/`getOrder`. */
export function getNotificationTemplate(id: number): Promise<NotificationTemplateInfoModel> {
  return authFetch<NotificationTemplateInfoModel>(`api/NotificationTemplates/${id}`)
}

export function createNotificationTemplate(
  model: NotificationTemplateUpdateModel,
): Promise<NotificationTemplateInfoModel> {
  return authFetch<NotificationTemplateInfoModel>('api/NotificationTemplates', {
    method: 'POST',
    body: JSON.stringify(model),
  })
}

/** Ответ содержит уже санитизированный HTML — принимать его за новый baseline редактора. */
export function updateNotificationTemplate(
  id: number,
  model: NotificationTemplateUpdateModel,
): Promise<NotificationTemplateInfoModel> {
  return authFetch<NotificationTemplateInfoModel>(`api/NotificationTemplates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}

/** 409 (`NotificationTemplateInUse`) — шаблон назначен событию или auth-триггеру, сначала
 * снять назначение (см. `usages` карточки). */
export function deleteNotificationTemplate(id: number): Promise<void> {
  return authFetch<void>(`api/NotificationTemplates/${id}`, { method: 'DELETE' })
}
