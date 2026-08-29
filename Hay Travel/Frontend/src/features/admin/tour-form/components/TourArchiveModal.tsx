import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

export interface TourArchiveModalProps {
  open: boolean
  /** Название продукта — в том виде, в каком его показывает список продуктов. */
  productTitle: string
  pending: boolean
  /** Черновик формы отличается от сохранённого продукта — предупреждаем, что правки пропадут. */
  hasUnsavedChanges: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Подтверждение мягкого удаления продукта из формы. Тот же подход, что у модала окончательного
 * удаления в `ProductsPage` (фокус на «Отмене», выделенное название внутри предложения, спиннер
 * в кнопке действия) — отличается только текстом и обратимостью действия.
 *
 * Презентационный компонент: запрос, ошибку и редирект держит вызывающая страница.
 */
export function TourArchiveModal({
  open,
  productTitle,
  pending,
  hasUnsavedChanges,
  onCancel,
  onConfirm,
}: TourArchiveModalProps) {
  const copy = useCopy(tourFormCopy).archive
  const common = useCopy(adminCommonCopy)
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={copy.modalTitle}
      initialFocusRef={cancelRef}
    >
      <p className="text-sm text-neutral-600">
        {copy.lead}{' '}
        <span className="font-semibold text-neutral-900">
          {copy.quoteOpen}
          {productTitle}
          {copy.quoteClose}
        </span>{' '}
        {copy.tail}
      </p>
      {hasUnsavedChanges && (
        <p className="mt-2 text-sm font-semibold text-neutral-800">{copy.unsavedNote}</p>
      )}
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
          variant="danger"
          onClick={onConfirm}
          disabled={pending}
          className="min-w-28"
        >
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
