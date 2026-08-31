import { Link, redirect, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { DataEntryScreenLayout } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getStoredLocale } from '@/shared/lib/locale'
import { AdminScreen, canView, ensurePermissionsReady } from '@/shared/auth'
import { getNotificationTemplate } from '@/features/admin/api/adminNotificationTemplates'
import { NotificationPlatform } from '@/features/admin/types/notificationTemplates'
import { NotificationTemplateForm } from './components/NotificationTemplateForm'
import { notificationTemplatesCopy } from './lib/notificationTemplatesCopy'

/**
 * Карточка одного шаблона, и форма создания — `id === 'new'`, тот же приём, что у
 * `RoleDetailPage` (отдельного роута `/new` со своей формой не заводим).
 *
 * `?channel=` (из `TemplatePicker`'s «Создать шаблон») предзаполняет канал новой записи —
 * читается прямо из `URLSearchParams`, лоадеру он не нужен.
 */
export async function notificationTemplateDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.NotificationTemplates)) throw redirect('/admin')

  const copy = notificationTemplatesCopy(getStoredLocale())

  const isNew = params.id === 'new'
  const id = isNew ? null : Number(params.id)
  if (!isNew && (id === null || !Number.isInteger(id) || id <= 0)) {
    throw new Response(copy.errorInvalidId, { status: 400 })
  }

  const template = isNew ? null : await getNotificationTemplate(id!)
  return { template }
}

function readChannelParam(): NotificationPlatform {
  const raw = new URLSearchParams(window.location.search).get('channel')
  return raw === String(NotificationPlatform.Telegram) ? NotificationPlatform.Telegram : NotificationPlatform.Email
}

export function NotificationTemplateDetailPage() {
  const { template } = useLoaderData<typeof notificationTemplateDetailLoader>()
  const copy = useCopy(notificationTemplatesCopy)

  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/notification-templates" className="transition-colors hover:text-neutral-800">
            {copy.title}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{template?.name ?? copy.newTemplateTitle}</span>
        </>
      }
      breadcrumbsLabel={copy.breadcrumbAria}
      title={template?.name ?? copy.newTemplateTitle}
      subtitle={copy.subtitleDetail}
    >
      {/* Key-инг по id: переход между шаблонами пересобирает форму, не тащит черновик. */}
      <NotificationTemplateForm
        key={template?.id ?? 'new'}
        template={template}
        initialChannel={readChannelParam()}
      />
    </DataEntryScreenLayout>
  )
}
