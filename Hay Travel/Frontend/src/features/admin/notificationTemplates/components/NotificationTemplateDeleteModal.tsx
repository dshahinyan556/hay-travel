import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { NotificationTemplateInfoModel } from '@/features/admin/types/notificationTemplates'
import { notificationTemplatesCopy } from '../lib/notificationTemplatesCopy'

export interface NotificationTemplateDeleteModalProps {
  template: NotificationTemplateInfoModel | null
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Подтверждение удаления одного шаблона — тот же приём, что `RoleDeleteModal`. */
export function NotificationTemplateDeleteModal({
  template,
  pending,
  onCancel,
  onConfirm,
}: NotificationTemplateDeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const copy = useCopy(notificationTemplatesCopy)

  return (
    <Modal
      open={template !== null}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={template === null ? copy.delete : copy.deleteTitle(template.name)}
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
