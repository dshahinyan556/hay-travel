import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { CheckIcon } from '@/shared/ui/icons'

/**
 * The one outcome a successful checkout can have (ADR 025): ONE order, ONE number.
 *
 * Three trips in the cart still produce a single number, so the panel also states how many
 * positions went into the request — otherwise one number after three rows reads as if the other
 * two were lost. The cart is already empty by the time this renders, which is exactly why this
 * state outranks the "cart is empty" branch on the page.
 */
export interface CheckoutResultPanelProps {
  orderNumber: string
  lineCount: number
  /** Итог, снятый ПЕРЕД очисткой корзины; `null` — все позиции были «по запросу». */
  total: string | null
}

export function CheckoutResultPanel({ orderNumber, lineCount, total }: CheckoutResultPanelProps) {
  const { t } = useLocale()

  return (
    <div className="max-w-[760px]">
      <div role="status" className="rounded-2xl bg-success-soft p-5 ring-1 ring-success/45">
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 text-success">
            <CheckIcon size={22} />
          </span>
          <h2 className="font-display text-xl leading-tight text-ink sm:text-2xl">
            {t('cart.result.title')}
          </h2>
        </div>
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-dim">{t('cart.result.body')}</p>

        {/* Set apart and large: this is the string the visitor will read out to a manager on the
            phone, so it must be findable in one glance and unambiguous digit by digit. */}
        <div className="mt-4 inline-flex items-center gap-2.5 rounded-2xl bg-panel px-5 py-3.5 ring-1 ring-edge">
          <span className="shrink-0 text-success">
            <CheckIcon size={18} />
          </span>
          <span>
            <span className="block text-[11px] tracking-[0.12em] uppercase text-ink-muted">
              {t('cart.result.orderNumberLabel')}
            </span>
            <span className="mt-0.5 block font-semibold text-[19px] leading-tight tabular-nums text-ink sm:text-[22px]">
              {t('cart.result.orderNumber', { number: orderNumber })}
            </span>
          </span>
        </div>

        <p className="mt-3 text-[13px] text-ink-muted">
          {total === null
            ? t('cart.result.lineCount', { count: lineCount })
            : t('cart.result.lineCountTotal', { count: lineCount, total })}
        </p>
      </div>

      <Link
        to="/trips"
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full px-4 py-2 text-[13.5px] font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none sm:w-auto sm:px-5"
      >
        {t('cart.result.continue')}
      </Link>
    </div>
  )
}
