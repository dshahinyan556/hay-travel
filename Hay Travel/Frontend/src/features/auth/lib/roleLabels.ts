/** Public-site labels for the role tiers. The admin panel has its own Russian-only copy in
 * `features/admin/users/lib/userCopy.ts` — this one goes through the dictionary because it is
 * rendered on the localised public site (account panel, user menu). */

import { RoleType } from '@/shared/auth'
import type { TranslationKey } from '@/shared/i18n/dictionary'

const KEYS: Record<RoleType, TranslationKey> = {
  [RoleType.Regular]: 'auth.role.regular',
  [RoleType.TourManager]: 'auth.role.tourManager',
  [RoleType.Admin]: 'auth.role.admin',
  [RoleType.Employee]: 'auth.role.employee',
}

/**
 * `null` means the account is on a CUSTOM role (its `UserRole.Type` is null, so the token carries
 * no role claim). The public `AuthUser` does not know that role's NAME and deliberately should not:
 * the internal names of an agency's roles are not customer-facing. A neutral "Сотрудник"/"Staff" is
 * the honest label here; the admin panel, which does have the name, shows `user.roleName`.
 */
export function roleLabelKey(role: RoleType | null): TranslationKey {
  return role === null ? 'auth.role.custom' : KEYS[role]
}
