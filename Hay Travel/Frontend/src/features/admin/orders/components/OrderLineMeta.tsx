import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { OrderLineInfoModel } from '@/shared/types/booking'
import { ordersCopy } from '../lib/ordersCopy'
import { formatLineTime, isCustomTransferLine } from '../lib/ordersModel'

export interface OrderLineMetaProps {
  line: OrderLineInfoModel
  className?: string
}

/** Одна серая пилюля «подпись: значение». Локальная, а не в `shared/ui`: за пределами этого
 * экрана такого вида чипов пока нет, а `KindChip`/`ProductTag` — про публичный сайт. */
function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex max-w-full items-baseline gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] leading-5 text-neutral-700">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span className="min-w-0 break-words font-medium text-neutral-900">{value}</span>
    </span>
  )
}

/**
 * Параметры строки заказа, появившиеся с трансферами и форматом (батч 2026-08-29, пункт 4.5):
 * выбранное время старта / подачи, формат (снапшот выбора клиента, когда у продукта «оба»), класс
 * авто по снапшоту названия и обратный рейс со своими датой и временем.
 *
 * Чипы под названием продукта, а НЕ четыре новые колонки грида: таблица строк уже 960px минимум,
 * и любая из этих величин у половины строк пустая — колонка ради пустоты растянула бы горизонтальную
 * прокрутку на всех экранах сразу.
 *
 * Каждый чип рисуется только когда значение есть, поэтому у старой строки (созданной до слотов) и
 * у обычного тура блок либо пуст, либо в одну пилюлю — компонент возвращает `null`, а не пустую
 * строку с отступами.
 */
export function OrderLineMeta({ line, className }: OrderLineMetaProps) {
  const copy = useCopy(ordersCopy)
  const formatLabels = useCopy(adminEnumsCopy).tourFormat

  const startTime = formatLineTime(line.startTime)
  // Сверяемся со словарём подписей, а не печатаем значение: у строки, созданной до батча,
  // формата нет, и пустой чип «Формат: » был бы хуже отсутствующего.
  const formatLabel = line.format === null ? null : (formatLabels[line.format] ?? null)
  const vehicleClass = line.vehicleClassNameSnapshot?.trim() || null
  const returnTime = formatLineTime(line.returnTime)
  const returnValue = line.isRoundTrip
    ? [line.returnDate, returnTime].filter(Boolean).join(' ').trim()
    : ''

  const chips = [
    startTime && { key: 'time', label: copy.lineTimeLabel, value: startTime },
    formatLabel && { key: 'format', label: copy.lineFormatLabel, value: formatLabel },
    vehicleClass && { key: 'vehicle', label: copy.lineVehicleClassLabel, value: vehicleClass },
    line.isRoundTrip && {
      key: 'return',
      label: copy.lineReturnLabel,
      // Обратный рейс есть, но дата/время не заполнены — сам факт важнее молчания.
      value: returnValue || copy.lineRoundTrip,
    },
  ].filter((chip): chip is { key: string; label: string; value: string } => Boolean(chip))

  const isRequest = isCustomTransferLine(line)
  if (chips.length === 0 && !isRequest) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ''}`}>
      {isRequest && (
        <span className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[11px] leading-5 font-semibold text-neutral-800">
          {copy.lineKindRequest}
        </span>
      )}
      {chips.map((chip) => (
        <MetaChip key={chip.key} label={chip.label} value={chip.value} />
      ))}
    </div>
  )
}
