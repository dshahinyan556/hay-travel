/**
 * Public surface of the "auth" feature — `app/router.tsx` imports only from here. Everything
 * shared with the rest of the app (the store, `useAuth`, the permission predicates) lives in
 * `@/shared/auth`, not in this feature.
 */
export { AuthPage } from './AuthPage'
export { CheckEmailPage } from './CheckEmailPage'
export { VerifyEmailPage } from './VerifyEmailPage'
export { ForgotPasswordPage } from './ForgotPasswordPage'
export { ResetPasswordPage } from './ResetPasswordPage'
export { ChangePasswordPage } from './ChangePasswordPage'
