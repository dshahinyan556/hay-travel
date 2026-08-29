import { useLocale } from '@/shared/i18n/LocaleProvider'
import { Select, type SelectOption } from '@/shared/ui'
import { ArrowRightIcon } from '@/shared/ui/icons'
import type { TransferFilterOption, TransferFilters } from '../hooks/useTransferFilters'

/**
 * Ряд «Откуда → Куда» + сброс + счётчик найденного.
 *
 * ── Рендерится ВСЕГДА (решение 0.25) ──────────────────────────────────────────────────────────
 * При любом количестве трансферов, включая ноль. Никаких порогов «появляются с N-го маршрута» и
 * никакого скрытия фильтра с одним значением: ряд — часть постоянного каркаса страницы. Панель,
 * которая приходит и уходит, двигала бы всю сетку под собой, и посетитель, зашедший второй раз,
 * не находил бы фильтры там, где оставил. Ровно те же грабли уже наступлены на кнопке «Сбросить»
 * в каталоге туров — поэтому она тоже всегда в DOM и гасится прозрачностью, а не размонтируется.
 *
 * ── Почему `Select`, а не свой листбокс ───────────────────────────────────────────────────────
 * Списки короткие, а `Select` уже умеет публичную палитру, поповер на десктопе, шторку `Sheet` на
 * телефоне, клавиатуру и typeahead. Ради двух фильтров заводить второй, отстающий листбокс — это
 * гарантированная потеря доступности. Три вещи, которых `Select` не умел, добавлены ЕМУ, а не
 * скопированы сюда: `triggerPrefix` (подпись внутри кнопки), `active` (выбранное состояние) и
 * `SelectOption.meta` (счётчик у значения).
 *
 * ── 375px ─────────────────────────────────────────────────────────────────────────────────────
 * Стрелка между фильтрами скрыта (`hidden sm:flex`): на узком экране она съедает ~25px, которых
 * не хватает подписям, а порядок «Откуда, потом Куда» и так читается слева направо. «Сбросить» и
 * «Найдено» уходят отдельной строкой под фильтрами — тот же порядок, что в каталоге туров.
 */
export interface TransferFilterBarProps {
  filters: TransferFilters
  options: { from: readonly TransferFilterOption[]; to: readonly TransferFilterOption[] }
  onChange: (key: keyof TransferFilters, value: string) => void
  onReset: () => void
  isFiltered: boolean
  resultCount: number
}

export function TransferFilterBar({
  filters,
  options,
  onChange,
  onReset,
  isFiltered,
  resultCount,
}: TransferFilterBarProps) {
  const { t } = useLocale()

  /* Первый пункт — всегда «Все»: сбросить ОДИН фильтр можно прямо в его же списке, не только
     общей кнопкой. `meta` у него — общее число маршрутов, чтобы «Все» читалось как выбор, а не
     как «выключить». */
  const toSelectOptions = (list: readonly TransferFilterOption[], total: number): SelectOption[] => [
    { value: '', label: t('transfers.filter.all'), meta: String(total) },
    ...list.map((option) => ({
      value: option.value,
      label: option.value,
      meta: String(option.count),
    })),
  ]

  const total = options.from.reduce((sum, option) => sum + option.count, 0)

  return (
    <div>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Select
          value={filters.from}
          onChange={(value) => onChange('from', value)}
          options={toSelectOptions(options.from, total)}
          placeholder={t('transfers.filter.all')}
          triggerPrefix={t('transfers.filter.from')}
          triggerValueAlign="end"
          active={filters.from !== ''}
          aria-label={t('transfers.filter.fromAria')}
          className="min-w-0 flex-1 sm:max-w-[260px]"
        />
        {/* Стрелка делает из двух кнопок один маршрут — та же иконка, что на карточках, поэтому
            связь очевидна без подписи. Декоративна, поэтому вне табуляции и вне озвучки. */}
        <span aria-hidden="true" className="hidden shrink-0 text-ink-muted sm:flex">
          <ArrowRightIcon size={17} />
        </span>
        <Select
          value={filters.to}
          onChange={(value) => onChange('to', value)}
          options={toSelectOptions(options.to, total)}
          placeholder={t('transfers.filter.all')}
          triggerPrefix={t('transfers.filter.to')}
          triggerValueAlign="end"
          active={filters.to !== ''}
          aria-label={t('transfers.filter.toAria')}
          className="min-w-0 flex-1 sm:max-w-[260px]"
        />
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        {/* Всегда в DOM, гасится прозрачностью: появляющаяся и исчезающая кнопка двигала бы весь
            ряд. `inert` (а не только `pointer-events-none`) убирает её и из табуляции. */}
        <button
          type="button"
          onClick={onReset}
          inert={!isFiltered}
          aria-hidden={!isFiltered}
          className={`min-h-11 rounded-full text-[13.5px] font-medium text-gold-ink transition-opacity hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none ${
            isFiltered ? '' : 'opacity-0'
          }`}
        >
          {t('transfers.filter.reset')}
        </button>
        <span className="ml-auto text-[12.5px] text-ink-dim sm:text-[13px]">
          {t('transfers.found', { count: resultCount })}
        </span>
      </div>
    </div>
  )
}
