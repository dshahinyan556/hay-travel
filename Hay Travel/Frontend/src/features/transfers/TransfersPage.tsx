import { Link, useLoaderData } from 'react-router'
import { getTransfers } from '@/shared/api/transfers'
import type { TransferSummary } from '@/shared/types/transfer'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Reveal } from '@/shared/ui'
import { RouteIcon, SearchIcon } from '@/shared/ui/icons'
import { TransferBuilderCta } from './components/TransferBuilderCta'
import { TransferCard } from './components/TransferCard'
import { TransferFilterBar } from './components/TransferFilterBar'
import {
  applyTransferFilters,
  useTransferFilterOptions,
  useTransferFilters,
} from './hooks/useTransferFilters'

/**
 * `/transfers` — единственное публичное место, где живут предопределённые трансферы
 * (решение 0.15). В общий каталог `/trips` они не попадают: бэк исключает их из
 * `GetToursClient`, а `GetTourInfo` отвечает на трансфер 404.
 *
 * Один запрос на страницу: список трансферов. Значения фильтров считаются из НЕГО ЖЕ
 * (`useTransferFilterOptions`) — справочник городов заводить не стали (решение 0.23), а второй
 * запрос ради двух коротких списков был бы платой ни за что.
 *
 * Фильтрация — целиком на клиенте, как в каталоге туров: список короткий, данные уже здесь, и
 * ходить на сервер за подмножеством того, что лежит в памяти, незачем. Поэтому и «скелета
 * фильтрации» здесь нет — сетка перестраивается мгновенно.
 */

export async function transfersLoader(): Promise<{ transfers: readonly TransferSummary[] }> {
  return { transfers: await getTransfers() }
}

export function TransfersPage() {
  const { transfers } = useLoaderData() as { transfers: readonly TransferSummary[] }
  const { filters, setFilter, reset, isFiltered } = useTransferFilters()
  const options = useTransferFilterOptions(transfers)
  const { t } = useLocale()

  const visible = applyTransferFilters(transfers, filters)

  /* Маршрут, который посетитель искал, — им подписано пустое состояние и им же открывается
     конструктор. Выбор человека не выкидывается: он уже сказал, куда хочет ехать, и показать ему
     вместо этого весь список значило бы потерять это знание. */
  const wantedRoute = [filters.from, filters.to].filter((point) => point !== '').join(' → ')
  const builderQuery = new URLSearchParams()
  if (filters.from !== '') builderQuery.set('from', filters.from)
  if (filters.to !== '') builderQuery.set('to', filters.to)
  const builderSearch = builderQuery.toString()
  const builderTo = `/transfers/custom${builderSearch === '' ? '' : `?${builderSearch}`}`

  return (
    <div>
      <div className="band-veil relative w-full overflow-hidden pt-24 pb-18">
        <Reveal as="div" className="mx-auto w-full max-w-7xl px-4 sm:px-16">
          <p className="section-eyebrow">{t('transfers.eyebrow')}</p>
          <h1 className="text-gold-sheen h1-page mt-1.5">{t('transfers.title')}</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">{t('transfers.subtitle')}</p>
        </Reveal>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-14 sm:px-6 sm:pt-10">
        <Reveal as="div">
          <TransferFilterBar
            filters={filters}
            options={options}
            onChange={setFilter}
            onReset={reset}
            isFiltered={isFiltered}
            resultCount={visible.length}
          />
        </Reveal>

        {/* Группа reveal — на всегда смонтированной обёртке, а не на сетке: сетка исчезает при
            пустом результате, и наблюдатель ушёл бы вместе с ней (см. `ToursPage`). */}
        <Reveal group as="div">
          {visible.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {visible.map((transfer) => (
                <li key={transfer.id} className="reveal-item grid">
                  <TransferCard transfer={transfer} />
                </li>
              ))}
            </ul>
          ) : isFiltered ? (
            /* Пустой результат фильтров. Ряд фильтров ОСТАЁТСЯ на месте со счётчиком «Найдено: 0»
               (см. `TransferFilterBar`) — убрать его вместе с результатом значило бы отнять
               возможность поменять один пункт и попробовать снова. */
            <div className="veil-top mt-10 flex flex-col items-center rounded-2xl border border-dashed border-edge px-5 py-10 text-center sm:mt-14 sm:px-6 sm:py-12">
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-gold-ink ring-1 ring-edge-strong">
                <SearchIcon size={24} />
              </span>
              <p className="mt-4 font-display text-xl text-ink sm:text-2xl">
                {t('transfers.emptyFiltered.title', { route: wantedRoute })}
              </p>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted sm:text-sm">
                {t('transfers.emptyFiltered.body')}
              </p>
              <div className="mt-6 flex w-full flex-col items-center gap-2.5 sm:w-auto sm:flex-row">
                <Link
                  to={builderTo}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none sm:w-auto"
                >
                  <RouteIcon size={17} />
                  {t('transfers.emptyFiltered.action', { route: wantedRoute })}
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none sm:w-auto"
                >
                  {t('transfers.emptyFiltered.showAll')}
                </button>
              </div>
            </div>
          ) : (
            /* Трансферов нет вообще. Не тупик: конструктор работает и без готовых маршрутов, и
               потому становится главным действием экрана. */
            <div className="veil-top mt-10 flex flex-col items-center rounded-2xl border border-dashed border-edge px-5 py-10 text-center sm:mt-14 sm:px-6 sm:py-12">
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-gold-ink ring-1 ring-edge-strong">
                <RouteIcon size={26} />
              </span>
              <p className="mt-4 font-display text-xl text-ink sm:text-2xl">
                {t('transfers.empty.title')}
              </p>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted sm:text-sm">
                {t('transfers.empty.body')}
              </p>
              <Link
                to="/transfers/custom"
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
              >
                <RouteIcon size={17} />
                {t('transfers.builder.action')}
              </Link>
            </div>
          )}
        </Reveal>

        {/* Лента конструктора — только когда на экране есть маршруты: в пустых состояниях выше
            призыв «собрать свой» уже стоит главной кнопкой, и второй такой же читался бы как
            дубль. */}
        {visible.length > 0 && (
          <Reveal as="div">
            <TransferBuilderCta />
          </Reveal>
        )}
      </div>
    </div>
  )
}
