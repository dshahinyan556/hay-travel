import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { BagIcon } from '@/shared/ui/icons'

/**
 * Empty cart (spec 008 §5.3 п.2).
 *
 * Not an error state and not a blank page: the SAME bag icon that sits in the header, so the
 * visitor recognises the object they just opened, one line explaining what fills it, and a gold
 * link back into the catalog.
 */
export function CartEmptyState() {
  const { t } = useLocale()

  return (
    <div className="rounded-2xl bg-panel px-6 py-12 text-center ring-1 ring-edge sm:py-14">
      <span className="inline-flex text-gold-ink">
        <BagIcon size={34} />
      </span>
      <h2 className="mt-3.5 font-display text-2xl text-ink sm:text-[26px]">{t('cart.empty.title')}</h2>
      <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-muted">
        {t('cart.empty.body')}
      </p>
      <Link
        to="/trips"
        className="btn-sheen mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-gold-fill px-6 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        {t('cart.empty.action')}
      </Link>
    </div>
  )
}
