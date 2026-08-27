import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { NotificationEventInfoModel } from '@/features/admin/types/notifications'
import { activeRecipientCount, eventLabelOf } from '../lib/notificationEventModel'
import { notificationsCopy } from '../lib/notificationsCopy'

export interface NotificationEventsTableProps {
  events: NotificationEventInfoModel[]
  onOpen: (event: NotificationEventInfoModel) => void
}

/** Чипы включённых платформ. Read-only производная — редактируется всё только в карточке. */
function PlatformChips({ event }: { event: NotificationEventInfoModel }) {
  const copy = useCopy(notificationsCopy)
  const enums = useCopy(adminEnumsCopy)
  const enabled = event.platforms.filter((platform) => platform.isEnabled)

  if (enabled.length === 0) {
    return <span className="text-neutral-400">{copy.platformsNone}</span>
  }

  return (
    <span className="flex flex-wrap gap-1">
      {enabled.map((platform) => (
        <span
          key={platform.platform}
          className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700"
        >
          {enums.notificationPlatform[platform.platform]}
        </span>
      ))}
    </span>
  )
}

/**
 * Список событий. Презентационный — переход на карточку выполняет `NotificationsPage`.
 *
 * Две раскладки по тому же рецепту, что у `RolesTable`: `<table>` от `sm` и карточки ниже.
 * `ActionsMenu` нет — действие ровно одно, «открыть», и оно на всей строке. Пустого состояния
 * тоже нет: четыре события засеяны миграцией, удалить их нечем.
 */
export function NotificationEventsTable({ events, onOpen }: NotificationEventsTableProps) {
  const copy = useCopy(notificationsCopy)
  const enums = useCopy(adminEnumsCopy)

  return (
    <>
      {/* ≥ sm */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-semibold">{copy.columnEvent}</th>
              <th className="w-[220px] px-4 py-2.5 font-semibold">{copy.columnPlatforms}</th>
              <th className="w-[150px] px-4 py-2.5 text-right font-semibold">{copy.columnRecipients}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const label = eventLabelOf(event, enums.emailActionKey)
              return (
                <tr
                  key={event.eventKey}
                  onClick={() => onOpen(event)}
                  aria-label={copy.rowOpenAria(label)}
                  className="cursor-pointer border-t border-neutral-100 text-sm transition-colors hover:bg-neutral-50"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-neutral-900">{label}</span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    <PlatformChips event={event} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">
                    {activeRecipientCount(event)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* < sm */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {events.map((event) => {
          const label = eventLabelOf(event, enums.emailActionKey)
          return (
            <li key={event.eventKey}>
              <button
                type="button"
                onClick={() => onOpen(event)}
                aria-label={copy.rowOpenAria(label)}
                className="flex w-full flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-left"
              >
                <span className="text-base font-semibold text-neutral-900">{label}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <PlatformChips event={event} />
                  <span>
                    {copy.columnRecipients}: {activeRecipientCount(event)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
