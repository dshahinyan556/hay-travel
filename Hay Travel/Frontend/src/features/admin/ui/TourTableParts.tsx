import { useState } from 'react'
import { TourTranslationType, TourType, tourTypeLabels } from '@/features/admin/lib/enums'
import { readLocalized } from '@/features/admin/lib/tourMapper'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import type { TourInfoModel } from '@/shared/types/attours'

/** The RU title of a tour, with an explicit flag for the "no title yet" case. */
export function tourTitleRu(tour: TourInfoModel): { text: string; empty: boolean } {
  const ru = readLocalized(tour.translations, TourTranslationType.Title).ru.trim()
  return ru === '' ? { text: '— без названия —', empty: true } : { text: ru, empty: false }
}

/**
 * Square-ish list thumbnail. `mainImageUrl` can be null or a broken link, so we render a
 * neutral placeholder when there's no url and swap to it on load error.
 */
export function TourThumb({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div
        aria-hidden="true"
        className="h-9 w-13 rounded-md bg-gradient-to-br from-neutral-200 to-neutral-300"
      />
    )
  }

  return (
    <img
      src={adaptiveImageUrl(url)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-9 w-13 rounded-md object-cover"
    />
  )
}

/** Teal pill for tours, indigo for excursions — mirrors the dashboard type legend. */
export function TypeBadge({ type }: { type: number }) {
  const isTour = type === TourType.Tour
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isTour ? 'bg-brand-50 text-brand-800' : 'bg-indigo-50 text-indigo-700'
      }`}
    >
      {tourTypeLabels[type as TourType] ?? '—'}
    </span>
  )
}
