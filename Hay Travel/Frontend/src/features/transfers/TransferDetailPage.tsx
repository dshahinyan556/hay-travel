import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { getClosedDates } from '@/shared/api/booking'
import { getTransferInfo } from '@/shared/api/transfers'
import { getBookingWindow } from '@/shared/booking'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { transferPointOf, type TransferDetail } from '@/shared/types/transfer'
import { Reveal } from '@/shared/ui'
import { ArrowRightIcon, RouteIcon } from '@/shared/ui/icons'
import { TransferBookingPanel } from './components/TransferBookingPanel'
import { TransferRouteTimeline } from './components/TransferRouteTimeline'

/**
 * `/transfers/:id` — страница предопределённого трансфера.
 *
 * Раскладка повторяет страницу тура (слева содержимое, справа «липкая» панель брони), потому что
 * это один и тот же жест — «посмотрел и забронировал», — и вторая раскладка для той же задачи
 * заставила бы посетителя учиться сайту второй раз.
 *
 * Содержимого у трансфера мало: главная картинка и маршрут. Ни галереи, ни дней, ни включённого/
 * не включённого, ни доп.расходов у него нет по домену (решение 0.4), поэтому пустых секций тут
 * тоже нет — их отсутствие это факт, а не незаполненные данные.
 */

export interface TransferDetailLoaderData {
  transfer: TransferDetail | undefined
  closedDates: readonly string[]
}

export async function transferDetailLoader({
  params,
}: LoaderFunctionArgs): Promise<TransferDetailLoaderData> {
  const id = params.id ?? ''
  const transfer = await getTransferInfo(id)
  if (!transfer) return { transfer: undefined, closedDates: [] }

  const window = getBookingWindow()
  /* Доступность не роняет страницу: потеря списка означает лишь, что закрытый день отобьёт
     сервер при создании заказа, а не что трансфер нельзя показать. Тот же контракт, что у
     `tourDetailLoader`. Тип продукта бэк берёт из БД, поэтому правило «все трансферы»
     (решение 0.27) сюда попадает само. */
  const closedDates = await getClosedDates(Number(id), window.fromISO, window.toISO).catch(
    () => [] as string[],
  )
  return { transfer, closedDates }
}

export function TransferDetailPage() {
  const { transfer, closedDates } = useLoaderData() as TransferDetailLoaderData
  const { t } = useLocale()

  if (!transfer) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">{t('transfers.notFound.title')}</h1>
        <p className="mt-3 text-sm text-ink-muted">{t('transfers.notFound.body')}</p>
        <Link
          to="/transfers"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          <RouteIcon size={17} />
          {t('transfers.notFound.action')}
        </Link>
      </div>
    )
  }

  const from = transferPointOf(transfer.route, 'from')
  const to = transferPointOf(transfer.route, 'to')

  return (
    <div>
      <div className="ribbon-veil relative w-full overflow-hidden pt-24 pb-10">
        <Reveal as="div" className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          {from !== '' && (
            <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] tracking-[0.14em] text-gold-ink uppercase">
              <span>{from}</span>
              {to !== '' && (
                <>
                  <ArrowRightIcon size={13} className="shrink-0" />
                  <span>{to}</span>
                </>
              )}
            </p>
          )}
          <h1 className="text-gold-sheen h1-page mt-2.5">{transfer.title}</h1>
        </Reveal>
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-start gap-6 px-4 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_396px] lg:gap-7">
        <div className="min-w-0">
          <Reveal as="div">
            <img
              src={adaptiveImageUrl(transfer.coverImage)}
              alt={transfer.title}
              className="aspect-[16/9] w-full rounded-2xl object-cover ring-1 ring-edge"
            />
          </Reveal>

          {transfer.route.length > 0 && (
            <Reveal as="section" className="mt-5 rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
              <h2 className="section-eyebrow flex items-center gap-2">
                <RouteIcon size={16} />
                {t('transfers.detail.routeHeading')}
              </h2>
              <div className="mt-4">
                <TransferRouteTimeline route={transfer.route} />
              </div>
            </Reveal>
          )}
        </div>

        {/* «Липкая» только с `lg`: ниже этой ширины панель просто идёт следующим блоком — место у
            нижнего края экрана на мобильном занято навигационным доком. */}
        <div className="lg:sticky lg:top-24">
          <TransferBookingPanel transfer={transfer} closedDates={closedDates} />
        </div>
      </div>
    </div>
  )
}
