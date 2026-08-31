import { useState } from 'react'
import { Link, redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import {
  AdminScreen,
  adoptSession,
  canImpersonate,
  canManageAdmins,
  canOpenAdminPanel,
  canUpdate,
  canView,
  ensurePermissionsReady,
  getAuthState,
  getMySessions,
  refreshPermissions,
  useScreenPermission,
  type LoginHistoryEntryModel,
  type SessionModel,
  type UserDetailInfoModel,
} from '@/shared/auth'
import { AdminActionButton, DataEntryScreenLayout } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { MailIcon, UserIcon } from '@/shared/ui/icons'
import type { EmployeeJobRole } from '@/shared/types/employeeRole'
import type { LanguageCode } from '@/shared/types/language'
import {
  roleHoldsCanImpersonate,
  roleHoldsCanManageAdmins,
} from '@/features/admin/roles/lib/roleModel'
import {
  deleteUser,
  forcePasswordReset,
  getUserDetail,
  getUserLoginHistory,
  getUserPermissionOverrides,
  getUserSessions,
  impersonateUser,
  sendPasswordResetEmail,
  setUserJobRole,
  setUserPreferredLanguage,
} from '@/features/admin/api/adminUsers'
import { getRoles, getScreens } from '@/features/admin/api/adminRoles'
import type {
  RoleInfoModel,
  ScreenDefinitionModel,
  ScreenOverrideModel,
} from '@/features/admin/types/roles'
import { UserDetailHeader } from './components/UserDetailHeader'
import { UserDetailInfo } from './components/UserDetailInfo'
import { UserImpersonateModal } from './components/UserImpersonateModal'
import { UserPermissionsCard } from './components/UserPermissionsCard'
import { LoginHistoryList } from './components/LoginHistoryList'
import { UserSessionsList } from './components/UserSessionsList'
import { UserDangerZone, type DangerConfirmKind } from './components/UserDangerZone'
import { getStoredLocale } from '@/shared/lib/locale'
import { useCopy } from '@/shared/i18n/defineCopy'
import { userCopy, usersErrorMessage } from './lib/userCopy'

/**
 * Loads one account's detail for `:id`. Same permission gate as `usersLoader` (somebody without
 * `users.View` typing the URL directly must not see a raw 403 screen) plus a defensive id check,
 * mirroring `tourEditLoader`. A missing/deleted id 404s from `getUserDetail` itself and is NOT
 * caught here — it propagates to `AdminErrorBoundary`, per the F4 architecture note's point 2.
 *
 * The three permission-editor requests are made only for a system Admin (their endpoints are
 * Admin-only) and each degrades to `null`, exactly like the login history: a failing meta-endpoint
 * must not take the profile card down with it.
 */
export async function userDetailLoader({ params }: LoaderFunctionArgs) {
  await ensurePermissionsReady()
  if (!canView(AdminScreen.Users)) throw redirect('/admin')

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    // A loader runs outside React, so there is no `useCopy` here — the stored locale is read
    // directly, per `shared/i18n/defineCopy.ts`'s rule 3.
    throw new Response(userCopy(getStoredLocale()).errors.invalidId, { status: 400 })
  }

  // Mirrors the backend gate on the PermissionOverrides endpoints exactly
  // (`[RequiresPermission(AdminScreens.Users, PermissionAction.Update)]`) — no role, including a
  // fully-loaded one, gets this for free any more (решение Давида 2026-08-22).
  const canEditPermissions = canUpdate(AdminScreen.Users)

  // The role list has TWO independent consumers below: the override editor's baseline (needs
  // `canEditPermissions`) and `isTargetAdmin` in the danger zone (needs only `roles.View` — do NOT
  // narrow this to `canEditPermissions`, or an actor with `users.Delete` but not `users.Update`
  // would see the delete button unlocked for an account it cannot actually touch).
  const canReadRoles = canEditPermissions || canView(AdminScreen.Roles)

  /**
   * Живые сессии (spec 017 §4). На СВОЕЙ карточке читаются самообслуживающей ручкой, а не админской:
   * только она умеет пометить строку `isCurrent` (сравнивая хеш refresh-cookie вызывающего), а без
   * этой пометки экран предложил бы администратору отозвать тот самый сеанс, в котором он сейчас
   * работает. На чужой карточке `isCurrent` вычислить нечем — там всегда админская ручка.
   */
  const isSelf = getAuthState().user?.id === id

  // Parallel, but NOT equally critical: everything except the profile itself is caught and degrades
  // to `null`. The profile request is deliberately left uncaught — without it there is no page.
  const [user, sessions, loginHistory, overrides, screens, roles] = await Promise.all([
    getUserDetail(id),
    (isSelf ? getMySessions() : getUserSessions(id)).catch(() => null),
    getUserLoginHistory(id).catch(() => null),
    canEditPermissions
      ? getUserPermissionOverrides(id).catch(() => null)
      : Promise.resolve(null),
    canEditPermissions ? getScreens().catch(() => null) : Promise.resolve(null),
    // The role list supplies the BASELINE shown under every override cell: without "по роли:
    // разрешено" a three-state control is unreadable.
    canReadRoles ? getRoles().catch(() => null) : Promise.resolve(null),
  ])
  return { user, sessions, loginHistory, overrides, screens, roles, canEditPermissions }
}

export function UserDetailPage() {
  const data = useLoaderData<typeof userDetailLoader>()
  // Keyed by id so navigating between two profile URLs remounts with fresh local state instead of
  // carrying the previous user's confirm/error state over — same reasoning as `TourEditPage`.
  return (
    <UserDetailView
      key={data.user.id}
      user={data.user}
      sessions={data.sessions}
      loginHistory={data.loginHistory}
      overrides={data.overrides}
      screens={data.screens}
      roles={data.roles}
      canEditPermissions={data.canEditPermissions}
    />
  )
}

function UserDetailView({
  user,
  sessions,
  loginHistory,
  overrides,
  screens,
  roles,
  canEditPermissions,
}: {
  user: UserDetailInfoModel
  sessions: SessionModel[] | null
  loginHistory: LoginHistoryEntryModel[] | null
  overrides: ScreenOverrideModel[] | null
  screens: ScreenDefinitionModel[] | null
  roles: RoleInfoModel[] | null
  canEditPermissions: boolean
}) {
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const copy = useCopy(userCopy)
  const usersPermission = useScreenPermission(AdminScreen.Users)

  const [confirmKind, setConfirmKind] = useState<DangerConfirmKind | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Success half of the message slot. Only the reset-email action needs one: every other mutation
   * on this screen proves itself by the value it leaves behind on the page (the new role, the new
   * language, the row that disappeared), while an email leaves no trace here at all. */
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [jobRolePending, setJobRolePending] = useState(false)
  const [languagePending, setLanguagePending] = useState(false)
  const [resetEmailPending, setResetEmailPending] = useState(false)
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [impersonatePending, setImpersonatePending] = useState(false)

  /** Both banners are cleared together at the start of every mutation: a success notice left over
   * from the previous action, sitting next to a fresh error, reads as a contradiction. */
  function clearMessages() {
    setActionError(null)
    setActionNotice(null)
  }

  // Read once per render, same convention as `UsersPage` — neither the id nor the SuperAdmin flag
  // can change without a full re-navigation while this screen is open.
  const actor = getAuthState().user
  const isSelf = user.id === actor?.id
  // Mirrors `UsersTable`'s `isTargetAdmin` — see `roleHoldsCanManageAdmins` for why this is a
  // lookup by `roleId` and not a straight field comparison any more.
  const isTargetAdmin = roleHoldsCanManageAdmins(user.roleId, roles) && !isSelf
  /**
   * Неприкосновенность учётной записи главного администратора (`SuperAdminGuard`, 2026-08-27).
   *
   * Asked off the ACCOUNT's own flag, never off its role tier: the two are not the same question,
   * and the backend guard is keyed on the account. `isTargetAdmin` above happens to cover the
   * SuperAdmin in today's data only because that account also holds an admin-tier role — a
   * coincidence, not a rule, and one that stops holding the moment the flag and the role part ways.
   *
   * `&& !isSelf` is what keeps the SuperAdmin able to run their own profile normally: the guard
   * lets `target.Id == actingUserId` through, so the panel must too. Every check below reads this
   * flag, so the exemption is stated once, here.
   *
   * Unconditional by design — no `&& !canManageAdmins(actor)` escape hatch anywhere below, unlike
   * D3's tier rule: «нельзя, чтобы другие даже самые лютые админы не смогли ничего поделать с этим
   * акком» (решение Давида).
   */
  const isTargetSuperAdmin = user.isSuperAdmin && !isSelf
  // D3 (2026-08-09): another Admin's account is deletable — but only by the SuperAdmin. Self-delete
  // stays blocked for everyone, SuperAdmin included (D4). `users.Delete` is a precondition ON TOP of
  // those rules, not a replacement for them.
  const canDelete =
    usersPermission.canDelete &&
    !isSelf &&
    !isTargetSuperAdmin &&
    (!isTargetAdmin || canManageAdmins(actor))
  // Ordered by how specific the reason is, not by how the booleans above combine: the SuperAdmin
  // lock outranks the admin-tier one because it is the stricter of the two and the tier hint
  // ("может только главный администратор") would be an outright lie when even they cannot act.
  const deleteDisabledHint = !usersPermission.canDelete
    ? copy.detail.deleteNoPermissionHint
    : isSelf
      ? copy.detail.deleteSelfHint
      : isTargetSuperAdmin
        ? copy.detail.deleteSuperAdminHint
        : copy.detail.deleteAdminHint
  /**
   * `users.Update` narrowed by the same lock — one boolean for every edit on this screen that the
   * guard covers: force-reset and the reset link in the danger zone / control zone, the job role
   * and the email language in `UserDetailInfo`, the personal permission overrides. They are gated
   * together because the backend gates them together, in one shared guard call, not per endpoint.
   */
  const canEditUser = usersPermission.canUpdate && !isTargetSuperAdmin
  // Same two-reason shape as `deleteDisabledHint`, and read only when the action is actually
  // locked: with `canEditUser` false there are exactly two ways to get here, and having the
  // permission is what identifies the other one.
  const resetDisabledHint = !usersPermission.canUpdate
    ? copy.detail.resetNoPermissionHint
    : copy.detail.resetSuperAdminHint
  const userLabel = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username

  /**
   * «Войти как пользователь» (spec 014 §3). Offered when the signed-in account carries the
   * `can_impersonate` claim and this is somebody else's profile — the same claim
   * `[RequiresImpersonate]` checks server-side, read through the `shared/auth` predicate like every
   * other non-matrix privilege (`canManageAdmins`), never off `user.role`.
   */
  const showImpersonate = canImpersonate(actor) && !isSelf
  /**
   * The backend additionally refuses an ELEVATED target unless the actor is the SuperAdmin
   * (`ImpersonationTargetNotAllowed`, 2218). Predicted here so the button explains itself instead
   * of failing — but only DISABLED, not hidden: when `roles` could not be read this answers `false`
   * and the action stays live, with 2218 surfacing as an inline message if it really was blocked.
   */
  const targetIsElevated =
    roleHoldsCanManageAdmins(user.roleId, roles) || roleHoldsCanImpersonate(user.roleId, roles)
  const impersonateBlocked = targetIsElevated && !canManageAdmins(actor)

  function openConfirm(kind: DangerConfirmKind) {
    if (pending) return
    clearMessages()
    setConfirmKind(kind)
  }

  function cancelConfirm() {
    if (pending) return
    setConfirmKind(null)
  }

  /** Задача D — immediate `PATCH`, no separate Save (same UX as `RoleSelect`). Not folded into the
   * page's `pending`/`confirm` flow above: it has no confirmation step and isn't a danger-zone
   * action, so it gets its own tiny pending flag instead. */
  async function handleChangeJobRole(jobRole: EmployeeJobRole | null) {
    if (jobRolePending) return
    setJobRolePending(true)
    clearMessages()
    try {
      await setUserJobRole({ userId: user.id, jobRole })
      await revalidator.revalidate()
    } catch (err) {
      setActionError(usersErrorMessage(copy, err, copy.errorActions.changeJobRole))
    } finally {
      setJobRolePending(false)
    }
  }

  /** Язык писем (редизайн 2026-08-23) — same immediate-PATCH shape as `handleChangeJobRole`, with
   * its own pending flag for the same reason: no confirmation step, not a danger-zone action. */
  async function handleChangePreferredLanguage(preferredLanguage: LanguageCode) {
    if (languagePending) return
    setLanguagePending(true)
    clearMessages()
    try {
      await setUserPreferredLanguage({ userId: user.id, preferredLanguage })
      await revalidator.revalidate()
    } catch (err) {
      setActionError(usersErrorMessage(copy, err, copy.errorActions.changePreferredLanguage))
    } finally {
      setLanguagePending(false)
    }
  }

  /**
   * Письмо со ссылкой на смену пароля (2026-08-27). Not the same action as the danger zone's
   * «Принудительный сброс пароля»: that one only raises `ForceToChangePass` and mails nothing, so
   * it does not help the one person who actually needs help — a client who cannot sign in to reach
   * the prompt in the first place. This runs the self-service forgot-password flow FOR them.
   *
   * No confirmation modal, unlike the two danger-zone actions: nothing is lost or locked by it, the
   * link is a second route into the account and not a replacement for the current password. The
   * only thing it needs to answer is "did it go, and to which address" — hence the notice banner
   * rather than a silent success, since a sent email leaves no visible trace on this screen.
   *
   * Same immediate-request shape as the two handlers above, with its own pending flag for the same
   * reason. `revalidator` is deliberately NOT called: the endpoint changes nothing the page shows.
   */
  async function handleSendPasswordResetEmail() {
    if (resetEmailPending) return
    setResetEmailPending(true)
    clearMessages()
    try {
      // The server's own `message` (English, and `devToken` with no mail provider configured) is
      // not for the panel — the localised confirmation is ours.
      await sendPasswordResetEmail(user.id)
      setActionNotice(copy.passwordResetEmail.sent(user.email))
    } catch (err) {
      setActionError(usersErrorMessage(copy, err, copy.errorActions.sendPasswordResetEmail))
    } finally {
      setResetEmailPending(false)
    }
  }

  /**
   * Sign in as this account. The one action on this page that ends the ACTOR's own session: by the
   * time the response lands the backend has revoked their refresh tokens and blacklisted their
   * access token (spec 014 §8), so there is nothing to keep and nothing to roll back to —
   * `adoptSession` replaces the whole client-side session with the target's, exactly as a fresh
   * login would.
   *
   * The permission snapshot in memory still belongs to the admin at that moment, so it is re-read
   * BEFORE navigating: otherwise the very next screen would render guards for the wrong identity.
   *
   * Destination (JUDGEMENT CALL — the spec does not pin it down): the panel if the target reaches
   * anything under `/admin`, the public site otherwise. `canOpenAdminPanel` reads exactly that —
   * the `is_admin`/non-empty `perms` claims of the token just issued FOR THE TARGET — so the
   * decision is made on their resolved rights, not on a guess.
   */
  async function confirmImpersonation() {
    if (impersonatePending) return
    setImpersonatePending(true)
    clearMessages()
    try {
      adoptSession(await impersonateUser(user.id))
      await refreshPermissions()
      // No `setImpersonatePending(false)` on this path, deliberately: this screen is being replaced
      // by the destination route, and the button should stay in its pending state until it is
      // rather than flashing back to idle for the frame before the navigation lands.
      navigate(canOpenAdminPanel(getAuthState().user) ? '/admin' : '/', { replace: true })
    } catch (err) {
      // Close the dialog first: the message belongs in the page's message slot (the convention
      // every other mutation on this screen follows), and it would be hidden behind the modal.
      setImpersonateOpen(false)
      setActionError(usersErrorMessage(copy, err, copy.errorActions.impersonate))
      setImpersonatePending(false)
    }
  }

  async function confirm() {
    if (confirmKind === null || pending) return
    setPending(true)
    clearMessages()
    try {
      if (confirmKind === 'delete') {
        await deleteUser(user.id)
        // Deliberately no `revalidator.revalidate()` here: that would re-run THIS route's own
        // loader (`getUserDetail`), which now 404s for a just-deleted, filtered-out id (B13's
        // `!IsDeleted` filter covers the detail endpoint too) — surfacing an error screen for a
        // fraction of a second before the navigation below even lands. `navigate` alone is enough;
        // `/admin/users` runs its own fresh `usersLoader` on arrival, which already excludes the
        // now-deleted account.
        navigate('/admin/users')
        return
      }
      await forcePasswordReset(user.id)
      setConfirmKind(null)
      await revalidator.revalidate()
    } catch (err) {
      setActionError(
        usersErrorMessage(
          copy,
          err,
          confirmKind === 'delete' ? copy.errorActions.deleteUser : copy.errorActions.resetPassword,
        ),
      )
    } finally {
      setPending(false)
    }
  }

  /**
   * Template A — «Экран ввода данных» (`DataEntryScreenLayout`): breadcrumbs → title/subtitle →
   * control zone → message slot → body, the same chrome the Order screen established as canon.
   * The breadcrumb, `<h1>` and `HelpButton` used to live inside `UserDetailHeader`; that component
   * is now only the record-identity card at the top of the body.
   *
   * No `AdminToolbar` in the control zone: this screen has no page-level draft to save or cancel —
   * every edit on it (job role, overrides, danger zone) commits on its own. What belongs there is
   * the contextual action, which is impersonation.
   */
  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/users" className="transition-colors hover:text-neutral-800">
            {copy.page.title}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{userLabel}</span>
        </>
      }
      breadcrumbsLabel={copy.header.breadcrumbAria}
      title={userLabel}
      controlZone={
        <HelpRevealZone className="flex flex-wrap items-center gap-3">
          {showImpersonate && (
            <AdminActionButton
              label={copy.impersonate.button}
              pendingLabel={copy.impersonate.pending}
              icon={<UserIcon size={17} />}
              variant="secondary"
              pending={impersonatePending}
              disabled={impersonateBlocked}
              title={impersonateBlocked ? copy.impersonate.elevatedHint : undefined}
              onClick={() => {
                clearMessages()
                setImpersonateOpen(true)
              }}
            />
          )}
          {/* Здесь, а не в «опасной зоне»: письмо со ссылкой ничего не ломает и не отбирает у
              пользователя доступ — в отличие от принудительного сброса, который стоит там. Это
              такое же контекстное действие над учётной записью, как и вход от её имени, поэтому
              живёт рядом с ним и в том же нейтральном `secondary`-стиле. Скрыто, а не заблокировано,
              без `users.Update` — та же логика, что у `showImpersonate`: кнопка, которая не сработает
              ни при каких условиях, не объясняет ничего, чего нет в «Ролях и правах». */}
          {usersPermission.canUpdate && (
            <AdminActionButton
              label={copy.passwordResetEmail.button}
              pendingLabel={copy.passwordResetEmail.pending}
              icon={<MailIcon size={17} />}
              variant="secondary"
              pending={resetEmailPending}
              // Disabled rather than hidden for a SuperAdmin target, the same split the impersonate
              // button makes: missing permission hides the action, a rule about THIS account keeps
              // it visible so the `title` can say what the rule is.
              disabled={isTargetSuperAdmin}
              title={isTargetSuperAdmin ? copy.passwordResetEmail.superAdminHint : undefined}
              onClick={() => void handleSendPasswordResetEmail()}
            />
          )}
          <HelpButton surface="admin" title={copy.detail.helpTitle}>
            {copy.detail.helpBody}
          </HelpButton>
        </HelpRevealZone>
      }
      message={
        // Guarded as a whole rather than per banner: the layout's message slot is a `flex` column
        // with a gap, so an always-truthy fragment would leave an empty row between the control
        // zone and the body even with both banners silent.
        (actionError || actionNotice) && (
          <>
            {actionError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <span aria-hidden="true">⚠️</span>
                <span>{actionError}</span>
              </div>
            )}
            {/* `status`, not `alert`: a confirmation is not urgent enough to interrupt a screen
                reader mid-sentence. Same emerald banner `UserPermissionsCard` uses for its own
                "saved" notice — the two never appear at once, but they should read as one language
                when the admin meets them one after the other. */}
            {actionNotice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <span aria-hidden="true">✓</span>
                <span>{actionNotice}</span>
              </div>
            )}
          </>
        )
      }
    >
      <UserDetailHeader user={user} />

      <UserDetailInfo
        user={user}
        onChangeJobRole={(role) => void handleChangeJobRole(role)}
        jobRolePending={jobRolePending}
        onChangePreferredLanguage={(language) => void handleChangePreferredLanguage(language)}
        languagePending={languagePending}
        canUpdate={canEditUser}
      />

      {/* Between the account's data and its login history: an override is a SETTING of the account,
          while the history is reference context for the destructive actions further down.
          Admin-only — editing overrides is administering the permission system itself. */}
      {canEditPermissions && (
        <UserPermissionsCard
          userId={user.id}
          roleName={user.roleName}
          rolePermissions={roles?.find((role) => role.id === user.roleId)?.permissions ?? null}
          overrides={overrides}
          screens={screens}
          canEdit={canEditUser}
          onSaved={() => void revalidator.revalidate()}
        />
      )}

      {/* Живые сессии — ВЫШЕ истории входов: это текущее состояние, с которым можно что-то сделать
          прямо сейчас, а история — только справка. То, зачем админ сюда пришёл действовать, стоит
          выше того, зачем он пришёл читать. */}
      <UserSessionsList
        userId={user.id}
        sessions={sessions}
        // `|| isSelf`: на своей карточке компонент дёргает самообслуживающие ручки
        // (`api/Auth/Sessions…`), которым право `users.Update` не нужно вовсе — свои устройства
        // человек отключает и без него, ровно как на `/account`.
        canRevoke={canEditUser || isSelf}
        isSelf={isSelf}
        onRevoked={() => void revalidator.revalidate()}
      />

      {/* Between the read-only data and the destructive actions: it is context for the decisions
          below it, not an action of its own. */}
      <LoginHistoryList entries={loginHistory} />

      <UserDangerZone
        userLabel={userLabel}
        canDelete={canDelete}
        canReset={canEditUser}
        resetDisabledHint={resetDisabledHint}
        targetIsAdmin={isTargetAdmin}
        deleteDisabledHint={deleteDisabledHint}
        confirmKind={confirmKind}
        pending={pending}
        onRequestDelete={() => openConfirm('delete')}
        onRequestReset={() => openConfirm('reset')}
        onCancelConfirm={cancelConfirm}
        onConfirm={confirm}
      />

      <UserImpersonateModal
        open={impersonateOpen}
        userLabel={userLabel}
        pending={impersonatePending}
        onCancel={() => setImpersonateOpen(false)}
        onConfirm={() => void confirmImpersonation()}
      />
    </DataEntryScreenLayout>
  )
}
