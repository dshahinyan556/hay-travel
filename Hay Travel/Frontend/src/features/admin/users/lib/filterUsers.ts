/**
 * Pure client-side filtering for the users list — no state, no I/O. Same shape as
 * `products/lib/filterProducts.ts`: the page owns the filter values and calls this.
 *
 * The whole list is loaded at once (the backend has no paging and the table is small), so
 * filtering in the browser is both simpler and instant.
 */

import type { RoleType, UserInfoModel } from '@/shared/auth'

export type RoleFilter = 'all' | RoleType
export type UserStatusFilter = 'all' | 'verified' | 'unverified' | 'locked'

export interface UserFilters {
  /** Matched against name, username, email and phone (case-insensitive). */
  search: string
  role: RoleFilter
  status: UserStatusFilter
}

export const emptyUserFilters: UserFilters = { search: '', role: 'all', status: 'all' }

function haystack(user: UserInfoModel): string {
  return [user.firstName, user.lastName ?? '', user.username, user.email, user.phoneNumber]
    .join(' ')
    .toLowerCase()
}

export function filterUsers(users: UserInfoModel[], filters: UserFilters): UserInfoModel[] {
  const query = filters.search.trim().toLowerCase()

  return users.filter((user) => {
    if (query !== '' && !haystack(user).includes(query)) return false
    if (filters.role !== 'all' && user.role !== filters.role) return false
    if (filters.status === 'verified' && !user.isEmailVerified) return false
    if (filters.status === 'unverified' && user.isEmailVerified) return false
    if (filters.status === 'locked' && !user.isLocked) return false
    return true
  })
}
