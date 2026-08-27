import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { RoleInfoModel } from '@/features/admin/types/roles'
import { rolesCopy } from '../lib/rolesCopy'

export interface RoleDeleteModalProps {
  /** The role awaiting confirmation, or `null` when the dialog is closed. */
  role: RoleInfoModel | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Delete confirmation for one role. One modal per page (the `UsersPage`/`ProductsPage` convention),
 * driven by which role the table asked about.
 *
 * Initial focus goes to «Отмена», not to the destructive button — the same choice the product and
 * user deletions make.
 */
export function RoleDeleteModal({ role, pending, onCancel, onConfirm }: RoleDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const copy = useCopy(rolesCopy)

  return (
    <Modal
      open={role !== null}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={role === null ? copy.delete : copy.deleteTitle(role.name)}
      initialFocusRef={cancelRef}
    >
      <p className="text-sm text-neutral-600">{copy.deleteBody}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={pending}
          className={`${buttonClassName('ghost', 'md')} disabled:pointer-events-none disabled:opacity-50`}
        >
          {copy.cancel}
        </button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={pending} className="min-w-28">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {copy.deleting}
            </span>
          ) : (
            copy.delete
          )}
        </Button>
      </div>
    </Modal>
  )
}
