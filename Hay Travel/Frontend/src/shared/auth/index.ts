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
  MessageResultModel,
  RegisterRequest,
  UserDetailInfoModel,
  UserInfoModel,
} from './types'

export {
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
  resetPasswordRequest,
  verifyEmailRequest,
} from './authApi'

// Only the PREDICATES are exported, never the raw `isSuperAdmin` field's meaning: call sites ask
// `canManageAdmins(user)` so the SuperAdmin matrix stays in one file (ADR 011, decision 4).
export {
  canArchiveTours,
  canDeleteTours,
  canFeatureTours,
  canManageAdmins,
  canManageCatalog,
  canManageSettings,
  canManageTours,
  canManageUsers,
  canOpenAdminPanel,
  canPublishTours,
  canViewCatalog,
} from './permissions'
