import { RoleType, type UserInfoModel } from '@/shared/auth'
import { ADMIN_ROLE_IMMUTABLE_HINT } from '../lib/userCopy'
import { RoleSelect } from './RoleSelect'

interface UsersTableProps {
  users: UserInfoModel[]
  /** Id of the signed-in admin — their own row cannot change its role (see `RoleSelect`). */
  currentUserId: number
  /** Id of the row whose PATCH is in flight, or null. */
  pendingId: number | null
  /** True while any mutation or revalidation is running. */
  isBusy: boolean
  onChangeRole: (user: UserInfoModel, role: RoleType) => void
  /** Opens the row's detail screen (F4) — row click, matching `ProductsTable`'s pattern. */
  onOpen: (user: UserInfoModel) => void
}

/** Two independent account states, so they are two badges rather than one "status" column: an
 * account can be verified AND locked out at the same time. */
function StatusBadges({ user }: { user: UserInfoModel }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          user.isEmailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        {user.isEmailVerified ? 'Подтверждён' : 'Не подтверждён'}
      </span>
      {user.isLocked && (
        <span
          className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
          title="Временная блокировка после неудачных попыток входа"
        >
          Заблокирован
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
  pendingId,
  isBusy,
  onChangeRole,
  onOpen,
}: UsersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="bg-neutral-50 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2.5 font-semibold">Имя</th>
            <th className="w-[150px] px-4 py-2.5 font-semibold">Логин</th>
            <th className="px-4 py-2.5 font-semibold">Email</th>
            <th className="w-[140px] px-4 py-2.5 font-semibold">Телефон</th>
            <th className="w-[190px] px-4 py-2.5 font-semibold">Статус</th>
            <th className="w-[200px] px-4 py-2.5 font-semibold">Роль</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = user.id === currentUserId
            // B6 (2026-08-06): the backend's role-change guard is now unconditional — a target
            // whose CURRENT role is Admin cannot have it changed by anyone, not even another
            // Admin, except directly in the database. `&& !isSelf` avoids picking a formulation
            // when both are true — the self case already has its own, more specific text below.
            const isTargetAdmin = user.role === RoleType.Admin && !isSelf
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
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                      это вы
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-700">{user.username}</td>
                <td className="max-w-[220px] truncate px-4 py-2.5 text-neutral-700" title={user.email}>
                  {user.email}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-neutral-700">{user.phoneNumber}</td>
                <td className="px-4 py-2.5">
                  <StatusBadges user={user} />
                </td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <RoleSelect
                    value={user.role}
                    onChange={(role) => onChangeRole(user, role)}
                    disabled={isSelf || isTargetAdmin || isBusy || pendingId === user.id}
                    userLabel={fullName || user.username}
                  />
                  {isSelf ? (
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Свою роль изменить нельзя
                    </p>
                  ) : (
                    isTargetAdmin && (
                      <p className="mt-1 text-[11px] text-neutral-500">{ADMIN_ROLE_IMMUTABLE_HINT}</p>
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
