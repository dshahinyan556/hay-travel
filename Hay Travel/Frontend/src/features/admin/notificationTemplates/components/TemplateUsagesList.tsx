import { Link } from 'react-router'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { NotificationTemplateUsageInfoModel } from '@/features/admin/types/notificationTemplates'
import { notificationTemplatesCopy } from '../lib/notificationTemplatesCopy'

export interface TemplateUsagesListProps {
  usages: NotificationTemplateUsageInfoModel[]
}

/**
 * Блок «Используется в» — двусторонняя связь с «Настройками уведомлений» (решение 2026-08-31):
 * с карточки события есть ссылка на шаблон (`TemplatePicker`), отсюда — обратно на событие.
 * Auth-триггеры текстом без ссылки: отдельного экрана-события у них нет.
 */
export function TemplateUsagesList({ usages }: TemplateUsagesListProps) {
  const copy = useCopy(notificationTemplatesCopy)
  const enums = useCopy(adminEnumsCopy)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      <span className="text-sm font-semibold text-neutral-700">{copy.usagesTitle}</span>
      {usages.length === 0 ? (
        <p className="text-sm text-neutral-500">{copy.usagesEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {usages.map((usage, index) => (
            <li key={index}>
              {usage.eventKey !== null && usage.platform !== null ? (
                <Link
                  to={`/admin/notifications/${usage.eventKey}`}
                  className="text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
                >
                  {enums.emailActionKey[usage.eventKey]} — {enums.notificationPlatform[usage.platform]}
                </Link>
              ) : usage.trigger !== null ? (
                <span className="text-neutral-700">{enums.notificationTemplateTrigger[usage.trigger]}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
