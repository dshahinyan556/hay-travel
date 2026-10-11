import { useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import { MaintenanceFormLayout, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { AdminScreen, canCreate, canDelete, canView, ensurePermissionsReady } from '@/shared/auth'
import { deleteNotificationTemplate, getNotificationTemplates } from '@/features/admin/api/adminNotificationTemplates'
import type { NotificationTemplateInfoModel } from '@/features/admin/types/notificationTemplates'
import { NotificationTemplatesTable } from './components/NotificationTemplatesTable'
import { NotificationTemplateDeleteModal } from './components/NotificationTemplateDeleteModal'
import { notificationTemplatesCopy, notificationTemplatesErrorMessage } from './lib/notificationTemplatesCopy'

/**
 * Список шаблонов — открытый CRUD (создавать/удалять можно), в отличие от закрытого списка
 * событий «Настроек уведомлений». `MaintenanceFormLayout` с `controlZone`, по образцу
 * `RolesPage`/`UsersPage` — не no-create вариант, как у `NotificationsPage`.
 */
export async function notificationTemplatesLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.NotificationTemplates)) throw redirect('/admin')

  const templates = await getNotificationTemplates()
  return { templates }
}

export function NotificationTemplatesPage() {
  const { templates } = useLoaderData<typeof notificationTemplatesLoader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const copy = useCopy(notificationTemplatesCopy)

  const [confirmTarget, setConfirmTarget] = useState<NotificationTemplateInfoModel | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function confirmDelete() {
    if (confirmTarget === null || busyId !== null) return
    setActionError(null)
    setBusyId(confirmTarget.id)
    try {
      await deleteNotificationTemplate(confirmTarget.id)
      setConfirmTarget(null)
      await revalidator.revalidate()
    } catch (err) {
      setActionError(
        notificationTemplatesErrorMessage(copy, err, copy.errorActions.deleteTemplate(confirmTarget.name)),
      )
      setConfirmTarget(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <MaintenanceFormLayout
      title={copy.title}
      subtitle={copy.subtitle}
      controlZone={
        canCreate(AdminScreen.NotificationTemplates) && (
          <Link
            to="/admin/notification-templates/new"
            className={`ml-auto ${buttonClassName('primary', 'md')}`}
          >
            {copy.create}
          </Link>
        )
      }
      message={
        actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{actionError}</span>
          </div>
        )
      }
    >
      <NotificationTemplatesTable
        templates={templates}
        busyId={busyId}
        canDelete={canDelete(AdminScreen.NotificationTemplates)}
        onOpen={(template) => navigate(`/admin/notification-templates/${template.id}`)}
        onRequestDelete={setConfirmTarget}
      />

      <NotificationTemplateDeleteModal
        template={confirmTarget}
        pending={busyId !== null}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </MaintenanceFormLayout>
  )
}
