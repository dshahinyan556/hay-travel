import { LOCALES } from '@/shared/lib/locale'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminLayoutCopy } from './adminLayoutCopy'

interface AdminLanguageSwitchProps {
  /** Extra classes for the container — the mounting point decides spacing and per-breakpoint
   * visibility, since the switch appears both in the desktop rail and in the mobile top bar. */
  className?: string
}

/**
 * Interface-language switch for `/admin` — same UX model as the public `app/layout/LanguageSwitch`
 * (a two-pill segmented control rendered from `LOCALES`, `aria-pressed` on the active one, tap
 * target grown to the 44px minimum), in the panel's own palette.
 *
 * It is a separate component rather than a reuse of the public one on purpose (ADR 021, decision
 * 4): the public switch is built on the site's wine/gold role tokens, while `AdminLayout`
 * deliberately pins `data-theme="light"` and strips `data-preset` so the panel never re-skins with
 * the site. Importing those tokens here would punch a hole through that isolation, so the pills
 * use the dark chrome's own literals (`#0b1220` background → `bg-white/10`/`text-slate-400`).
 *
 * No state of its own: both pills are a thin wrapper over `useLocale().setLocale`, which is the
 * same store the public site writes to. Switching here is a pure re-render — admin loaders fetch
 * every translation row at once, so nothing is refetched.
 */
export function AdminLanguageSwitch({ className = '' }: AdminLanguageSwitchProps) {
  const { locale: active, setLocale } = useLocale()
  const copy = useCopy(adminLayoutCopy)

  return (
    <div
      role="group"
      aria-label={copy.languageLabel}
      className={`flex items-center rounded-full p-0.5 ring-1 ring-white/15 ${className}`}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          type="button"
          onClick={() => setLocale(locale.code)}
          aria-pressed={active === locale.code}
          aria-label={locale.name}
          // `min-h-8` keeps the pill compact inside the slim top bar; the real tap target is grown
          // to 44px by the invisible `before:` expander — outward and vertical only, never toward
          // the neighbouring pill, so the two never fight over the same click.
          className={[
            'relative inline-flex min-h-8 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-wide transition-colors',
            "before:absolute before:-top-2 before:-bottom-2 before:content-[''] first:before:-left-3 first:before:right-0 last:before:left-0 last:before:-right-3",
            active === locale.code ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
          ].join(' ')}
        >
          {locale.label}
        </button>
      ))}
    </div>
  )
}
