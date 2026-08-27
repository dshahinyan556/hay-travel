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
 *
 * ── Ниже 640px — одна кнопка вместо двух (2026-08-22, корзина) ────────────────────────────────
 * На 375px внутри капсулы шапки доступно ≈319px, и после добавления иконки корзины двух языковых
 * пилюль там физически не помещалось. Свободного места нет ни у логотипа (его уже прятали на
 * мобильном однажды — это читалось как поломка, и решение отменили), ни у валюты. Схлопывание
 * языка освобождает ≈33px и по существу лучше: показывать одновременно «RU» и «EN» — значит
 * тратить место на факт, что языка два. С 640px обе пилюли возвращаются без изменений.
 *
 * Две ветки разметки, а не один список с `hidden`-классом на неактивной пилюле: в схлопнутом виде
 * это ДРУГОЙ контрол — одна кнопка-переключатель, у которой видимая подпись называет текущий
 * язык, а действие противоположно (`language.switchTo`). Прятать половину сегментированного
 * переключателя означало бы кнопку с `aria-pressed`, которая при нажатии меняет чужое состояние.
 * Обе ветки чисто CSS-адаптивные: медиазапросов в JS нет, поэтому нет и мигания при первом кадре.
 */
export function LanguageSwitch() {
  const { locale: active, setLocale, t } = useLocale()

  const activeLocale = LOCALES.find((locale) => locale.code === active) ?? LOCALES[0]
  const nextLocale = LOCALES[(LOCALES.indexOf(activeLocale) + 1) % LOCALES.length]

  return (
    <>
      {/* Same wrapper as the expanded control, with one child instead of two — so the collapsed
          switch keeps the cluster's 40px height and its ring, and nothing in the row shifts at the
          breakpoint. */}
      <div className="flex items-center rounded-full p-0.5 ring-1 ring-edge sm:hidden">
        <button
          type="button"
          onClick={() => setLocale(nextLocale.code)}
          aria-label={t('language.switchTo', { language: nextLocale.name })}
          className="relative inline-flex min-h-9 items-center rounded-full bg-wine-tint px-2.5 text-[11px] font-medium tracking-wide text-gold-light transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] before:absolute before:-inset-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {activeLocale.label}
        </button>
      </div>

      <div className="hidden items-center rounded-full p-0.5 ring-1 ring-edge sm:flex">
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
    </>
  )
}
