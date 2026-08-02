import { useRef } from 'react'
import { Button, buttonClassName } from './Button'
import { Modal } from './Modal'

export interface UnsavedChangesModalProps {
  open: boolean
  /** Dismiss without acting — stay where the admin already was. */
  onCancel: () => void
  /** Proceed with whatever the admin was trying to do. */
  onConfirm: () => void
  title?: string
  message?: string
  confirmLabel?: string
}

/**
 * Confirmation dialog for "you have unsaved changes" moments. Presentational and reusable —
 * the caller decides what "cancel"/"confirm" mean (staying on a screen vs. leaving it, staying
 * on a tab vs. switching it). Defaults match the copy first used for leaving a page mid-edit;
 * pass `title`/`message`/`confirmLabel` to fit a different action.
 */
export function UnsavedChangesModal({
  open,
  onCancel,
  onConfirm,
  title = 'Уйти без сохранения?',
  message = 'Изменения ещё не сохранены. Если уйти со страницы сейчас, они будут потеряны.',
  confirmLabel = 'Уйти',
}: UnsavedChangesModalProps) {
  const stayButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal open={open} onClose={onCancel} title={title} initialFocusRef={stayButtonRef}>
      <p className="text-sm text-neutral-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          ref={stayButtonRef}
          type="button"
          onClick={onCancel}
          className={buttonClassName('ghost', 'md')}
        >
          Остаться
        </button>
        <Button type="button" variant="danger" onClick={onConfirm} className="min-w-28">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
