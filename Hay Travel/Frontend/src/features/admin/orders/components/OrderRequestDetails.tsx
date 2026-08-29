import { Field, Input, Tooltip } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { TransferRoutePointKind } from '@/features/admin/lib/enums'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type {
  CustomTransferDetailsInfoModel,
  OrderInfoModel,
  OrderLineInfoModel,
} from '@/shared/types/booking'
import { ordersCopy } from '../lib/ordersCopy'
import { isCustomTransferLine, lineTitle } from '../lib/ordersModel'
import { OrderLineMeta } from './OrderLineMeta'

export interface OrderRequestDetailsProps {
  /** Уже с наложенным черновиком: `lineTotal` в поле цены может быть несохранённой правкой —
   * коммитит её общий Save страницы, как и предоплату в гриде. */
  order: OrderInfoModel
  /** Любой запрос страницы в полёте / заказ заморожен — то же значение, что получает грид. */
  pending: boolean
  /** Причина недоступности `UpdateLine` (`Update`), или `null`: цену заявки правит тот же
   * эндпоинт, что предоплату, поэтому и гейт у них общий.
   * @default null */
  updateHint?: string | null
  /** Пишет прямо в черновик страницы — сеть не трогается до нажатия Save. */
  onChangeLineTotal: (line: OrderLineInfoModel, lineTotal: number) => void
}

/** Заголовок подраздела карточки с необязательной подсказкой за «?» (правило проекта: пояснения
 * живут за иконкой, а не инлайн-прозой). */
function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <HelpRevealZone enabled={Boolean(hint)} className="flex items-center gap-2">
      <h4 className="text-[11px] font-bold uppercase tracking-[.08em] text-neutral-500">{title}</h4>
      {hint && (
        <HelpButton surface="admin" title={title}>
          {hint}
        </HelpButton>
      )}
    </HelpRevealZone>
  )
}

/** Маршрут заявки: «откуда → стопы → куда» ровно в том виде, в каком его ввёл клиент (одноязычный
 * свободный текст, перевода у него нет). Сервер отдаёт список уже отсортированным, поэтому здесь
 * он только рисуется. `<ol>`, а не набор чипов: это последовательность, и порядок в ней — смысл. */
function RequestRoute({ details }: { details: CustomTransferDetailsInfoModel }) {
  const copy = useCopy(ordersCopy)
  const kindLabels = useCopy(adminEnumsCopy).transferRoutePointKind

  if (details.stops.length === 0) {
    return <p className="text-sm text-neutral-500">{copy.requestRouteEmpty}</p>
  }

  return (
    <ol className="flex flex-col gap-1.5" aria-label={copy.requestRouteAria}>
      {details.stops.map((stop) => (
        <li key={stop.id} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400"
          />
          <span className="min-w-0">
            {/* `kind` едет числом: неизвестное значение остаётся без подписи, а не печатает
                `undefined` — текст точки при этом всё равно виден. */}
            <span className="block text-[11px] uppercase tracking-wide text-neutral-500">
              {kindLabels[stop.kind as TransferRoutePointKind] ?? ''}
            </span>
            <span className="block break-words text-sm text-neutral-900">
              {stop.text?.trim() || copy.dash}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Багаж: два счётчика + свободный текст «другое». Заполнять его клиент не обязан (решение 0.13),
 * поэтому «ничего не указано» — нормальное состояние, а не ошибка. */
function RequestLuggage({ details }: { details: CustomTransferDetailsInfoModel }) {
  const copy = useCopy(ordersCopy)
  const other = details.luggageOther?.trim()
  const items = [
    details.luggageMediumCount > 0 && copy.requestLuggageMedium(details.luggageMediumCount),
    details.luggageLargeCount > 0 && copy.requestLuggageLarge(details.luggageLargeCount),
    other && `${copy.requestLuggageOther}: ${other}`,
  ].filter((item): item is string => Boolean(item))

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">{copy.requestLuggageEmpty}</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item} className="break-words text-sm text-neutral-900">
            {item}
          </li>
        ))}
      </ul>
      {details.luggageUnits > 0 && (
        <p className="text-xs text-neutral-500">{copy.requestLuggageUnits(details.luggageUnits)}</p>
      )}
    </div>
  )
}

/** Согласованная цена одной заявки. Полностью контролируемый инпут поверх `line.lineTotal`,
 * который страница уже «просветила» черновиком — сам он ничего не сохраняет. */
function RequestPriceField({
  line,
  currency,
  disabled,
  updateHint,
  onChange,
}: {
  line: OrderLineInfoModel
  currency: string
  disabled: boolean
  updateHint: string | null
  onChange: (lineTotal: number) => void
}) {
  const copy = useCopy(ordersCopy)

  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle title={copy.requestPriceTitle} />
      <Tooltip enabled={updateHint !== null} content={updateHint} cursor="not-allowed">
        <div className="w-full sm:w-56">
          <Field
            label={copy.requestPriceLabel(currency)}
            htmlFor={`request-line-total-${line.id}`}
            hint={copy.requestPriceHelp}
            // Ноль — валидное значение («ещё не согласована»), а не ошибка: заявка именно с ним и
            // приходит. Поэтому напоминание, а не блокирующая ошибка.
            warning={line.lineTotal === 0 ? copy.requestPriceNotSet : undefined}
          >
            <Input
              id={`request-line-total-${line.id}`}
              type="number"
              min={0}
              value={String(line.lineTotal)}
              disabled={disabled}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (Number.isFinite(value) && value >= 0) onChange(value)
              }}
            />
          </Field>
        </div>
      </Tooltip>
    </div>
  )
}

/**
 * «Детали заявки» — блок под гридом строк на вкладке «Обзор» (пункт 4.5 чек-листа): по карточке на
 * каждую строку-заявку кастомного трансфера, плюс поле согласованной цены.
 *
 * Почему отдельным блоком, а не колонками грида: у заявки нет продукта, зато есть маршрут из
 * произвольного числа точек, багаж и свободный комментарий — всё это принципиально многострочное.
 * Грид строк живёт в горизонтально прокручиваемой таблице `min-w-[960px]`, и на 375px маршрут в
 * ней был бы недостижим без прокрутки вбок. Эта карточка — обычный поток, поэтому читается и
 * правится на узком экране без единого горизонтального пикселя.
 *
 * Возвращает `null`, когда заявок в заказе нет — то есть у любого обычного заказа экран выглядит
 * ровно так же, как до этого батча.
 */
export function OrderRequestDetails({
  order,
  pending,
  updateHint = null,
  onChangeLineTotal,
}: OrderRequestDetailsProps) {
  const copy = useCopy(ordersCopy)
  const requestLines = order.lines.filter(isCustomTransferLine)
  if (requestLines.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-neutral-900">{copy.requestDetailsTitle}</h3>

      {requestLines.map((line) => {
        const details = line.customTransferDetails
        const comment = details?.comment?.trim()
        const desiredClass = details?.desiredVehicleClassName?.trim()

        return (
          <section key={line.id} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
            <header className="flex flex-col gap-1.5">
              <p className="break-words font-semibold text-neutral-900">{lineTitle(line, copy)}</p>
              <p className="text-xs text-neutral-500">{line.tourDate}</p>
              <OrderLineMeta line={line} />
            </header>

            {/* `customTransferDetails` заполняется сервером у КАЖДОЙ строки-заявки; пустой он
                может быть только на битых данных — тогда показываем хотя бы цену, а не падаем. */}
            {details && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <SectionTitle title={copy.requestRouteTitle} />
                    <RequestRoute details={details} />
                  </div>

                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <SectionTitle title={copy.requestPassengers} />
                      <p className="text-sm tabular-nums text-neutral-900">{details.passengerCount}</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <SectionTitle title={copy.requestLuggageTitle} hint={copy.requestLuggageHelp} />
                      <RequestLuggage details={details} />
                    </div>

                    {(desiredClass || details.desiredVehicleClassId !== null) && (
                      <div className="flex flex-col gap-1.5">
                        <SectionTitle
                          title={copy.requestDesiredClass}
                          hint={copy.requestDesiredClassHelp}
                        />
                        <p className="break-words text-sm text-neutral-900">{desiredClass || copy.dash}</p>
                      </div>
                    )}
                  </div>
                </div>

                {comment && (
                  <div className="flex flex-col gap-1.5">
                    <SectionTitle title={copy.requestComment} />
                    <p className="whitespace-pre-line break-words text-sm text-neutral-900">{comment}</p>
                  </div>
                )}
              </>
            )}

            <RequestPriceField
              line={line}
              currency={order.currency}
              disabled={pending || updateHint !== null}
              updateHint={updateHint}
              onChange={(lineTotal) => onChangeLineTotal(line, lineTotal)}
            />
          </section>
        )
      })}
    </div>
  )
}
