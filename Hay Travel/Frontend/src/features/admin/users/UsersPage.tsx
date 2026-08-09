import { useMemo, useState } from 'react'
import { redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import {
  canManageAdmins,
  canManageUsers,
  ensureAuthReady,
  getAuthState,
  RoleType,
  type UserInfoModel,
} from '@/shared/auth'
import { changeUserRole, getUsers } from '@/features/admin/api/adminUsers'
import { UsersToolbar } from './components/UsersToolbar'
import { UsersTable } from './components/UsersTable'
import { PromoteToAdminModal } from './components/PromoteToAdminModal'
import { emptyUserFilters, filterUsers, type UserFilters } from './lib/filterUsers'
import { roleHints, roleIdFor, roleLabels, usersErrorMessage } from './lib/userCopy'

/**
 * Loads every account.
 *
 * Checks the permission itself and redirects rather than letting the request 403: `adminRootLoader`
 * only gates the panel as a whole, so a TourManager typing `/admin/users` would otherwise land on
 * a raw error screen. The redirect target is the dashboard, which every panel role can open.
 */
export async function usersLoader() {
  await ensureAuthReady()
  if (!canManageUsers(getAuthState().user?.role)) throw redirect('/admin')

  const users = await getUsers()
  return { users }
}

export function UsersPage() {
  const { users } = useLoaderData<typeof usersLoader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()

  const [filters, setFilters] = useState<UserFilters>(emptyUserFilters)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  /** The row whose promotion to Admin is waiting for confirmation (D5), or `null`. */
  const [pendingPromotion, setPendingPromotion] = useState<UserInfoModel | null>(null)

  // Read once per render from the store (not `useAuth`) — neither the id nor the SuperAdmin flag
  // can change while this screen is open without a full re-navigation, and the loaders re-run on
  // that navigation anyway.
  const actor = getAuthState().user
  const currentUserId = actor?.id ?? 0
  const actorManagesAdmins = canManageAdmins(actor)

  const isBusy = pendingId !== null || revalidator.state !== 'idle'
  const visible = useMemo(() => filterUsers(users, filters), [users, filters])

  function patchFilters(patch: Partial<UserFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  /**
   * What the table reports. Promotion to Admin is the one transition that does NOT go straight to
   * the server (D5): it parks the row in `pendingPromotion` and the modal decides.
   *
   * The interception lives here, not in `RoleSelect`: the confirmation is a page-level modal (one
   * per page, not one per row) and this is where the mutation already lives.
   */
  function requestChangeRole(user: UserInfoModel, role: RoleType) {
    if (isBusy) return
    if (role === RoleType.Admin) {
      setActionError(null)
      setPendingPromotion(user)
      return
    }
    void handleChangeRole(user, role)
  }

  async function handleChangeRole(user: UserInfoModel, role: RoleType) {
    if (isBusy) return
    setActionError(null)
    setPendingId(user.id)
    try {
      await changeUserRole({ userId: user.id, roleId: roleIdFor(role, users) })
      setPendingPromotion(null)
      await revalidator.revalidate()
    } catch (err) {
      setActionError(usersErrorMessage(err, `изменить роль пользователя «${user.username}»`))
      // The modal closes on failure too: the error banner lives above the table, and leaving a
      // dialog open in front of the message explaining the failure would hide it.
      setPendingPromotion(null)
    } finally {
      setPendingId(null)
    }
  }

  const adminCount = users.filter((user) => user.role === RoleType.Admin).length
  const emptyAfterFilter = users.length > 0 && visible.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-neutral-900">Пользователи</h1>
        <p className="text-sm text-neutral-500">
          Все учётные записи и их роли. Смена роли применяется сразу.
        </p>
      </header>

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{actionError}</span>
        </div>
      )}

      <UsersToolbar filters={filters} onFiltersChange={patchFilters} />

      {/* `users` can never be empty — the signed-in admin is in it — so there is no "no data at
          all" state here, only "nothing matched the filters". */}
      {emptyAfterFilter ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          Ничего не найдено по заданным фильтрам.
        </p>
      ) : (
        <UsersTable
          users={visible}
          currentUserId={currentUserId}
          canManageAdmins={actorManagesAdmins}
          pendingId={pendingId}
          isBusy={isBusy}
          onChangeRole={requestChangeRole}
          onOpen={(user) => !isBusy && navigate(`/admin/users/${user.id}`)}
        />
      )}

      {/* One modal per page (see `PromoteToAdminModal`). Cancelling needs no undo: `RoleSelect` is
          controlled by `user.role` from the loader, so the unconfirmed pick reverts by itself. */}
      <PromoteToAdminModal
        userLabel={
          pendingPromotion === null
            ? null
            : [pendingPromotion.firstName, pendingPromotion.lastName].filter(Boolean).join(' ') ||
              pendingPromotion.username
        }
        pending={pendingId !== null}
        onCancel={() => setPendingPromotion(null)}
        onConfirm={() => {
          if (pendingPromotion) void handleChangeRole(pendingPromotion, RoleType.Admin)
        }}
      />

      <section className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
        <h2 className="text-sm font-semibold text-neutral-800">Что даёт роль</h2>
        <dl className="mt-2 flex flex-col gap-1.5 text-sm">
          {[RoleType.Regular, RoleType.TourManager, RoleType.Admin].map((role) => (
            <div key={role} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="font-semibold text-neutral-700 sm:w-40 sm:shrink-0">
                {roleLabels[role]}
              </dt>
              <dd className="text-neutral-500">{roleHints[role]}</dd>
            </div>
          ))}
        </dl>
        {adminCount === 1 && (
          <p className="mt-3 text-xs text-neutral-500">
            Сейчас администратор один — снять эту роль с него нельзя, пока не назначен другой.
          </p>
        )}
        {!actorManagesAdmins && (
          <p className="mt-3 text-xs text-neutral-500">
            Назначать и снимать роль администратора может только главный администратор.
          </p>
        )}
      </section>
    </div>
  )
}
