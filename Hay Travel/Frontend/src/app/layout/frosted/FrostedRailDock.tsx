import { NavLink } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useAuth } from '@/shared/auth'
import { CarIcon, CompassIcon, GuideIcon, HomeIcon, MapIcon } from '@/shared/ui/icons'

/**
 * Нижний док — мобильная навигация «Стеклянной ленты» (`theme.navStyle === 'rail'`, макет
 * `design/header-2026-08/direction-a-frosted-rail.html`), пара к `FrostedRailHeader`.
 *
 * Отличия от плавающей капсулы `MobileTabBar`, которую он заменяет в этом варианте:
 *  - док идёт во всю ширину и прижат к нижнему краю, а не висит островом с отступами;
 *  - размытие растёт ВВЕРХ на 34px с масками затухания — контент уходит под док постепенно,
 *    без линии обрезки (зеркало стопки стекла в шапке);
 *  - активная вкладка — золотая засечка 22×2px НАД иконкой, а не сплошной круг под ней: круг
 *    «съедал» иконку, засечка читается спокойнее и рифмуется со швом ленты.
 *
 * Рендерится соседом шапки в `RootLayout` (через `SiteMobileNav`), а не внутри неё: док
 * зафиксирован к вьюпорту, а не к позиции прокрутки. `lg:hidden` держит его и ссылки в ленте
 * взаимоисключающими.
 */
export function FrostedRailDock() {
  const { t } = useLocale()
  const { user } = useAuth()

  const tabItems = [
    { to: '/', label: t('nav.home'), end: true, Icon: HomeIcon },
    // Пятая вкладка (батч 2026-08-29). Подписи с этого момента обрезаются многоточием
    // (`truncate` ниже): на 375px пять колонок дают ~71px, и «Путешествия» в них не помещается
    // целиком — но подпись под иконкой это подсказка, а не единственный носитель смысла.
    { to: '/transfers', label: t('nav.transfersShort'), end: false, Icon: CarIcon },
    // «Путешествия» — средняя, третья из пяти вкладок (решение Давида 2026-08-31).
    { to: '/trips', label: t('nav.trips'), end: false, Icon: CompassIcon },
    { to: '/regions', label: t('nav.regionsShort'), end: false, Icon: MapIcon },
    // Одна вкладка, два адреса: у кабинета свой маршрут (`/account`), и `/auth` всё равно
    // отправил бы вошедшего туда же — незачем гонять через редирект на каждом тапе. `end`
    // остаётся false, чтобы вкладка читалась активной и на вложенных шагах `/auth/*`.
    {
      to: user ? '/account' : '/auth',
      label: user ? t('nav.account') : t('nav.login'),
      end: false,
      Icon: GuideIcon,
    },
  ] as const

  return (
    <nav
      aria-label={t('nav.mainAriaLabel')}
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden"
    >
      {/* Зеркало `.rail-glass`: те же слои, маски развёрнуты вверх. */}
      <div className="dock-glass">
        <i className="dock-blur-1" />
        <i className="dock-blur-2" />
        <i className="dock-tint" />
      </div>
      {/* Шов сверху — та же `.seam`, что у ленты, но горит постоянно: док не «проявляется». */}
      <div className="seam dock-seam" />

      <div
        className="relative grid grid-cols-5 px-1.5 pt-2"
        style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom))' }}
      >
        {tabItems.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            // `min-h-13` (52px) — зона нажатия с запасом к минимуму 44×44; по ширине это пятая
            // часть экрана (~75px при 390px), так что горизонталь всё ещё с запасом.
            className={({ isActive }) =>
              [
                'relative flex min-h-13 min-w-0 flex-col items-center gap-1 pt-1.5 pb-0.5 text-[11px] transition-colors duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)]',
                isActive ? 'text-gold-ink' : 'text-ink-muted hover:text-gold-ink',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {/*
                  Засечка. Всегда в разметке и всегда одного размера — меняется только `scaleX`,
                  поэтому переключение вкладки не двигает ни иконку, ни подпись. Ширина съезжается
                  к центру (`-translate-x-1/2` + `origin-center`), а не растёт от левого края.
                */}
                <span
                  aria-hidden="true"
                  className={[
                    'absolute top-0 left-1/2 h-0.5 w-[22px] -translate-x-1/2 rounded-full bg-gold-fill transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]',
                    isActive ? 'scale-x-100' : 'scale-x-0',
                  ].join(' ')}
                />
                <Icon size={20} />
                <span className={`w-full truncate text-center ${isActive ? 'font-bold' : ''}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
