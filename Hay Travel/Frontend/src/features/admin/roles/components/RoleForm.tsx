import { Checkbox, Field, Input } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { PermissionMatrix } from '@/features/admin/ui/PermissionMatrix'
import type { UseRoleFormResult } from '../hooks/useRoleForm'
import { rolesCopy } from '../lib/rolesCopy'

export interface RoleFormProps {
  /** State of the card — owned by `RoleDetailPage` (`useRoleForm`), which also hosts Save/Cancel/
   * Delete in the template-A toolbar and the error/lag banners in the `message` slot. */
  form: UseRoleFormResult
  /** No `roles.Update` (or `roles.Create` on the create form) — every field is disabled. */
  readOnly: boolean
  /** Only SuperAdmin may change `canManageAdmins`/`canImpersonate`. */
  isSuperAdmin: boolean
}

/**
 * Name + the two cross-cutting privileges + the matrix. Presentational: no state, no buttons, no
 * banners — the page owns all of it.
 *
 * No role — not even the seeded «Администратор» — opens locked any more (решение Давида
 * 2026-08-22): the card is read-only exactly when the signed-in session lacks the permission,
 * same rule as every other screen in the panel. The one field that stays SuperAdmin-exclusive
 * regardless of it is `canManageAdmins` — see the checkbox below.
 */
export function RoleForm({ form, readOnly, isSuperAdmin }: RoleFormProps) {
  const copy = useCopy(rolesCopy)

  return (
    <div className="flex flex-col gap-5">
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
    </div>
  )
}
