import { useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import { MaintenanceFormLayout, buttonClassName } from '@/shared/ui'
import { AlertIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import { AdminScreen, canCreate, canDelete, canView, ensurePermissionsReady, refreshPermissions } from '@/shared/auth'
import { deleteRole, getRoles } from '@/features/admin/api/adminRoles'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { RolesTable } from './components/RolesTable'
import { RoleDeleteModal } from './components/RoleDeleteModal'
import { rolesCopy, rolesErrorMessage } from './lib/rolesCopy'

/**
 * The role list.
 *
 * Gated by the `roles` screen key like everything else (решение Давида 2026-08-22) — the seeded
 * "Администратор" gets it from its own matrix row (seeded true), not from special-cased code, so
 * it can just as easily be revoked from it.
 */
export async function rolesLoader() {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Roles)) throw redirect('/admin')

  const roles = await getRoles()
  return { roles }
}

/**
 * Template B — «Форма обслуживания» (`MaintenanceFormLayout`): the full set — create, rename,
 * delete — and no role is protected from any of it, which is what makes the records genuinely
 * equal. The permission matrix of a single role is the other half of the pair and lives on its own
 * screen (`/admin/roles/:id`, template A), never edited inline in this table.
 */
export function RolesPage() {
  const { roles } = useLoaderData<typeof rolesLoader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const copy = useCopy(rolesCopy)

  const [confirmTarget, setConfirmTarget] = useState<RoleInfoModel | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function confirmDelete() {
    if (confirmTarget === null || busyId !== null) return
    setActionError(null)
    setBusyId(confirmTarget.id)
    try {
      await deleteRole(confirmTarget.id)
      setConfirmTarget(null)
      await revalidator.revalidate()
      // Deleting a role cannot change the actor's own rights, but it can change what the seed
      // considers a valid role id; re-reading keeps the panel and the server in step for free.
      await refreshPermissions()
    } catch (err) {
      setActionError(rolesErrorMessage(copy, err, copy.errorActions.deleteRole))
      // Closed on failure too: the banner lives above the table, and a dialog in front of the
      // message explaining the failure would hide it (same choice `UsersPage` makes).
      setConfirmTarget(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <MaintenanceFormLayout
      title={copy.title}
      subtitle={copy.subtitle}
      /* Still a `Link`, not an `AdminActionButton`: it navigates to `/admin/roles/new`, and a
         button would lose middle-click / open-in-new-tab for no structural gain. */
      controlZone={
        canCreate(AdminScreen.Roles) && (
          <Link to="/admin/roles/new" className={`ml-auto ${buttonClassName('primary', 'md')}`}>
            {copy.create}
          </Link>
        )
      }
      message={
        actionError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )
      }
    >
      {/* No empty state: the four seeded roles always exist until someone deletes them. */}
      <RolesTable
        roles={roles}
        busyId={busyId}
        canDelete={canDelete(AdminScreen.Roles)}
        onOpen={(role) => navigate(`/admin/roles/${role.id}`)}
        onRequestDelete={setConfirmTarget}
      />

      <RoleDeleteModal
        role={confirmTarget}
        pending={busyId !== null}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </MaintenanceFormLayout>
  )
}
