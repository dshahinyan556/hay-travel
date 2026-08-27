import type { UserInfoModel } from '@/shared/auth'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { roleHoldsCanManageAdmins } from '@/features/admin/roles/lib/roleModel'
import { userCopy, type UserCopy } from '../lib/userCopy'
import { RoleSelect } from './RoleSelect'

interface UsersTableProps {
  users: UserInfoModel[]
  /** Id of the signed-in admin — their own row cannot change its role (see `RoleSelect`). */
  currentUserId: number
  /**
   * `canManageAdmins(actor)` — is the signed-in admin the SuperAdmin (D3)? Passed as a CAPABILITY,
   * not as the actor object, so this component stays presentational (the same convention
   * `UserDangerZone.canDelete` already follows).
   */
  canManageAdmins: boolean
  /** `users.Update` — without it every row's role is read-only text. Same convention: a capability,
   * resolved once by the page, never a permission lookup inside a presentational component. */
  canUpdate: boolean
  /** Every assignable role (`GET api/Roles`); `null` when the actor may not read them. */
  roles: RoleInfoModel[] | null
  /** Id of the row whose PATCH is in flight, or null. */
  pendingId: number | null
  /** True while any mutation or revalidation is running. */
  isBusy: boolean
  onChangeRole: (user: UserInfoModel, role: RoleInfoModel) => void
  /** Opens the row's detail screen (F4) — row click, matching `ProductsTable`'s pattern. */
  onOpen: (user: UserInfoModel) => void
}

/** Two independent account states, so they are two badges rather than one "status" column: an
 * account can be verified AND locked out at the same time. */
function StatusBadges({ user, copy }: { user: UserInfoModel; copy: UserCopy['status'] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          user.isEmailVerified ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 border border-dashed border-neutral-300'
        }`}
      >
        {user.isEmailVerified ? copy.verified : copy.unverified}
      </span>
      {user.isLocked && (
        <span
          className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          title={copy.lockedTitle}
        >
          {copy.locked}
        </span>
      )}
    </div>
  )
}

/**
 * The accounts table. Rows are clickable (F4) — opens `/admin/users/:id` — the same recipe as
 * `ProductsTable`: `onClick` on the `<tr>`, `stopPropagation` on the cell that has its own
 * interactive control so a role change doesn't also trigger navigation.
 */
export function UsersTable({
  users,
  currentUserId,
  canManageAdmins,
  canUpdate,
  roles,
  pendingId,
  isBusy,
  onChangeRole,
  onOpen,
}: UsersTableProps) {
  const copy = useCopy(userCopy)

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2.5 font-semibold">{copy.table.colName}</th>
            <th className="w-[150px] px-4 py-2.5 font-semibold">{copy.table.colUsername}</th>
            <th className="px-4 py-2.5 font-semibold">{copy.table.colEmail}</th>
            <th className="w-[140px] px-4 py-2.5 font-semibold">{copy.table.colPhone}</th>
            <th className="w-[190px] px-4 py-2.5 font-semibold">{copy.table.colStatus}</th>
            <th className="w-[200px] px-4 py-2.5 font-semibold">{copy.table.colRole}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId
            // `&& !isSelf` avoids picking a formulation when both are true — the self case has its
            // own, more specific text below. `CanManageAdmins` lives on the ROLE, not the account,
            // so this is a lookup by `roleId` rather than a straight field comparison (решение
            // Давида 2026-08-22 — no fixed `RoleType` means anything about privilege any more).
            const isTargetAdmin = roleHoldsCanManageAdmins(user.roleId, roles) && !isSelf
            // D3 (2026-08-09) relaxed B6's unconditional lock: another admin-tier role is still
            // frozen for everyone EXCEPT the SuperAdmin, who may now demote them. Previously this
            // was just `isTargetAdmin`.
            const roleLocked = isTargetAdmin && !canManageAdmins
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
            return (
              <tr
                key={user.id}
                onClick={() => !isBusy && onOpen(user)}
                className="cursor-pointer border-t border-neutral-100 text-sm transition-colors hover:bg-neutral-50"
              >
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-neutral-900">{fullName}</span>
                  {isSelf && (
                    <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {copy.table.itsYou}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-700">{user.username}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-neutral-700" title={user.email}>
                  {user.email}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-neutral-700">{user.phoneNumber}</td>
                <td className="px-4 py-2.5">
                  <StatusBadges user={user} copy={copy.status} />
                </td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <RoleSelect
                    value={user.roleId}
                    valueName={user.roleName}
                    roles={canUpdate ? roles : null}
                    onChange={(role) => onChangeRole(user, role)}
                    disabled={isSelf || roleLocked || isBusy || pendingId === user.id}
                    allowAdminOption={canManageAdmins}
                    userLabel={fullName || user.username}
                  />
                  {isSelf ? (
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {copy.table.ownRoleLocked}
                    </p>
                  ) : (
                    roleLocked && (
                      <p className="mt-1 text-[11px] text-neutral-500">{copy.adminRoleImmutableHint}</p>
                    )
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
