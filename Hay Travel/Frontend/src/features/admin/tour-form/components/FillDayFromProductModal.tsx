import { useState } from 'react'
import { Button, Modal } from '@/shared/ui'
import type { DaySource, DaySourceContent } from '@/features/admin/lib/tourMapper'

interface FillDayFromProductModalProps {
  open: boolean
  onClose: () => void
  sources: DaySource[]
  /** Whether the target day already has text or route points — gates the replace confirm step. */
  hasContent: boolean
  onConfirm: (content: DaySourceContent) => void
}

/**
 * Picker for "заполнить день из другого продукта" (F13 gap closure, part 2) — lets the admin
 * prefill a day's text + route points from an existing excursion or another tour's day (e.g. a
 * multi-day tour's second day IS the "Гарни-Гегард" excursion in substance, no need to retype
 * it). Copy-once: picking a source replaces the day's content immediately; nothing stays linked
 * afterwards, so further edits are free. Price is never touched; the gallery keeps whatever the
 * admin added by hand and gains the images of any copied route point that carries a Place link
 * (see `tourFormReducer`'s `fillDayFromSource` case).
 */
export function FillDayFromProductModal({
  open,
  onClose,
  sources,
  hasContent,
  onConfirm,
}: FillDayFromProductModalProps) {
  const [pending, setPending] = useState<DaySource | null>(null)

  const close = () => {
    setPending(null)
    onClose()
  }

  const pick = (source: DaySource) => {
    if (hasContent) {
      setPending(source)
      return
    }
    onConfirm(source.content)
    close()
  }

  if (pending) {
    return (
      <Modal open={open} onClose={close} title="Заменить содержимое дня?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            В дне уже есть текст или точки маршрута — заливка из «{pending.tourTitle.ru || pending.tourTitle.en}
            {pending.dayLabel ? `, ${pending.dayLabel}` : ''}» полностью заменит их. Цена дня и уже добавленные
            картинки не меняются; для скопированных точек с привязкой к каталогу в галерею добавятся их фото.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
              Назад
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onConfirm(pending.content)
                close()
              }}
            >
              Заменить
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={close} title="Заполнить день из другого продукта">
      {sources.length === 0 ? (
        <p className="text-sm text-neutral-500">Других продуктов пока нет.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                onClick={() => pick(source)}
                className="w-full cursor-pointer rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="font-medium text-neutral-900">
                  {source.tourTitle.ru || source.tourTitle.en || 'Без названия'}
                </span>
                {source.dayLabel && <span className="text-neutral-500"> · {source.dayLabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
