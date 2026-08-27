import { useEffect, useState } from 'react'
import { Link, redirect, useLoaderData } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import {
  AdminActionButton,
  DataEntryScreenLayout,
  Tabs,
  UnsavedChangesModal,
  type TabItem,
} from '@/shared/ui'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getStoredLocale } from '@/shared/lib/locale'
import {
  AdminScreen,
  canView,
  ensurePermissionsReady,
  useScreenPermission,
  type UserInfoModel,
} from '@/shared/auth'
import { getNotificationEvent } from '@/features/admin/api/adminNotifications'
import { getUsers } from '@/features/admin/api/adminUsers'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import {
  NotificationPlatform,
  isEmailActionKey,
  type NotificationEventInfoModel,
} from '@/features/admin/types/notifications'
import { EmailTemplateEditor } from './components/EmailTemplateEditor'
import { PlatformsTab } from './components/PlatformsTab'
import { RecipientsGrid } from './components/RecipientsGrid'
import { useNotificationEventForm } from './hooks/useNotificationEventForm'
import { eventLabelOf } from './lib/notificationEventModel'
import { notificationsCopy } from './lib/notificationsCopy'

const PLATFORMS_TAB = 'platforms'
const platformTabId = (platform: NotificationPlatform) => `platform-${platform}`

/**
 * Карточка одного события. Отдельный роут, а не модалка: три вкладки, два RTE на четыре языковых
 * поля и редактируемый грид получателей — это полноценный экран-запись (прямой прецедент в
 * кодовой базе — пара `RolesPage` → `RoleDetailPage`). Заодно бесплатно достаются deep-link,
 * `AdminErrorBoundary` на неизвестный ключ и штатно работающий `useUnsavedChangesGuard`.
 */
export async function notificationEventLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Notifications)) throw redirect('/admin')

  // Лоадер работает вне React — локаль читается напрямую (правило 3 из `defineCopy.ts`).
  const copy = notificationsCopy(getStoredLocale())

  const raw = Number(params.eventKey)
  if (!Number.isInteger(raw) || !isEmailActionKey(raw)) {
    throw new Response(copy.errorInvalidEventKey, { status: 400 })
  }

  // Список пользователей нужен колонке «Получатель» источника User, но гейтится ЧУЖИМ ключом
  // (`users.View`) — поэтому деградирует до пустого списка, а не 403-ит весь экран: уже
  // сохранённые строки останутся читаемыми за счёт денормализованных userFullName/userEmail.
  const [event, users] = await Promise.all([
    getNotificationEvent(raw),
    canView(AdminScreen.Users) ? getUsers() : Promise.resolve<UserInfoModel[]>([]),
  ])

  return { event, users }
}

export function NotificationEventPage() {
  const { event, users } = useLoaderData<typeof notificationEventLoader>()

  // Key-инг по ключу события: переход между событиями пересобирает форму, а не тащит черновик
  // предыдущего — то же, что делают `OrderDetailPage`/`UserDetailPage`.
  return <NotificationEventView key={event.eventKey} event={event} users={users} />
}

interface NotificationEventViewProps {
  event: NotificationEventInfoModel
  users: UserInfoModel[]
}

function NotificationEventView({ event, users }: NotificationEventViewProps) {
  const copy = useCopy(notificationsCopy)
  const enums = useCopy(adminEnumsCopy)
  const permission = useScreenPermission(AdminScreen.Notifications)

  const eventLabel = eventLabelOf(event, enums.emailActionKey)
  const form = useNotificationEventForm({ event, eventLabel })
  const guard = useUnsavedChangesGuard(form.isDirty && !form.isSubmitting)

  const [activeTab, setActiveTab] = useState<string>(PLATFORMS_TAB)

  const enabledPlatforms = form.draft.platforms.filter((platform) => platform.isEnabled)

  // Вкладка платформы существует ровно тогда, когда её рубильник включён В ЧЕРНОВИКЕ — то есть
  // появляется и исчезает мгновенно, без сохранения.
  const tabs: TabItem[] = [
    { id: PLATFORMS_TAB, label: copy.tabPlatforms, badge: enabledPlatforms.length },
    ...enabledPlatforms.map((platform) => ({
      id: platformTabId(platform.platform),
      label:
        platform.platform === NotificationPlatform.Email
          ? copy.tabEmailSettings
          : copy.tabTelegramSettings,
      badge: platform.recipients.filter((row) => row.isActive).length,
    })),
  ]

  // Выключенная платформа уносит с собой свою вкладку: без этого `Tabs` остался бы с `activeId`,
  // которого нет в списке, и тело вкладки просто не отрисовалось бы. Зависимость — строка из id,
  // а не сам массив: он пересобирается на каждый рендер и гонял бы эффект впустую.
  const tabIds = tabs.map((tab) => tab.id).join('|')
  useEffect(() => {
    if (!tabIds.split('|').includes(activeTab)) setActiveTab(PLATFORMS_TAB)
  }, [tabIds, activeTab])

  const activePlatform = form.draft.platforms.find(
    (platform) => platformTabId(platform.platform) === activeTab,
  )

  const disabled = !permission.canUpdate || form.isSubmitting

  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/notifications" className="transition-colors hover:text-neutral-800">
            {copy.title}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{eventLabel}</span>
        </>
      }
      breadcrumbsLabel={copy.breadcrumbAria}
      title={eventLabel}
      subtitle={copy.eventSubtitle}
      /* Не `AdminToolbar`: его `onAdd`/`onDelete` обязательны, а здесь бессмысленны — событие
         нельзя ни создать, ни удалить. Тот же ряд контекстных кнопок, что у `UserDetailPage`. */
      controlZone={
        <div className="ml-auto flex items-center gap-3">
          {form.isDirty && <span className="hidden text-xs text-neutral-500 sm:inline">{copy.dirtyHint}</span>}
          <AdminActionButton
            label={copy.cancelEdits}
            variant="secondary"
            disabled={!form.isDirty || form.isSubmitting}
            onClick={form.reset}
          />
          <AdminActionButton
            label={copy.save}
            pendingLabel={copy.saving}
            variant="primary"
            pending={form.isSubmitting}
            disabled={!form.canSubmit || !permission.canUpdate}
            onClick={form.submit}
          />
        </div>
      }
      message={
        <>
          {!permission.canUpdate && (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              {copy.readOnlyHint}
            </p>
          )}
          {form.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              <span aria-hidden="true">⚠️</span>
              <span>{form.error}</span>
            </div>
          )}
          {form.savedAt !== null && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900"
            >
              <span aria-hidden="true">✓</span>
              <span>{copy.saved}</span>
            </div>
          )}
        </>
      }
    >
      <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} label={copy.tabsLabel} />

      {activeTab === PLATFORMS_TAB && (
        <PlatformsTab
          platforms={form.draft.platforms}
          disabled={disabled}
          onToggle={form.setPlatformEnabled}
        />
      )}

      {activePlatform && (
        <div className="flex flex-col gap-6">
          {activePlatform.platform === NotificationPlatform.Telegram && !activePlatform.isImplemented && (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              {copy.telegramNotImplementedBanner}
            </p>
          )}

          <RecipientsGrid
            platform={activePlatform.platform}
            rows={activePlatform.recipients}
            users={users}
            disabled={disabled}
            errors={form.rowErrors}
            onPatch={(rowKey, patch) => form.patchRecipient(activePlatform.platform, rowKey, patch)}
            onAdd={() => form.addRecipient(activePlatform.platform)}
            onRemove={(rowKey) => form.removeRecipient(activePlatform.platform, rowKey)}
          />

          {activePlatform.platform === NotificationPlatform.Email && (
            <EmailTemplateEditor
              subject={activePlatform.subject}
              subjectEn={activePlatform.subjectEn}
              bodyHtml={activePlatform.bodyHtml}
              bodyHtmlEn={activePlatform.bodyHtmlEn}
              availablePlaceholders={activePlatform.availablePlaceholders}
              disabled={disabled}
              error={form.templateError}
              onChange={(patch) => form.patchTemplate(activePlatform.platform, patch)}
            />
          )}
        </div>
      )}

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </DataEntryScreenLayout>
  )
}
