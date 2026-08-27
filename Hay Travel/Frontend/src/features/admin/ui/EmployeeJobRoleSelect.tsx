import { Select } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { EmployeeJobRole } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { adminUiCopy } from './adminUiCopy'

/** Order of the options — the labels themselves are resolved per render from `adminEnumsCopy`,
 * so this stays a module constant while the captions follow the interface language. */
const ROLE_ORDER = [EmployeeJobRole.Driver, EmployeeJobRole.Guide, EmployeeJobRole.DriverGuide]

/** `Select` speaks strings; parse back exhaustively rather than casting — same convention as
 * `RoleSelect`'s `parseRole`, so an unexpected value degrades to "unchanged" instead of being
 * asserted into the type. */
function parseJobRole(value: string): EmployeeJobRole | null {
  if (value === String(EmployeeJobRole.Driver)) return EmployeeJobRole.Driver
  if (value === String(EmployeeJobRole.Guide)) return EmployeeJobRole.Guide
  if (value === String(EmployeeJobRole.DriverGuide)) return EmployeeJobRole.DriverGuide
  return null
}

export interface EmployeeJobRoleSelectProps {
  /** `null` — no role chosen yet (assignment is required to have one before it can be submitted;
   * this component only reports the pick, it does not enforce that). */
  value: EmployeeJobRole | null
  onChange: (role: EmployeeJobRole | null) => void
  disabled?: boolean
  /** Defaults to the localised "Роль…"/"Role…". */
  placeholder?: string
  className?: string
  'aria-label'?: string
  /** Adds a "Не задано" option that reports `null` — for the employee PROFILE's default role
   * (Задача D: optional there, unlike the assignment popup where a role is mandatory). Off by
   * default so the assignment call sites can't accidentally offer "no role". */
  allowClear?: boolean
  /** Caption of that option. Defaults to the localised "Не задано"/"Not set". */
  clearLabel?: string
}

/**
 * Role picker for the employee-assignment flow (Задача D) — used by `AssignEmployeesModal`
 * (orders feature) AND `UserDetailInfo` (users feature, the profile default), so
 * it lives here in `features/admin/ui` rather than under either feature's own `components/` — a
 * feature cannot import another feature's pieces (same rule `shared/types/booking.ts`'s doc
 * comment states for types).
 *
 * Deliberately dumb, same spirit as `RoleSelect`: it does not know about defaults from the
 * employee's profile or about the mandatory-role gate — both are the caller's concern (the caller
 * pre-fills `value` from `employee.defaultJobRole` and disables its own submit button while
 * `value` is `null`).
 */
export function EmployeeJobRoleSelect({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  'aria-label': ariaLabel,
  allowClear = false,
  clearLabel,
}: EmployeeJobRoleSelectProps) {
  const copy = useCopy(adminUiCopy).employeeJobRole
  const roleLabels = useCopy(adminEnumsCopy).employeeJobRole

  const roleOptions = ROLE_ORDER.map((role) => ({ value: String(role), label: roleLabels[role] }))
  const options = allowClear
    ? [{ value: '', label: clearLabel ?? copy.unset }, ...roleOptions]
    : roleOptions

  return (
    <Select
      surface="admin"
      value={value === null ? '' : String(value)}
      onChange={(next) => {
        if (next === '' && allowClear) {
          onChange(null)
          return
        }
        const role = parseJobRole(next)
        if (role !== null) onChange(role)
      }}
      options={options}
      placeholder={placeholder ?? copy.placeholder}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    />
  )
}
