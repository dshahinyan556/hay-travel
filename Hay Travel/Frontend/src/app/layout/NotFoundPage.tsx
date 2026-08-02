import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { CompassIcon } from '@/shared/ui/icons'

export function NotFoundPage() {
  const { t } = useLocale()

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-4 py-16 text-center">
      <span className="text-gold-ink">
        <CompassIcon size={32} />
      </span>
      <h1 className="text-gold-sheen mt-4 font-display text-4xl">{t('notFound.title')}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('notFound.body')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/trips"
          className="rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover"
        >
          {t('notFound.allTrips')}
        </Link>
        <Link
          to="/regions"
          className="rounded-full px-5 py-2.5 text-sm text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft"
        >
          {t('nav.regions')}
        </Link>
      </div>
    </div>
  )
}
