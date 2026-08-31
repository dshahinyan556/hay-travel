import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { TranslationKey } from '@/shared/i18n/dictionary'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { useDefaultPhoneCountry } from '@/shared/hooks'
import { Input, PhoneField, publicButtonClass, Select } from '@/shared/ui'
import { ContactAlert } from './ContactAlert'
import { ContactLimits, ContactMethodType, type ContactMethodModel } from '@/shared/types/contact'
import type { ContactMethodInput, ContactProfile } from '../api/contacts'
import {
  CONTACT_METHOD_LABEL_KEY,
  CONTACT_METHOD_ORDER,
  CONTACT_VALUE_LABEL_KEY,
  contactAutoComplete,
  contactFirstNameErrorKey,
  contactInputMode,
  contactValueErrorKey,
  isPhoneLike,
  normalizeContactValue,
  profileValueForType,
} from '../lib/contactValidation'

/**
 * Форма контакта — одна на создание и на правку.
 *
 * Разворачивается ПРЯМО В СПИСКЕ, а не в модальном окне: на 375 px модалка с пятью полями всё
 * равно стала бы полноэкранной панелью, и вместо одного сценария получилось бы два. Модальное
 * окно в разделе ровно одно — подтверждение удаления.
 *
 * Форма не ходит в сеть сама: `onSubmit` отдаёт готовое тело запроса разделу, который владеет
 * списком. Иначе после сохранения ей пришлось бы рассказывать наверх, что именно изменилось, —
 * и владение списком размазалось бы по двум местам.
 *
 * Ошибка показывается у КОНКРЕТНОГО поля и появляется по потере фокуса (повторно — по нажатию
 * «Сохранить»): общий список ошибок сверху заставляет искать глазами, какое из полей он имеет в
 * виду. Правило на фронте зеркалит серверное (`ContactMethodValidator`), а не заменяет его.
 *
 * ── Одна форма на два места (батч контактов 2026-08-29) ──────────────────────────────────────
 * Кроме справочника кабинета её же разворачивает `OrderContactsPicker` — блок «с кем связаться по
 * этому заказу» в корзине и в конструкторе трансфера. Отличаются только подписи (там контакт
 * добавляется В ЗАКАЗ, а не в справочник) и то, что флагом «основной» распоряжается сам блок, а
 * не форма, — поэтому появились три необязательных пропа, а не вторая форма: два набора правил
 * «что считается верным номером» разъехались бы на первой же правке.
 */
export interface ContactFormProps {
  /** Правимая строка; `null` — создание нового контакта. */
  contact: ContactMethodModel | null
  /** Профиль владельца аккаунта для «Заполнить из профиля». `null` — запрос профиля не удался,
   * и кнопки просто нет: неработающая кнопка хуже её отсутствия. */
  profile: ContactProfile | null
  /** Подставить профиль сразу при открытии — так открывается форма из пустого состояния,
   * где «Заполнить из профиля» и есть главное действие. */
  autoFillFromProfile?: boolean
  /** Справочник пуст: первый контакт сервер сделает основным в любом случае
   * (`UserContactMethodCreationService`), поэтому чекбокс не показывается — он не влиял бы ни на что. */
  isFirstContact: boolean
  submitting: boolean
  /** Отказ сервера по этой форме. Показывается над кнопками, а не у поля: сервер не сообщает,
   * какое из них ему не понравилось. */
  serverError: string | null
  /** Заголовок формы. По умолчанию — «Новый контакт»/«Изменение контакта» справочника. */
  titleKey?: TranslationKey
  /** Подпись кнопки отправки. По умолчанию — «Сохранить контакт». */
  submitKey?: TranslationKey
  /**
   * Убрать чекбокс «основной» СОВСЕМ, даже когда контакт не первый.
   *
   * Нужен блоку контактов заказа: там основной выбирается на карточках уже добавленных контактов
   * (это выбор из трёх, а не свойство одной формы), и вторая точка того же решения означала бы
   * два способа получить противоречивый ответ. `isFirstContact` для этого не годится: он
   * утверждает, что контакт первый, а в заказе он может быть и третьим.
   */
  hidePrimaryToggle?: boolean
  onSubmit: (input: ContactMethodInput) => void
  /**
   * Не передан — кнопки «Отмена» нет.
   *
   * Так форма открывается в блоке контактов заказа, пока не выбрано ни одного контакта: отменять
   * там нечего (контакт обязателен, а закрытая форма оставила бы пустой блок с одной кнопкой), и
   * кнопка, которая заведомо ничего не делает, объясняет это хуже, чем её отсутствие.
   */
  onCancel?: () => void
}

/** Проверяемые поля. Фамилии здесь нет: она необязательна (решение заказчика 2026-08-29), а
 * «поле без единого способа быть заполненным неправильно» не нуждается ни в `touched`, ни в
 * строке ошибки. */
type FieldName = 'firstName' | 'value'

export function ContactForm({
  contact,
  profile,
  autoFillFromProfile = false,
  isFirstContact,
  submitting,
  serverError,
  titleKey,
  submitKey = 'account.contacts.save',
  hidePrimaryToggle = false,
  onSubmit,
  onCancel,
}: ContactFormProps) {
  const { t } = useLocale()
  const fieldId = useId()
  const defaultCountry = useDefaultPhoneCountry()

  // Лениво и ровно один раз: форма пересоздаётся вместе со строкой, которую правит (у `<li>` в
  // списке свой `key`), поэтому пересчитывать начальные значения на каждый ввод символа не за чем.
  const [initial] = useState(() => buildInitialValues(contact, autoFillFromProfile ? profile : null))
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [type, setType] = useState<ContactMethodType>(initial.type)
  const [value, setValue] = useState(initial.value)
  const [isPrimary, setPrimary] = useState(contact?.isPrimary ?? false)
  /** `PhoneField` seeds its country+digits ONCE on mount and ignores later `initialValue` changes
   * by design (see its own doc comment) — correct for ordinary typing, wrong for «Заполнить из
   * профиля», which replaces `value` out from under an already-mounted field. Bumping this forces
   * a remount so the fresh value actually lands; switching between Phone/WhatsApp/Viber must NOT
   * bump it, or the digits someone already typed would vanish when they just change the method. */
  const [phoneFieldGen, setPhoneFieldGen] = useState(0)
  /** Какие поля человек уже покидал. Ошибка на нетронутом поле — это упрёк за то, что ещё не
   * успели набрать. */
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    firstName: false,
    value: false,
  })

  /** Снять флаг «основной» правкой НЕЛЬЗЯ: сервер обрабатывает только переход false → true, иначе
   * справочник остался бы без основного вовсе. Понижение делается повышением другого. */
  const primaryLocked = contact?.isPrimary === true

  const errors: Record<FieldName, string | null> = {
    firstName: keyToText(contactFirstNameErrorKey(firstName)),
    value: keyToText(contactValueErrorKey(type, value)),
  }

  function keyToText(key: TranslationKey | null): string | null {
    return key === null ? null : t(key)
  }

  const visibleError = (field: FieldName) => (touched[field] ? errors[field] : null)
  const hasVisibleError = (['firstName', 'value'] as const).some(
    (field) => visibleError(field) !== null,
  )

  function markTouched(field: FieldName) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  }

  function fillFromProfile() {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName ?? '')
    const filled = profileValueForType(type, profile)
    if (filled !== null) setValue(filled)
    // Форсирует пересоздание `PhoneField`, если способ телефонный — иначе он не заметит, что
    // `value` подменили снаружи (см. комментарий у `phoneFieldGen`).
    setPhoneFieldGen((generation) => generation + 1)
    // Подстановка — это не ввод: показывать ошибки на только что подставленных полях не за что.
    setTouched({ firstName: false, value: false })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setTouched({ firstName: true, value: true })
    if (errors.firstName || errors.value) return

    onSubmit({
      type,
      // Отправляем нормализованное значение — ровно то, что сервер и так запишет. Иначе форма
      // отдавала бы «+374 (91) 23-45-67», а обратно получала «+37491234567», и строка списка
      // мигала бы другим текстом сразу после сохранения.
      value: normalizeContactValue(type, value),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      // Первый контакт всё равно станет основным на сервере — отправляем это честно, чтобы тело
      // запроса не расходилось с тем, что произойдёт. При `hidePrimaryToggle` это правило не
      // действует: там основного назначает блок контактов заказа, и досчитывать его здесь значило
      // бы дать один ответ из двух мест.
      isPrimary: hidePrimaryToggle ? isPrimary : isFirstContact || primaryLocked || isPrimary,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl bg-panel-raised p-4 ring-1 ring-edge ring-inset sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h3 className="card-title text-ink">
          {titleKey
            ? t(titleKey)
            : contact
              ? t('account.contacts.formTitleEdit')
              : t('account.contacts.formTitleNew')}
        </h3>
        {profile && (
          <button
            type="button"
            onClick={fillFromProfile}
            disabled={submitting}
            className={publicButtonClass('ghost', 'sm', 'w-full sm:w-auto')}
          >
            {t('account.contacts.fillFromProfile')}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <FormField
          label={t('account.contacts.firstName')}
          htmlFor={`${fieldId}-first`}
          error={visibleError('firstName')}
          messageId={`${fieldId}-first-msg`}
        >
          <Input
            id={`${fieldId}-first`}
            surface="public"
            value={firstName}
            maxLength={ContactLimits.maxNameLength}
            autoComplete="given-name"
            error={visibleError('firstName') !== null}
            aria-describedby={visibleError('firstName') ? `${fieldId}-first-msg` : undefined}
            disabled={submitting}
            onChange={(event) => setFirstName(event.target.value)}
            onBlur={() => markTouched('firstName')}
          />
        </FormField>

        {/* Фамилия необязательна и НЕ помечена обязательной: у половины контактов её просто не
            знают («Ашот, водитель»), и требовать её означало бы получать выдуманные. */}
        <FormField label={t('account.contacts.lastName')} htmlFor={`${fieldId}-last`}>
          <Input
            id={`${fieldId}-last`}
            surface="public"
            value={lastName}
            maxLength={ContactLimits.maxNameLength}
            autoComplete="family-name"
            disabled={submitting}
            onChange={(event) => setLastName(event.target.value)}
          />
        </FormField>

        <FormField label={t('account.contacts.method')} htmlFor={`${fieldId}-type`}>
          <Select
            id={`${fieldId}-type`}
            surface="public"
            value={String(type)}
            disabled={submitting}
            options={CONTACT_METHOD_ORDER.map((method) => ({
              value: String(method),
              label: t(CONTACT_METHOD_LABEL_KEY[method]),
            }))}
            aria-label={t('account.contacts.method')}
            onChange={(next) => setType(Number(next) as ContactMethodType)}
          />
        </FormField>

        {/* Способы со значением-номером получают тот же составной контрол (флаг + код страны +
            цифры), что и регистрация/смена телефона в профиле — один компонент, одни правила
            (David, 2026-08-31). У него своя подпись/ошибка, поэтому здесь он не заворачивается в
            `FormField`, которая нарисовала бы их второй раз. */}
        {isPhoneLike(type) ? (
          <div className="flex flex-col gap-1.5">
            <PhoneField
              key={phoneFieldGen}
              name={`${fieldId}-value`}
              label={t(CONTACT_VALUE_LABEL_KEY[type])}
              defaultCountry={defaultCountry}
              initialValue={value}
              disabled={submitting}
              onValueChange={(next) => setValue(next ? `+${next}` : '')}
            />
            {/* `PhoneField` blurs/validates internally and never calls `markTouched`, so this can
                only appear after an actual submit attempt (`handleSubmit` is what sets
                `touched.value`) — never mid-typing, same restraint `FormField`'s own error slot
                has everywhere else. */}
            {visibleError('value') && (
              <p role="alert" className="text-[12.5px] leading-snug text-danger">
                {visibleError('value')}
              </p>
            )}
          </div>
        ) : (
          <FormField
            label={t(CONTACT_VALUE_LABEL_KEY[type])}
            htmlFor={`${fieldId}-value`}
            error={visibleError('value')}
            messageId={`${fieldId}-value-msg`}
          >
            <Input
              id={`${fieldId}-value`}
              surface="public"
              value={value}
              maxLength={ContactLimits.maxValueLength}
              inputMode={contactInputMode(type)}
              autoComplete={contactAutoComplete(type)}
              error={visibleError('value') !== null}
              aria-describedby={`${fieldId}-value-msg`}
              disabled={submitting}
              className="tabular-nums"
              onChange={(event) => setValue(event.target.value)}
              onBlur={() => markTouched('value')}
            />
          </FormField>
        )}
      </div>

      {!isFirstContact && !hidePrimaryToggle && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={primaryLocked ? true : isPrimary}
            disabled={submitting || primaryLocked}
            onChange={(event) => setPrimary(event.target.checked)}
            className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] accent-gold-fill focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <span className="text-sm text-ink-dim">
            {primaryLocked
              ? t('account.contacts.isPrimaryLocked')
              : t('account.contacts.isPrimaryField')}
          </span>
        </label>
      )}

      {serverError && (
        <div className="mt-4">
          <ContactAlert message={serverError} />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={submitting || hasVisibleError}
          className={publicButtonClass('gold')}
        >
          {submitting ? t('account.contacts.saving') : t(submitKey)}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={publicButtonClass('quiet')}
          >
            {t('account.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}

/** Поле формы кабинета: подпись (11 px, uppercase, muted — как в `ProfileSummary`), контрол,
 * под ним ошибка ЛИБО подсказка. `shared/ui/Field` здесь не годится: он на админской палитре
 * (`text-neutral-700`, `text-rose-700`) и на тёмной теме читался бы как чужой. */
function FormField({
  label,
  htmlFor,
  error,
  hint,
  messageId,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | null
  hint?: string
  /** Id сообщения под полем. Контрол ссылается на него через `aria-describedby`, иначе ошибка
   * есть на экране, но не в том, что читает скринридер, дойдя до поля. */
  messageId?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={messageId} role="alert" className="text-[12.5px] leading-snug text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[12.5px] leading-snug text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Начальные значения: правка — текущая строка, создание — либо профиль, либо пусто.
 * Способ по умолчанию — телефон: им пользуются чаще всех остальных вместе взятых. */
function buildInitialValues(contact: ContactMethodModel | null, profile: ContactProfile | null) {
  if (contact) {
    return {
      firstName: contact.firstName,
      // Фамилии может не быть вовсе — поле формы всё равно строковое.
      lastName: contact.lastName ?? '',
      type: contact.type,
      value: contact.value,
    }
  }

  // Без телефона в профиле подставлять телефонный способ незачем — тогда первым предлагается
  // почта, которая у аккаунта есть всегда.
  const type: ContactMethodType =
    profile && !profile.phoneNumber ? ContactMethodType.Email : ContactMethodType.Phone

  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    type,
    value: profile ? (profileValueForType(type, profile) ?? '') : '',
  }
}
