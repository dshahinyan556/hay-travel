import { useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { AdminToolbar, DataEntryScreenLayout, UnsavedChangesModal } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { getStoredLocale } from '@/shared/lib/locale'
import {
  AdminScreen,
  canManageAdmins as canManageAdminsSelf,
  canView,
  ensurePermissionsReady,
  refreshPermissions,
  useAuth,
  useScreenPermission,
} from '@/shared/auth'
import { deleteRole, getRoles, getScreens } from '@/features/admin/api/adminRoles'
import type { RoleInfoModel, ScreenDefinitionModel } from '@/features/admin/types/roles'
import { RoleForm } from './components/RoleForm'
import { RoleDeleteModal } from './components/RoleDeleteModal'
import { useRoleForm } from './hooks/useRoleForm'
import { rolesCopy, rolesErrorMessage } from './lib/rolesCopy'

/**
 * One role's card, and the create form.
 *
 * There is no separate `/admin/roles/new` route: creating IS this screen with `id = 'new'`, because
 * the only difference is that no role is loaded. A second route would duplicate the whole form for
 * that one distinction.
 *
 * The role itself comes out of `GET api/Roles` rather than a by-id endpoint — there is none, and
 * with roles numbering in the single digits there does not need to be. The same call supplies
 * `existingNames`, which the form needs anyway to reject a duplicate before sending it.
 */
export async function roleDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Roles)) throw redirect('/admin')

  // A loader runs outside React, so there is no `useCopy` here — the stored locale is read
  // directly, per `shared/i18n/defineCopy.ts`'s rule 3.
  const copy = rolesCopy(getStoredLocale())

  const isNew = params.id === 'new'
  const id = isNew ? null : Number(params.id)
  if (!isNew && (id === null || !Number.isInteger(id) || id <= 0)) {
    throw new Response(copy.errorInvalidId, { status: 400 })
  }

  const [roles, screens] = await Promise.all([getRoles(), getScreens()])
  const role = isNew ? null : (roles.find((candidate) => candidate.id === id) ?? null)
  if (!isNew && role === null) throw new Response(copy.errorNotFound, { status: 404 })

  return { role, screens, existingNames: roles.map((candidate) => candidate.name) }
}

export function RoleDetailPage() {
  const { role, screens, existingNames } = useLoaderData<typeof roleDetailLoader>()
  // Keyed by id so navigating between two roles rebuilds the form state instead of carrying the
  // previous role's edits over — the same reasoning as `UserDetailPage`/`TourEditPage`.
  return <RoleDetailView key={role?.id ?? 'new'} role={role} screens={screens} existingNames={existingNames} />
}

/**
 * Template A — «Экран ввода данных» (`DataEntryScreenLayout`), the same shape as the order card:
 * `useRoleForm` lives HERE, Отмена/Сохранить/Удалить sit in the pinned `AdminToolbar`, the
 * error / "applied with a lag" banners go to the `message` slot, and `RoleForm` only renders the
 * fields. Deleting is an immediate action behind `RoleDeleteModal`, never part of the draft.
 */
function RoleDetailView({
  role,
  screens,
  existingNames,
}: {
  role: RoleInfoModel | null
  screens: ScreenDefinitionModel[]
  existingNames: string[]
}) {
  const copy = useCopy(rolesCopy)
  const navigate = useNavigate()
  const permission = useScreenPermission(AdminScreen.Roles)
  const { user } = useAuth()
  const isSuperAdmin = canManageAdminsSelf(user)

  const form = useRoleForm({ role, screens, existingNames })
  const readOnly = role === null ? !permission.canCreate : !permission.canUpdate

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const busy = form.isSubmitting || deletePending
  const guard = useUnsavedChangesGuard(form.isDirty && !busy && !readOnly)

  // Same two reasons the list's row shows (`RolesTable#deleteBlockedReason`) plus the permission.
  const deleteHint =
    role === null
      ? null
      : !permission.canDelete
        ? copy.noPermissionHint
        : role.userCount > 0
          ? copy.deleteInUseHint(role.userCount)
          : null

  async function confirmDelete() {
    if (role === null || deletePending) return
    setDeleteOpen(false)
    setDeletePending(true)
    setDeleteError(null)
    try {
      await deleteRole(role.id)
      // Same as `RolesPage`: re-read the actor's own rights before the panel draws the next screen.
      await refreshPermissions()
      // No `setDeletePending(false)` on success: this screen is being replaced, and the guard must
      // stay off for the navigation (the draft of a deleted role is meaningless).
      navigate('/admin/roles')
    } catch (err) {
      setDeleteError(rolesErrorMessage(copy, err, copy.errorActions.deleteRole))
      setDeletePending(false)
    }
  }

  const error = deleteError ?? form.error
  const title = role?.name ?? copy.newRoleTitle

  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/roles" className="transition-colors hover:text-neutral-800">
            {copy.title}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{title}</span>
        </>
      }
      breadcrumbsLabel={copy.breadcrumbAria}
      title={title}
      subtitle={copy.subtitle}
      controlZone={
        <>
          <AdminToolbar
            onCancel={form.reset}
            onSave={form.submit}
            // The create form has nothing to delete yet — no button at all, not a dead one.
            onDelete={role === null ? undefined : () => setDeleteOpen(true)}
            cancelState={{ disabled: !form.isDirty || busy }}
            saveState={{
              disabled: !form.canSubmit || readOnly || deletePending,
              pending: form.isSubmitting,
              hint: readOnly ? copy.noPermissionHint : null,
            }}
            deleteState={{ disabled: busy || deleteHint !== null, pending: deletePending, hint: deleteHint }}
          />
          {form.isDirty && !readOnly && <span className="text-xs text-neutral-500">{copy.unsavedChanges}</span>}
        </>
      }
      message={
        (error || form.showLagHint) && (
          <>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {form.showLagHint && !error && (
              <p
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                {copy.permissionLag}
              </p>
            )}
          </>
        )
      }
    >
      <RoleForm form={form} readOnly={readOnly} isSuperAdmin={isSuperAdmin} />

      <RoleDeleteModal
        role={deleteOpen ? role : null}
        pending={deletePending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </DataEntryScreenLayout>
  )
}
