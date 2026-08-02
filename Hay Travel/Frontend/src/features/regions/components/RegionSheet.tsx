import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Sheet } from '@/shared/ui/Sheet'

interface RegionSheetProps {
  open: boolean
  /** Called when the sheet should go away — backdrop, swipe-down or flick-down. */
  onClose: () => void
  /** Accessible name of the dialog, e.g. the region being shown. */
  ariaLabel: string
  children: React.ReactNode
}

/**
 * Draggable bottom sheet for the region panel.
 *
 * Thin wrapper over `shared/ui/Sheet`, which owns all the drag/detent/focus/scroll-lock
 * mechanics (see its doc comment for the reasoning — hand-rolled drag, no pointer capture, the
 * enter animation trick, etc.). This wrapper only supplies the region panel's specific shape:
 * a fixed 88dvh height (the tour list is long enough to want a stable viewport fraction) and the
 * region-specific accessible strings for the backdrop and drag handle.
 */
export function RegionSheet({ open, onClose, ariaLabel, children }: RegionSheetProps) {
  const { t } = useLocale()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      ariaLabel={ariaLabel}
      heightDvh={88}
      backdropLabel={t('regions.panel.close')}
      expandLabel={t('regions.panel.expand')}
      collapseLabel={t('regions.panel.collapse')}
    >
      {children}
    </Sheet>
  )
}
