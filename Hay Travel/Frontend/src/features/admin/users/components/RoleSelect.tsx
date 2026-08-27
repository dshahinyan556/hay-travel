import { Select } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { buildRoleOptions, userCopy } from '../lib/userCopy'

interface RoleSelectProps {
  /** The `UserRole` ROW id (`user.roleId`), which is what `ChangeRole` expects — not a `RoleType`. */
  value: number
  /** Name of the account's current role — rendered as static text when the picker is unavailable. */
  valueName: string
  /**
   * Every assignable role, from `GET api/Roles`. `null` means the list could not be loaded, which in
   * practice means the signed-in staff member is not a system Admin: that endpoint is Admin-only.
   * The row then shows the role as read-only text rather than an empty dropdown.
   */
  roles: RoleInfoModel[] | null
  onChange: (role: RoleInfoModel) => void
  disabled: boolean
  /**
   * Whether roles of the built-in Admin tier are offered at all — `canManageAdmins(actor)` upstream
   * (D3). The option list is still guaranteed to contain the CURRENT role, so an Admin row reads
   * correctly even when this is false; see `buildRoleOptions`.
   */
  allowAdminOption: boolean
  /** Row owner's name — used for the accessible label, since the visible one is a column header. */
  userLabel: string
}

/**
 * Per-row role picker. Changing it is an immediate `PATCH` upstream — there is no save button,
 * matching the publish toggle on the products table.
 *
 * Deliberately DUMB: it does not know that promoting to Admin needs a confirmation. That belongs to
 * whoever owns the mutation (`UsersPage`), because the confirmation is a page-level modal and one
 * modal per page beats one per row. This component only reports "the visitor picked role X" — and
 * it reports the whole `RoleInfoModel`, not just an id, so the caller can decide about the
 * confirmation without looking the role up again.
 *
 * `disabled` covers three cases the caller distinguishes: a request in flight, the admin's OWN row
 * (the backend reports "you cannot demote yourself" and "you cannot demote the last admin" with the
 * same code, so blocking it here is what lets the message stay specific), and another Admin's row
 * when the actor is not the SuperAdmin.
 */
export function RoleSelect({
  value,
  valueName,
  roles,
  onChange,
  disabled,
  allowAdminOption,
  userLabel,
}: RoleSelectProps) {
  const copy = useCopy(userCopy)

  if (roles === null) {
    return <span className="text-sm text-neutral-700">{valueName}</span>
  }

  return (
    <Select
      surface="admin"
      value={String(value)}
      onChange={(next) => {
        const picked = roles.find((role) => String(role.id) === next)
        // An unknown value degrades to "unchanged" rather than being asserted into the type.
        if (picked !== undefined && picked.id !== value) onChange(picked)
      }}
      options={buildRoleOptions(roles, value, allowAdminOption)}
      disabled={disabled}
      aria-label={copy.table.roleAria(userLabel)}
    />
  )
}

/** Does this role hold `CanManageAdmins`? The one transition that needs a confirmation (D5) —
 * keyed on the flag itself, not on `role.type`, since any role (built-in or custom) can carry it
 * now (решение Давида 2026-08-22). */
export function isAdminRole(role: RoleInfoModel): boolean {
  return role.canManageAdmins
}
