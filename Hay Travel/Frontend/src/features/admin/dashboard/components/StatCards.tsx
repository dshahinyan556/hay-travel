import { Card } from '@/shared/ui'
import { LanguageCode, TourTranslationType, TourType } from '@/features/admin/lib/enums'
import type { TourInfoModel } from '@/shared/types/attours'

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
 * Four summary counters derived purely from the loaded tour list — no extra request.
 * Presentational: it receives `tours` and computes the aggregates for render only.
 */
export function StatCards({ tours }: StatCardsProps) {
  const total = tours.length
  const tourCount = tours.filter((t) => t.type === TourType.Tour).length
  const excursionCount = tours.filter((t) => t.type === TourType.Excursion).length
  const missingEn = tours.filter((t) => !hasEnglishTitle(t)).length

  const stats: Stat[] = [
    { label: 'Всего позиций', value: total },
    { label: 'Туров', value: tourCount, dotClassName: 'bg-brand-600' },
    { label: 'Экскурсий', value: excursionCount, dotClassName: 'bg-indigo-500' },
    { label: 'Без EN-перевода', value: missingEn, warn: true },
  ]

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          padding="sm"
          className={stat.warn ? 'border-amber-200 bg-amber-50' : ''}
        >
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              stat.warn ? 'text-amber-800' : 'text-neutral-500'
            }`}
          >
            {stat.dotClassName ? (
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${stat.dotClassName}`} />
            ) : null}
            {stat.label}
          </div>
          <div
            className={`mt-1.5 text-3xl font-bold tabular-nums ${
              stat.warn ? 'text-amber-800' : 'text-neutral-900'
            }`}
          >
            {stat.value}
          </div>
        </Card>
      ))}
    </div>
  )
}
