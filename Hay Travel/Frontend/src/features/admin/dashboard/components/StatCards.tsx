import { Card } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { LanguageCode, TourTranslationType, TourType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'
import { dashboardCopy } from '../lib/dashboardCopy'

interface StatCardsProps {
  tours: TourInfoModel[]
}

/** A tour counts as "missing EN" when it has no non-empty English title row. */
function hasEnglishTitle(tour: TourInfoModel): boolean {
  return tour.translations.some(
    (t) =>
      t.type === TourTranslationType.Title &&
      t.languageCode === LanguageCode.English &&
      (t.value?.trim() ?? '') !== '',
  )
}

interface Stat {
  label: string
  value: number
  /** Small colored dot before the label, matching the mockup's type legend. */
  dotClassName?: string
  /** Amber "attention" treatment for the missing-translation card. */
  warn?: boolean
}

/**
 * Five summary counters derived purely from the loaded tour list — no extra request.
 * Presentational: it receives `tours` and computes the aggregates for render only.
 */
export function StatCards({ tours }: StatCardsProps) {
  // Only the CAPTIONS follow the interface language — what each counter counts (including the
  // English-title check below) is data logic and stays as it is.
  const copy = useCopy(dashboardCopy).stats
  const total = tours.length
  const tourCount = tours.filter((t) => t.type === TourType.Tour).length
  const excursionCount = tours.filter((t) => t.type === TourType.Excursion).length
  const transferCount = tours.filter((t) => t.type === TourType.Transfer).length
  const missingEn = tours.filter((t) => !hasEnglishTitle(t)).length

  const stats: Stat[] = [
    { label: copy.total, value: total },
    { label: copy.tours, value: tourCount, dotClassName: 'bg-neutral-900' },
    { label: copy.excursions, value: excursionCount, dotClassName: 'border border-neutral-400' },
    { label: copy.transfers, value: transferCount, dotClassName: 'bg-neutral-400' },
    { label: copy.missingEn, value: missingEn, warn: true },
  ]

  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          padding="sm"
          className={stat.warn ? 'border-neutral-900 bg-neutral-50' : ''}
        >
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              stat.warn ? 'text-neutral-900' : 'text-neutral-500'
            }`}
          >
            {stat.dotClassName ? (
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${stat.dotClassName}`} />
            ) : null}
            {stat.label}
          </div>
          <div className="mt-1.5 text-3xl font-bold tabular-nums text-neutral-900">
            {stat.value}
          </div>
        </Card>
      ))}
    </div>
  )
}
