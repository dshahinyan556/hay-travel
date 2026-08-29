import { useMoney } from '@/shared/currency'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { TransferVehicleOption } from '@/shared/types/transfer'
import { AlertIcon } from '@/shared/ui/icons'

/**
 * Один класс автомобиля в блоке брони: радио + вместимость + лимит багажа + ДВЕ цены + причина
 * недоступности.
 *
 * ── Две цены, но крупная одна ────────────────────────────────────────────────────────────────
 * У класса всегда есть и «в одну сторону», и «туда-обратно» (решение 0.6 — это ДВА независимых
 * поля, а не цена ×2). Крупно показывается та, что соответствует текущему выбору обратного
 * рейса, вторая идёт мелким серым рядом. Так на экране всегда ровно одна «настоящая» сумма, и
 * итог внизу панели не спорит с карточкой класса.
 *
 * ── Недоступный класс не исчезает ────────────────────────────────────────────────────────────
 * Он остаётся в списке, приглушённый, с ТОЧНОЙ причиной («не хватает 8 ед. багажа», «мест меньше,
 * чем пассажиров»). Исчезающие варианты выглядят как баг сайта, а исчезнувший вариант нечем
 * объяснить: посетитель не узнает, что уменьшив багаж, он его вернёт.
 *
 * Вместимость и багаж стоят прямо в карточке, а не за иконкой «?»: это не пояснение, а параметр
 * выбора. «?» рядом с заголовком блока объясняет другое — что цена за машину.
 *
 * ── 340px (самая узкая колонка проекта) ──────────────────────────────────────────────────────
 * Цена уходит ПОД название отдельной строкой (`flex-wrap`), а не вправо от него: тогда длина
 * названия («Минивэн повышенной вместимости» / «Extended-capacity minivan») вообще не влияет на
 * то, поместится ли цена. Название переносится и НЕ обрезается многоточием — обрезанное название
 * машины бессмысленно.
 */
export interface VehicleClassOptionProps {
  vehicle: TransferVehicleOption
  name: string
  selected: boolean
  onSelect: () => void
  /** `true` — цена «туда-обратно» становится главной. */
  roundTrip: boolean
  /** Почему класс не подходит; `null` — подходит. Показывается прямо в карточке. */
  issue: string | null
  disabled?: boolean
}

export function VehicleClassOption({
  vehicle,
  name,
  selected,
  onSelect,
  roundTrip,
  issue,
  disabled = false,
}: VehicleClassOptionProps) {
  const { t } = useLocale()
  const money = useMoney()

  const mainPrice = roundTrip ? vehicle.roundTripPrice : vehicle.oneWayPrice
  const secondary = roundTrip
    ? t('transfers.detail.oneWayPrice', { price: money.format(vehicle.oneWayPrice) })
    : t('transfers.detail.roundTripPrice', { price: money.format(vehicle.roundTripPrice) })

  return (
    <label
      className={[
        'flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors sm:p-3.5',
        issue !== null
          ? 'border-danger/45 bg-panel-raised opacity-70'
          : selected
            ? 'border-edge-strong bg-accent-soft'
            : 'border-edge bg-panel-raised hover:border-gold-line',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        className="peer sr-only"
      />
      {/* Своя «точка» радио: нативный `input` в тёмной теме рисуется системой и в палитру сайта
          не попадает. Настоящий `input` остаётся в DOM (`sr-only`), поэтому клавиатура, группа
          `name` и озвучка работают штатно; `peer-focus-visible` возвращает видимый фокус. */}
      <span
        aria-hidden="true"
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-focus ${
          selected ? 'border-gold-line' : 'border-edge-strong'
        }`}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-gold-fill" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{vehicle.name}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-dim sm:text-xs">
          <span>{t('transfers.detail.capacity', { count: vehicle.capacity })}</span>
          <span>{t('transfers.detail.luggage', { count: vehicle.luggageCapacity })}</span>
        </span>
        {issue !== null && (
          <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-danger">
            <AlertIcon size={13} className="shrink-0" />
            {issue}
          </span>
        )}
      </span>

      <span className="ml-[29px] w-full border-t border-edge pt-2 text-left sm:ml-0 sm:w-auto sm:border-0 sm:pt-0 sm:text-right">
        <span
          className={`font-display text-[19px] sm:text-[21px] ${
            issue !== null ? 'text-ink-muted' : 'text-gold-ink'
          }`}
        >
          {money.format(mainPrice)}
        </span>
        <span className="ml-2 text-[11px] text-ink-muted sm:ml-0 sm:block">{secondary}</span>
      </span>
    </label>
  )
}
