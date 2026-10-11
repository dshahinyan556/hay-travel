import { ActionsMenu, type ActionsMenuItem } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { NotificationTemplateInfoModel } from '@/features/admin/types/notificationTemplates'
import { notificationTemplatesCopy, type NotificationTemplatesCopy } from '../lib/notificationTemplatesCopy'

export interface NotificationTemplatesTableProps {
  templates: NotificationTemplateInfoModel[]
  onOpen: (template: NotificationTemplateInfoModel) => void
  onRequestDelete: (template: NotificationTemplateInfoModel) => void
  busyId: number | null
  canDelete: boolean
}

/** Почему удаление заблокировано, или `null`. Тот же список `usages`, что показывает карточка
 * шаблона — не дублирует логику, сервер проверяет это же на удалении (409). */
function deleteBlockedReason(
  template: NotificationTemplateInfoModel,
  copy: NotificationTemplatesCopy,
): string | null {
  return template.usages.length > 0 ? copy.deleteInUseHint : null
}

/** Список шаблонов. Презентационный — все мутации у `NotificationTemplatesPage`. Два макета,
 * тот же приём, что у `RolesTable`: карточки ниже `sm`, таблица выше. */
export function NotificationTemplatesTable({
  templates,
  onOpen,
  onRequestDelete,
  busyId,
  canDelete,
}: NotificationTemplatesTableProps) {
  const copy = useCopy(notificationTemplatesCopy)
  const enums = useCopy(adminEnumsCopy)

  function actionsOf(template: NotificationTemplateInfoModel) {
    const blocked = deleteBlockedReason(template, copy)
    const items: ActionsMenuItem[] = [{ key: 'open', label: copy.open, onClick: () => onOpen(template) }]
    if (canDelete) {
      items.push({
        key: 'delete',
        label: blocked === null ? copy.delete : `${copy.delete} — ${blocked}`,
        onClick: () => onRequestDelete(template),
        disabled: blocked !== null || busyId !== null,
        danger: true,
      })
    }
    return items
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-semibold">{copy.columnName}</th>
              <th className="w-[120px] px-4 py-2.5 font-semibold">{copy.columnChannel}</th>
              <th className="w-[140px] px-4 py-2.5 font-semibold">{copy.columnEntity}</th>
              <th className="w-[90px] px-4 py-2.5 text-right font-semibold">{copy.columnActive}</th>
              <th className="w-[70px] px-4 py-2.5 text-right font-semibold">
                <span className="sr-only">{copy.columnActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr
                key={template.id}
                onClick={() => onOpen(template)}
                className="cursor-pointer border-t border-neutral-100 text-sm transition-colors hover:bg-neutral-50"
              >
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-neutral-900">{template.name}</span>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{enums.notificationPlatform[template.channel]}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {enums.notificationTemplateEntity[template.boundEntity]}
                </td>
                <td className="px-4 py-2.5 text-right">{template.isActive ? '✓' : '—'}</td>
                <td className="px-4 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <ActionsMenu items={actionsOf(template)} label={copy.rowActionsLabel(template.name)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 sm:hidden">
        {templates.map((template) => (
          <li
            key={template.id}
            className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-3"
          >
            <button type="button" onClick={() => onOpen(template)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-base font-semibold text-neutral-900">{template.name}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                {enums.notificationPlatform[template.channel]}
                {' · '}
                {enums.notificationTemplateEntity[template.boundEntity]}
                {!template.isActive && ` · ${copy.columnActive.toLowerCase()}: —`}
              </span>
            </button>
            <ActionsMenu items={actionsOf(template)} label={copy.rowActionsLabel(template.name)} />
          </li>
        ))}
      </ul>
    </>
  )
}
