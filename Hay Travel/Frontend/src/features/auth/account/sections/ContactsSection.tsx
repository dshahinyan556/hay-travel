import { useEffect, useState } from 'react'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import type { UserInfoModel } from '@/shared/auth'
import { ContactLimits, type ContactMethodModel } from '@/shared/types/contact'
import { AuthError, AuthSuccess } from '../../components/AuthShell'
import { getMe } from '../api/account'
import {
  createContact,
  deleteContact,
  getContacts,
  setPrimaryContact,
  updateContact,
  type ContactMethodInput,
} from '../api/contacts'
import { AccountSectionHead } from '../components/AccountSectionHead'
import { AccountStatePanel } from '../components/AccountStatePanel'
import { ContactCard } from '../components/ContactCard'
import { ContactDeleteDialog } from '../components/ContactDeleteDialog'
import { ContactForm } from '../components/ContactForm'
import { accountButtonClass } from '../lib/accountButton'
import { describeContact } from '../lib/contactDisplay'
import { contactErrorMessageKey } from '../lib/contactErrors'

/**
 * Раздел «Способы связи» — справочник контактов профиля (спека 016 / ADR 032).
 *
 * Справочник, а не «мой телефон»: у контакта есть собственное имя, способ и значение, потому что
 * заказ оформляет не всегда тот, с кем надо связаться. Фамилия при этом необязательна (решение
 * заказчика 2026-08-29): «Ашот, водитель» — законный контакт. Ровно один контакт помечен
 * основным — его менеджер видит первым, и им же предзаполняется форма заказа.
 *
 * ── Кто владеет данными ──────────────────────────────────────────────────────────────────────
 * Раздел, а не страница: он грузит список сам и сам держит его состояния (скелетон / пусто /
 * ошибка запроса). Падение `GET Account/Contacts` не роняет остальной кабинет.
 *
 * ── Почему после каждой правки список ПЕРЕЗАПРАШИВАЕТСЯ ───────────────────────────────────────
 * Локальная заплатка здесь была бы неправдой в трёх случаях сразу: создание с «основным» снимает
 * флаг у прежнего, удаление основного переносит метку на другую строку (это делает сервер,
 * `UserContactMethodDeletionService`), а порядок списка — тоже серверный (основной первым) и
 * фронт не имеет права его пересобирать. Один лишний GET дешевле, чем экран, показывающий двух
 * основных или ни одного.
 * Исключение — «Сделать основным»: `PATCH SetPrimary` уже возвращает справочник целиком, и второй
 * запрос за тем же самым был бы просто лишним.
 */
export function ContactsSection() {
  const { t } = useLocale()

  const [contacts, setContacts] = useState<ContactMethodModel[] | null>(null)
  /** Профиль нужен только кнопке «Заполнить из профиля». `null` — запрос не удался; раздел от
   * этого не ломается, кнопка просто не рисуется. */
  const [profile, setProfile] = useState<UserInfoModel | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  /** Увеличивается кнопкой «Повторить» — единственный способ перезапустить загрузку. */
  const [attempt, setAttempt] = useState(0)

  /** Открытая форма: `contact === null` — создание, иначе правка этой строки. */
  const [form, setForm] = useState<{ contact: ContactMethodModel | null; autoFill: boolean } | null>(
    null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  /** Любая операция над списком в полёте: действия строк блокируются, чтобы два запроса не
   * переписывали один и тот же список наперегонки. */
  const [listBusy, setListBusy] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Строка, к которой относится сообщение об успехе: список приходит в серверном порядке, и без
   * подсветки только что сохранённый контакт пришлось бы искать глазами. */
  const [highlightId, setHighlightId] = useState<number | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ContactMethodModel | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)

    // Параллельно: запросы независимы, а последовательными они поставили бы второй round-trip
    // перед первой отрисовкой раздела без всякой выгоды.
    void Promise.all([getContacts(), getMe().catch(() => null)])
      .then(([list, me]) => {
        if (cancelled) return
        setContacts(list)
        setProfile(me)
      })
      .catch(() => {
        // Код ошибки здесь бесполезен: не загрузившийся список — это не загрузившийся список, и
        // единственное доступное человеку действие одно и то же.
        if (!cancelled) setLoadFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  /** Подтверждение живёт там, где было действие, и уходит само: оставшись насовсем, оно к
   * третьему сохранению перестаёт читаться как ответ на последнее. */
  useEffect(() => {
    if (notice === null) return
    const timer = window.setTimeout(() => {
      setNotice(null)
      // Подсветка строки — часть того же подтверждения и гаснет вместе с ним.
      setHighlightId(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const atLimit = (contacts?.length ?? 0) >= ContactLimits.maxProfileContacts
  const isCreating = form !== null && form.contact === null

  function openCreate(autoFill: boolean) {
    setFormError(null)
    setListError(null)
    setForm({ contact: null, autoFill })
  }

  function openEdit(contact: ContactMethodModel) {
    setFormError(null)
    setListError(null)
    setForm({ contact, autoFill: false })
  }

  async function handleSubmit(input: ContactMethodInput) {
    if (form === null || submitting) return
    const editing = form.contact
    setSubmitting(true)
    setFormError(null)

    try {
      const saved = editing
        ? await updateContact(editing.id, input)
        : await createContact(input)
      setContacts(await getContacts())
      setForm(null)
      setHighlightId(saved.id)
      setNotice(t('account.contacts.saved', { contact: describeContact(saved, t) }))
    } catch (err) {
      setFormError(
        t(contactErrorMessageKey(err), { max: ContactLimits.maxProfileContacts }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMakePrimary(contact: ContactMethodModel) {
    if (listBusy) return
    setListBusy(true)
    setListError(null)
    try {
      setContacts(await setPrimaryContact(contact.id))
      setNotice(t('account.contacts.primaryChanged', { contact: describeContact(contact, t) }))
    } catch (err) {
      setListError(t(contactErrorMessageKey(err), { max: ContactLimits.maxProfileContacts }))
    } finally {
      setListBusy(false)
    }
  }

  async function handleDelete() {
    if (deleteTarget === null || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteContact(deleteTarget.id)
      setContacts(await getContacts())
      // Правимая строка могла быть только что удалена — форму по ней держать не на чем.
      setForm((current) => (current?.contact?.id === deleteTarget.id ? null : current))
      setNotice(t('account.contacts.removed', { contact: describeContact(deleteTarget, t) }))
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(t(contactErrorMessageKey(err), { max: ContactLimits.maxProfileContacts }))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <AccountSectionHead
        title={t('account.sectionContacts')}
        action={
          contacts !== null && contacts.length > 0 ? (
            <button
              type="button"
              onClick={() => openCreate(false)}
              disabled={isCreating || atLimit}
              className={accountButtonClass('gold')}
            >
              {t('account.contacts.add')}
            </button>
          ) : undefined
        }
      />

      {notice && <AuthSuccess message={notice} />}
      {listError && <AuthError message={listError} />}

      {form !== null && form.contact === null && (
        <ContactForm
          contact={null}
          profile={profile}
          autoFillFromProfile={form.autoFill}
          isFirstContact={(contacts?.length ?? 0) === 0}
          submitting={submitting}
          serverError={formError}
          onSubmit={(input) => void handleSubmit(input)}
          onCancel={() => setForm(null)}
        />
      )}

      {isLoading ? (
        <ContactsSkeleton />
      ) : loadFailed || contacts === null ? (
        <AccountStatePanel
          tone="danger"
          title={t('account.contacts.loadFailedTitle')}
          body={t('account.contacts.loadFailedBody')}
        >
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className={accountButtonClass('ghost')}
          >
            {t('account.contacts.retry')}
          </button>
        </AccountStatePanel>
      ) : contacts.length === 0 ? (
        // Пока открыта форма первого контакта, пустое состояние прячется: оно предлагает ровно
        // то, что уже происходит на экране.
        !isCreating && (
          <AccountStatePanel
            title={t('account.contacts.emptyTitle')}
            body={t('account.contacts.emptyBody')}
          >
            {/* Главное действие пустого состояния — «Заполнить из профиля»: у нового клиента уже
                есть имя, почта и телефон, и первый контакт создаётся одним нажатием. Без профиля
                (запрос не удался) остаётся только ручной ввод. */}
            {profile && (
              <button
                type="button"
                onClick={() => openCreate(true)}
                className={accountButtonClass('gold')}
              >
                {t('account.contacts.fillFromProfile')}
              </button>
            )}
            <button
              type="button"
              onClick={() => openCreate(false)}
              className={accountButtonClass(profile ? 'ghost' : 'gold')}
            >
              {t('account.contacts.emptyManual')}
            </button>
          </AccountStatePanel>
        )
      ) : (
        <>
          <ul
            aria-label={t('account.contacts.listLabel')}
            aria-busy={listBusy || undefined}
            className="flex flex-col divide-y divide-edge rounded-2xl bg-panel ring-1 ring-edge ring-inset"
          >
            {contacts.map((contact) =>
              form?.contact?.id === contact.id ? (
                // Правка разворачивается НА МЕСТЕ строки: так видно, какой именно контакт
                // редактируется, без подписи «вы правите вот этот».
                <li key={contact.id} className="p-2">
                  <ContactForm
                    contact={contact}
                    profile={profile}
                    isFirstContact={contacts.length === 1}
                    submitting={submitting}
                    serverError={formError}
                    onSubmit={(input) => void handleSubmit(input)}
                    onCancel={() => setForm(null)}
                  />
                </li>
              ) : (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  busy={listBusy}
                  highlighted={highlightId === contact.id}
                  onMakePrimary={() => void handleMakePrimary(contact)}
                  onEdit={() => openEdit(contact)}
                  onDelete={() => {
                    setDeleteError(null)
                    setDeleteTarget(contact)
                  }}
                />
              ),
            )}
          </ul>

          {atLimit && (
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {t('account.contacts.limitNote', { max: ContactLimits.maxProfileContacts })}
            </p>
          )}
        </>
      )}

      {deleteTarget && (
        <ContactDeleteDialog
          contactLabel={describeContact(deleteTarget, t)}
          deleting={deleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  )
}

/**
 * Скелетон повторяет геометрию карточки контакта — две строки текста в той же рамке, — поэтому
 * список не «прыгает», когда данные приходят. Мерцание — общий `.skeleton-shimmer`, который сам
 * выключается при `prefers-reduced-motion`.
 *
 * Три строки: столько же, сколько у типичного справочника, и достаточно, чтобы блок занял место
 * будущего списка, а не мигнул одной полоской.
 */
function ContactsSkeleton() {
  const { t } = useLocale()

  return (
    <div
      role="status"
      aria-label={t('account.sectionContacts')}
      className="flex flex-col divide-y divide-edge rounded-2xl bg-panel ring-1 ring-edge ring-inset"
    >
      {[170, 140, 190].map((width) => (
        <div key={width} className="px-4 py-3.5">
          <div
            className="skeleton-shimmer h-[15px] max-w-full rounded-lg bg-panel-raised"
            style={{ width }}
          />
          <div
            className="skeleton-shimmer mt-2 h-[13px] max-w-full rounded-lg bg-panel-raised"
            style={{ width: width + 40 }}
          />
        </div>
      ))}
    </div>
  )
}
