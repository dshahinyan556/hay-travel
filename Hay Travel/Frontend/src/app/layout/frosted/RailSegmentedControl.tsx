import { useTheme } from '@/shared/hooks/useTheme'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { LOCALES } from '@/shared/lib/locale'
import { MoonIcon, SunIcon } from '@/shared/ui/icons'
import { CurrencySwitch } from '../CurrencySwitch'

/**
 * Валюта · язык · тема одним сегментированным треком — служебный кластер «Стеклянной ленты»
 * (макет `design/header-2026-08/direction-a-frosted-rail.html`). В плавающей шапке (`Header`) те
 * же три контрола живут как три отдельные капсулы; здесь это ОДИН трек с золотыми разделителями,
 * чтобы единственным «золотым пятном» в ленте осталась кнопка «Войти».
 *
 * ── Что переиспользуется, а что нарисовано заново ────────────────────────────────────────────
 * `ThemeToggle`/`LanguageSwitch` — чистая презентация над `useTheme`/`LocaleProvider`, поэтому
 * здесь дёргаются те же хуки и рисуется своя разметка: сегмент трека и отдельная капсула — это
 * разные объекты, а не два скина одного. `CurrencySwitch` наоборот переиспользуется целиком (в
 * нём живут поповер, шторка, фокус-трап и живые курсы) и получает `variant="rail"`, который
 * меняет ТОЛЬКО класс его триггера.
 *
 * ── Тапы 44×44 ───────────────────────────────────────────────────────────────────────────────
 * Видимая высота трека — 34px на мобильном, 38px на десктопе (макет). До минимума 44×44 каждый
 * сегмент дотягивается невидимым `before:`-расширителем, ровно как `ThemeToggle` и
 * `LanguageSwitch` в старой шапке. Расширители растут наружу и по вертикали, но никогда навстречу
 * соседу — иначе два сегмента дрались бы за один клик.
 */
export function RailSegmentedControl() {
  const { theme, toggleTheme } = useTheme()
  const { t, locale: activeLocale, setLocale } = useLocale()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <div className="flex h-[34px] items-stretch rounded-full ring-1 ring-edge lg:h-[38px]">
      {/* Валюта — всегда первый сегмент, поэтому её триггер закруглён слева самим треком. */}
      <div className="flex items-stretch">
        <CurrencySwitch variant="rail" />
      </div>

      <div className="flex items-stretch border-l border-gold-line/70">
        {LOCALES.map((locale) => (
          <button
            key={locale.code}
            type="button"
            onClick={() => setLocale(locale.code)}
            aria-pressed={activeLocale === locale.code}
            aria-label={locale.name}
            className={[
              // Переключатель состояния — только кросс-фейд цвета на `--dur-micro` (2.4 §5):
              // сегмент не должен «шевелиться» относительно соседнего.
              'relative inline-flex items-center px-2.5 text-[12px] font-semibold tracking-wide transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]',
              "before:absolute before:-top-1.5 before:-bottom-1.5 before:content-[''] first:before:-left-2 first:before:right-0 last:before:left-0 last:before:-right-2",
              activeLocale === locale.code
                ? 'text-gold-ink'
                : 'text-ink-muted hover:text-gold-ink',
            ].join(' ')}
          >
            {/*
              Активный язык — золотыми чернилами, а не залитой капсулой `bg-wine-tint`, как в
              плавающей шапке. Внутри общего трека вторая заливка читалась бы как ещё один
              контрол поверх контрола; в макете здесь тоже только цвет.
            */}
            {locale.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={nextTheme === 'light' ? t('theme.light') : t('theme.dark')}
        // `.icon-press` (2.4) несёт и переход цвета, и 90ms сжатие по `:active` — он ЗАМЕНЯЕТ
        // `transition-colors`, а не дополняет его (неслоёный CSS выигрывает у утилит Tailwind).
        className="icon-press relative inline-flex min-w-11 items-center justify-center rounded-r-full border-l border-gold-line/70 px-3 text-ink-dim before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:text-gold-ink"
      >
        {theme === 'dark' ? <SunIcon size={17} /> : <MoonIcon size={17} />}
      </button>
    </div>
  )
}
