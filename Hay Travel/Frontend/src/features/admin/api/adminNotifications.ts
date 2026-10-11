/**
 * Admin Notifications API — `api/NotificationSettings` (редизайн 2026-08-23), гейтится ключом
 * экрана `notifications` (View на чтение, Update на PUT).
 *
 * Заменил `api/EmailTemplate`: получатели перестали быть константой кода, а событие теперь
 * сохраняется целиком (рубильники платформ + шаблон + весь набор строк-получателей).
 */

import { authFetch } from '@/shared/auth'
import type {
  EmailActionKey,
  NotificationEventInfoModel,
  NotificationEventUpdateModel,
} from '@/features/admin/types/notifications'

/** GET все 5 событий с платформами/получателями (шаблон — по ссылке `templateId`, см.
 * `types/notificationTemplates.ts`) — список раздела. */
export function getNotificationEvents(): Promise<NotificationEventInfoModel[]> {
  return authFetch<NotificationEventInfoModel[]>('api/NotificationSettings')
}

/**
 * GET одно событие. Список уже содержит всё то же самое, но карточка обязана открываться по
 * прямому URL — для этого второй эндпоинт и написан.
 *
 * Неизвестный ключ — 404 (`EmailTemplateInvalid`); не перехватывается, уходит в
 * `AdminErrorBoundary`, как `getUserDetail`/`getOrder`.
 */
export function getNotificationEvent(eventKey: EmailActionKey): Promise<NotificationEventInfoModel> {
  return authFetch<NotificationEventInfoModel>(`api/NotificationSettings/${eventKey}`)
}

/**
 * PUT — сохранение события ЦЕЛИКОМ (declarative sync): строки-получатели, которых нет в
 * `platforms[].recipients`, сервер УДАЛЯЕТ. Отправлять надо весь набор грида, включая строки с
 * источниками, которых нет в UI-чек-листе (`AdminMailbox`).
 *
 * Ответ содержит санитизированный HTML и `id` у только что созданных строк — его и надо класть
 * в baseline, иначе редактор покажет не то, что легло в БД, а следующее сохранение примет
 * правку за вставку.
 */
export function updateNotificationEvent(
  model: NotificationEventUpdateModel,
): Promise<NotificationEventInfoModel> {
  return authFetch<NotificationEventInfoModel>('api/NotificationSettings', {
    method: 'PUT',
    body: JSON.stringify(model),
  })
}
