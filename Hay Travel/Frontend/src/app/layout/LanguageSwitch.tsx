import { useState } from 'react'
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/shared/lib/locale'

/**
 * Language switch — UI only for now.
 *
 * The site ships Russian copy; EN is visible so the layout is designed for it from the start
 * (a switch bolted on later tends to break the header). Selecting a language changes only the
 * active pill: real string localisation comes with the i18n pass, and the backend already
 * speaks `languageCode` (see `docs/backend-api.md`) so the data side is ready.
 *
 * The pills are rendered from `LOCALES` (`shared/lib/locale`), so a new language appears here
 * automatically once it is added to that list.
 */
export function LanguageSwitch() {
  const [active, setActive] = useState<Locale>(DEFAULT_LOCALE)

  return (
    <div className="flex items-center rounded-full p-0.5 ring-1 ring-edge">
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={() => setActive(locale.code)}
          aria-pressed={active === locale.code}
          aria-label={locale.name}
          // `min-h-9` keeps the pill visually compact; the actual tap target is grown to the
          // 44x44 CSS px minimum by the invisible `before:` expander below (outward + vertical
          // only, never toward the neighbouring pill, so the two never fight over a click).
          className={[
            'relative inline-flex min-h-9 items-center rounded-full px-2.5 text-[11px] font-medium tracking-wide transition-colors',
            'before:absolute before:-top-1 before:-bottom-1 before:content-[\'\'] first:before:-left-3 first:before:right-0 last:before:left-0 last:before:-right-3',
            active === locale.code ? 'bg-wine-tint text-gold-light' : 'text-ink-muted hover:text-gold',
          ].join(' ')}
        >
          {locale.label}
        </button>
      ))}
    </div>
  )
}
