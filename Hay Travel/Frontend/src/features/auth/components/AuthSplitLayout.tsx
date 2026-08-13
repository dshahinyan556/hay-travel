import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { MountainIcon } from '@/shared/ui/icons'
import { AuthPhotoPanel } from './AuthPhotoPanel'

interface AuthSplitLayoutProps {
  /** Заголовок над карточкой («С возвращением» / «Создать аккаунт»). */
  title: string
  /** Подзаголовок под ним. */
  subtitle?: string
  /** Содержимое карточки: переключатель режима + форма. */
  children: ReactNode
  /** Мелкий текст под карточкой (условия сервиса на регистрации). */
  note?: string
  /**
   * Запрос в полёте. Превращает золотой «шов» под заголовком в бегущую полосу
   * (`.seam-loading`). Ничего кроме шва не трогает — блокировка полей живёт в формах.
   */
  isBusy?: boolean
}

/**
 * Split-screen frame for `/auth` — and ONLY for `/auth` (ADR 017).
 *
 * There are deliberately two auth shells. `AuthShell` (the centred column) serves the six
 * transactional screens people arrive at from an email link, plus `/account`; this one serves the
 * single screen people arrive at from the site itself, which is a shopfront and gets the
 * photograph. A new auth screen should default to `AuthShell` and pick this one only if it is an
 * entry point from the site.
 *
 * NO viewport height units anywhere in this tree — not `h-screen`, not `100dvh`, not `svh`. The
 * screen lives inside `RootLayout` (sticky Header above, Footer below, a fixed `MobileTabBar`),
 * so its height comes from its content. A viewport unit here is a guaranteed on-screen-keyboard
 * bug on mobile, and the reason `useVisualViewportHeight` is NOT used either: that hook exists
 * for `position: fixed` sheets, and this is plain document flow the browser scrolls by itself.
 */
export function AuthSplitLayout({
  title,
  subtitle,
  children,
  note,
  isBusy = false,
}: AuthSplitLayoutProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[44%_56%]">
      <AuthPhotoPanel />

      <div className="flex items-center justify-center px-4 py-8 lg:px-10 lg:py-12">
        <div className="w-full max-w-[400px]">
          <div className="text-center">
            <span className="inline-flex text-gold-ink">
              <MountainIcon size={28} />
            </span>
            <h1 className="text-gold-sheen mt-2.5 font-display text-[30px]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
            {/* At rest a decorative hairline; while a request is in flight the same 1px becomes
                the progress indicator (`.seam-loading`, index.css). */}
            <div
              aria-hidden
              className={`mx-auto mt-4 h-px max-w-[180px] ${isBusy ? 'seam-loading' : 'seam'}`}
            />
          </div>

          {/* `.veil-top` is the existing surface wash, not a one-off gradient; `shadow-lg` reads
              the per-theme `--shadow-lg` token. */}
          <div className="veil-top relative mt-5 overflow-hidden rounded-2xl bg-panel p-5 shadow-lg ring-1 ring-edge sm:p-[22px]">
            {children}
          </div>

          {note && <p className="mt-3.5 text-center text-xs text-ink-muted">{note}</p>}

          <Link
            to="/"
            className="link-underline mt-5 block text-center text-sm text-ink-dim hover:text-gold-ink"
          >
            {t('auth.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
