import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { getLogoUrl } from '@/shared/api/siteSettings'
import { MountainIcon } from '@/shared/ui/icons'
import { UserMenu } from '../UserMenu'
import { RailSegmentedControl } from './RailSegmentedControl'
import { useScrollElevation } from './useScrollElevation'

/**
 * «Стеклянная лента» — второй скин шапки публичного сайта (`theme.navStyle === 'rail'`,
 * макет `design/header-2026-08/direction-a-frosted-rail.html`).
 *
 * Вместо плавающей капсулы `Header` — полоса во всю ширину экрана: наверху страницы её как
 * объекта нет (прозрачна, видно только логотип/меню/контролы), при прокрутке под ней проявляется
 * матовое стекло от края до края. Щелей по бокам, из-за которых контент проезжал мимо размытия у
 * капсулы, здесь не остаётся физически.
 *
 * ── Почему это отдельный файл, а не флаг внутри `Header` ─────────────────────────────────────
 * Два варианта НИКОГДА не смонтированы одновременно (`SiteHeader` рендерит ровно один), а
 * `Header` заморожен: любая правка в нём — это риск регрессии на дизайне, который сейчас в
 * проде. Поэтому мелочи (массив ссылок, эффект загрузки логотипа) здесь честно продублированы, а
 * не вынесены в общий хелпер: связывать два скина общим кодом — значит чинить один и ломать
 * другой.
 *
 * ── Что переиспользуется ─────────────────────────────────────────────────────────────────────
 * `UserMenu` (авторизация, поповер, роли) — целиком, с `variant="rail"`, который меняет только
 * класс триггера. Валюта/язык/тема — в `RailSegmentedControl` (см. его комментарий).
 *
 * ── Ссылки только с `lg` ─────────────────────────────────────────────────────────────────────
 * Как и у капсулы: ниже `lg` разделы живут в `FrostedRailDock` (сосед по `RootLayout`), в ленте
 * при 390px остаются логотип и служебный трек.
 */
export function FrostedRailHeader() {
  const { t } = useLocale()
  const elevated = useScrollElevation()

  const navItems = [
    { to: '/', label: t('nav.home'), end: true },
    // Одна запись каталога: туры и экскурсии — вкладки внутри `/trips`, не разные разделы.
    { to: '/trips', label: t('nav.trips') },
    { to: '/regions', label: t('nav.regions') },
  ]

  // Логотип из админки (`Настройки → Брендинг`). Пустая строка — это ветка пустого состояния
  // (встроенный словесный знак ниже), а не отсутствующий текст сайта.
  const [logoUrl, setLogoUrl] = useState('')
  useEffect(() => {
    let cancelled = false
    getLogoUrl().then((url) => {
      if (!cancelled) setLogoUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    /*
      Оболочка постоянной высоты, лента внутри — абсолютная и сжимающаяся: почему именно так,
      см. `.rail-shell` в `index.css` (короткий ответ — иначе страница дёргалась бы на 20px в
      момент пересечения порога прокрутки).

      `pointer-events-none` на оболочке + `pointer-events-auto` на самой ленте: после сжатия под
      лентой остаётся ~20px прозрачной оболочки, и без этого они бы глушили клики по контенту.
    */
    <header className="rail-shell pointer-events-none sticky top-0 z-30 w-full">
      <div
        className="rail-visual pointer-events-auto absolute inset-x-0 top-0"
        data-elevated={elevated || undefined}
      >
        {/*
          Стопка стекла: три `backdrop-filter` разной силы со своими масками затухания + тон
          панели поверх. Порядок слоёв важен — тон рисует пиксели и должен лежать последним.
          `aria-hidden` не нужен: пустые `<i>` без текста скринридер и так не озвучивает.
        */}
        <div className="rail-glass">
          <i className="rail-blur-1" />
          <i className="rail-blur-2" />
          <i className="rail-blur-3" />
          <i className="rail-tint" />
        </div>

        <div className="relative mx-auto flex h-full max-w-[1200px] items-center justify-between gap-4 px-3.5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-7">
          <NavLink to="/" className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="Hay Travel" className="h-9 w-auto lg:h-11" />
            ) : (
              <>
                <span className="text-gold-ink">
                  <MountainIcon size={22} />
                </span>
                {/* `.rail-word` уменьшается вместе с лентой (25→21px), см. `index.css`. */}
                <span className="text-gold-sheen rail-word font-display tracking-[0.03em]">
                  Hay Travel
                </span>
              </>
            )}
          </NavLink>

          {/* Разделы по центру — симметричная композиция вместо «всё влево, контролы вправо». */}
          <nav
            aria-label={t('nav.mainAriaLabel')}
            className="hidden items-center gap-7 justify-self-center lg:flex"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'link-underline text-[13.5px] tracking-[0.04em]',
                    isActive ? 'text-gold-ink' : 'text-ink-dim hover:text-gold-ink',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 lg:justify-self-end">
            <RailSegmentedControl />
            {/* Единственное золотое пятно ленты: «Войти» / кнопка аккаунта (с `lg`). */}
            <UserMenu variant="rail" />
          </div>
        </div>

        {/* Золотой шов — та же `.seam`, что между секциями главной, проявляется при прокрутке. */}
        <div className="seam rail-seam" />
      </div>
    </header>
  )
}
