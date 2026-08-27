import { Button, Checkbox, Field, Input, UnsavedChangesModal, buttonClassName } from '@/shared/ui'
import { Link } from 'react-router'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { AdminScreen, canManageAdmins as canManageAdminsSelf, canUpdate, useAuth } from '@/shared/auth'
import { PermissionMatrix } from '@/features/admin/ui/PermissionMatrix'
import type { RoleInfoModel, ScreenDefinitionModel } from '@/features/admin/types/roles'
import { useRoleForm } from '../hooks/useRoleForm'
import { rolesCopy } from '../lib/rolesCopy'

export interface RoleFormProps {
  /** `null` — creating a new role. */
  role: RoleInfoModel | null
  screens: ScreenDefinitionModel[]
  /** Names of the existing roles, for catching a duplicate before the request. */
  existingNames: string[]
}

/**
 * Name + matrix + actions. Owns nothing itself — `useRoleForm` holds the state, the matrix is the
 * shared presentational grid.
 *
 * No role — not even the seeded «Администратор» — opens locked any more (решение Давида
 * 2026-08-22): the card is read-only exactly when the signed-in session lacks `roles.Update`,
 * same rule as every other screen in the panel. The one field that stays SuperAdmin-exclusive
 * regardless of `roles.Update` is `canManageAdmins` — see the checkbox below.
 */
export function RoleForm({ role, screens, existingNames }: RoleFormProps) {
  const copy = useCopy(rolesCopy)
  const form = useRoleForm({ role, screens, existingNames })
  const readOnly = !canUpdate(AdminScreen.Roles)
  const { user } = useAuth()
  const isSuperAdmin = canManageAdminsSelf(user)
  const guard = useUnsavedChangesGuard(form.isDirty && !form.isSubmitting && !readOnly)

  return (
    <div className="flex flex-col gap-5">
      {form.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{form.error}</span>
        </div>
      )}

      {form.showLagHint && !form.error && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {copy.permissionLag}
        </p>
      )}

      <div className="max-w-md">
        <Field label={copy.nameLabel} htmlFor="role-name" required error={form.nameError ?? undefined} hint={copy.nameHint}>
          <Input
            id="role-name"
            value={form.name}
            maxLength={256}
            disabled={readOnly || form.isSubmitting}
            error={form.nameError !== null}
            onChange={(event) => form.setName(event.target.value)}
          />
        </Field>
      </div>

      {/* The two privileges that are NOT part of the matrix: both are cross-cutting, both are
          SuperAdmin-only, and both must be SENT on every save (the backend compares the submitted
          value with the stored one — an omitted field reads as "revoke", not as "unchanged"). */}
      <div className="flex max-w-md flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div>
          <Checkbox
            label={copy.canManageAdminsLabel}
            checked={form.canManageAdmins}
            disabled={!isSuperAdmin || form.isSubmitting}
            onChange={(event) => form.setCanManageAdmins(event.target.checked)}
          />
          <p className="mt-1 pl-[26px] text-xs text-neutral-500">
            {isSuperAdmin ? copy.canManageAdminsHint : copy.canManageAdminsLocked}
          </p>
        </div>

        <div>
          <Checkbox
            label={copy.canImpersonateLabel}
            checked={form.canImpersonate}
            disabled={!isSuperAdmin || form.isSubmitting}
            onChange={(event) => form.setCanImpersonate(event.target.checked)}
          />
          <p className="mt-1 pl-[26px] text-xs text-neutral-500">
            {isSuperAdmin ? copy.canImpersonateHint : copy.canManageAdminsLocked}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-neutral-500">{copy.matrixLevelExplain}</p>
        <PermissionMatrix
          mode="role"
          rows={form.rows}
          caption={copy.matrixCaption}
          disabled={readOnly || form.isSubmitting}
          onChange={form.setLevel}
        />
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {form.isDirty && <span className="mr-auto text-sm text-neutral-500">{copy.unsavedChanges}</span>}
          <Link to="/admin/roles" className={buttonClassName('ghost', 'md')}>
            {copy.cancel}
          </Link>
          <Button type="button" onClick={form.submit} disabled={!form.canSubmit} className="min-w-32">
            {form.isSubmitting ? copy.saving : copy.save}
          </Button>
        </div>
      )}

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
  )
}
