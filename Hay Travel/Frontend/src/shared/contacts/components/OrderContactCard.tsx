import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ContactMethodType, type OrderContactInput } from '@/shared/types/contact'
import { publicButtonClass } from '@/shared/ui'
import { contactFullName } from '../lib/contactDisplay'
import { CONTACT_METHOD_LABEL_KEY } from '../lib/contactValidation'

/**
 * Один ВЫБРАННЫЙ контакт заказа. Близнец `ContactCard` по визуальному языку и намеренно не он:
 * там строка справочника со своим `id` и действиями «изменить/удалить навсегда», здесь — снимок,
 * который живёт только до отправки, и действий у него ровно два, «сделать основным» и «убрать».
 * Слить их в один компонент значило бы завести пропы, половина которых всегда `undefined`.
 *
 * Чистая презентация: инвариант «основной ровно один» держит `lib/orderContacts.ts`, карточка
 * только показывает результат.
 */
export interface OrderContactCardProps {
  contact: OrderContactInput
  /** Отправка в полёте — действия строки заблокированы. */
  disabled: boolean
  /** `null` — контакт в наборе единственный: выбирать основного не из чего, и кнопка не рисуется
   * вовсе (заблокированная она объясняла бы это хуже, чем её отсутствие). */
  onMakePrimary: (() => void) | null
  onRemove: () => void
}

const CHIP_BASE =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs whitespace-nowrap ring-1 ring-inset'

export function OrderContactCard({ contact, disabled, onMakePrimary, onRemove }: OrderContactCardProps) {
  const { t } = useLocale()

  const name = contactFullName(contact)
  const methodLabel = t(CONTACT_METHOD_LABEL_KEY[contact.type])
  /** Для aria-подписей: иначе две кнопки в наборе из трёх назывались бы одинаково. */
  const target = `${name} · ${methodLabel}`
  // Номер набирают глазами по цифрам — моноширинные цифры не дают им «плясать» между строками.
  const isNumeric = contact.type !== ContactMethodType.Email && !contact.value.startsWith('@')

  return (
    <li className="flex flex-col gap-3 rounded-xl bg-panel-raised px-3.5 py-3 ring-1 ring-edge ring-inset sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="break-words">{name}</span>
          {contact.isPrimary && (
            <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.1em] text-gold-ink uppercase ring-1 ring-gold-line ring-inset">
              {t('orderContacts.primaryBadge')}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-dim">
          <span
            className={`${CHIP_BASE} ${
              contact.isPrimary
                ? 'bg-gold-soft text-gold-ink ring-gold-line'
                : 'bg-panel text-ink-dim ring-edge'
            }`}
          >
            {methodLabel}
          </span>
          <span className={`break-all ${isNumeric ? 'tabular-nums' : ''}`}>{contact.value}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
        {onMakePrimary && !contact.isPrimary && (
          <button
            type="button"
            onClick={onMakePrimary}
            disabled={disabled}
            aria-label={t('orderContacts.makePrimaryAria', { contact: target })}
            className={publicButtonClass('ghost', 'sm')}
          >
            {t('orderContacts.makePrimary')}
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('orderContacts.removeAria', { contact: target })}
          className={publicButtonClass('quiet', 'sm')}
        >
          {t('orderContacts.remove')}
        </button>
      </div>
    </li>
  )
}
