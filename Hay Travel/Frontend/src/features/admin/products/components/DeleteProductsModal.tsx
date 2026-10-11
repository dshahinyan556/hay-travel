import { useRef } from 'react'
import { Button, Modal, Spinner, buttonClassName } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { adminCommonCopy } from '@/features/admin/lib/adminCommonCopy'
import { tourTitle } from '@/features/admin/ui/TourTableParts'
import type { TourInfoModel } from '@/shared/types/attours'
import { productsCopy } from '../lib/productsCopy'

export interface DeleteProductsModalProps {
  /** Products queued for permanent deletion; empty = closed. */
  targets: TourInfoModel[]
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * The permanent-delete confirmation of the archive (the same dialog the screen always had), now
 * worded for a selection: one product is named in the sentence, several are counted. Focus starts
 * on «Отмена» — the safe choice for an irreversible action.
 */
export function DeleteProductsModal({ targets, pending, onCancel, onConfirm }: DeleteProductsModalProps) {
  const copy = useCopy(productsCopy).deleteModal
  const common = useCopy(adminCommonCopy)
  const { locale } = useLocale()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const single = targets.length === 1 ? targets[0] : null

  return (
    <Modal
      open={targets.length > 0}
      onClose={() => {
        if (!pending) onCancel()
      }}
      title={copy.title}
      initialFocusRef={cancelRef}
    >
      <p className="text-sm text-neutral-600">
        {single ? (
          <>
            {copy.lead}{' '}
            <span className="font-semibold text-neutral-900">
              {copy.quoteOpen}
              {tourTitle(single, locale).text}
              {copy.quoteClose}
            </span>{' '}
            {copy.tail}
          </>
        ) : (
          copy.many(targets.length)
        )}
      </p>
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
        <Button type="button" variant="danger" onClick={onConfirm} disabled={pending} className="min-w-28">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {copy.deleting}
            </span>
          ) : (
            copy.confirm
          )}
        </Button>
      </div>
    </Modal>
  )
}
