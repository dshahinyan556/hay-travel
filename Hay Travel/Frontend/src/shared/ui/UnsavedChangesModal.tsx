import { useRef } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Button, buttonClassName } from './Button'
import { Modal } from './Modal'

export interface UnsavedChangesModalProps {
  open: boolean
  /** Dismiss without acting — stay where the admin already was. */
  onCancel: () => void
  /** Proceed with whatever the admin was trying to do. */
  onConfirm: () => void
  /** Defaults to `t('ui.unsaved.title')` in the current locale. */
  title?: string
  /** Defaults to `t('ui.unsaved.message')`. */
  message?: string
  /** Defaults to `t('ui.unsaved.confirm')`. */
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
  title,
  message,
  confirmLabel,
}: UnsavedChangesModalProps) {
  const stayButtonRef = useRef<HTMLButtonElement>(null)
  // Resolved in the body, not in the parameter list — a hook cannot run in a default parameter.
  const { t } = useLocale()
  const resolvedTitle = title ?? t('ui.unsaved.title')
  const resolvedMessage = message ?? t('ui.unsaved.message')
  const resolvedConfirmLabel = confirmLabel ?? t('ui.unsaved.confirm')

  return (
    <Modal open={open} onClose={onCancel} title={resolvedTitle} initialFocusRef={stayButtonRef}>
      <p className="text-sm text-neutral-600">{resolvedMessage}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          ref={stayButtonRef}
          type="button"
          onClick={onCancel}
          className={buttonClassName('ghost', 'md')}
        >
          {t('ui.unsaved.stay')}
        </button>
        <Button type="button" variant="danger" onClick={onConfirm} className="min-w-28">
          {resolvedConfirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
