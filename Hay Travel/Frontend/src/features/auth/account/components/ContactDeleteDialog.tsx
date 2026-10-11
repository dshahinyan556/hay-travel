import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock, useFocusTrap } from '@/shared/hooks'
import { useLocale } from '@/shared/i18n/LocaleProvider'
import { AuthError } from '../../components/AuthShell'
import { accountButtonClass } from '../lib/accountButton'

/**
 * Подтверждение удаления контакта — единственное модальное окно раздела.
 *
 * Спрашиваем, потому что удаление необратимо и «отмены» у него нет; называем контакт словами, а
 * не «этот элемент», — за окном список, сверяться с которым человек не должен.
 *
 * Почему не `shared/ui/Modal`: он на админской палитре (`bg-white`, заголовок `text-neutral-900`)
 * и на обсидиане был бы белым листом посреди тёмного кабинета. Взято от него всё, кроме краски:
 * портал в `document.body` (окно не должно зависеть от `overflow`/`transform` родителей),
 * Escape, клик по подложке, блокировка прокрутки фона и ловушка фокуса — последние две через
 * общие `useBodyScrollLock`/`useFocusTrap`, которыми пользуются и `Sheet`, и админская панель.
 *
 * Фокус при открытии уходит на контейнер (`tabIndex={-1}`), а не на «Удалить»: подтверждающая
 * кнопка под курсором Enter — способ удалить контакт, не прочитав вопроса.
 */
export interface ContactDeleteDialogProps {
  /** Человекочитаемое имя контакта: «Давид Саргсян · Telegram · @dsargsyan». */
  contactLabel: string
  deleting: boolean
  /** Отказ сервера на удалении. Окно остаётся открытым — иначе сообщение некуда показать. */
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ContactDeleteDialog({
  contactLabel,
  deleting,
  error,
  onConfirm,
  onCancel,
}: ContactDeleteDialogProps) {
  const { t } = useLocale()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(true)
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Пока запрос в полёте, закрывать нечего: строка уже, возможно, удалена, и окно обязано
      // дождаться ответа, чтобы показать отказ.
      if (event.key === 'Escape' && !deleting) {
        event.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [deleting, onCancel])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-obsidian/70 p-5 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !deleting) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-[420px] rounded-2xl bg-panel p-5 shadow-[var(--shadow-lg)] ring-1 ring-edge-strong outline-none ring-inset"
      >
        <h2 id={titleId} className="text-[17px] font-semibold text-ink">
          {t('account.contacts.deleteTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {t('account.contacts.deleteBody', { contact: contactLabel })}
        </p>

        {error && (
          <div className="mt-4">
            <AuthError message={error} />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className={accountButtonClass('danger')}
          >
            {deleting ? t('account.contacts.deleting') : t('account.contacts.deleteConfirm')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className={accountButtonClass('quiet')}
          >
            {t('account.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
