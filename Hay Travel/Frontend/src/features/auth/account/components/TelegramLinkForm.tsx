import { useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { TelegramIcon } from '@/shared/ui/icons'
import { AuthError, AuthNotice, AuthSubmitButton } from '../../components/AuthShell'
import {
  issueTelegramLinkCode,
  unlinkTelegram,
  type TelegramLinkCodeModel,
  type TelegramLinkStatusModel,
} from '../api/telegram'
import { useTelegramLinkWatch } from '../hooks/useTelegramLinkWatch'
import { accountErrorMessageKey } from '../lib/accountErrors'

interface TelegramLinkFormProps {
  /** Current binding, loaded by `accountLoader`. `null` means the status request itself failed —
   * the page still renders (a dead status call must not cost the visitor the whole screen), and
   * this section falls back to the "not linked" flow, which is the only useful thing left to offer. */
  status: TelegramLinkStatusModel | null
  /** Hands the new binding back so the collapsed row re-renders without re-running the loader —
   * the same contract `PhoneChangeForm.onSaved` uses. */
  onChanged: (status: TelegramLinkStatusModel) => void
}

/** Insecure origins (plain `http://` on a LAN IP) expose no `navigator.clipboard` at all. Checked
 * once at module scope — it cannot change during a session — so the button simply does not exist
 * there instead of being a control that silently does nothing. The code itself stays selectable. */
const CAN_COPY = typeof navigator !== 'undefined' && Boolean(navigator.clipboard)

/**
 * Linking the account to `@HayTravelNotificationsBot` (ADR 031 / spec 015).
 *
 * The handshake finishes in Telegram, not here: we mint a one-time code, hand over the deep link,
 * and the bot's webhook binds the chat server-side.
 *
 * Раньше из этого следовало, что статус оживает только на следующем заходе, и это было записано
 * здесь как осознанное ограничение. Оно им не оказалось: подключаешь бота, возвращаешься на сайт,
 * а страница показывает «не подключено», пока не нажмёшь F5 (замечание Давида, 2026-08-29).
 * Теперь досмотром занимается `useTelegramLinkWatch` — проверка при возврате во вкладку плюс
 * короткий опрос, пока код выдан и вкладка на экране.
 *
 * Issuing a code is a POST that INVALIDATES the previous one, so it is bound to an explicit button
 * press and never to an effect — mounting this section must not quietly break a code the visitor
 * already sent to the bot from another device.
 */
export function TelegramLinkForm({ status, onChanged }: TelegramLinkFormProps) {
  const { t } = useLocale()

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<TelegramLinkCodeModel | null>(null)
  const [copied, setCopied] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  /** Человек ушёл к боту (нажал кнопку или свернул вкладку с кодом на руках). Экран обязан
   *  встретить его ответом, а не той же формой, которую он оставил. */
  const [waiting, setWaiting] = useState(false)
  /** Вернулся, а привязки нет. Отдельно от `waiting`: молчание в ответ на ожидание читается
   *  как «сайт не заметил, что я подключился». */
  const [notYet, setNotYet] = useState(false)
  /** Привязалось прямо сейчас, у нас на глазах — а не «было привязано, когда открыл страницу». */
  const [justLinked, setJustLinked] = useState(false)

  /* Досмотр привязки. `enabled` — пока не привязано (в том числе когда статус вообще не
     загрузился: там тоже показывается сценарий подключения). `polling` — только после выдачи
     кода: до неё привязываться нечему, и опрос был бы пустым. */
  useTelegramLinkWatch({
    enabled: !status?.isLinked,
    polling: link !== null,
    onLinked: (linked) => {
      setJustLinked(true)
      setWaiting(false)
      setNotYet(false)
      onChanged(linked)
    },
    onLeft: () => {
      setWaiting(true)
      setNotYet(false)
    },
    onStillNotLinked: () => setNotYet(true),
  })

  async function handleIssueCode() {
    if (pending) return

    setPending(true)
    setError(null)
    try {
      const issued = await issueTelegramLinkCode()
      setLink(issued)
      /* Новый код — новая попытка: и ожидание, и «пока не видим» относились к прошлому коду. */
      setWaiting(false)
      setNotYet(false)
      // The previous code is dead now — a stale "Скопировано" next to a different string would be
      // a lie about what is on the clipboard.
      setCopied(false)
      setDisconnected(false)
    } catch (err) {
      setError(t(accountErrorMessageKey(err)))
    } finally {
      setPending(false)
    }
  }

  async function handleDisconnect() {
    if (pending) return

    setPending(true)
    setError(null)
    try {
      await unlinkTelegram()
      setLink(null)
      setDisconnected(true)
      onChanged({ isLinked: false, telegramUsername: null })
    } catch (err) {
      setError(t(accountErrorMessageKey(err)))
    } finally {
      setPending(false)
    }
  }

  async function handleCopy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.code)
      setCopied(true)
    } catch {
      // Denied permission or a non-secure context: the code is right there and selectable, so
      // there is nothing to report — an error banner would be louder than the problem.
      setCopied(false)
    }
  }

  if (status?.isLinked) {
    return (
      <div className="flex flex-col gap-3.5">
        {error && <AuthError message={error} />}
        {/* Только когда привязка случилась в этой сессии: на обычном заходе «Telegram подключён»
            поверх строки «Подключён» было бы объявлением очевидного. */}
        {justLinked && <AuthNotice message={t('account.telegramJustLinked')} />}

        <p className="flex items-center gap-2 text-sm text-ink">
          <TelegramIcon size={17} className="shrink-0 text-gold-ink" />
          <span className="break-all">
            {status.telegramUsername
              ? `@${status.telegramUsername}`
              : t('account.telegramLinkedAccount')}
          </span>
        </p>
        <p className="text-sm text-ink-dim">{t('account.telegramLinkedHint')}</p>

        <button
          type="button"
          onClick={handleDisconnect}
          disabled={pending}
          className="w-full cursor-pointer rounded-full px-5 py-3 text-center text-sm text-ink-dim ring-1 ring-edge-strong transition-colors hover:text-danger focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t('auth.submitting') : t('account.telegramDisconnect')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {error && <AuthError message={error} />}
      {disconnected && <AuthNotice message={t('account.telegramDisconnected')} />}

      {link && (
        <div className="flex flex-col gap-3 rounded-xl bg-panel px-3.5 py-3 ring-1 ring-edge-strong">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <span className="text-[11px] font-semibold tracking-[.14em] text-ink-muted uppercase">
              {t('account.telegramCodeLabel')}
            </span>
            {CAN_COPY && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label={t('account.telegramCopyAria')}
                className="cursor-pointer rounded-full px-2.5 py-1 text-xs text-ink-dim transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              >
                {copied ? t('account.telegramCopied') : t('account.telegramCopy')}
              </button>
            )}
          </div>
          {/* `select-all` so a tap/click grabs the whole code even where the clipboard API is
              unavailable — that is the real fallback, not the button above. */}
          <code className="block font-mono text-base break-all select-all text-gold-ink">
            {link.code}
          </code>
          <p className="text-xs text-ink-muted">
            {t('account.telegramCodeExpires', { minutes: minutesUntil(link.expiresAtUtc) })}
          </p>
        </div>
      )}

      {link && (
        <>
          {/* A plain external link, not a router `Link`: `t.me` is another origin, and on a phone
              this is the handoff to the Telegram app itself. */}
          <a
            href={link.deepLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            /* Переход в мессенджер — это и есть начало ожидания. Ставим состояние по клику, не
               дожидаясь `visibilitychange`: на десктопе Telegram открывается отдельным окном, и
               вкладка сайта может вообще не скрыться. */
            onClick={() => {
              setWaiting(true)
              setNotYet(false)
            }}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
          >
            <TelegramIcon size={17} />
            {t('account.telegramOpenInApp')}
          </a>

          {waiting ? (
            <div className="flex flex-col gap-2 rounded-xl bg-panel px-3.5 py-3 ring-1 ring-edge-strong">
              <p className="flex items-center gap-2.5 text-sm text-ink">
                {/* `aria-hidden`: точка — это индикатор, а не содержание. Само сообщение уже
                    прочитано скринридером как текст. */}
                <span
                  aria-hidden
                  className="size-2 shrink-0 animate-pulse rounded-full bg-gold-ink motion-reduce:animate-none"
                />
                {t('account.telegramWaiting')}
              </p>
              <p className="text-sm text-ink-dim">
                {notYet ? t('account.telegramNotYet') : t('account.telegramWaitingHint')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-dim">{t('account.telegramCodeHint')}</p>
          )}

          <p className="text-sm text-ink-dim">{t('account.telegramRefreshHint')}</p>
        </>
      )}

      <form
        className="flex flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          handleIssueCode()
        }}
      >
        {/* Demoted to a quiet secondary action once a code exists: at that point the primary
            action is opening Telegram, and re-issuing would throw away the code just handed out. */}
        {link ? (
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer text-center text-sm text-ink-dim transition-colors hover:text-gold-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('auth.submitting') : t('account.telegramGetNewCode')}
          </button>
        ) : (
          <AuthSubmitButton disabled={pending}>
            {pending ? t('auth.submitting') : t('account.telegramGetCode')}
          </AuthSubmitButton>
        )}
      </form>
    </div>
  )
}

/**
 * Whole minutes left on the code — a static "действует N мин.", not a live countdown: the visitor
 * is about to leave for Telegram anyway, and a ticking timer on this screen would be decoration.
 *
 * The `Z` guard is not paranoia about the current backend (`DateTime.UtcNow` serializes with one):
 * a UTC timestamp that ever loses its designator is parsed as LOCAL time, which would silently
 * turn 30 minutes into "270 минут" for a visitor four zones away.
 */
function minutesUntil(expiresAtUtc: string): number {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(expiresAtUtc) ? expiresAtUtc : `${expiresAtUtc}Z`
  const remainingMs = new Date(normalized).getTime() - Date.now()
  return Math.max(1, Math.round(remainingMs / 60_000))
}
