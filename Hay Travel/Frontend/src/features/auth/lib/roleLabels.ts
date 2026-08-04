/** Public-site labels for the role tiers. The admin panel has its own Russian-only copy in
 * `features/admin/users/lib/userCopy.ts` — this one goes through the dictionary because it is
 * rendered on the localised public site (account panel, user menu). */

import { RoleType } from '@/shared/auth'
import type { TranslationKey } from '@/shared/i18n/dictionary'

const KEYS: Record<RoleType, TranslationKey> = {
  [RoleType.Regular]: 'auth.role.regular',
  [RoleType.TourManager]: 'auth.role.tourManager',
  [RoleType.Admin]: 'auth.role.admin',
}

export function roleLabelKey(role: RoleType): TranslationKey {
  return KEYS[role]
}
