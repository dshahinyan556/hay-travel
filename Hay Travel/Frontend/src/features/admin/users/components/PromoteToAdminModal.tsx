import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { userCopy } from '../lib/userCopy'

interface PromoteToAdminModalProps {
  /** The row awaiting confirmation, or `null` when nothing is pending. Doubles as the open flag so
   * the two cannot disagree. */
  userLabel: string | null
  /** True while the `PATCH` is in flight. */
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Confirmation for promoting somebody to Admin (D5, 2026-08-09).
 *
 * Before this, changing a role was a bare `<select>` with no confirmation at all — fine for
 * Regular↔TourManager, too quiet for the one change that grants full control of the panel.
 *
 * ONE instance per page, owned by `UsersPage`, not one per row: the table can hold hundreds of
 * rows, and a `Modal` per row would mean hundreds of mounted dialogs. Cancelling needs no undo
 * either — `RoleSelect` is controlled by `user.role` from the loader, so an unconfirmed pick
 * reverts on the next render by itself.
 *
 * Modal shape (title + body + cancel/confirm row, cancel focused first) matches `UserDangerZone`
 * and the confirmations in «Продукты»/«Справочники».
 */
export function PromoteToAdminModal({
  userLabel,
  pending,
  onCancel,
  onConfirm,
}: PromoteToAdminModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const copy = useCopy(userCopy).promote
  const common = useCopy(adminCommonCopy)

  return (
    <Modal
      open={userLabel !== null}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={userLabel === null ? '' : copy.title(userLabel)}
      initialFocusRef={cancelRef}
    >
      <p className="text-sm text-neutral-600">{copy.body}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={`${buttonClassName('ghost', 'md')} disabled:pointer-events-none disabled:opacity-50`}
        >
          {common.cancel}
        </button>
        <Button type="button" onClick={onConfirm} disabled={pending} className="min-w-28">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {copy.pending}
            </span>
          ) : (
            copy.confirm
          )}
        </Button>
      </div>
    </Modal>
  )
}
