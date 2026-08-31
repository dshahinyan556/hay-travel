import { useState } from 'react'
import {
  Link,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  canOpenAdminPanel,
  ensureAuthReady,
  logout,
  useAuth,
  type AuthUser,
  type UserInfoModel,
} from '@/shared/auth'
import { withReturnTo } from '@/shared/lib/returnTo'
import { getMe } from './api/account'
import { getTelegramStatus, type TelegramLinkStatusModel } from './api/telegram'
import {
  AccountRail,
  DEFAULT_ACCOUNT_SECTION,
  isAccountSection,
  type AccountSectionId,
} from './components/AccountRail'
import { ConnectionsSection } from './sections/ConnectionsSection'
import { ContactsSection } from './sections/ContactsSection'
import { OrdersSection } from './sections/OrdersSection'
import { PreferencesSection } from './sections/PreferencesSection'
import { ProfileSection } from './sections/ProfileSection'
import { SecuritySection } from './sections/SecuritySection'

/**
 * Guard + profile fetch for `/account` (ADR 010, decisions 2 and 4).
 *
 * The guard is a LOADER, not an effect: it runs before the route renders, so an anonymous visitor
 * never sees a flash of an empty account screen — the same pattern as `adminRootLoader`. It also
 * carries the destination in `?returnTo=`, so signing in lands back here.
 *
 * `GET api/Account/Me` failing does NOT fail the route: everything except the name is available
 * from the token-derived `AuthUser`, so a dead profile request degrades two rows to «—» instead of
 * replacing the whole screen with an error. `GET api/Account/Telegram` is treated exactly the same
 * way, and for the same reason — one optional row must never cost the visitor the screen.
 *
 * The two requests run in parallel: they are independent, and sequencing them would put a second
 * round trip in front of the first paint for no benefit.
 *
 * It stays deliberately THIN as the cabinet grows: «Способы связи» and «Мои заказы» fetch their own
 * data when they are opened. Blocking the first paint on lists most visitors never open would make
 * every arrival pay for the one section someone happened to want.
 */
export async function accountLoader() {
  const state = await ensureAuthReady()
  if (!state.user) throw redirect(withReturnTo('/auth', '/account'))

  const [profile, telegram] = await Promise.all([
    getMe().catch(() => null),
    getTelegramStatus().catch(() => null),
  ])
  return { profile, telegram }
}

/** The open section lives in the URL, not in `useState`: a room of the cabinet has to be linkable,
 * has to survive a reload, and has to answer the Back button. `profile` is the default and carries
 * NO parameter — `/account` and `/account?section=profile` are the same place, and only one of them
 * should be the address people copy. */
const SECTION_PARAM = 'section'

/**
 * `/account` — the customer cabinet.
 *
 * This is a SHELL and nothing more: it resolves which section is open, owns the two pieces of state
 * that outlive a single section (the locally patched profile and the Telegram binding), and lays
 * the rail out against exactly one section at a time. Each section owns its own data, its own
 * loading/empty/error states and its own forms.
 *
 * It is no longer wrapped in `AuthShell`. That frame is for transactional screens reached from an
 * email link — «state a result and get out of the way» — and its `max-w-2xl` column cannot hold an
 * order table. The other seven screens keep it unchanged.
 */
export function AccountPage() {
  const { profile, telegram } = useLoaderData<typeof accountLoader>()
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  /** Locally applied result of a successful phone save, so the collapsed section shows the new
   * number without re-running the loader (which would also refetch the profile for one field). */
  const [savedProfile, setSavedProfile] = useState<UserInfoModel | null>(null)
  /** Same idea for the Telegram binding. It lives HERE rather than inside «Подключения» because
   * sections unmount when you leave them: kept there, a fresh link would be forgotten the moment
   * you looked at another section and would read «не подключён» again until the next full load. */
  const [telegramStatus, setTelegramStatus] = useState<TelegramLinkStatusModel | null>(telegram)
  const [isLeaving, setIsLeaving] = useState(false)

  // `useAuth` can momentarily report `null` during a sign-out initiated from this very screen; the
  // loader has already proven there was a session, so this is a render guard, not a permission one.
  if (!user) return null

  const rawSection = searchParams.get(SECTION_PARAM)
  /* An unknown or hand-typed value is not an error state — it falls back to the default section,
     the same way an unrecognised route param would. */
  const activeSection: AccountSectionId = isAccountSection(rawSection)
    ? rawSection
    : DEFAULT_ACCOUNT_SECTION

  /** Other parameters are carried over untouched: whoever put them there did so on purpose, and
   * changing rooms is not the moment to drop them. */
  function sectionHref(section: AccountSectionId): string {
    const next = new URLSearchParams(searchParams)
    if (section === DEFAULT_ACCOUNT_SECTION) next.delete(SECTION_PARAM)
    else next.set(SECTION_PARAM, section)

    const query = next.toString()
    return query === '' ? location.pathname : `${location.pathname}?${query}`
  }

  const effectiveProfile = savedProfile ?? profile
  const currentEmail = effectiveProfile?.email ?? user.email
  const currentPhone = effectiveProfile?.phoneNumber ?? user.phoneNumber ?? null

  async function handleLogout() {
    setIsLeaving(true)
    try {
      await logout()
      navigate('/')
    } finally {
      setIsLeaving(false)
    }
  }

  /* ONE element rendered in two places — under the rail's separator on a desktop, at the end of the
     page on a phone — with CSS deciding which one exists. Two hand-written copies of the same two
     actions would eventually drift apart. `display:none` also drops the hidden copy out of the
     accessibility tree, so a screen reader is offered exactly one «Выйти». */
  const exitActions = (
    <div className="flex flex-col gap-2.5">
      {/* Staff only — for everyone else this link does not exist, same rule the header's user
          menu applies. */}
      {canOpenAdminPanel(user) && (
        <Link
          to="/admin"
          className="min-h-11 w-full rounded-full bg-gold-fill px-5 py-3 text-center text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
        >
          {t('auth.goToPanel')}
        </Link>
      )}
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLeaving}
        className="min-h-11 w-full cursor-pointer rounded-full px-5 py-3 text-center text-sm text-ink-dim transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('auth.logout')}
      </button>
    </div>
  )

  return (
    <div>
      <div className="band-veil relative w-full overflow-hidden pt-20 pb-6 sm:pt-24 sm:pb-8">
        <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-10">
          <p className="section-eyebrow">{t('account.eyebrow')}</p>
          {/*
            Deliberately not `.h1-page`: that rule is unlayered CSS, so a `text-[30px]` utility
            could not override its 44px on a phone (see the warning in index.css). The sizes are
            its own — 44 / lg 52 — plus the 30px step the cabinet needs at 375px, where «Личный
            кабинет» otherwise eats two lines before the page has said anything. Leading stays at
            1.2: `.text-gold-sheen` clips its gradient to the LINE BOX, and anything tighter shears
            the descenders off.
          */}
          <h1 className="text-gold-sheen mt-1.5 font-display text-[30px] leading-[1.2] sm:text-[44px] lg:text-[52px]">
            {t('account.title')}
          </h1>
          <p className="mt-2 text-sm break-words text-ink-muted">{currentEmail}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-14 sm:px-6 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-10">
          {/* Счётчики появятся, когда «Способы связи» и «Мои заказы» научатся считать: до тех пор
              рельс показывает подпись без числа, а не выдуманный ноль. */}
          <AccountRail active={activeSection} sectionHref={sectionHref} footer={exitActions} />

          {/* `min-w-0`: without it a wide child (an order row, a link code) stretches the `1fr`
              column past the container and hands the whole page a horizontal scrollbar. */}
          <div className="min-w-0">
            <ActiveSection
              section={activeSection}
              user={user}
              profile={effectiveProfile}
              email={currentEmail}
              phone={currentPhone}
              telegram={telegramStatus}
              onTelegramChanged={setTelegramStatus}
              onPhoneSaved={setSavedProfile}
            />

            <div className="mt-8 border-t border-edge pt-5 lg:hidden">{exitActions}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActiveSectionProps {
  section: AccountSectionId
  user: AuthUser
  profile: UserInfoModel | null
  email: string
  phone: string | null
  telegram: TelegramLinkStatusModel | null
  onTelegramChanged: (status: TelegramLinkStatusModel) => void
  onPhoneSaved: (profile: UserInfoModel) => void
}

/**
 * The one open room.
 *
 * A `switch` rather than a lookup map, so TypeScript checks exhaustiveness: adding a seventh id to
 * `AccountSectionId` stops this compiling instead of silently rendering nothing.
 *
 * Sections are UNMOUNTED when you leave, not hidden — that is what «одна вещь за раз» actually
 * means here. A half-typed contact form must not survive a trip to another section and reappear
 * later, and a list nobody is looking at must not keep polling.
 */
function ActiveSection({
  section,
  user,
  profile,
  email,
  phone,
  telegram,
  onTelegramChanged,
  onPhoneSaved,
}: ActiveSectionProps) {
  switch (section) {
    case 'profile':
      return <ProfileSection user={user} profile={profile} email={email} />
    case 'contacts':
      return <ContactsSection />
    case 'orders':
      return <OrdersSection />
    case 'preferences':
      return <PreferencesSection />
    case 'connections':
      return <ConnectionsSection telegram={telegram} onTelegramChanged={onTelegramChanged} />
    case 'security':
      return (
        <SecuritySection currentEmail={email} currentPhone={phone} onPhoneSaved={onPhoneSaved} />
      )
  }
}
