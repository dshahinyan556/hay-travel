import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import {
  getContacts,
  getContentText,
  getSocialLinks,
  type ContactsContent,
  type ContentText,
  type SocialLink,
} from '@/shared/api/siteSettings'
import { Reveal } from '@/shared/ui'
import {
  MountainIcon,
  InstagramIcon,
  FacebookIcon,
  TelegramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from '@/shared/ui/icons'

const SOCIAL_ICON: Record<SocialLink['key'], (props: { size?: number }) => React.ReactElement> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsappIcon,
  youtube: YoutubeIcon,
}

const SOCIAL_LABEL: Record<SocialLink['key'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
}

/**
 * Utility footer: identity, navigation, contacts. Deliberately NOT a "why choose us" marketing
 * block — trust signals live on the tour cards instead (see `docs/client-site.md`).
 *
 * Motion (2.4): the three columns rise in as one block when the page bottom is reached, and every
 * text link draws its underline on hover/focus (`.link-underline`, `index.css`). The bottom
 * copyright strip is deliberately left out of the reveal — it sits below the fold of the fold,
 * and fading it in would only make the last line of the page feel late.
 */
export function Footer() {
  const { t } = useLocale()
  // Fetched client-side rather than through a route loader: the footer mounts on every page
  // via `RootLayout`, none of which have a reason to know about social links in their own data.
  // `getSocialLinks` never throws, and an empty/loading result just means the row stays hidden —
  // there is no error state to show for an optional row of icons.
  const [socialLinks, setSocialLinks] = useState<readonly SocialLink[]>([])
  // Same client-side-fetch, never-throws contract as `socialLinks` — admin-set via `Настройки →
  // Контакты`/`Настройки → Тексты сайта`, no hardcoded duplicate of this copy in the frontend.
  const [contacts, setContacts] = useState<ContactsContent>({ phone: '', email: '', address: '' })
  const [content, setContent] = useState<ContentText>({
    footerTagline: '',
    catalogTitle: '',
    catalogSubtitle: '',
    featuredHeading: '',
  })

  useEffect(() => {
    let cancelled = false
    getSocialLinks().then((links) => {
      if (!cancelled) setSocialLinks(links)
    })
    getContacts().then((result) => {
      if (!cancelled) setContacts(result)
    })
    getContentText().then((result) => {
      if (!cancelled) setContent(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer className="mt-24 border-t border-edge bg-panel">
      <Reveal
        as="div"
        className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-gold-ink">
              <MountainIcon size={20} />
            </span>
            <span className="text-gold-sheen font-display text-xl font-semibold tracking-wide">
              Hay Travel
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">{content.footerTagline}</p>

          {/*
            `flex-wrap`: the count is whatever the admin filled in (1 to 5, or none — the whole
            row is skipped then), so this has to hold up at any length without a fixed grid
            assuming 5 slots.
          */}
          {socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {socialLinks.map(({ key, url }) => {
                const SocialIcon = SOCIAL_ICON[key]
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={SOCIAL_LABEL[key]}
                    className="icon-press inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-dim ring-1 ring-edge hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
                  >
                    <SocialIcon size={17} />
                  </a>
                )
              })}
            </div>
          )}
        </div>

        <nav className="text-sm">
          <p className="text-[11px] tracking-[0.16em] text-gold-ink uppercase">{t('footer.navigation')}</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/trips" className="link-underline text-ink-dim hover:text-gold-ink">
                {t('nav.trips')}
              </Link>
            </li>
            <li>
              <Link to="/regions" className="link-underline text-ink-dim hover:text-gold-ink">
                {t('nav.regions')}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="text-[11px] tracking-[0.16em] text-gold-ink uppercase">{t('footer.contacts')}</p>
          <ul className="mt-3 space-y-2 text-ink-dim">
            {contacts.address && <li>{contacts.address}</li>}
            {contacts.phone && (
              <li>
                <a
                  href={`tel:${contacts.phone.replace(/[^+\d]/g, '')}`}
                  className="link-underline hover:text-gold-ink"
                >
                  {contacts.phone}
                </a>
              </li>
            )}
            {contacts.email && (
              <li>
                <a href={`mailto:${contacts.email}`} className="link-underline hover:text-gold-ink">
                  {contacts.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </Reveal>

      <div className="border-t border-edge px-4 py-5 text-center text-xs text-ink-muted sm:px-6">
        © {new Date().getFullYear()} Hay Travel. {t('footer.rights')}
      </div>
    </footer>
  )
}
