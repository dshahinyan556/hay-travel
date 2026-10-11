import { useLocale } from '@/shared/i18n/LocaleProvider'
import { TelegramIcon } from '@/shared/ui/icons'
import type { TelegramLinkStatusModel } from '../api/telegram'
import { TelegramLinkForm } from '../components/TelegramLinkForm'

interface ConnectionsSectionProps {
  /** Loaded by `accountLoader`. `null` is NOT «not connected» — the status request itself failed,
   * and claiming the account has no Telegram would be a guess presented as a fact. */
  telegram: TelegramLinkStatusModel | null
  /** Keeps the page's copy in step after a link/unlink, without re-running the loader. */
  onTelegramChanged: (status: TelegramLinkStatusModel) => void
}

/**
 * «Подключения» — external services we can reach you through.
 *
 * Telegram moved here out of «Безопасность»: that section holds what you sign IN with, and sitting
 * next to a password made a messenger binding read as a login method. Nothing about the flow itself
 * changed — `TelegramLinkForm` and its `useTelegramLinkWatch` came across untouched.
 *
 * Built as a LIST of connections rather than a single full-width form, even though there is exactly
 * one entry today: signing in with Telegram is the obvious next tenant here (deferred by the
 * client), and a second row must not cost a re-layout.
 */
export function ConnectionsSection({ telegram, onTelegramChanged }: ConnectionsSectionProps) {
  const { t } = useLocale()

  const isLinked = telegram?.isLinked === true
  const statusLabel = isLinked
    ? t('account.telegramLinked')
    : telegram === null
      ? t('account.telegramStatusUnknown')
      : t('account.telegramNotLinked')

  return (
    <div className="flex flex-col gap-4">
      <h2 className="card-title text-ink">{t('account.sectionConnections')}</h2>

      <ul className="flex flex-col gap-3">
        <li className="rounded-2xl bg-panel-raised ring-1 ring-edge">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
            <TelegramIcon size={18} className="shrink-0 text-gold-ink" />
            <h3 className="text-sm font-semibold text-ink">{t('account.telegram')}</h3>

            {/* Same geometry as the order badge (28px, 11px/700, `.08em`, uppercase) so one status
                object looks the same everywhere in the cabinet. `strong` when connected, `muted`
                otherwise — including «статус недоступен», which is an absence of knowledge and must
                not be dressed up as a state. */}
            <span
              className={`inline-flex h-7 items-center gap-2 rounded-full px-3 text-[11px] font-bold tracking-[.08em] whitespace-nowrap uppercase ring-1 ${
                isLinked
                  ? 'bg-gold-soft text-gold-ink ring-gold-line'
                  : 'text-ink-muted ring-edge-strong'
              }`}
            >
              <span
                aria-hidden
                className={`size-[7px] shrink-0 rounded-full ${
                  isLinked ? 'bg-gold-ink' : 'ring-[1.5px] ring-ink-muted'
                }`}
              />
              {statusLabel}
            </span>
          </div>

          <div className="border-t border-edge px-4 py-4 sm:px-5">
            <TelegramLinkForm status={telegram} onChanged={onTelegramChanged} />
          </div>
        </li>
      </ul>
    </div>
  )
}
