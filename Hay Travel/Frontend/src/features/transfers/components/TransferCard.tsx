import { Link } from 'react-router'
import { adaptiveImageUrl } from '@/shared/lib/adaptiveImage'
import { useMoney } from '@/shared/currency'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { transferPointOf, type TransferSummary } from '@/shared/types/transfer'
import { KindChip } from '@/shared/ui'
import { ArrowRightIcon, CarIcon } from '@/shared/ui/icons'

/**
 * Карточка трансфера в сетке `/transfers`.
 *
 * СВОЙ компонент, а не `TourCard` с проверками на `null`: у трансфера нет региона, длительности,
 * тегов, скидки и формата — половина той карточки была бы мёртвым кодом. Но СТРУКТУРА копируется
 * один в один (`h-full` + `flex-col`, прижатый `mt-auto` низ, `line-clamp-2` заголовок), потому
 * что от неё зависит главное правило витрины: цена всех карточек в ряду стоит на одном уровне
 * независимо от длины заголовка (см. `docs/client-site.md`, «Карточка тура»).
 *
 * На мобильном карточка ГОРИЗОНТАЛЬНАЯ (обложка слева, 112px): вертикальная плитка с картинкой
 * 4:3 на 375px оставляет на экране полторы карточки, и список маршрутов превращается в
 * бесконечную прокрутку. Ниже `sm` это `flex-row`, выше — обычная плитка.
 */
export function TransferCard({ transfer }: { transfer: TransferSummary }) {
  const { t } = useLocale()
  const money = useMoney()

  const from = transferPointOf(transfer.route, 'from')
  const to = transferPointOf(transfer.route, 'to')

  return (
    // `min-w-0`: the wrapping `<li className="reveal-item grid">` makes THIS article a grid item
    // too (its own nested grid context, one implicit cell) — a grid item defaults to
    // `min-width: auto` same as a flex item, so without this it repeats the exact overflow the
    // `<li>` itself needed `min-w-0` for, just one level deeper (David, 2026-08-31).
    <article className="card-lift group h-full min-w-0">
      <Link
        to={`/transfers/${transfer.id}`}
        className="flex h-full overflow-hidden rounded-2xl bg-gradient-to-b from-panel-raised to-panel ring-1 ring-edge transition-shadow duration-[var(--dur-micro)] ease-[var(--ease-in-out-soft)] hover:ring-gold-line focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none sm:flex-col"
      >
        <div className="relative w-28 shrink-0 overflow-hidden sm:aspect-[4/3] sm:w-auto">
          <img
            src={adaptiveImageUrl(transfer.coverImage)}
            alt={transfer.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[var(--dur-reveal)] ease-[var(--ease-out-soft)] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/85 via-obsidian/10 to-obsidian/40" />
          {/* Чип только на широком экране: на 112px обложке он закрыл бы её целиком, а тип
              продукта на самой странице `/transfers` и так не вызывает вопросов. */}
          <div className="absolute inset-x-3 bottom-3 hidden sm:flex">
            <KindChip kind="transfer" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
          {from !== '' && (
            <p className="flex min-w-0 items-center gap-1.5 text-[10px] tracking-[0.14em] text-gold-ink uppercase sm:text-[11px]">
              {/* `min-w-0` on each span, not just the row: `truncate`'s `white-space: nowrap` gives
                  a flex item an intrinsic (max-content) width, and a flex item defaults to
                  `min-width: auto` — without this it refuses to shrink below the route name's own
                  full width, which was pushing the whole card past its grid track on mobile
                  (David, 2026-08-31). */}
              <span className="min-w-0 truncate">{from}</span>
              {to !== '' && (
                <>
                  <ArrowRightIcon size={12} className="shrink-0" />
                  <span className="min-w-0 truncate">{to}</span>
                </>
              )}
            </p>
          )}

          <h3 className="card-title mt-1.5 line-clamp-2 text-ink sm:mt-2">{transfer.title}</h3>

          {/* `mt-auto` — то самое, что держит цену всех карточек ряда на одной линии. */}
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-2.5 sm:pt-3.5">
            <span className="flex items-center gap-1.5 text-[10.5px] text-ink-dim sm:text-xs">
              <CarIcon size={14} className="shrink-0" />
              {t('transfers.pricePerCar')}
            </span>
            <span className="text-right leading-tight">
              {/* Цены нет только на битых данных: валидация не пропускает трансфер без цен.
                  «от 0» здесь было бы прямой ложью, поэтому ветка говорит «по запросу». */}
              {transfer.priceFrom === null ? (
                <span className="text-sm text-ink-dim">{t('transfers.priceUnknown')}</span>
              ) : (
                <>
                  <span className="block text-[10px] tracking-wide text-ink-muted">
                    {t('transfers.priceFrom')}
                  </span>
                  <span className="font-display text-xl text-gold-ink sm:text-2xl">
                    {money.format(transfer.priceFrom)}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

/**
 * Скелет карточки — повторяет структуру настоящей точь-в-точь (та же пропорция обложки, те же
 * отступы, тот же низ), поэтому сетка не прыгает в момент прихода данных. Отдельный от
 * `TourCardSkeleton` ровно потому, что карточка трансфера на мобильном горизонтальная: общий
 * скелет обещал бы не ту форму.
 */
export function TransferCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full overflow-hidden rounded-2xl bg-gradient-to-b from-panel-raised to-panel ring-1 ring-edge sm:flex-col"
    >
      <div className="skeleton-shimmer w-28 shrink-0 bg-edge/30 sm:aspect-[4/3] sm:w-auto" />
      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="skeleton-shimmer h-3 w-2/5 rounded-full bg-edge/30" />
        <div className="skeleton-shimmer h-5 w-4/5 rounded-full bg-edge/30" />
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-edge pt-2.5 sm:pt-3.5">
          <div className="skeleton-shimmer h-3 w-16 rounded-full bg-edge/30" />
          <div className="skeleton-shimmer h-6 w-20 rounded-full bg-edge/30" />
        </div>
      </div>
    </div>
  )
}
