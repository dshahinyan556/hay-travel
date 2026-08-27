import { useState } from 'react'
import { Button } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { DaySource, DaySourceContent } from '@/features/admin/lib/tourMapper'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'
import { FillDayFromProductModal } from './FillDayFromProductModal'

interface DayFillTriggerProps {
  sources: DaySource[]
  hasContent: boolean
  onFill: (content: DaySourceContent) => void
}

/** Button + picker for "заполнить день из другого продукта" (F13 gap closure, part 2). One
 * component shared by the multi-day accordion (`TourDayFields`) and the excursion's flat single
 * day (`TourForm`) so the trigger and its confirm-on-replace behavior stay identical in both. */
export function DayFillTrigger({ sources, hasContent, onFill }: DayFillTriggerProps) {
  const copy = useCopy(tourFormCopy).fill
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {copy.trigger}
      </Button>
      <FillDayFromProductModal
        open={open}
        onClose={() => setOpen(false)}
        sources={sources}
        hasContent={hasContent}
        onConfirm={onFill}
      />
    </>
  )
}
