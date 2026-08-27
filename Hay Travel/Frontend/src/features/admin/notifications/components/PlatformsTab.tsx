import { Checkbox } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { NotificationPlatform } from '@/features/admin/types/notifications'
import type { PlatformDraft } from '../lib/notificationEventModel'
import { notificationsCopy } from '../lib/notificationsCopy'

export interface PlatformsTabProps {
  platforms: PlatformDraft[]
  /** `!canUpdate || isSubmitting`. */
  disabled: boolean
  onToggle: (platform: NotificationPlatform, isEnabled: boolean) => void
}

/**
 * Рубильники каналов доставки события. Включённая платформа немедленно (без сохранения)
 * добавляет свою вкладку настроек — это буквальная реализация п.5 чек-листа.
 *
 * Обрамление и шапка — те же, что у `RolesTable`: одна визуальная семья на все гриды админки.
 * Ниже `sm` та же тройка полей идёт списком карточек, а не таблицей с горизонтальным скроллом.
 */
export function PlatformsTab({ platforms, disabled, onToggle }: PlatformsTabProps) {
  const copy = useCopy(notificationsCopy)
  const enums = useCopy(adminEnumsCopy)

  /** Статус канала — факт («сообщения пока не отправляются»), не совет; поэтому серым, а не
   * предупреждающим цветом. */
  function statusOf(platform: PlatformDraft) {
    return platform.isImplemented ? copy.platformWorking : copy.platformSetupOnly
  }

  return (
    <>
      {/* ≥ sm */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="w-12 px-4 py-2.5 font-semibold">{copy.platformColumnActive}</th>
              <th className="w-[200px] px-4 py-2.5 font-semibold">{copy.platformColumnName}</th>
              <th className="px-4 py-2.5 font-semibold">{copy.platformColumnStatus}</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map((platform) => {
              const name = enums.notificationPlatform[platform.platform]
              return (
                <tr key={platform.platform} className="border-t border-neutral-100 text-sm">
                  <td className="px-4 py-2.5">
                    {/* Подпись живёт в шапке колонки — в ячейке она была бы шумом на экране, но
                        не для скринридера, который заголовки колонок по ячейкам не читает. */}
                    <Checkbox
                      label={copy.platformToggleAria(name)}
                      labelHidden
                      checked={platform.isEnabled}
                      disabled={disabled}
                      onChange={(e) => onToggle(platform.platform, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-neutral-900">{name}</td>
                  <td
                    className={`px-4 py-2.5 ${platform.isImplemented ? 'text-neutral-600' : 'text-neutral-400'}`}
                  >
                    {statusOf(platform)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* < sm */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {platforms.map((platform) => {
          const name = enums.notificationPlatform[platform.platform]
          return (
            <li
              key={platform.platform}
              className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3"
            >
              <Checkbox
                label={copy.platformToggleAria(name)}
                labelHidden
                checked={platform.isEnabled}
                disabled={disabled}
                onChange={(e) => onToggle(platform.platform, e.target.checked)}
                containerClassName="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-neutral-900">{name}</span>
                <span
                  className={`mt-0.5 block text-xs ${platform.isImplemented ? 'text-neutral-500' : 'text-neutral-400'}`}
                >
                  {statusOf(platform)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
