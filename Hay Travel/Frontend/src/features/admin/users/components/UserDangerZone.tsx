import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { userDetailCopy } from '../lib/userCopy'

export type DangerConfirmKind = 'delete' | 'reset'

interface UserDangerZoneProps {
  /** Full name (or username fallback) shown in the confirm modal's title. */
  userLabel: string
  /** `false` on your own profile, and on another Admin's profile unless the actor is the SuperAdmin
   * (D3) — mirrors the backend's guards (`CannotDeleteSelf`, `SuperAdminPrivilegeRequired`).
   * `UserDetailPage` computes this the same way `UsersTable` computes `isSelf`/`roleLocked`. */
  canDelete: boolean
  /** The account being viewed is an Admin (and not you). Only changes the confirm dialog's WORDING:
   * deleting a colleague with panel access has wider consequences than deleting a customer, and the
   * one person who can actually do it should be told so before they do. */
  targetIsAdmin?: boolean
  /** Shown under the delete button when `canDelete` is false — which of the two reasons above. */
  deleteDisabledHint: string
  /** Which confirm modal is open, or `null`. Owned by the parent — same "container owns the
   * `Modal`'s open state" shape `ProductsPage`/`PlacesTab` already use for their own delete
   * confirmations. */
  confirmKind: DangerConfirmKind | null
  /** True while the request for `confirmKind` is in flight. */
  pending: boolean
  onRequestDelete: () => void
  onRequestReset: () => void
  onCancelConfirm: () => void
  onConfirm: () => void
}

/**
 * "Опасная зона" (F4): force password reset + soft-delete, each behind its own confirm `Modal` —
 * the same `Modal` contract "Продукты"/"Справочники" already use (title + message + cancel/confirm
 * row), rendered here rather than in `UserDetailPage` because the two actions and their modals are
 * a single cohesive unit with nothing else on the page needing to know about them mid-flight.
 *
 * Visual direction from the approved mockup (`hay-travel-ux-proposal.html` §3): rose-tinted card,
 * separated from the neutral info cards above it, two different-weight buttons — `outline-danger`
 * for the reversible-ish "reset" (a prompt, not an immediate lockout — see B5's own noted gap) and
 * filled `danger` for the irreversible-from-the-panel delete.
 */
export function UserDangerZone({
  userLabel,
  canDelete,
  targetIsAdmin = false,
  deleteDisabledHint,
  confirmKind,
  pending,
  onRequestDelete,
  onRequestReset,
  onCancelConfirm,
  onConfirm,
}: UserDangerZoneProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  const isDelete = confirmKind === 'delete'
  const title = confirmKind === null ? '' : isDelete ? userDetailCopy.deleteTitle(userLabel) : userDetailCopy.resetTitle(userLabel)
  const deleteBody = targetIsAdmin ? userDetailCopy.deleteAdminBody : userDetailCopy.deleteBody
  const body = isDelete ? deleteBody : userDetailCopy.resetBody

  return (
    <section className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50">
      <div className="border-b border-rose-200 px-4 py-2.5 text-[11px] font-bold tracking-wide text-rose-700 uppercase">
        Опасная зона
      </div>

      <div className="flex flex-col divide-y divide-rose-200">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Принудительный сброс пароля</p>
            <p className="text-xs text-neutral-500">
              Пользователь будет обязан задать новый пароль при следующем входе
            </p>
          </div>
          <Button variant="outline-danger" size="sm" onClick={onRequestReset} disabled={pending}>
            Сбросить пароль
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Удалить пользователя</p>
            <p className="text-xs text-neutral-500">Необратимо в панели. Аккаунт будет деактивирован</p>
            {!canDelete && <p className="mt-1 text-[11px] text-neutral-500">{deleteDisabledHint}</p>}
          </div>
          <Button variant="danger" size="sm" onClick={onRequestDelete} disabled={pending || !canDelete}>
            Удалить пользователя
          </Button>
        </div>
      </div>

      <Modal
        open={confirmKind !== null}
        onClose={() => {
          if (!pending) onCancelConfirm()
        }}
        title={title}
        initialFocusRef={cancelRef}
      >
        <p className="text-sm text-neutral-600">{body}</p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancelConfirm}
            disabled={pending}
            className={`${buttonClassName('ghost', 'md')} disabled:pointer-events-none disabled:opacity-50`}
          >
            Отмена
          </button>
          <Button
            type="button"
            variant={isDelete ? 'danger' : 'outline-danger'}
            onClick={onConfirm}
            disabled={pending}
            className="min-w-28"
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                {isDelete ? 'Удаление…' : 'Сброс…'}
              </span>
            ) : isDelete ? (
              'Удалить'
            ) : (
              'Сбросить'
            )}
          </Button>
        </div>
      </Modal>
    </section>
  )
}
