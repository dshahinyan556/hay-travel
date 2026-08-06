import { useState } from 'react'
import { redirect, useLoaderData, useNavigate, useRevalidator } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'
import { canManageUsers, ensureAuthReady, getAuthState, RoleType, type UserDetailInfoModel } from '@/shared/auth'
import { deleteUser, forcePasswordReset, getUserDetail } from '@/features/admin/api/adminUsers'
import { UserDetailHeader } from './components/UserDetailHeader'
import { UserDetailInfo } from './components/UserDetailInfo'
import { UserDangerZone, type DangerConfirmKind } from './components/UserDangerZone'
import { userDetailCopy, usersErrorMessage } from './lib/userCopy'

/**
 * Loads one account's detail for `:id`. Same permission gate as `usersLoader` (a TourManager
 * typing the URL directly must not see a raw 403 screen) plus a defensive id check, mirroring
 * `tourEditLoader`. A missing/deleted id 404s from `getUserDetail` itself and is NOT caught here —
 * it propagates to `AdminErrorBoundary`, per the F4 architecture note's point 2.
 */
export async function userDetailLoader({ params }: LoaderFunctionArgs) {
  await ensureAuthReady()
  if (!canManageUsers(getAuthState().user?.role)) throw redirect('/admin')

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Response('Некорректный идентификатор пользователя', { status: 400 })
  }

  const user = await getUserDetail(id)
  return { user }
}

export function UserDetailPage() {
  const { user } = useLoaderData<typeof userDetailLoader>()
  // Keyed by id so navigating between two profile URLs remounts with fresh local state instead of
  // carrying the previous user's confirm/error state over — same reasoning as `TourEditPage`.
  return <UserDetailView key={user.id} user={user} />
}

function UserDetailView({ user }: { user: UserDetailInfoModel }) {
  const navigate = useNavigate()
  const revalidator = useRevalidator()

  const [confirmKind, setConfirmKind] = useState<DangerConfirmKind | null>(null)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Read once per render, same convention as `UsersPage` — cannot change without a full
  // re-navigation while this screen is open.
  const currentUserId = getAuthState().user?.id ?? 0
  const isSelf = user.id === currentUserId
  // Mirrors `UsersTable`'s `isTargetAdmin` — the backend blocks deleting an Admin account exactly
  // as unconditionally as it blocks changing its role (`AdminAccountImmutable`, B6-style guard).
  const isTargetAdmin = user.role === RoleType.Admin && !isSelf
  const canDelete = !isSelf && !isTargetAdmin
  const deleteDisabledHint = isSelf ? userDetailCopy.deleteSelfHint : userDetailCopy.deleteAdminHint
  const userLabel = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username

  function openConfirm(kind: DangerConfirmKind) {
    if (pending) return
    setActionError(null)
    setConfirmKind(kind)
  }

  function cancelConfirm() {
    if (pending) return
    setConfirmKind(null)
  }

  async function confirm() {
    if (confirmKind === null || pending) return
    setPending(true)
    setActionError(null)
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
      setActionError(usersErrorMessage(err, confirmKind === 'delete' ? 'удалить пользователя' : 'сбросить пароль'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <UserDetailHeader user={user} />

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <span aria-hidden="true">⚠️</span>
          <span>{actionError}</span>
        </div>
      )}

      <UserDetailInfo user={user} />

      <UserDangerZone
        userLabel={userLabel}
        canDelete={canDelete}
        deleteDisabledHint={deleteDisabledHint}
        confirmKind={confirmKind}
        pending={pending}
        onRequestDelete={() => openConfirm('delete')}
        onRequestReset={() => openConfirm('reset')}
        onCancelConfirm={cancelConfirm}
        onConfirm={confirm}
      />
    </div>
  )
}
