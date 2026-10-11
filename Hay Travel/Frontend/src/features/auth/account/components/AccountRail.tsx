import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TranslationKey } from '@/shared/i18n/dictionary'

/** The six rooms of `/account`. Exactly one is open at a time — the page-level version of the
 * accordion rule that used to govern the four forms (see `AccountPage`). */
export type AccountSectionId =
  | 'profile'
  | 'contacts'
  | 'orders'
  | 'preferences'
  | 'connections'
  | 'security'

/** The section a visit lands on, and the one that carries NO `?section=` in the URL. */
export const DEFAULT_ACCOUNT_SECTION: AccountSectionId = 'profile'

interface RailItem {
  id: AccountSectionId
  labelKey: TranslationKey
  /**
   * Shorter caption for the phone strip. Six items do not fit on 375px at any font size, so the
   * strip scrolls — but «Способы связи»/«Мои заказы» would each eat a third of the screen and make
   * the scroll longer than it has to be. Absent where the full label is already short.
   */
  shortLabelKey?: TranslationKey
}

const ITEMS: readonly RailItem[] = [
  { id: 'profile', labelKey: 'account.sectionProfile' },
  {
    id: 'contacts',
    labelKey: 'account.sectionContacts',
    shortLabelKey: 'account.sectionContactsShort',
  },
  { id: 'orders', labelKey: 'account.sectionOrders', shortLabelKey: 'account.sectionOrdersShort' },
  { id: 'preferences', labelKey: 'account.sectionPreferences' },
  { id: 'connections', labelKey: 'account.sectionConnections' },
  { id: 'security', labelKey: 'account.sectionSecurity' },
]

const IDS = ITEMS.map((item) => item.id)

/** Narrows whatever `?section=` happens to contain. A hand-typed or stale value is not an error
 * state — it falls back to the default section, the same way an unknown route param would. */
export function isAccountSection(value: string | null): value is AccountSectionId {
  return value !== null && (IDS as string[]).includes(value)
}

interface AccountRailProps {
  active: AccountSectionId
  /**
   * Builds the URL of a section. The rail renders real links — a section lives in the URL, so it
   * must survive «open in a new tab», a forwarded link and the Back button — but it deliberately
   * does NOT know how that URL is assembled; the page owns the query string.
   */
  sectionHref: (section: AccountSectionId) => string
  /** Optional counters. Owned by the sections that can actually count (contacts / orders); until
   * they hand a number over, the rail shows a label and nothing else rather than a guessed `0`. */
  contactsCount?: number
  ordersCount?: number
  /**
   * «Выйти» (and the staff-only panel link) — actions, not sections, hence a separator between
   * them and the list. Rendered here only from `lg` up: on a phone the rail is a strip at the top
   * of the screen, and a sign-out button inside a horizontally scrolling row of destinations is
   * both unfindable and easy to hit by accident. The page renders the same block at the bottom.
   */
  footer?: ReactNode
}

/**
 * Navigation of the account cabinet: a sticky 236px column on the desktop, a horizontally
 * scrollable strip of sections on a phone.
 *
 * ── One list, two shapes ──────────────────────────────────────────────────────────────────────
 * Both layouts are the SAME set of links with responsive utilities, not two rendered copies. A
 * duplicated list would mean two `<nav>` landmarks, two tab stops per section, and two places to
 * forget when a seventh section appears.
 */
export function AccountRail({
  active,
  sectionHref,
  contactsCount,
  ordersCount,
  footer,
}: AccountRailProps) {
  const { t } = useLocale()

  const stripRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  /* Arriving straight at `?section=security` must not leave the active tab off-screen with no
     sign that anything is selected. Scrolls the STRIP only (never the window): `scrollIntoView`
     would drag the whole page along with it. */
  useEffect(() => {
    const strip = stripRef.current
    const item = activeRef.current
    if (!strip || !item) return
    // Desktop: the list is a vertical column with nothing to scroll sideways.
    if (strip.scrollWidth <= strip.clientWidth) return

    const target = item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2
    strip.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [active])

  const counts: Partial<Record<AccountSectionId, number>> = {
    contacts: contactsCount,
    orders: ordersCount,
  }

  return (
    // `min-w-0`: without it the strip's un-wrapped `whitespace-nowrap` pills give this grid item an
    // intrinsic content width (~660px) that stretches the WHOLE mobile grid track to fit it — the
    // same failure mode `AccountPage`'s sibling column already guards against with its own
    // `min-w-0`, just on the other item. Without this the entire `/account` page overflows on a
    // phone (David, 2026-08-31): tabs, theme/currency segments and every card clipped at the
    // viewport edge instead of the strip scrolling internally as designed.
    <nav aria-label={t('account.navAria')} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      {/* `-mx-*` lets the strip bleed to the screen edges on a phone: an item clipped by the
          viewport edge is the only honest hint that the row continues — which is also why the OS
          bar is hidden (`.no-scrollbar`, same as `shared/ui/Tabs`). `relative` is load-bearing for
          the effect above: `offsetLeft` is measured against this box. `pt-1` matches the existing
          `pb-1`: a non-`visible` `overflow-x` makes the browser treat `overflow-y` as clipping too
          (CSS overflow spec), so the pills' own `ring-1` box-shadow was cut off flush at the
          container's top edge with no padding to render into — it read as a missing top border,
          fused with whatever sat above (David, 2026-08-31). */}
      <div
        ref={stripRef}
        className="no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:px-0 lg:pt-0 lg:pb-0"
      >
        {ITEMS.map((item) => {
          const isActive = item.id === active
          const count = counts[item.id]

          return (
            <Link
              key={item.id}
              to={sectionHref(item.id)}
              ref={isActive ? activeRef : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 flex-none items-center gap-2 rounded-full px-3.5 py-2 text-sm whitespace-nowrap ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none lg:justify-between lg:rounded-xl lg:ring-0 ${
                isActive
                  ? 'bg-gold-soft font-semibold text-gold-ink ring-gold-line lg:shadow-[inset_2px_0_0_var(--color-gold-line)]'
                  : 'text-ink-dim ring-edge hover:text-gold-ink lg:hover:bg-panel-raised'
              }`}
            >
              {/* `hidden` also removes the twin from the accessibility tree, so a screen reader
                  reads one caption, not both. */}
              <span className="lg:hidden">{t(item.shortLabelKey ?? item.labelKey)}</span>
              <span className="hidden lg:inline">{t(item.labelKey)}</span>

              {count !== undefined && (
                <span className="rounded-full bg-panel-raised px-1.5 py-px text-[11px] font-bold text-ink-muted tabular-nums ring-1 ring-edge">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {footer && (
        <div className="hidden lg:block">
          <div className="mx-1 my-3 h-px bg-edge" />
          {footer}
        </div>
      )}
    </nav>
  )
}
