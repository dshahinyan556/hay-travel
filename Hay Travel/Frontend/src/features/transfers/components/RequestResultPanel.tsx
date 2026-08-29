import { Link } from 'react-router'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { CheckIcon } from '@/shared/ui/icons'

/**
 * Экран результата заявки (пункт 6.7): «заявка принята» + НОМЕР.
 *
 * Отдельный экран, а не всплывашка: номер заявки нужно успеть увидеть и запомнить — это та
 * строка, которую посетитель назовёт менеджеру по телефону. Всплывашка закрывается случайным
 * тапом мимо, и номер исчезает вместе с ней.
 *
 * Никаких салютов и восклицательных знаков — тон сайта сдержанный. Зелёный здесь ровно один: круг
 * с галочкой, всё остальное остаётся обычными поверхностями.
 *
 * Сводка маршрута под номером — не украшение: заявка отправляется без цены, и единственный способ
 * убедиться, что уехало именно то, что собирали, — увидеть маршрут и дату ещё раз.
 */
export interface RequestResultPanelProps {
  orderNumber: string
  /** Маршрут одной строкой: «Звартноц → Гарни → Дилижан». */
  route: string
  /** Уже отформатированная дата поездки. */
  date: string
  /** `HH:mm`. */
  time: string
  passengers: number
}

export function RequestResultPanel({
  orderNumber,
  route,
  date,
  time,
  passengers,
}: RequestResultPanelProps) {
  const { t } = useLocale()

  return (
    <div className="mx-auto w-full max-w-[520px] text-center">
      <div role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-success/45">
          <CheckIcon size={26} strokeWidth={2} />
        </span>
        <h1 className="mt-4 font-display text-2xl leading-tight text-ink sm:text-[27px]">
          {t('transfers.result.title')}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-dim">{t('transfers.result.body')}</p>

        <div className="mt-4 rounded-xl bg-panel-raised px-4 py-3.5 ring-1 ring-edge">
          <p className="text-[11.5px] text-ink-muted">{t('transfers.result.numberLabel')}</p>
          <p className="mt-0.5 font-display text-2xl tabular-nums text-gold-ink">
            {t('transfers.result.number', { number: orderNumber })}
          </p>
        </div>

        {route !== '' && (
          <div className="mt-2.5 rounded-xl bg-panel-raised px-4 py-3.5 text-left ring-1 ring-edge">
            <p className="text-[11.5px] text-ink-muted">{t('transfers.result.routeLabel')}</p>
            <p className="mt-1 text-sm break-words text-ink">{route}</p>
            <p className="mt-1.5 text-[12.5px] text-ink-dim">
              {t('transfers.result.summary', { date, time, passengers })}
            </p>
          </div>
        )}
      </div>

      <Link
        to="/account"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      >
        {t('transfers.result.orders')}
      </Link>
      <Link
        to="/"
        className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-gold-ink ring-1 ring-gold-line transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
      >
        {t('transfers.result.home')}
      </Link>
    </div>
  )
}
