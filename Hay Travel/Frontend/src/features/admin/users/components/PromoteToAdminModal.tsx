import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { promoteCopy } from '../lib/userCopy'

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

  return (
    <Modal
      open={userLabel !== null}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={userLabel === null ? '' : promoteCopy.title(userLabel)}
      initialFocusRef={cancelRef}
    >
      <p className="text-sm text-neutral-600">{promoteCopy.body}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={`${buttonClassName('ghost', 'md')} disabled:pointer-events-none disabled:opacity-50`}
        >
          Отмена
        </button>
        <Button type="button" onClick={onConfirm} disabled={pending} className="min-w-28">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {promoteCopy.pending}
            </span>
          ) : (
            promoteCopy.confirm
          )}
        </Button>
      </div>
    </Modal>
  )
}
