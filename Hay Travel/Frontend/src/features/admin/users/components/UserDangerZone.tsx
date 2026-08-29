import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { userCopy } from '../lib/userCopy'

export type DangerConfirmKind = 'delete' | 'reset'

interface UserDangerZoneProps {
  /** Full name (or username fallback) shown in the confirm modal's title. */
  userLabel: string
  /** `false` on your own profile, on another Admin's profile unless the actor is the SuperAdmin
   * (D3), and ALWAYS on the SuperAdmin's own row (`SuperAdminGuard`, 2026-08-27) — mirrors the
   * backend's guards (`CannotDeleteSelf`, `SuperAdminPrivilegeRequired`). `UserDetailPage` computes
   * this the same way `UsersTable` computes `isSelf`/`roleLocked`. */
  canDelete: boolean
  /** `users.Update`, minus the SuperAdmin lock (2026-08-27) — same `canEditUser` the page hands to
   * every other editor on the screen. Disables the reset button rather than hiding it: the row
   * explains what the action is, and an explanation with no control reads better than a silently
   * missing section. */
  canReset: boolean
  /** Shown under the reset button when `canReset` is false — WHICH of the two reasons it is, picked
   * by the page, exactly like `deleteDisabledHint`. */
  resetDisabledHint: string
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
  canReset,
  resetDisabledHint,
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
  const copy = useCopy(userCopy)
  const common = useCopy(adminCommonCopy)
  const detail = copy.detail

  const isDelete = confirmKind === 'delete'
  const title = confirmKind === null ? '' : isDelete ? detail.deleteTitle(userLabel) : detail.resetTitle(userLabel)
  const deleteBody = targetIsAdmin ? detail.deleteAdminBody : detail.deleteBody
  const body = isDelete ? deleteBody : detail.resetBody

  return (
    <section className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50">
      <div className="border-b border-rose-200 px-4 py-2.5 text-[11px] font-bold tracking-wide text-rose-700 uppercase">
        {copy.danger.sectionTitle}
      </div>

      <div className="flex flex-col divide-y divide-rose-200">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{copy.danger.resetHeading}</p>
            <p className="text-xs text-neutral-500">{copy.danger.resetHint}</p>
            {!canReset && <p className="mt-1 text-[11px] text-neutral-500">{resetDisabledHint}</p>}
          </div>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={onRequestReset}
            disabled={pending || !canReset}
          >
            {copy.danger.resetButton}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{copy.danger.deleteHeading}</p>
            <p className="text-xs text-neutral-500">{copy.danger.deleteHint}</p>
            {!canDelete && <p className="mt-1 text-[11px] text-neutral-500">{deleteDisabledHint}</p>}
          </div>
          <Button variant="danger" size="sm" onClick={onRequestDelete} disabled={pending || !canDelete}>
            {copy.danger.deleteButton}
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
            {common.cancel}
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
                {isDelete ? copy.danger.deleting : copy.danger.resetting}
              </span>
            ) : isDelete ? (
              copy.danger.confirmDelete
            ) : (
              copy.danger.confirmReset
            )}
          </Button>
        </div>
      </Modal>
    </section>
  )
}
