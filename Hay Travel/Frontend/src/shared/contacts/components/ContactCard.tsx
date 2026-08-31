import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ContactMethodType, type ContactMethodModel } from '@/shared/types/contact'
import { publicButtonClass } from '@/shared/ui'
import { contactFullName } from '../lib/contactDisplay'
import { CONTACT_METHOD_LABEL_KEY } from '../lib/contactValidation'

/**
 * Одна строка справочника способов связи. Чистая презентация: ничего не грузит и не решает,
 * какие действия возможны, — это знает раздел, который ею владеет.
 *
 * У основного контакта нет кнопки «Сделать основным»: она была бы уже нажата. Это единственное
 * различие между карточками, и ряд действий от него не «прыгает», потому что кнопки прижаты к
 * правому краю и растут влево.
 *
 * На узком экране действия уезжают ПОД содержимое и переносятся по строкам: три кнопки в один
 * ряд на 375 px не помещаются, а сжимать их до нечитаемого размера ради одной строки — плохой
 * размен.
 */
export interface ContactCardProps {
  contact: ContactMethodModel
  /** Список занят другой операцией — все действия строки заблокированы, чтобы два запроса не
   * переписывали один и тот же список наперегонки. */
  busy: boolean
  /** Строка, только что сохранённая: подсветка гаснет вместе с сообщением об успехе. Нужна
   * потому, что сервер ставит новый контакт в СВОЙ порядок (основной первым), и без подсветки
   * его пришлось бы искать глазами по всему списку. */
  highlighted: boolean
  onMakePrimary: () => void
  onEdit: () => void
  onDelete: () => void
}

const CHIP_BASE =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs whitespace-nowrap ring-1 ring-inset'

export function ContactCard({
  contact,
  busy,
  highlighted,
  onMakePrimary,
  onEdit,
  onDelete,
}: ContactCardProps) {
  const { t } = useLocale()

  const name = contactFullName(contact)
  const methodLabel = t(CONTACT_METHOD_LABEL_KEY[contact.type])
  /** Для aria-подписей: три кнопки в строке иначе назывались бы одинаково во всём списке. */
  const target = `${name} · ${methodLabel}`
  // Номер набирают глазами по цифрам — моноширинные цифры не дают им «плясать» между строками.
  const isNumeric = contact.type !== ContactMethodType.Email && !contact.value.startsWith('@')

  return (
    <li
      // `--dur-map` — «цветовая» длительность: она сознательно НЕ схлопывается при
      // `prefers-reduced-motion`, потому что смена цвета движением не является.
      className={`flex flex-col gap-3 px-4 py-3.5 transition-colors duration-[var(--dur-map)] sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${
        highlighted ? 'bg-gold-soft' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
          <span className="break-words">{name}</span>
          {contact.isPrimary && (
            <span className="inline-flex items-center rounded-full bg-gold-soft px-2.5 py-0.5 text-[10.5px] font-bold tracking-[0.1em] text-gold-ink uppercase ring-1 ring-gold-line ring-inset">
              {t('account.contacts.primaryBadge')}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-dim">
          <span
            className={`${CHIP_BASE} ${
              contact.isPrimary
                ? 'bg-gold-soft text-gold-ink ring-gold-line'
                : 'bg-panel-raised text-ink-dim ring-edge'
            }`}
          >
            {methodLabel}
          </span>
          <span className={`break-all ${isNumeric ? 'tabular-nums' : ''}`}>{contact.value}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
        {!contact.isPrimary && (
          <button
            type="button"
            onClick={onMakePrimary}
            disabled={busy}
            aria-label={t('account.contacts.makePrimaryAria', { contact: target })}
            className={publicButtonClass('ghost', 'sm')}
          >
            {t('account.contacts.makePrimary')}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          aria-label={t('account.contacts.editAria', { contact: target })}
          className={publicButtonClass('ghost', 'sm')}
        >
          {t('account.contacts.edit')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={t('account.contacts.deleteAria', { contact: target })}
          className={publicButtonClass('quiet', 'sm')}
        >
          {t('account.contacts.delete')}
        </button>
      </div>
    </li>
  )
}
