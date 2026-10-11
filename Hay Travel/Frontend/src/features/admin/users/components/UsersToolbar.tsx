import { Input, Select, type SelectOption } from '@/shared/ui'
import { SearchIcon } from '@/shared/ui/icons'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { userCopy, type UserCopy } from '../lib/userCopy'
import type { RoleFilter, UserFilters, UserStatusFilter } from '../lib/filterUsers'

/** Options come from the loaded roles, not from a hard-coded tier list: a filter that cannot select
 * a user-created role would silently hide half the accounts it claims to cover. */
function roleOptions(copy: UserCopy, roles: RoleInfoModel[]): SelectOption[] {
  return [
    { value: 'all', label: copy.toolbar.allRoles },
    ...roles.map((role) => ({ value: String(role.id), label: role.name })),
  ]
}

function statusOptions(copy: UserCopy): SelectOption[] {
  return [
    { value: 'all', label: copy.toolbar.allStatuses },
    { value: 'verified', label: copy.status.verified },
    { value: 'unverified', label: copy.status.unverified },
    { value: 'locked', label: copy.status.locked },
  ]
}

function parseRoleFilter(value: string, roles: RoleInfoModel[]): RoleFilter {
  const id = Number(value)
  return roles.some((role) => role.id === id) ? id : 'all'
}

function parseStatusFilter(value: string): UserStatusFilter {
  return value === 'verified' || value === 'unverified' || value === 'locked' ? value : 'all'
}

interface UsersToolbarProps {
  filters: UserFilters
  onFiltersChange: (patch: Partial<UserFilters>) => void
  /** Every role, from `GET api/Roles`. `null` (not a system Admin) hides the role filter entirely —
   * an empty dropdown would be worse than no dropdown. */
  roles: RoleInfoModel[] | null
}

/** Search + role/status dropdowns for the users list. Stateless — the page owns the values and
 * does the filtering, same contract as `ProductsToolbar`. */
export function UsersToolbar({ filters, onFiltersChange, roles }: UsersToolbarProps) {
  const copy = useCopy(userCopy)

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        >
          <SearchIcon size={16} />
        </span>
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          placeholder={copy.toolbar.searchPlaceholder}
          aria-label={copy.toolbar.searchAria}
          className="pl-9"
        />
      </div>

      {roles !== null && (
        <div className="w-full sm:w-48">
          <Select
            surface="admin"
            value={String(filters.role)}
            onChange={(value) => onFiltersChange({ role: parseRoleFilter(value, roles) })}
            options={roleOptions(copy, roles)}
            aria-label={copy.toolbar.roleFilterAria}
          />
        </div>
      )}

      <div className="w-full sm:w-48">
        <Select
          surface="admin"
          value={filters.status}
          onChange={(value) => onFiltersChange({ status: parseStatusFilter(value) })}
          options={statusOptions(copy)}
          aria-label={copy.toolbar.statusFilterAria}
        />
      </div>
    </div>
  )
}
