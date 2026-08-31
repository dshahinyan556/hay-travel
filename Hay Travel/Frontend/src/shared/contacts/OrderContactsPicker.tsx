import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '@/shared/auth'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { ContactLimits, type ContactMethodModel, type OrderContactInput } from '@/shared/types/contact'
import { publicButtonClass } from '@/shared/ui'
import { getContactProfile, getContacts, type ContactProfile } from './api/contacts'
import { ContactAlert } from './components/ContactAlert'
import { ContactForm } from './components/ContactForm'
import { OrderContactCard } from './components/OrderContactCard'
import { contactFullName } from './lib/contactDisplay'
import { CONTACT_METHOD_LABEL_KEY } from './lib/contactValidation'
import {
  addOrderContact,
  isSameContact,
  readLastOrderContacts,
  removeOrderContact,
  setPrimaryOrderContact,
  toOrderContact,
} from './lib/orderContacts'

/**
 * Блок «с кем связаться по этому заказу» — ОДИН на две точки создания заказа: корзину (`/cart`) и
 * конструктор трансфера (`/transfers/custom`). Живёт в `shared`, а не в одной из фич, ровно
 * поэтому: `features/cart` не имеет права импортировать `features/transfers`, и наоборот — а блок
 * обязан быть один, иначе правила «минимум 1, максимум 3, ровно один основной» разъехались бы
 * между двумя экранами.
 *
 * ── Зачем контакт вообще нужен ───────────────────────────────────────────────────────────────
 * Человек регистрируется с российским номером, прилетает в Армению и покупает местную симку.
 * Менеджер не должен гадать, куда звонить, — поэтому контакт обязателен у КАЖДОГО заказа и
 * уезжает СНИМКОМ значений (ADR 032 Р1): правка справочника не меняет уже созданные заказы.
 *
 * ── Кто чем владеет ──────────────────────────────────────────────────────────────────────────
 * Набор контактов принадлежит ЭКРАНУ ОФОРМЛЕНИЯ (`value`/`onChange`) — ровно то, что уедет в тело
 * запроса. Блок владеет только тем, что нужно ему самому: справочником профиля, профилем для
 * «Заполнить из профиля» и открытой формой. Он НЕ знает про отправку и поэтому не запоминает
 * «последний использованный набор» сам — это делает оформление после успеха
 * (`rememberOrderContacts`), потому что «использованный» значит «по нему реально договорились».
 *
 * ── Аноним ───────────────────────────────────────────────────────────────────────────────────
 * Корзина не требует входа до момента отправки, и блок это не ломает: справочника у анонима нет
 * (эндпоинт под токеном) — ему сразу показывается форма ручного ввода и объяснение, откуда
 * возьмутся сохранённые контакты. Ни одного запроса за него не делается.
 */
export interface OrderContactsPickerProps {
  /** Выбранные контакты заказа. Ровно то, что уедет в тело запроса. */
  value: readonly OrderContactInput[]
  onChange: (contacts: OrderContactInput[]) => void
  /** Ошибка ПО КОНТАКТАМ с сервера (2060-2063), уже переведённая в текст. */
  error?: string | null
  /** Отправка в полёте — блок не редактируется. */
  disabled?: boolean
}

/** Состояние справочника профиля. `'skipped'` — за анонима его никто не спрашивал. */
type DirectoryState = 'idle' | 'loading' | 'ready' | 'failed' | 'skipped'

export function OrderContactsPicker({
  value,
  onChange,
  error = null,
  disabled = false,
}: OrderContactsPickerProps) {
  const { t } = useLocale()
  const { status } = useAuth()
  const headingId = useId()

  const [directory, setDirectory] = useState<ContactMethodModel[]>([])
  const [directoryState, setDirectoryState] = useState<DirectoryState>('idle')
  /** Профиль владельца аккаунта — только ради «Заполнить из профиля». `null` — запрос не удался
   * либо посетитель аноним; кнопки в форме тогда просто нет. */
  const [profile, setProfile] = useState<ContactProfile | null>(null)

  /** Форма ручного ввода развёрнута. Когда не выбрано ничего, она видна и без этого флага —
   * пустой блок с одной кнопкой «Добавить» заставлял бы делать лишнее нажатие на обязательном шаге. */
  const [adding, setAdding] = useState(false)
  /** Почему нажатие ничего не изменило. Сейчас повод ровно один — «такой контакт уже добавлен». */
  const [notice, setNotice] = useState<string | null>(null)

  const atLimit = value.length >= ContactLimits.maxOrderContacts

  /* Справочник и профиль — только для залогиненного: оба эндпоинта под токеном, и спрашивать их
     за анонима значило бы гарантированный 401 на каждой загрузке корзины. */
  useEffect(() => {
    if (status === 'idle' || status === 'loading') return
    if (status !== 'authenticated') {
      setDirectoryState('skipped')
      return
    }

    let cancelled = false
    setDirectoryState('loading')

    // Параллельно: запросы независимы, а последовательными они добавили бы второй round-trip
    // перед первой отрисовкой блока без всякой выгоды. Профиль имеет право не приехать — без него
    // теряется только кнопка «Заполнить из профиля», а не весь блок.
    void Promise.all([getContacts(), getContactProfile().catch(() => null)])
      .then(([list, me]) => {
        if (cancelled) return
        setDirectory(list)
        setProfile(me)
        setDirectoryState('ready')
      })
      .catch(() => {
        // Код ошибки здесь бесполезен: не загрузившийся справочник — это не загрузившийся
        // справочник, и доступное человеку действие одно и то же (ввести контакт руками).
        if (!cancelled) setDirectoryState('failed')
      })

    return () => {
      cancelled = true
    }
  }, [status])

  /**
   * Предзаполнение — РОВНО ОДИН раз за жизнь блока.
   *
   * Порядок намеренный: последний использованный набор важнее основного контакта профиля. Человек,
   * оформивший прошлую заявку на армянский номер, в следующий раз почти наверняка хочет тот же
   * номер, а не тот, что лежит в профиле с регистрации.
   *
   * Непустой `value` (черновик мастера трансфера, возврат со входа) предзаполнение не трогает —
   * иначе оно затёрло бы выбор, который человек уже сделал.
   */
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (prefilledRef.current) return
    if (value.length > 0) {
      prefilledRef.current = true
      return
    }
    // Ждём, пока станет известно, есть ли справочник вообще: подставить последний использованный
    // набор, а через полсекунды подменить его основным контактом профиля — значит на глазах
    // переписать поле, которое человек уже начал читать.
    if (directoryState === 'idle' || directoryState === 'loading') return

    prefilledRef.current = true

    const last = readLastOrderContacts()
    if (last.length > 0) {
      onChange(last)
      return
    }

    const primary = directory.find((contact) => contact.isPrimary) ?? directory[0]
    if (primary) onChange([toOrderContact(primary, true)])
  }, [directoryState, directory, value.length, onChange])

  /** Контакты справочника, которых в наборе ещё нет. Уже добавленный второй раз не предлагается —
   * позвонить дважды по одному номеру менеджеру не нужно. */
  const suggestions = directory.filter(
    (contact) => !value.some((chosen) => isSameContact(chosen, contact)),
  )

  const resolving = directoryState === 'idle' || directoryState === 'loading'
  /* Форма видна, пока не выбрано ничего: контакт обязателен, и первый шаг здесь — ввод, а не
     нажатие «Добавить». Достигнутый потолок её закрывает — добавлять больше некуда. */
  const formVisible = !resolving && !atLimit && (adding || value.length === 0)

  /**
   * Потолок здесь НЕ проверяется: на третьем контакте и форма, и список предложений исчезают
   * (`formVisible`/`suggestions` завязаны на `atLimit`), то есть добавить четвёртый физически
   * не через что. Проверка была бы веткой, в которую нельзя попасть.
   */
  function handleAdd(next: OrderContactInput) {
    if (value.some((chosen) => isSameContact(chosen, next))) {
      // Ручной ввод уже добавленного номера — единственный путь сюда: из предложений выбранные
      // контакты исчезают, а форму человек заполняет чем хочет.
      setNotice(t('orderContacts.duplicate'))
      return
    }
    setNotice(null)
    onChange(addOrderContact(value, next))
    setAdding(false)
  }

  function handleRemove(index: number) {
    setNotice(null)
    onChange(removeOrderContact(value, index))
  }

  function handleMakePrimary(index: number) {
    setNotice(null)
    onChange(setPrimaryOrderContact(value, index))
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl bg-panel p-4 ring-1 ring-edge sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="card-title text-ink">
          {t('orderContacts.title')}
        </h2>
        <span className="text-xs text-ink-muted tabular-nums">
          {t('orderContacts.count', { count: value.length, max: ContactLimits.maxOrderContacts })}
        </span>
      </div>
      <p className="mt-1.5 max-w-[64ch] text-[13px] leading-snug text-ink-muted sm:text-[13.5px]">
        {t('orderContacts.subtitle')}
      </p>

      {error !== null && (
        <div className="mt-3.5">
          <ContactAlert message={error} />
        </div>
      )}

      {value.length > 0 && (
        <ul className="mt-3.5 space-y-2">
          {value.map((contact, index) => (
            <OrderContactCard
              // Способ + значение уникальны в наборе (дубли не добавляются), поэтому индекс в
              // ключе не нужен: удаление среднего контакта не должно переиспользовать карточку.
              key={`${contact.type}:${contact.value}`}
              contact={contact}
              disabled={disabled}
              onMakePrimary={value.length > 1 ? () => handleMakePrimary(index) : null}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </ul>
      )}

      {/* Правило «кому позвонят первым» показывается только когда контактов больше одного:
          у единственного оно ничего не объясняет. */}
      {value.length > 1 && (
        <p className="mt-2.5 text-xs leading-snug text-ink-muted">{t('orderContacts.primaryNote')}</p>
      )}

      {notice !== null && (
        <p role="status" className="mt-2.5 text-[13px] leading-snug text-warning">
          {notice}
        </p>
      )}

      {resolving && (
        <p className="mt-3.5 text-[13px] text-ink-muted">{t('orderContacts.loading')}</p>
      )}

      {/* Сохранённые контакты — предложение, а не второй список: нажатие переносит контакт наверх,
          в набор заказа, и оттуда он уже удаляется как любой другой. */}
      {!resolving && !atLimit && suggestions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
            {t('orderContacts.savedTitle')}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-col gap-2 rounded-xl bg-panel-raised px-3.5 py-2.5 ring-1 ring-edge ring-inset sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-ink">{contactFullName(contact)}</span>
                  <span className="text-ink-muted"> · {t(CONTACT_METHOD_LABEL_KEY[contact.type])}</span>
                  <span className="block break-all text-ink-dim">{contact.value}</span>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleAdd(toOrderContact(contact, false))}
                  aria-label={t('orderContacts.pickAria', {
                    contact: `${contactFullName(contact)} · ${contact.value}`,
                  })}
                  className={publicButtonClass('ghost', 'sm', 'sm:shrink-0')}
                >
                  {t('orderContacts.pick')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Почему сохранённых контактов не видно. Три разные причины — три разных ответа: их нет,
          их не удалось загрузить, или посетитель ещё не вошёл. */}
      {!resolving && directoryState === 'failed' && (
        <p className="mt-3 text-[13px] leading-snug text-warning">{t('orderContacts.loadFailed')}</p>
      )}
      {!resolving && directoryState === 'skipped' && (
        <p className="mt-3 text-[13px] leading-snug text-ink-muted">{t('orderContacts.anonymous')}</p>
      )}
      {!resolving && directoryState === 'ready' && directory.length === 0 && (
        <p className="mt-3 text-[13px] leading-snug text-ink-muted">{t('orderContacts.directoryEmpty')}</p>
      )}

      {formVisible && (
        <div className="mt-4">
          <ContactForm
            /* Форма всегда монтируется заново: добавление первого контакта её закрывает
               (`formVisible` перестаёт выполняться), поэтому прошлый ввод в ней не остаётся. */
            contact={null}
            profile={profile}
            /* Справочник пуст — «Заполнить из профиля» здесь главное действие, и держать его за
               ещё одним нажатием незачем: подставить имя, фамилию и телефон аккаунта — ровно то,
               что человек и собирался набрать руками. */
            autoFillFromProfile={directory.length === 0 && profile !== null}
            /* Флагом «основной» распоряжаются карточки набора, а не форма: это выбор из трёх, и
               два места, где он делается, рано или поздно ответили бы по-разному. */
            hidePrimaryToggle
            isFirstContact={value.length === 0}
            submitting={disabled}
            /* Отказ сервера относится к НАБОРУ, а не к этой форме, и показан выше, под заголовком
               блока: у формы он читался бы как «неправильно заполнено вот это поле». */
            serverError={null}
            titleKey="orderContacts.formTitle"
            submitKey="orderContacts.formSubmit"
            onSubmit={(input) =>
              handleAdd({
                type: input.type,
                value: input.value,
                firstName: input.firstName,
                lastName: input.lastName,
                isPrimary: false,
              })
            }
            /* Пока не выбрано ни одного контакта, отменять нечего: контакт обязателен, и закрытая
               форма оставила бы обязательный шаг пустым. */
            onCancel={value.length === 0 ? undefined : () => setAdding(false)}
          />
        </div>
      )}

      {!resolving && !formVisible && !atLimit && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setNotice(null)
            setAdding(true)
          }}
          className={publicButtonClass('ghost', 'md', 'mt-3.5 w-full sm:w-auto')}
        >
          {t('orderContacts.addManual')}
        </button>
      )}

      {atLimit && (
        <p className="mt-3 text-[13px] leading-snug text-ink-muted">
          {t('orderContacts.limitReached', { max: ContactLimits.maxOrderContacts })}
        </p>
      )}
    </section>
  )
}
