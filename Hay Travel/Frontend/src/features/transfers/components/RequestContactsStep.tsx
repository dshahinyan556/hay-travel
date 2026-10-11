import { useLocale } from '@/shared/i18n/LocaleProvider'
import { OrderContactsPicker } from '@/shared/contacts'
import type { OrderContactInput } from '@/shared/types/contact'
import type { VehicleClass } from '@/shared/types/transfer'
import { AlertIcon } from '@/shared/ui/icons'
import { RequestSummaryCard } from './RequestSummaryCard'
import type { TransferRequestFormState, WizardStep } from '../lib/transferWizard'

/**
 * Шаг 3 мастера: с кем связаться и что именно уедет.
 *
 * Контакты стоят ПЕРЕД сводкой, а не после: сводка — последнее, что человек читает перед
 * нажатием «Отправить», и вклинивать между ней и кнопкой ещё одну форму значило бы сломать
 * порядок «проверил → отправил».
 *
 * Блок контактов НЕ реализуется здесь и даже не оборачивается своей панелью с заголовком:
 * `OrderContactsPicker` живёт в `shared/contacts` и рисует себя целиком — заголовок, список,
 * форму и собственную ошибку. Он один на две точки создания заказа, корзину и этот конструктор,
 * потому что правило «минимум 1, максимум 3, ровно один основной» обязано быть одним куском кода:
 * две копии разъехались бы там, где расхождение стоит дороже всего, — на отправке заказа. Своя
 * рамка вокруг него дала бы вторую подложку и второй заголовок поверх его собственных.
 */
export interface RequestContactsStepProps {
  values: TransferRequestFormState
  onContactsChange: (contacts: OrderContactInput[]) => void
  chosenClass: VehicleClass | null
  /** Вернуться на шаг из сводки. */
  onEdit: (step: WizardStep) => void
  /** Ошибка по контактам: своя проверка формы либо отказ сервера (2060-2063). */
  contactsError?: string
  disabled?: boolean
}

export function RequestContactsStep({
  values,
  onContactsChange,
  chosenClass,
  onEdit,
  contactsError,
  disabled = false,
}: RequestContactsStepProps) {
  const { t } = useLocale()

  return (
    <>
      <OrderContactsPicker
        value={values.contacts}
        onChange={onContactsChange}
        error={contactsError ?? null}
        disabled={disabled}
      />

      <div className="mt-4">
        <RequestSummaryCard values={values} chosenClass={chosenClass} onEdit={onEdit} />
      </div>

      {/* Второе напоминание про цену — ровно здесь, где принимается решение. Первое стоит в шапке
          формы, и между ними человек успевает про него забыть. */}
      <div className="mt-4 flex items-start gap-3 rounded-xl bg-panel-raised p-3.5 ring-1 ring-edge-strong">
        <span className="mt-0.5 shrink-0 text-gold-ink">
          <AlertIcon size={19} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink-dim sm:text-[13.5px]">
          {t('transfers.request.submitHint')}
        </p>
      </div>
    </>
  )
}
