import { ActionsMenu, type ActionsMenuItem } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { rolesCopy, type RolesCopy } from '../lib/rolesCopy'

export interface RolesTableProps {
  roles: RoleInfoModel[]
  /** Open the role's card. */
  onOpen: (role: RoleInfoModel) => void
  /** Ask to delete — the PAGE owns the confirmation modal (one per page, as on `UsersPage`). */
  onRequestDelete: (role: RoleInfoModel) => void
  /** Id of the role whose delete is in flight, or `null`. */
  busyId: number | null
  /** `roles.Delete` for the signed-in session — hides the action entirely rather than offering a
   * button that would 403 (the same choice every other table in this admin makes). */
  canDelete: boolean
}

/** Built-in tiers keep a readable type; a custom role simply has none. */
function roleTypeLabel(role: RoleInfoModel, copy: RolesCopy): string {
  return role.type === null ? copy.customType : copy.roleTypeLabels[role.type]
}

/** Why deletion is blocked, or `null` when it is allowed. Enforced server-side too (2032) — this
 * only avoids offering a button that answers an error. No role, seeded or custom, is exempt from
 * deletion on its own account (решение Давида 2026-08-22) — only being in use blocks it. */
function deleteBlockedReason(role: RoleInfoModel, copy: RolesCopy): string | null {
  if (role.userCount > 0) return copy.deleteInUseHint(role.userCount)
  return null
}

/**
 * The roles list. Presentational — every mutation belongs to `RolesPage`.
 *
 * Two layouts, the same recipe `UsersTable` uses: cards below `sm`, a table above. There is no
 * empty state: the four seeded roles always exist until someone deletes them.
 */
export function RolesTable({ roles, onOpen, onRequestDelete, busyId, canDelete }: RolesTableProps) {
  const copy = useCopy(rolesCopy)

  function actionsOf(role: RoleInfoModel) {
    const blocked = deleteBlockedReason(role, copy)
    const items: ActionsMenuItem[] = [{ key: 'open', label: copy.open, onClick: () => onOpen(role) }]
    if (canDelete) {
      items.push({
        key: 'delete',
        label: blocked === null ? copy.delete : `${copy.delete} — ${blocked}`,
        onClick: () => onRequestDelete(role),
        disabled: blocked !== null || busyId !== null,
        danger: true,
      })
    }
    return items
  }

  return (
    <>
      {/* ≥ sm */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white sm:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-semibold">{copy.columnName}</th>
              <th className="w-[180px] px-4 py-2.5 font-semibold">{copy.columnType}</th>
              <th className="w-[130px] px-4 py-2.5 text-right font-semibold">{copy.columnUsers}</th>
              <th className="w-[70px] px-4 py-2.5 text-right font-semibold">
                <span className="sr-only">{copy.columnActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr
                key={role.id}
                onClick={() => onOpen(role)}
                className="cursor-pointer border-t border-neutral-100 text-sm transition-colors hover:bg-neutral-50"
              >
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-neutral-900">{role.name}</span>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {roleTypeLabel(role, copy)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-700">{role.userCount}</td>
                <td className="px-4 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <ActionsMenu items={actionsOf(role)} label={copy.rowActionsLabel(role.name)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < sm */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {roles.map((role) => (
          <li
            key={role.id}
            className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-3"
          >
            <button
              type="button"
              onClick={() => onOpen(role)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-base font-semibold text-neutral-900">{role.name}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                {roleTypeLabel(role, copy)}
                {' · '}
                {copy.columnUsers}: {role.userCount}
              </span>
            </button>
            <ActionsMenu items={actionsOf(role)} label={copy.rowActionsLabel(role.name)} />
          </li>
        ))}
      </ul>
    </>
  )
}
