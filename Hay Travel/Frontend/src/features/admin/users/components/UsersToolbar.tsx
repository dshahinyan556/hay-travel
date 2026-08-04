import { Input, Select, type SelectOption } from '@/shared/ui'
import { RoleType } from '@/shared/auth'
import { roleLabels } from '../lib/userCopy'
import type { RoleFilter, UserFilters, UserStatusFilter } from '../lib/filterUsers'

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Все роли' },
  { value: String(RoleType.Regular), label: roleLabels[RoleType.Regular] },
  { value: String(RoleType.TourManager), label: roleLabels[RoleType.TourManager] },
  { value: String(RoleType.Admin), label: roleLabels[RoleType.Admin] },
]

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Все статусы' },
  { value: 'verified', label: 'Подтверждён' },
  { value: 'unverified', label: 'Не подтверждён' },
  { value: 'locked', label: 'Заблокирован' },
]

function parseRoleFilter(value: string): RoleFilter {
  if (value === String(RoleType.Regular)) return RoleType.Regular
  if (value === String(RoleType.TourManager)) return RoleType.TourManager
  if (value === String(RoleType.Admin)) return RoleType.Admin
  return 'all'
}

function parseStatusFilter(value: string): UserStatusFilter {
  return value === 'verified' || value === 'unverified' || value === 'locked' ? value : 'all'
}

interface UsersToolbarProps {
  filters: UserFilters
  onFiltersChange: (patch: Partial<UserFilters>) => void
}

/** Search + role/status dropdowns for the users list. Stateless — the page owns the values and
 * does the filtering, same contract as `ProductsToolbar`. */
export function UsersToolbar({ filters, onFiltersChange }: UsersToolbarProps) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        >
          🔍
        </span>
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          placeholder="Поиск по имени, логину, email или телефону…"
          aria-label="Поиск пользователей"
          className="pl-9"
        />
      </div>

      <div className="w-full sm:w-48">
        <Select
          surface="admin"
          value={String(filters.role)}
          onChange={(value) => onFiltersChange({ role: parseRoleFilter(value) })}
          options={ROLE_OPTIONS}
          aria-label="Фильтр по роли"
        />
      </div>

      <div className="w-full sm:w-48">
        <Select
          surface="admin"
          value={filters.status}
          onChange={(value) => onFiltersChange({ status: parseStatusFilter(value) })}
          options={STATUS_OPTIONS}
          aria-label="Фильтр по статусу"
        />
      </div>
    </div>
  )
}
