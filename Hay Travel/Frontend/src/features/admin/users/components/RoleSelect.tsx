import { Select } from '@/shared/ui'
import { RoleType } from '@/shared/auth'
import { buildRoleOptions } from '../lib/userCopy'

/** `Select` speaks strings; parse back exhaustively rather than casting, so an unexpected value
 * degrades to "unchanged" instead of being asserted into the type. */
function parseRole(value: string): RoleType | null {
  if (value === String(RoleType.Regular)) return RoleType.Regular
  if (value === String(RoleType.TourManager)) return RoleType.TourManager
  if (value === String(RoleType.Admin)) return RoleType.Admin
  if (value === String(RoleType.Employee)) return RoleType.Employee
  return null
}

interface RoleSelectProps {
  value: RoleType
  onChange: (role: RoleType) => void
  disabled: boolean
  /**
   * Whether «Администратор» is offered at all — `canManageAdmins(actor)` upstream (D3). The option
   * list is still guaranteed to contain the CURRENT value, so an Admin row reads correctly even
   * when this is false; see `buildRoleOptions`.
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
 * modal per page beats one per row. This component only reports "the visitor picked X".
 *
 * `disabled` covers three cases the caller distinguishes: a request in flight, the admin's OWN row
 * (the backend reports "you cannot demote yourself" and "you cannot demote the last admin" with the
 * same code, so blocking it here is what lets the message stay specific), and another Admin's row
 * when the actor is not the SuperAdmin.
 */
export function RoleSelect({ value, onChange, disabled, allowAdminOption, userLabel }: RoleSelectProps) {
  return (
    <Select
      surface="admin"
      value={String(value)}
      onChange={(next) => {
        const role = parseRole(next)
        if (role !== null && role !== value) onChange(role)
      }}
      options={buildRoleOptions(value, allowAdminOption)}
      disabled={disabled}
      aria-label={`Роль: ${userLabel}`}
    />
  )
}
