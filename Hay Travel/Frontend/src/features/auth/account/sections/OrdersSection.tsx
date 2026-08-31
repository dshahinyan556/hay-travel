import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getMyOrders } from '@/shared/api/booking'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { LANGUAGE_CODE_BY_LOCALE } from '@/shared/lib/locale'
import type { OrderInfoModel } from '@/shared/types/booking'
import { AccountSectionHead } from '../components/AccountSectionHead'
import { AccountStatePanel } from '../components/AccountStatePanel'
import { OrderCard } from '../components/OrderCard'
import { accountButtonClass } from '../lib/accountButton'

/**
 * Раздел «Мои заказы» — заказы и заявки, оформленные под этим аккаунтом.
 *
 * Список read-only: менять заказ из кабинета нельзя, для этого есть менеджер. Поэтому у раздела
 * ровно три состояния — грузится, показывает список, не смог загрузиться, — и ни одной мутации.
 *
 * Порядок (новые сверху) задаёт сервер (`OrderByDescending(CreatedAtUtc)`), фронт не
 * пересортировывает. Фильтров и поиска нет сознательно: объём согласован, а когда заказов станет
 * действительно много, сортировки «новые сверху» перестанет хватать вместе с отсутствием
 * пагинации — это одна задача, а не две.
 *
 * Запрос повторяется при смене языка: названия продуктов приходят уже переведёнными сервером
 * (`GetMine?languageCode=`), и оставить в списке русские заголовки после переключения на
 * английский значило бы показать наполовину переведённый экран.
 */
export function OrdersSection() {
  const { t, locale } = useLocale()

  const [orders, setOrders] = useState<OrderInfoModel[] | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)

    getMyOrders(LANGUAGE_CODE_BY_LOCALE[locale])
      .then((result) => {
        if (cancelled) return
        setOrders(result)
      })
      .catch(() => {
        // Разбирать код отказа незачем: список либо пришёл, либо нет, и человеку в обоих
        // случаях доступно одно действие — повторить.
        if (!cancelled) setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locale, attempt])

  return (
    <section className="flex flex-col gap-4">
      <AccountSectionHead title={t('account.sectionOrders')} />

      {isLoading ? (
        <OrdersSkeleton />
      ) : loadFailed || orders === null ? (
        <AccountStatePanel
          tone="danger"
          title={t('account.orders.loadFailedTitle')}
          body={t('account.orders.loadFailedBody')}
        >
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className={accountButtonClass('ghost')}
          >
            {t('account.orders.retry')}
          </button>
        </AccountStatePanel>
      ) : orders.length === 0 ? (
        <AccountStatePanel
          title={t('account.orders.emptyTitle')}
          body={t('account.orders.emptyBody')}
        >
          {/* Пустой кабинет — единственное место, где уместно позвать в каталог: человек уже
              вошёл, но ещё ничего не заказал. Это переходы, поэтому ссылки, а не кнопки. */}
          <Link to="/trips" className={accountButtonClass('gold')}>
            {t('account.orders.emptyTrips')}
          </Link>
          <Link to="/transfers" className={accountButtonClass('ghost')}>
            {t('account.orders.emptyTransfer')}
          </Link>
        </AccountStatePanel>
      ) : (
        <ul aria-label={t('account.orders.listLabel')} className="flex flex-col gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Скелетон повторяет геометрию карточки заказа — шапка с номером, пилюлей и суммой плюс одна
 * строка, — чтобы список не «прыгал», когда данные приходят. Мерцание общее
 * (`.skeleton-shimmer`) и само выключается при `prefers-reduced-motion`.
 *
 * Две карточки, а не одна: одна читалась бы как «заказ уже здесь, дорисовывается», а не как
 * «список грузится».
 */
function OrdersSkeleton() {
  const { t } = useLocale()

  return (
    <div role="status" aria-label={t('account.orders.loading')} className="flex flex-col gap-4">
      {[70, 55].map((titleWidth) => (
        <div key={titleWidth} className="rounded-2xl bg-panel ring-1 ring-edge ring-inset">
          <div className="flex items-center gap-3.5 border-b border-edge px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="skeleton-shimmer h-4 w-[130px] rounded-lg bg-panel-raised" />
            <div className="skeleton-shimmer h-7 w-[92px] rounded-full bg-panel-raised" />
            <div className="skeleton-shimmer ml-auto h-4 w-[110px] rounded-lg bg-panel-raised" />
          </div>
          <div className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
            <div
              className="skeleton-shimmer h-[15px] rounded-lg bg-panel-raised"
              style={{ width: `${titleWidth}%` }}
            />
            <div className="skeleton-shimmer h-[15px] w-1/3 rounded-lg bg-panel-raised" />
          </div>
        </div>
      ))}
    </div>
  )
}
