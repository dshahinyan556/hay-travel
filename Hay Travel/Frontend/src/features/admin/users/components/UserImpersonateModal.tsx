import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { userCopy } from '../lib/userCopy'

export interface UserImpersonateModalProps {
  open: boolean
  /** Full name (or username fallback) of the account being entered. */
  userLabel: string
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Confirmation for «Войти как пользователь» (spec 014 §3).
 *
 * Same `Modal` contract as `RoleDeleteModal`/`UserDangerZone` (title + body + cancel/confirm row,
 * initial focus on «Отмена»), and it is NOT optional chrome: this action ends the administrator's
 * own session server-side the instant it succeeds — refresh tokens revoked and the current access
 * token blacklisted (§8) — with no way back except signing in again. That consequence is invisible
 * from the button, so it is spelled out here before anything is sent.
 *
 * The confirm button is `outline-danger`, not `danger`: nothing is destroyed and no data is lost,
 * but the actor is about to lose their own session, which is more than an ordinary action.
 */
export function UserImpersonateModal({
  open,
  userLabel,
  pending,
  onCancel,
  onConfirm,
}: UserImpersonateModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const copy = useCopy(userCopy)
  const common = useCopy(adminCommonCopy)

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={copy.impersonate.title(userLabel)}
      initialFocusRef={cancelRef}
    >
      <p className="text-sm text-neutral-600">{copy.impersonate.body}</p>
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
        <Button
          type="button"
          variant="outline-danger"
          onClick={onConfirm}
          disabled={pending}
          className="min-w-28"
        >
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {copy.impersonate.pending}
            </span>
          ) : (
            copy.impersonate.confirm
          )}
        </Button>
      </div>
    </Modal>
  )
}
