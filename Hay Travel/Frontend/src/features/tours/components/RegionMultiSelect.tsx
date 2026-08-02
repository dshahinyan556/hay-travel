import { useId, useRef, useState } from 'react'
import { REGIONS, type RegionSlug } from '@/shared/data/armeniaRegions'
import { useIsCompactViewport } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Popover, Sheet, SHEET_SINGLE_DETENT } from '@/shared/ui'
import { ChevronDownIcon } from '@/shared/ui/icons'

interface RegionMultiSelectProps {
  id?: string
  value: readonly RegionSlug[]
  onChange: (value: readonly RegionSlug[]) => void
  className?: string
  'aria-labelledby'?: string
}

/**
 * Region filter for the public catalog (`ToursFilterBar`) — a checkbox list, not `Select`'s
 * single-pick combobox: `tour.regionSlugs` is already an array (a multi-day tour crosses several
 * regions), so narrowing to exactly one used to hide tours that also touch a second one.
 *
 * Built on the same two positioning primitives `Select` uses (`Popover` on desktop, `Sheet` on a
 * compact viewport) rather than extending `Select` itself: the two controls commit differently —
 * `Select` closes and commits on every click, this one stays open so several regions can be ticked
 * in one visit — and share almost nothing beyond "anchor a panel to a trigger".
 */
export function RegionMultiSelect({
  id,
  value,
  onChange,
  className = '',
  'aria-labelledby': ariaLabelledBy,
}: RegionMultiSelectProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const isCompact = useIsCompactViewport()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { locale, t } = useLocale()
  const regionName = (region: { ru: string; en: string }) => (locale === 'en' ? region.en : region.ru)

  function toggle(slug: RegionSlug) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug])
  }

  const label =
    value.length === 0
      ? t('filter.region.all')
      : value.length === 1
        ? (() => {
            const region = REGIONS.find((r) => r.slug === value[0])
            return region ? regionName(region) : value[0]
          })()
        : t('filter.region.count', { count: value.length })

  const list = (
    <ul className="max-h-72 overflow-auto py-1">
      {REGIONS.map((region) => {
        const checked = value.includes(region.slug)
        return (
          <li key={region.slug}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-ink transition-colors hover:bg-accent-soft">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(region.slug)}
                className="h-[18px] w-[18px] shrink-0 rounded border-edge-strong accent-[var(--accent-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
              {regionName(region)}
            </label>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={ariaLabelledBy}
        onClick={() => setOpen((o) => !o)}
        className="relative flex min-h-11 w-full items-center gap-2 rounded-full border border-edge-strong bg-panel-raised px-3.5 py-2 text-left text-sm text-ink transition-colors hover:border-gold-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="flex-1 truncate">{label}</span>
        <ChevronDownIcon
          size={16}
          className={`shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {isCompact ? (
        <Sheet open={open} onClose={() => setOpen(false)} ariaLabel={t('filter.region.ariaLabel')} detents={SHEET_SINGLE_DETENT}>
          <div className="px-1 pb-2 pt-1 text-sm font-semibold text-ink">{t('filter.region.ariaLabel')}</div>
          {list}
        </Sheet>
      ) : (
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
          matchAnchorWidth
          className="overflow-auto rounded-lg border border-edge-strong bg-panel-raised shadow-lg"
        >
          {list}
        </Popover>
      )}
    </div>
  )
}
