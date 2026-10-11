import type { ReactNode } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { formatShortDate } from '@/shared/lib/format'
import type { VehicleClass } from '@/shared/types/transfer'
import type { TransferRequestFormState, WizardStep } from '../lib/transferWizard'

/**
 * Сводка заявки на последнем шаге: что именно сейчас уедет менеджеру.
 *
 * Заявка отправляется БЕЗ ЦЕНЫ — значит у человека нет ни одной цифры, по которой он мог бы
 * заметить, что собрал не то. Единственная проверка, которая у него остаётся, — прочитать
 * маршрут и дату ещё раз. Поэтому сводка не «приятное дополнение», а обязательная часть шага
 * отправки, и та же связка (номер + маршрут + дата) повторяется потом в `RequestResultPanel`.
 *
 * «Изменить» стоит у ГРУППЫ, а не у каждой строки: строк семь, семь одинаковых кнопок читаются
 * как таблица настроек, а не как сводка. Групп ровно две — по числу шагов, которые сюда попадают.
 *
 * Пустые необязательные поля (багаж, комментарий) не превращаются в строку «не указано»: пустая
 * строка в сводке — это шум, который человек обязан прочитать, чтобы понять, что читать было
 * нечего. Класс авто — исключение: «подберите сами» это осмысленный ВЫБОР, а не пропуск.
 */
export interface RequestSummaryCardProps {
  values: TransferRequestFormState
  chosenClass: VehicleClass | null
  /** Вернуться на шаг, где эту группу можно поправить. */
  onEdit: (step: WizardStep) => void
}

export function RequestSummaryCard({ values, chosenClass, onEdit }: RequestSummaryCardProps) {
  const { locale, t } = useLocale()

  const route = [values.from, ...values.stops.map((stop) => stop.text), values.to]
    .map((point) => point.trim())
    .filter((point) => point !== '')
    .join(' → ')

  const luggageParts: string[] = []
  if (values.luggageMedium > 0 || values.luggageLarge > 0) {
    luggageParts.push(
      t('transfers.request.summaryLuggageValue', {
        medium: values.luggageMedium,
        large: values.luggageLarge,
      }),
    )
  }
  if (values.luggageOther.trim() !== '') luggageParts.push(values.luggageOther.trim())

  return (
    <section className="rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5">
      <h2 className="text-[12px] tracking-[0.14em] text-gold-ink uppercase">
        {t('transfers.request.summaryTitle')}
      </h2>

      <SummaryGroup
        title={t('transfers.request.wizardStep1')}
        onEdit={() => onEdit(0)}
        editLabel={t('transfers.request.summaryEditAria', { section: t('transfers.request.wizardStep1') })}
      >
        {route !== '' && <SummaryRow label={t('transfers.request.summaryRoute')} value={route} />}
        {/* Дата и время могут быть пусты ровно в одном случае: черновик вернулся с третьего шага,
            а дата в нём протухла за ночь и была отброшена при чтении. Строка «, » вместо даты
            выглядела бы как поломка — строки просто нет, а «Далее»/отправка вернут на первый шаг. */}
        {values.date !== '' && values.pickupTime !== '' && (
          <SummaryRow
            label={t('transfers.request.summaryWhen')}
            value={t('transfers.request.summaryWhenValue', {
              date: formatShortDate(values.date, locale),
              time: values.pickupTime,
            })}
          />
        )}
        {values.isRoundTrip && values.returnDate !== '' && values.returnTime !== '' && (
          <SummaryRow
            label={t('transfers.request.summaryReturn')}
            value={t('transfers.request.summaryWhenValue', {
              date: formatShortDate(values.returnDate, locale),
              time: values.returnTime,
            })}
          />
        )}
      </SummaryGroup>

      <SummaryGroup
        title={t('transfers.request.wizardStep2')}
        onEdit={() => onEdit(1)}
        editLabel={t('transfers.request.summaryEditAria', { section: t('transfers.request.wizardStep2') })}
      >
        <SummaryRow
          label={t('transfers.detail.passengers')}
          value={String(values.passengers)}
        />
        {luggageParts.length > 0 && (
          <SummaryRow
            label={t('transfers.request.summaryLuggage')}
            value={luggageParts.join(' · ')}
          />
        )}
        <SummaryRow
          label={t('transfers.request.summaryVehicle')}
          value={chosenClass?.name ?? t('transfers.request.vehicleAny')}
        />
        {values.comment.trim() !== '' && (
          <SummaryRow
            label={t('transfers.request.summaryComment')}
            value={values.comment.trim()}
          />
        )}
      </SummaryGroup>
    </section>
  )
}

function SummaryGroup({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string
  onEdit: () => void
  editLabel: string
  children: ReactNode
}) {
  const { t } = useLocale()

  return (
    <div className="mt-4 rounded-xl bg-panel-raised px-3.5 py-3 ring-1 ring-edge">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-[12.5px] font-medium text-ink-dim">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="-mr-1.5 inline-flex min-h-11 shrink-0 items-center rounded-full px-2.5 text-[12.5px] font-medium text-gold-ink transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none"
        >
          {t('transfers.request.summaryEdit')}
        </button>
      </div>
      <dl className="mt-1 space-y-1.5">{children}</dl>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-[12px] text-ink-muted sm:w-28">{label}</dt>
      {/* `break-words`: маршрут из шести точек и комментарий на 2000 знаков — обычные значения
          здесь, и на 375px они обязаны переноситься, а не растягивать карточку. */}
      <dd className="min-w-0 flex-1 text-[13.5px] leading-snug break-words text-ink">{value}</dd>
    </div>
  )
}
