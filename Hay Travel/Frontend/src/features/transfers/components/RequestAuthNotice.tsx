import { Link } from 'react-router'
import { withReturnTo } from '@/shared/lib/returnTo'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { CheckIcon, LockIcon } from '@/shared/ui/icons'

/**
 * «Войдите, чтобы отправить заявку» — появляется НА МЕСТЕ кнопки в момент нажатия.
 *
 * Не модальное окно и не молчаливый редирект: посетитель нажал «Отправить», и ответом должно
 * быть требование, стоящее там же, где его рука. Тот же приём уже работает в корзине
 * (`CartSummary`).
 *
 * Обещание «всё сохранится» здесь не вежливость, а описание реального механизма: черновик
 * заявки лежит в `localStorage` (`lib/transferRequestDraft.ts`) и переживает уход на `/auth` и
 * возврат по `?returnTo=`. Обещать это, не сохранив, было бы худшим из вариантов.
 *
 * Сеть при этом НЕ трогается вовсе: запроса не было, значит ничего не осталось наполовину
 * сделанным, пока посетитель ходит логиниться.
 */
export function RequestAuthNotice({ returnTo }: { returnTo: string }) {
  const { t } = useLocale()

  return (
    <div role="status" className="rounded-xl bg-panel-raised p-4 ring-1 ring-edge-strong">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-gold-ink">
          <LockIcon size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t('transfers.auth.title')}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-ink-muted">{t('transfers.auth.body')}</p>
        </div>
      </div>
      <Link
        to={withReturnTo('/auth', returnTo)}
        className="mt-3.5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gold-fill px-5 py-2.5 text-sm font-medium text-gold-on transition-colors hover:bg-gold-fill-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-panel-raised focus-visible:outline-none"
      >
        {t('transfers.auth.action')}
      </Link>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
        <CheckIcon size={14} className="shrink-0 text-success" />
        {t('transfers.auth.saved')}
      </p>
    </div>
  )
}
