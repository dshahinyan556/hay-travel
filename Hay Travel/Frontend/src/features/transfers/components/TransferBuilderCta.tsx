import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { RouteIcon } from '@/shared/ui/icons'

/**
 * Вход в конструктор своего трансфера — ЛЕНТОЙ во всю ширину под сеткой, а не четвёртой плиткой
 * в ней.
 *
 * Плиткой он потерялся бы среди маршрутов и читался бы как ещё один товар; полоса читается как
 * отдельное действие и не конкурирует с тем, что продаётся. Ниже `sm` кнопка становится
 * блочной — на 375px кнопка рядом с текстом сжалась бы до нечитаемой.
 */
export function TransferBuilderCta({ to = '/transfers/custom' }: { to?: string }) {
  const { t } = useLocale()

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl bg-panel p-5 ring-1 ring-edge-strong sm:mt-8 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="section-eyebrow">{t('transfers.builder.eyebrow')}</p>
        <p className="mt-2 font-display text-xl leading-tight text-ink sm:text-2xl">
          {t('transfers.builder.title')}
        </p>
        <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-dim sm:text-sm">
          {t('transfers.builder.body')}
        </p>
      </div>
      <Link
        to={to}
        className="btn-sheen inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-gold-fill px-5 py-3 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none"
      >
        <RouteIcon size={17} />
        {t('transfers.builder.action')}
      </Link>
    </div>
  )
}
