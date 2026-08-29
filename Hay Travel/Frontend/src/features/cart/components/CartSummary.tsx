import { Link } from 'react-router'
import { withReturnTo } from '@/shared/lib/returnTo'
import { useLocale } from '@/shared/i18n/LocaleProvider'

/**
 * The cart's total + the single action that sends it (spec 008 §8.1).
 *
 * The label is always "Отправить заявку"/"Отправляем…": with an atomic checkout there is no such
 * thing as "send the remaining ones", so no third caption exists.
 *
 * The sign-in link carries `?returnTo=/cart` and NOTHING else — the cart lives in localStorage and
 * survives the trip to `/auth` on its own. That is the single biggest simplification the cart
 * brought: the booking form used to smuggle the picked date and guest count through the query
 * string to restore them after login.
 */
export interface CartSummaryProps {
  itemCount: number
  /** Готовые строки из useCartTotal. */
  total: string | null
  originalTotal: string | null
  /** true — хотя бы одна позиция с 7+ гостями, итог неполный. */
  hasQuoteOnlyLines: boolean
  /**
   * Причина блокировки CTA, или null — можно отправлять.
   *
   * `lineErrors` — сервер отклонил позиции на ПОСЛЕДНЕЙ попытке; `lineIssues` — позиция не
   * отправляема прямо сейчас (мест не хватает, формат не выбран — батч 2026-08-29), но ничего
   * ещё не отправлялось. Разные значения, потому что разная копия: во втором случае сказать
   * «заявка не создана» было бы неправдой.
   */
  blockedBy: 'unavailableTour' | 'lineErrors' | 'lineIssues' | 'sessionUnknown' | null
  running: boolean
  /** Не привязанная к строке ошибка последней попытки. */
  formError: string | null
  authNotice: boolean
  onSubmit: () => void
}

export function CartSummary({
  itemCount,
  total,
  originalTotal,
  hasQuoteOnlyLines,
  blockedBy,
  running,
  formError,
  authNotice,
  onSubmit,
}: CartSummaryProps) {
  const { t } = useLocale()
  const disabled = running || blockedBy !== null

  const blockedHint =
    blockedBy === 'unavailableTour'
      ? t('cart.summary.blockedUnavailable')
      : blockedBy === 'lineErrors' || blockedBy === 'lineIssues'
        ? t('cart.summary.blockedLines')
        : null

  return (
    <aside className="rounded-2xl bg-panel p-4 ring-1 ring-edge lg:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-xs text-ink-muted">{t('cart.summary.total')}</span>
          <p className="mt-1 text-xs text-ink-muted">{t('cart.summary.itemCount', { count: itemCount })}</p>
        </div>
        <div className="text-right">
          {originalTotal !== null && (
            <p className="text-xs text-ink-muted line-through">{originalTotal}</p>
          )}
          {/* `null` only when EVERY position is quote-only — showing "0 ֏" there would be a lie. */}
          <p className="font-semibold text-3xl tabular-nums text-gold-ink">{total ?? '—'}</p>
        </div>
      </div>

      {/* Directly under the sum, not in a footnote: a total computed from only part of the cart
          must not read as a final bill. */}
      {hasQuoteOnlyLines && (
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t('cart.summary.quoteNote')}</p>
      )}

      <div className="my-4 h-px bg-edge" />

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        // `btn-sheen` only while enabled — a shimmering DISABLED button reads as "still live",
        // which contradicts the dimmed state right next to it.
        className={`w-full rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${disabled ? '' : 'btn-sheen'}`}
      >
        {running ? t('cart.summary.submitting') : t('cart.summary.submit')}
      </button>

      <p className={`mt-2.5 text-center text-xs leading-snug ${blockedHint ? 'text-warning' : 'text-ink-muted'}`}>
        {blockedHint ?? t('cart.summary.hint')}
      </p>

      {/* On a long desktop list the banner at the top has already scrolled away by the time the
          visitor looks at the button, so the reassurance is repeated where the hand is. */}
      {blockedBy === 'lineErrors' && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] leading-snug text-ink-dim ring-1 ring-danger/45">
          {t('cart.summary.rejectedNote')}
        </p>
      )}

      {formError !== null && (
        <p role="alert" className="mt-2.5 text-[13.5px] leading-snug break-words text-danger">
          {formError}
        </p>
      )}

      {/* Not an error and no red: the visitor did nothing wrong, they simply have not signed in. */}
      {authNotice && (
        <div role="status" className="mt-4 rounded-xl bg-panel-raised p-3.5 ring-1 ring-edge-strong">
          <p className="text-sm font-medium text-ink">{t('cart.auth.title')}</p>
          <p className="mt-1 text-[13.5px] leading-snug break-words text-ink-muted">{t('cart.auth.body')}</p>
          <Link
            to={withReturnTo('/auth', '/cart')}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
          >
            {t('cart.auth.action')}
          </Link>
        </div>
      )}
    </aside>
  )
}
