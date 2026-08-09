/**
 * Public surface of the "auth" feature — `app/router.tsx` imports only from here. Everything
 * shared with the rest of the app (the store, `useAuth`, the permission predicates) lives in
 * `@/shared/auth`, not in this feature.
 *
 * NOTE on the name (ADR 010, decision 1): this feature owns more than signing in — `account/` is
 * the signed-in profile screen (email / phone / password). It lives here rather than in a separate
 * `features/account` because it is built entirely out of this feature's own presentational layer
 * (`AuthShell`, `AuthField`, `PhoneField`, `passwordRules`), and features may not import from one
 * another in this codebase. Splitting it out would mean promoting six internal components to
 * `shared/` for a single consumer. If the account screen ever grows server state of its own
 * (bookings, favourites), that is the moment to reconsider.
 */
export { AuthPage, authPageLoader } from './AuthPage'
export { CheckEmailPage } from './CheckEmailPage'
export { VerifyEmailPage } from './VerifyEmailPage'
export { ForgotPasswordPage } from './ForgotPasswordPage'
export { ResetPasswordPage } from './ResetPasswordPage'
export { ChangePasswordPage } from './ChangePasswordPage'
export { ConfirmEmailChangePage } from './ConfirmEmailChangePage'
export { AccountPage, accountLoader } from './account/AccountPage'
