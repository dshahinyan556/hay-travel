import { NavLink } from 'react-router'
import { useCartCount } from '@/shared/cart'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { BagIcon } from '@/shared/ui/icons'

/**
 * The cart entry point, in the utility cluster of BOTH headers (spec 008 §8.4).
 *
 * Visible on EVERY breakpoint, with no `lg:` gate — the same reasoning that keeps `CurrencySwitch`
 * there. It deliberately does NOT go into the bottom mobile bars (`MobileTabBar`,
 * `FrostedRailDock`): both are documented as exactly four navigation tabs on a `grid-cols-4`
 * capsule at 375px, and a fifth tab breaks both the contract and the layout. Room for this button
 * on a narrow screen comes from collapsing the language switch instead (see `LanguageSwitch`).
 *
 * A plain link, not a dropdown: the cart has one destination and no hover-only affordances.
 */
export interface CartNavButtonProps {
  /** Как у UserMenu: меняет только класс триггера, не структуру. */
  variant?: 'capsule' | 'rail'
}

export function CartNavButton({ variant = 'capsule' }: CartNavButtonProps) {
  const { t } = useLocale()
  const count = useCartCount()

  return (
    <NavLink
      to="/cart"
      aria-label={t('cart.nav.aria', { count })}
      className={[
        'relative inline-flex shrink-0 items-center justify-center rounded-full text-gold-ink ring-1 ring-edge transition-colors',
        variant === 'rail' ? 'h-[34px] w-[34px] lg:h-[38px] lg:w-[38px]' : 'h-10 w-10',
        'hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none',
      ].join(' ')}
    >
      <BagIcon size={variant === 'rail' ? 17 : 19} />
      {/*
        Wine, not gold: a gold badge next to a gold glyph disappears into it, and wine is the
        site's second colour in both skins. The two literals are intentional — this pill must read
        identically in dark and light, so it does not follow a palette token.

        `aria-hidden`: the count is already in the link's accessible name, and a screen reader
        must not read it twice. At zero the badge does not render at all — an empty cart has
        nothing to announce visually.
      */}
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#8e1b38] px-1 text-[10.5px] leading-none font-bold tabular-nums text-[#f0d9a0] ring-2 ring-panel"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </NavLink>
  )
}
