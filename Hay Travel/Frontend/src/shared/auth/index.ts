/**
 * Public surface of the auth core. Features import from `@/shared/auth`, never from the files
 * inside it — that keeps the internal dependency direction (`http ← authApi ← authStore ←
 * authFetch`) an implementation detail nobody can accidentally short-circuit.
 */

export { RoleType } from './types'
export type {
  AuthState,
  AuthStatus,
  AuthUser,
  ChangePasswordRequest,
  ChangeRoleRequest,
  LoginHistoryEntryModel,
  LoginRequest,
  LoginResultModel,
  MessageResultModel,
  MyPermissionsModel,
  MyScreenPermissionModel,
  RegisterRequest,
  SetUserJobRoleModel,
  SetUserPreferredLanguageModel,
  UserDetailInfoModel,
  UserInfoModel,
} from './types'

export {
  AccessLevel,
  AdminScreen,
  ALL_ACCESS_LEVELS,
  ALL_PERMISSION_ACTIONS,
  ALL_SCREEN_KEYS,
  CATALOG_SCREEN_KEYS,
  levelAllows,
  PermissionAction,
} from './screens'
export type { KnownScreenKey, ScreenKey } from './screens'

export {
  adoptSession,
  applyUser,
  clearForceChangePassword,
  ensureAuthReady,
  getAuthState,
  login,
  logout,
  refreshAccessToken,
  register,
  subscribeAuth,
  toAuthUser,
} from './authStore'

export { authFetch, SessionExpiredError } from './authFetch'
export { useAuth } from './useAuth'
export { AuthErrorCode, authErrorCodeOf, authErrorMessageKey } from './authErrors'

export {
  forgotPasswordRequest,
  resendVerificationRequest,
  resetPasswordRequest,
  verifyEmailRequest,
} from './authApi'

// Only the PREDICATES are exported, never the raw `isSuperAdmin`/`hasPanelAccess` fields' meaning:
// call sites ask `canManageAdmins(user)` / `canOpenAdminPanel(user)` so those two matrices stay in
// one file (ADR 011, decision 4; ADR 024, decision 1).
export {
  can,
  canCreate,
  canDelete,
  canImpersonate,
  canManageAdmins,
  canOpenAdminPanel,
  canUpdate,
  canView,
  canViewAny,
  hasAnyScreenAccess,
} from './permissions'

// `invalidatePermissions`/`clearPermissions` are deliberately NOT here: they are the private wiring
// between `authStore` and `permissionStore`, and a feature calling them would desynchronise the
// matrix from the session that owns it.
export { ensurePermissionsReady, getPermissions, refreshPermissions } from './permissionStore'
export type { PermissionSnapshot, PermissionStatus, ScreenPermission } from './permissionStore'
export { usePermissions, useScreenPermission } from './usePermissions'
