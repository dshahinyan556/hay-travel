import { useMemo, useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import {
  AdminScreen,
  canManageAdmins,
  canView,
  ensurePermissionsReady,
  getAuthState,
  useScreenPermission,
  type UserInfoModel,
} from '@/shared/auth'
import { MaintenanceFormLayout } from '@/shared/ui'
import { changeUserRole, getUsers } from '@/features/admin/api/adminUsers'
import { getRoles } from '@/features/admin/api/adminRoles'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { roleHoldsCanManageAdmins } from '@/features/admin/roles/lib/roleModel'
import { useCopy } from '@/shared/i18n/defineCopy'
import { UsersToolbar } from './components/UsersToolbar'
import { UsersTable } from './components/UsersTable'
import { isAdminRole } from './components/RoleSelect'
import { PromoteToAdminModal } from './components/PromoteToAdminModal'
import { emptyUserFilters, filterUsers, type UserFilters } from './lib/filterUsers'
import { userCopy, usersErrorMessage } from './lib/userCopy'

/**
 * Loads every account, plus the role list needed to change one.
 *
 * Checks the permission itself and redirects rather than letting the request 403: `adminRootLoader`
 * only gates the panel as a whole, so a role without `users.View` typing `/admin/users` would
 * otherwise land on a raw error screen.
 *
 * `GET api/Roles` is gated by `roles.View` like any other matrix screen now (решение Давида
 * 2026-08-22) — requested whenever the signed-in session can see it, and its failure degrades to
 * `null` regardless: the screen still lists the accounts, it just shows each role as text instead
 * of a picker.
 */
export async function usersLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Users)) throw redirect('/admin')

  const [users, roles] = await Promise.all([
    getUsers(),
    canView(AdminScreen.Roles) ? getRoles().catch(() => null) : Promise.resolve(null),
  ])
  return { users, roles }
}

/**
 * Template B — «Форма обслуживания» (`MaintenanceFormLayout`), in its no-create variant: accounts
 * are equal, unlinked records, but they are born from registration on the public site, never from
 * a button in the panel. The empty right end of the control zone is therefore correct, not a
 * missing feature — there is nothing here for an «Добавить» to do.
 *
 * The row keeps exactly one inline control (the role picker) plus row-click-to-open, which is the
 * list↔card rule of the template system: a list never edits a record in place beyond one or two
 * quick toggles; everything else belongs to `UserDetailPage` (template A).
 */
export function UsersPage() {
  const { users, roles } = useLoaderData<typeof usersLoader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const copy = useCopy(userCopy)
  // Through the hook, not the bare predicate: the matrix can be refetched in the background (token
  // rotation, or this very admin editing their own rights) and the row controls must follow.
  const usersPermission = useScreenPermission(AdminScreen.Users)

  const [filters, setFilters] = useState<UserFilters>(emptyUserFilters)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  /** The row whose promotion to Admin is waiting for confirmation (D5), or `null`. Carries the
   * picked role too — with user-created roles there can be more than one Admin-tier row. */
  const [pendingPromotion, setPendingPromotion] = useState<{
    user: UserInfoModel
    role: RoleInfoModel
  } | null>(null)

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
  function requestChangeRole(user: UserInfoModel, role: RoleInfoModel) {
    if (isBusy) return
    // Only the BUILT-IN Admin tier needs the confirmation: a custom role, however broad, cannot
    // hand over the SuperAdmin-protected controls that make this transition special.
    if (isAdminRole(role)) {
      setActionError(null)
      setPendingPromotion({ user, role })
      return
    }
    void handleChangeRole(user, role)
  }

  async function handleChangeRole(user: UserInfoModel, role: RoleInfoModel) {
    if (isBusy) return
    setActionError(null)
    setPendingId(user.id)
    try {
      await changeUserRole({ userId: user.id, roleId: role.id })
      setPendingPromotion(null)
      await revalidator.revalidate()
    } catch (err) {
      setActionError(usersErrorMessage(copy, err, copy.errorActions.changeRole(user.username)))
      // The modal closes on failure too: the error banner lives above the table, and leaving a
      // dialog open in front of the message explaining the failure would hide it.
      setPendingPromotion(null)
    } finally {
      setPendingId(null)
    }
  }

  // Counts accounts on a `CanManageAdmins` role, not "roles named admin" — that flag, wherever it
  // sits, is what `GuardRoleChange`/`GuardAdminAccountAsync` actually key their SuperAdmin-only
  // rule on (решение Давида 2026-08-22).
  const adminCount = users.filter((user) => roleHoldsCanManageAdmins(user.roleId, roles)).length
  const emptyAfterFilter = users.length > 0 && visible.length === 0

  return (
    <MaintenanceFormLayout
      title={copy.page.title}
      subtitle={copy.page.subtitle}
      /* Search + role/status filters are the whole control zone here. `w-full` because the toolbar
         lays its own three controls out on one row from `sm:` up and would otherwise shrink to
         its content inside the zone's flex row. */
      controlZone={
        <div className="w-full">
          <UsersToolbar filters={filters} onFiltersChange={patchFilters} roles={roles} />
        </div>
      }
      message={
        actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{actionError}</span>
          </div>
        )
      }
    >
      {/* `users` can never be empty — the signed-in admin is in it — so there is no "no data at
          all" state here, only "nothing matched the filters". */}
      {emptyAfterFilter ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          {copy.page.emptyFiltered}
        </p>
      ) : (
        <UsersTable
          users={visible}
          currentUserId={currentUserId}
          canManageAdmins={actorManagesAdmins}
          canUpdate={usersPermission.canUpdate}
          roles={roles}
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
            : [pendingPromotion.user.firstName, pendingPromotion.user.lastName]
                .filter(Boolean)
                .join(' ') || pendingPromotion.user.username
        }
        pending={pendingId !== null}
        onCancel={() => setPendingPromotion(null)}
        onConfirm={() => {
          if (pendingPromotion) {
            void handleChangeRole(pendingPromotion.user, pendingPromotion.role)
          }
        }}
      />

      <section className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
        {/* No per-tier legend any more: what a role allows is editable data now, and restating it
            here would be a copy that goes stale the first time somebody edits the matrix. */}
        {roles !== null && (
          <p className="text-sm text-neutral-500">
            {copy.page.roleLegend}{' '}
            <Link to="/admin/roles" className="font-semibold text-brand-700 hover:text-brand-800">
              {copy.page.roleLegendLink}
            </Link>
            .
          </p>
        )}
        {adminCount === 1 && (
          <p className="mt-3 text-xs text-neutral-500">{copy.page.singleAdminNote}</p>
        )}
        {!actorManagesAdmins && (
          <p className="mt-3 text-xs text-neutral-500">{copy.page.superAdminOnlyNote}</p>
        )}
      </section>
    </MaintenanceFormLayout>
  )
}
