import { useMemo, useState } from 'react'
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
import {
  AdminActionsMenu,
  AdminToolbar,
  DataEntryScreenLayout,
  UnsavedChangesModal,
  type AdminActionsMenuItem,
} from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { AlertIcon, CheckIcon } from '@/shared/ui/icons'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import type { EmployeeJobRole } from '@/shared/types/employeeRole'
import type { LanguageCode } from '@/shared/types/language'
import {
  applyLevelChange,
  areOverridesDirty,
  buildOverrideMatrixRows,
  clearAllOverrides,
  countOverrides,
  roleHoldsCanImpersonate,
  roleHoldsCanManageAdmins,
  rowsToOverrides,
} from '@/features/admin/roles/lib/roleModel'
import { rolesCopy, rolesErrorMessage } from '@/features/admin/roles/lib/rolesCopy'
import { adminScreensCopy } from '@/features/admin/lib/adminScreensCopy'
import type { PermissionMatrixRow } from '@/features/admin/ui/PermissionMatrix'
import {
  deleteUser,
  forcePasswordReset,
  getUserDetail,
  getUserLoginHistory,
  getUserPermissionOverrides,
  getUserSessions,
  impersonateUser,
  putUserPermissionOverrides,
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

/** Несохранённые правки карточки. `undefined` у поля — «не трогали». */
interface UserDraft {
  jobRole?: EmployeeJobRole | null
  preferredLanguage?: LanguageCode
  /** Полный набор строк редактора персональных прав, если его трогали. */
  overrideRows?: PermissionMatrixRow[]
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
  const rolesC = useCopy(rolesCopy)
  const screensCopy = useCopy(adminScreensCopy)
  const usersPermission = useScreenPermission(AdminScreen.Users)

  const [confirmKind, setConfirmKind] = useState<DangerConfirmKind | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Success half of the message slot. Only the reset-email action needs one: every other mutation
   * on this screen proves itself by the value it leaves behind on the page (the new role, the new
   * language, the row that disappeared), while an email leaves no trace here at all. */
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<UserDraft>({})
  const [savePending, setSavePending] = useState(false)
  /** «Права сохранены, на сервере применятся в течение 15 минут» — после Save с правками прав. */
  const [showLagHint, setShowLagHint] = useState(false)
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

  /**
   * Разовые действия над учётной записью — в «…» тулбара, как «Назначить»/«Отправить» у заказа:
   * немедленные, с собственным подтверждением/результатом, в черновик не входят. Отдельными
   * кнопками рядом с тулбаром они раздували закреплённую зону управления на мобиле до трёх строк.
   *
   * «Войти как пользователь» — только при `can_impersonate` у сессии и на чужой карточке
   * (`showImpersonate`); для «повышенной» цели — видно, но заблокировано с причиной.
   * «Ссылка на смену пароля» — скрыта без `users.Update` (кнопка, которая не сработает ни при
   * каких условиях, ничего не объясняет), заблокирована с причиной для главного администратора.
   */
  const accountActions: AdminActionsMenuItem[] = [
    ...(showImpersonate
      ? [
          {
            label: copy.impersonate.button,
            onClick: () => {
              clearMessages()
              setImpersonateOpen(true)
            },
            disabled: impersonateBlocked,
            hint: impersonateBlocked ? copy.impersonate.elevatedHint : null,
          },
        ]
      : []),
    ...(usersPermission.canUpdate
      ? [
          {
            label: copy.passwordResetEmail.button,
            onClick: () => void handleSendPasswordResetEmail(),
            disabled: isTargetSuperAdmin,
            hint: isTargetSuperAdmin ? copy.passwordResetEmail.superAdminHint : null,
          },
        ]
      : []),
  ]

  function openConfirm(kind: DangerConfirmKind) {
    if (pending) return
    clearMessages()
    setConfirmKind(kind)
  }

  function cancelConfirm() {
    if (pending) return
    setConfirmKind(null)
  }

  /**
   * Черновик карточки (2026-10-11, шаблон A как у заказа): роль исполнителя по умолчанию, язык
   * писем и персональные права больше не сохраняются мгновенно — копятся здесь и уходят одним
   * Save тулбара. `undefined` = не трогали. Сеттеры выкидывают значение, вернувшееся к
   * сохранённому, а dirty считается сравнением с baseline, а не фактом «трогали».
   *
   * Разовые действия над учётной записью (вход от имени, письмо со ссылкой, сброс пароля,
   * удаление, завершение сеансов) в черновик НЕ входят — как Approve/Reject у заказа.
   */
  const jobRoleDirty = draft.jobRole !== undefined && draft.jobRole !== user.defaultJobRole
  const languageDirty = draft.preferredLanguage !== undefined && draft.preferredLanguage !== user.preferredLanguage

  const rolePermissions = roles?.find((role) => role.id === user.roleId)?.permissions ?? null
  /** Сохранённые персональные права в виде строк редактора. Черновик сравнивается с ЭТИМ, а не с
   * сырым ответом сервера: тот может содержать строки с `level: null`, ключи, которых уже нет в
   * реестре экранов, и уровни без `capLevel` — тогда «ничего не меняли» уже давало разную
   * длину/уровни (реальная причина ложного «есть изменения» в прежнем `UserPermissionsCard`). */
  const baselineOverrideRows = useMemo<PermissionMatrixRow[] | null>(
    () =>
      screens === null || rolePermissions === null || overrides === null
        ? null
        : buildOverrideMatrixRows(screens, rolePermissions, overrides, screensCopy),
    [screens, rolePermissions, overrides, screensCopy],
  )
  const baselineOverrides = useMemo(
    () => (baselineOverrideRows === null ? [] : rowsToOverrides(baselineOverrideRows)),
    [baselineOverrideRows],
  )
  const overridesDirty =
    draft.overrideRows !== undefined && areOverridesDirty(rowsToOverrides(draft.overrideRows), baselineOverrides)

  const dirty = jobRoleDirty || languageDirty || overridesDirty
  const guard = useUnsavedChangesGuard(dirty && !savePending && !pending)

  function setJobRole(jobRole: EmployeeJobRole | null) {
    setDraft((prev) => ({ ...prev, jobRole: jobRole === user.defaultJobRole ? undefined : jobRole }))
  }

  function setPreferredLanguage(language: LanguageCode) {
    setDraft((prev) => ({
      ...prev,
      preferredLanguage: language === user.preferredLanguage ? undefined : language,
    }))
  }

  function changeOverrideRows(change: (rows: PermissionMatrixRow[]) => PermissionMatrixRow[]) {
    if (baselineOverrideRows === null) return
    setShowLagHint(false)
    setDraft((prev) => {
      const next = change(prev.overrideRows ?? baselineOverrideRows)
      const unchanged = !areOverridesDirty(rowsToOverrides(next), baselineOverrides)
      return { ...prev, overrideRows: unchanged ? undefined : next }
    })
  }

  function handleCancel() {
    setDraft({})
    clearMessages()
  }

  /** Один Save на всю карточку. Поля пользователя и персональные права — разные ручки с разными
   * разборами ошибок, поэтому два шага; при частичной неудаче черновик не сбрасывается, а
   * ревалидация подтягивает то, что успело сохраниться, — dirty по сравнению это учтёт сам. */
  async function handleSave() {
    if (savePending || !dirty || !canEditUser) return
    setSavePending(true)
    clearMessages()
    setShowLagHint(false)
    let failed = false
    try {
      const calls: Promise<unknown>[] = []
      if (jobRoleDirty) calls.push(setUserJobRole({ userId: user.id, jobRole: draft.jobRole ?? null }))
      if (languageDirty && draft.preferredLanguage !== undefined) {
        calls.push(setUserPreferredLanguage({ userId: user.id, preferredLanguage: draft.preferredLanguage }))
      }
      await Promise.all(calls)
    } catch (err) {
      failed = true
      setActionError(usersErrorMessage(copy, err, copy.errorActions.saveChanges))
    }
    if (!failed && overridesDirty && draft.overrideRows !== undefined) {
      try {
        // Only the rows that actually deviate travel: the endpoint reads an absent key as "drop
        // the override", so sending an inherited row would ask it to store nothing.
        await putUserPermissionOverrides({ userId: user.id, overrides: rowsToOverrides(draft.overrideRows) })
        setShowLagHint(true)
        // The admin may have just overridden THEMSELVES — re-read before the panel keeps drawing
        // controls their own new set no longer allows.
        await refreshPermissions()
      } catch (err) {
        failed = true
        setActionError(rolesErrorMessage(rolesC, err, rolesC.errorActions.saveOverrides))
      }
    }
    if (!failed) setDraft({})
    await revalidator.revalidate()
    setSavePending(false)
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
   * `AdminToolbar` in the control zone (2026-10-11): Отмена/Сохранить commit the page draft (job
   * role, email language, personal overrides); Удалить opens the danger zone's delete confirmation.
   * Impersonation and the reset-link email live in the toolbar's «…» (`accountActions`) — immediate
   * actions, not part of the draft.
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
          <AdminToolbar
            onCancel={handleCancel}
            onSave={() => void handleSave()}
            onDelete={() => openConfirm('delete')}
            cancelState={{ disabled: !dirty || savePending }}
            saveState={{
              disabled: !dirty || savePending || pending || !canEditUser,
              pending: savePending,
              hint: canEditUser
                ? null
                : usersPermission.canUpdate
                  ? copy.detail.saveSuperAdminHint
                  : copy.detail.resetNoPermissionHint,
            }}
            deleteState={{
              disabled: !canDelete || pending || savePending,
              pending: pending && confirmKind === 'delete',
              hint: canDelete ? null : deleteDisabledHint,
            }}
            actionsMenu={
              accountActions.length > 0 && (
                <AdminActionsMenu
                  groups={[{ title: copy.detail.actionsGroupAccount, items: accountActions }]}
                  label={copy.detail.actionsLabel(userLabel)}
                  disabled={impersonatePending || resetEmailPending || pending || savePending}
                />
              )
            }
          />
          <HelpButton surface="admin" title={copy.detail.helpTitle}>
            {copy.detail.helpBody}
          </HelpButton>
          {dirty && <span className="text-xs text-neutral-500">{copy.detail.unsavedChanges}</span>}
        </HelpRevealZone>
      }
      message={
        // Guarded as a whole rather than per banner: the layout's message slot is a `flex` column
        // with a gap, so an always-truthy fragment would leave an empty row between the control
        // zone and the body even with both banners silent.
        (actionError || actionNotice || showLagHint) && (
          <>
            {actionError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
            {/* `status`, not `alert`: a confirmation is not urgent enough to interrupt a screen
                reader mid-sentence. */}
            {actionNotice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <CheckIcon size={16} className="mt-0.5 shrink-0" />
                <span>{actionNotice}</span>
              </div>
            )}
            {showLagHint && !actionError && (
              <p
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                {rolesC.permissionLag}
              </p>
            )}
          </>
        )
      }
    >
      <UserDetailHeader user={user} />

      <UserDetailInfo
        user={user}
        jobRole={draft.jobRole !== undefined ? draft.jobRole : user.defaultJobRole}
        onChangeJobRole={setJobRole}
        preferredLanguage={draft.preferredLanguage ?? user.preferredLanguage}
        onChangePreferredLanguage={setPreferredLanguage}
        pending={savePending}
        canUpdate={canEditUser}
      />

      {/* Between the account's data and its login history: an override is a SETTING of the account,
          while the history is reference context for the destructive actions further down.
          Admin-only — editing overrides is administering the permission system itself. */}
      {canEditPermissions && (
        <UserPermissionsCard
          roleName={user.roleName}
          rows={draft.overrideRows ?? baselineOverrideRows}
          savedOverrideCount={countOverrides(overrides ?? [])}
          canEdit={canEditUser}
          pending={savePending}
          onChange={(screenKey, value) => changeOverrideRows((rows) => applyLevelChange(rows, screenKey, value))}
          onResetAll={() => changeOverrideRows(clearAllOverrides)}
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
        canReset={canEditUser}
        resetDisabledHint={resetDisabledHint}
        targetIsAdmin={isTargetAdmin}
        confirmKind={confirmKind}
        pending={pending}
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

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </DataEntryScreenLayout>
  )
}
