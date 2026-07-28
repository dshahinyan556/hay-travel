import { Link } from 'react-router'
import { MountainIcon } from '@/shared/ui/icons'

/**
 * Utility footer: identity, navigation, contacts. Deliberately NOT a "why choose us" marketing
 * block — trust signals live on the tour cards instead (see `docs/client-site.md`).
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-edge bg-panel">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-gold-ink">
              <MountainIcon size={20} />
            </span>
            <span className="text-gold-sheen font-display text-xl font-semibold tracking-wide">
              Hay Travel
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            Туры и экскурсии по Армении — от Севана до Татева. Небольшие группы, местные гиды.
          </p>
        </div>

        <nav className="text-sm">
          <p className="text-[11px] tracking-[0.16em] text-gold-ink uppercase">Навигация</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to="/trips" className="text-ink-dim transition-colors hover:text-gold-ink">
                Путешествия
              </Link>
            </li>
            <li>
              <Link to="/regions" className="text-ink-dim transition-colors hover:text-gold-ink">
                Карта регионов
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm">
          <p className="text-[11px] tracking-[0.16em] text-gold-ink uppercase">Контакты</p>
          <ul className="mt-3 space-y-2 text-ink-dim">
            <li>Ереван, ул. Туманяна, 12</li>
            <li>
              <a href="tel:+37410123456" className="transition-colors hover:text-gold-ink">
                +374 10 123 456
              </a>
            </li>
            <li>
              <a href="mailto:info@haytravel.am" className="transition-colors hover:text-gold-ink">
                info@haytravel.am
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-edge px-4 py-5 text-center text-xs text-ink-muted sm:px-6">
        © {new Date().getFullYear()} Hay Travel. Все права защищены.
      </div>
    </footer>
  )
}
