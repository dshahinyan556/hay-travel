import { useState } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import { TourTranslationType, TourType } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { readLocalized } from '@/features/admin/lib/tourMapper'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import type { Locale } from '@/shared/lib/locale'
import type { TourInfoModel } from '@/shared/types/attours'
import { adminUiCopy } from './adminUiCopy'

/**
 * The list title of a tour, with an explicit flag for the "no title yet" case.
 *
 * The title FOLLOWS the interface language and falls back to Russian when the English translation
 * has not been filled in yet (ADR 021, решение 5) — an English panel where every product is signed
 * in Russian reads like a half-finished translation, while an empty cell would hide the product.
 * Nothing is translated here: only the language row that already exists in the data is chosen.
 *
 * A plain function, not a hook: it is called inside `.map()` bodies, so the caller reads the locale
 * once (`useLocale()`) and passes it in — see rule 3 in `shared/i18n/defineCopy.ts`.
 */
export function tourTitle(
  tour: TourInfoModel,
  locale: Locale,
): { text: string; empty: boolean } {
  const title = readLocalized(tour.translations, TourTranslationType.Title)
  const ru = title.ru.trim()
  const preferred = locale === 'en' ? title.en.trim() : ru
  const text = preferred === '' ? ru : preferred
  return text === ''
    ? { text: adminUiCopy(locale).tourTable.untitled, empty: true }
    : { text, empty: false }
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

/** Solid pill for tours (primary product type), outlined for excursions — mirrors the dashboard
 * type legend. Strict b/w palette: fill vs. outline carries the distinction, not hue. */
export function TypeBadge({ type }: { type: number }) {
  const typeLabels = useCopy(adminEnumsCopy).tourType
  const isTour = type === TourType.Tour
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isTour ? 'bg-neutral-900 text-white' : 'border border-neutral-300 bg-white text-neutral-700'
      }`}
    >
      {typeLabels[type as TourType] ?? '—'}
    </span>
  )
}
