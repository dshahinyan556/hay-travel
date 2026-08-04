import { Select, type SelectOption } from '@/shared/ui'
import { RoleType } from '@/shared/auth'
import { roleLabels } from '../lib/userCopy'

const OPTIONS: SelectOption[] = [
  { value: String(RoleType.Regular), label: roleLabels[RoleType.Regular] },
  { value: String(RoleType.TourManager), label: roleLabels[RoleType.TourManager] },
  { value: String(RoleType.Admin), label: roleLabels[RoleType.Admin] },
]

/** `Select` speaks strings; parse back exhaustively rather than casting, so an unexpected value
 * degrades to "unchanged" instead of being asserted into the type. */
function parseRole(value: string): RoleType | null {
  if (value === String(RoleType.Regular)) return RoleType.Regular
  if (value === String(RoleType.TourManager)) return RoleType.TourManager
  if (value === String(RoleType.Admin)) return RoleType.Admin
  return null
}

interface RoleSelectProps {
  value: RoleType
  onChange: (role: RoleType) => void
  disabled: boolean
  /** Row owner's name — used for the accessible label, since the visible one is a column header. */
  userLabel: string
}

/**
 * Per-row role picker. Changing it is an immediate `PATCH` upstream — there is no save button,
 * matching the publish toggle on the products table.
 *
 * `disabled` covers two cases the caller distinguishes: a request in flight, and the admin's OWN
 * row. The latter is enforced here because the backend reports "you cannot demote yourself" and
 * "you cannot demote the last admin" with the SAME error code (2001) — blocking self-demotion in
 * the UI is what lets the error message for 2001 be specific and correct.
 */
export function RoleSelect({ value, onChange, disabled, userLabel }: RoleSelectProps) {
  return (
    <Select
      surface="admin"
      value={String(value)}
      onChange={(next) => {
        const role = parseRole(next)
        if (role !== null && role !== value) onChange(role)
      }}
      options={OPTIONS}
      disabled={disabled}
      aria-label={`Роль: ${userLabel}`}
    />
  )
}
