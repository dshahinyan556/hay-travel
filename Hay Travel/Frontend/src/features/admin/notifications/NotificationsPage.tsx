import { redirect, useLoaderData, useNavigate } from 'react-router'
import { AdminScreen, canView, ensurePermissionsReady } from '@/shared/auth'
import { MaintenanceFormLayout } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getNotificationEvents } from '@/features/admin/api/adminNotifications'
import { NotificationEventsTable } from './components/NotificationEventsTable'
import { notificationsCopy } from './lib/notificationsCopy'

/**
 * Загружает все 4 события уведомлений — гейтится ключом экрана `notifications`, как и всё
 * остальное (решение Давида 2026-08-22): роль получает раздел строкой своей матрицы, а не
 * захардкоженным исключением. Та же конвенция redirect-вместо-403, что у `settingsLoader`.
 */
export async function notificationsLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Notifications)) throw redirect('/admin')

  const events = await getNotificationEvents()
  return { events }
}

/**
 * Шаблон B — «Форма обслуживания» (`MaintenanceFormLayout`) в «no-create» варианте, как у
 * `UsersPage`: набор записей закрыт кодом (пятое событие создать нельзя, существующее — удалить),
 * поэтому `controlZone` пуст, а не содержит кнопку «Добавить».
 *
 * Экран перестал быть «одной записью» (был шаблон C с полосой личности): теперь это список из
 * четырёх событий, у каждого своя карточка по своему URL — `/admin/notifications/:eventKey`.
 */
export function NotificationsPage() {
  const copy = useCopy(notificationsCopy)
  const { events } = useLoaderData<typeof notificationsLoader>()
  const navigate = useNavigate()

  return (
    <MaintenanceFormLayout title={copy.title} subtitle={copy.subtitle}>
      {/* Пустого состояния нет: 4 события засеяны миграцией и удалить их нечем. */}
      <NotificationEventsTable
        events={events}
        onOpen={(event) => void navigate(`/admin/notifications/${event.eventKey}`)}
      />
    </MaintenanceFormLayout>
  )
}
