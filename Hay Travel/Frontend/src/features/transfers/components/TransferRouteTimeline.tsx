import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TransferPoint } from '@/shared/types/transfer'

/**
 * Маршрут трансфера вертикальным таймлайном: «Откуда» → остановки → «Куда».
 *
 * Не список через запятую и не строка со стрелками: у маршрута с двумя-тремя остановками длинные
 * названия («Ереван, площадь Республики») в одну строку не помещаются ни на каком экране, а
 * перенос посреди стрелки читается как две разные точки.
 *
 * Роль каждой точки подписана СЛОВОМ, а не только позицией в списке: крайние точки визуально
 * отличаются золотым узлом, но цвет — не текст, и для скринридера подпись здесь единственный
 * носитель смысла. Разметка — `ol`/`li`: порядок точек это и есть содержание.
 */
export function TransferRouteTimeline({ route }: { route: readonly TransferPoint[] }) {
  const { t } = useLocale()

  const label = (kind: TransferPoint['kind']) =>
    kind === 'from'
      ? t('transfers.detail.pointFrom')
      : kind === 'to'
        ? t('transfers.detail.pointTo')
        : t('transfers.detail.pointStop')

  return (
    <ol className="relative pl-6">
      {/* Линия проведена псевдо-градиентом от золота к границе, поэтому «спускается» вместе со
          взглядом. Декоративная, вне потока чтения. */}
      <span
        aria-hidden="true"
        className="absolute top-3 bottom-3 left-[5px] w-px bg-gradient-to-b from-gold-deep to-edge-strong"
      />
      {route.map((point, index) => {
        const isEnd = point.kind !== 'stop'
        return (
          <li key={`${point.kind}-${index}-${point.text}`} className="relative py-1.5">
            <span
              aria-hidden="true"
              className={`absolute top-[13px] -left-6 h-2.5 w-2.5 rounded-full ${
                isEnd ? 'bg-gold-fill' : 'border-[1.5px] border-edge-strong bg-panel'
              }`}
            />
            <span className="block text-[10.5px] tracking-[0.14em] text-ink-muted uppercase">
              {label(point.kind)}
            </span>
            <span className="block text-[14px] font-semibold text-ink sm:text-[15px]">
              {point.text}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
