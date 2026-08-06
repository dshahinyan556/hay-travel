import { LOCALES } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'

/**
 * Language switch — drives the real `LocaleProvider` (2026-08 i18n pass). Selecting a pill
 * updates every UI string on the public site immediately, and re-runs the active route's loader
 * (`useRevalidateOnLocaleChange`, in `RootLayout`) so backend content — tour titles/descriptions,
 * fetched already resolved to one `languageCode` — catches up too.
 *
 * The pills are rendered from `LOCALES` (`shared/lib/locale`), so a new language appears here
 * automatically once it is added to that list (and to `shared/i18n/dictionary.ts`).
 */
export function LanguageSwitch() {
  const { locale: active, setLocale } = useLocale()

  return (
    <div className="flex items-center rounded-full p-0.5 ring-1 ring-edge">
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={() => setLocale(locale.code)}
          aria-pressed={active === locale.code}
          aria-label={locale.name}
          // `min-h-9` keeps the pill visually compact; the actual tap target is grown to the
          // 44x44 CSS px minimum by the invisible `before:` expander below (outward + vertical
          // only, never toward the neighbouring pill, so the two never fight over a click).
          className={[
            // A segment control switches STATE, so it stays a pure colour cross-fade on
            // `--dur-micro` (2.4 §5) — no lift, no press: the pill must not appear to move
            // relative to the one next to it.
            'relative inline-flex min-h-9 items-center rounded-full px-2 text-[11px] font-medium tracking-wide transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] sm:px-2.5',
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
