/**
 * Состояние карточки одного события: черновик, dirty, локальная валидация и сохранение.
 *
 * Стор не заводим — данные читает ровно один экран, ничего межфичевого. Форма построена
 * дословно по `useRoleForm`: локальный `useState` + BASELINE, который после успешного PUT
 * заменяется ОТВЕТОМ СЕРВЕРА (санитизированный HTML + проставленные `id` у новых строк), поэтому
 * «грязно» всегда означает «отличается от того, что лежит в БД», и ревалидация лоадера не нужна.
 *
 * `useReducer` не берём по тому же доводу, что записан в `useRoleForm`: операции однородные
 * (патч поля / добавить строку / удалить строку) и не оправдывают action-union.
 */

import { useCallback, useMemo, useState } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import { updateNotificationEvent } from '@/features/admin/api/adminNotifications'
import type {
  NotificationEventInfoModel,
  NotificationPlatform,
} from '@/features/admin/types/notifications'
import {
  isEventDraftEqual,
  newRecipientRow,
  toDraft,
  toUpdateModel,
  validateDraft,
  type EventDraft,
  type PlatformDraft,
  type RecipientDraft,
} from '../lib/notificationEventModel'
import { notificationsCopy, notificationsErrorMessage } from '../lib/notificationsCopy'

export interface UseNotificationEventFormArgs {
  event: NotificationEventInfoModel
  /** Подпись события для текста ошибки («не удалось сохранить событие …»). */
  eventLabel: string
}

export interface UseNotificationEventFormResult {
  draft: EventDraft
  /** Рубильник платформы (вкладка «Платформы»). */
  setPlatformEnabled: (platform: NotificationPlatform, isEnabled: boolean) => void
  /** Выбор шаблона из библиотеки Notification Templates для этой платформы. */
  setTemplateId: (platform: NotificationPlatform, templateId: number | null) => void
  addRecipient: (platform: NotificationPlatform) => void
  removeRecipient: (platform: NotificationPlatform, rowKey: string) => void
  patchRecipient: (
    platform: NotificationPlatform,
    rowKey: string,
    patch: Partial<RecipientDraft>,
  ) => void
  /** Вернуть черновик к последнему сохранённому состоянию. */
  reset: () => void
  isDirty: boolean
  /** Пер-строчные ошибки грида, ключ — `rowKey`. Показываются только после первой попытки
   * сохранения: валидировать по мере ввода — нытьё (то же правило, что у `nameError`
   * в `useRoleForm`). */
  rowErrors: Record<string, string>
  /** Ошибка шаблона Email, по тому же правилу «только после попытки». */
  templateError: string | null
  canSubmit: boolean
  submit: () => void
  isSubmitting: boolean
  error: string | null
  /** Момент последнего успешного сохранения — или `null`, если его не было либо поверх него уже
   * лежит несохранённая правка (плашка «Сохранено» не должна врать про текущий экран). */
  savedAt: number | null
}

export function useNotificationEventForm({
  event,
  eventLabel,
}: UseNotificationEventFormArgs): UseNotificationEventFormResult {
  const copy = useCopy(notificationsCopy)

  const [draft, setDraft] = useState<EventDraft>(() => toDraft(event))
  const [baseline, setBaseline] = useState<EventDraft>(() => toDraft(event))
  const [attempted, setAttempted] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const isDirty = !isEventDraftEqual(draft, baseline)

  // Валидация — чистая функция от черновика, но она обходит все строки всех платформ, а
  // `RecipientsGrid` перерисовывается на каждое нажатие клавиши: мемоизация здесь не
  // преждевременная, а способ не гонять этот обход впустую.
  const validation = useMemo(() => validateDraft(draft, copy), [draft, copy])

  /**
   * Общая точка правки одной платформы черновика: единственное место, где живёт поиск по
   * `platform`, чтобы четыре сеттера ниже не повторяли его каждый по-своему.
   *
   * Патч, ничего не меняющий, возвращает ПРЕЖНИЙ черновик. Это не микрооптимизация: после
   * сохранения в `RichTextEditor` приезжает санитизированный сервером HTML, редактор
   * перевыставляет документ и отвечает `onChange` с тем же значением — без этой проверки такой
   * эхо-патч считался бы правкой пользователя.
   */
  const patchPlatform = useCallback(
    (platform: NotificationPlatform, patch: (current: PlatformDraft) => PlatformDraft) => {
      setDraft((prev) => {
        const next = {
          ...prev,
          platforms: prev.platforms.map((candidate) =>
            candidate.platform === platform ? patch(candidate) : candidate,
          ),
        }
        return isEventDraftEqual(next, prev) ? prev : next
      })
    },
    [],
  )

  const setPlatformEnabled = useCallback(
    (platform: NotificationPlatform, isEnabled: boolean) => {
      patchPlatform(platform, (current) => ({ ...current, isEnabled }))
    },
    [patchPlatform],
  )

  const setTemplateId = useCallback(
    (platform: NotificationPlatform, templateId: number | null) => {
      patchPlatform(platform, (current) => ({ ...current, templateId }))
    },
    [patchPlatform],
  )

  const addRecipient = useCallback(
    (platform: NotificationPlatform) => {
      patchPlatform(platform, (current) => ({
        ...current,
        recipients: [...current.recipients, newRecipientRow(platform)],
      }))
    },
    [patchPlatform],
  )

  const removeRecipient = useCallback(
    (platform: NotificationPlatform, rowKey: string) => {
      patchPlatform(platform, (current) => ({
        ...current,
        recipients: current.recipients.filter((row) => row.rowKey !== rowKey),
      }))
    },
    [patchPlatform],
  )

  const patchRecipient = useCallback(
    (platform: NotificationPlatform, rowKey: string, patch: Partial<RecipientDraft>) => {
      patchPlatform(platform, (current) => ({
        ...current,
        recipients: current.recipients.map((row) =>
          row.rowKey === rowKey ? { ...row, ...patch } : row,
        ),
      }))
    },
    [patchPlatform],
  )

  const reset = useCallback(() => {
    setDraft(baseline)
    setAttempted(false)
    setError(null)
    setSavedAt(null)
  }, [baseline])

  function submit(): void {
    if (isSubmitting || !isDirty) return
    setAttempted(true)
    setSavedAt(null)

    const { rowErrors, templateError } = validateDraft(draft, copy)
    if (templateError !== null) {
      setError(templateError)
      return
    }
    if (Object.keys(rowErrors).length > 0) {
      setError(copy.errorFixRowsBeforeSave)
      return
    }

    setSubmitting(true)
    setError(null)
    void (async () => {
      try {
        const saved = await updateNotificationEvent(toUpdateModel(draft))
        // Ответ — новый baseline И новый черновик: он несёт очищенный сервером HTML и `id`
        // только что созданных строк, без которых следующее сохранение приняло бы правку за
        // вставку. Ревалидация лоадера при этом не нужна.
        const savedDraft = toDraft(saved)
        setDraft(savedDraft)
        setBaseline(savedDraft)
        setAttempted(false)
        setSavedAt(Date.now())
      } catch (err) {
        setError(notificationsErrorMessage(copy, err, copy.errorActions.saveEvent(eventLabel)))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return {
    draft,
    setPlatformEnabled,
    setTemplateId,
    addRecipient,
    removeRecipient,
    patchRecipient,
    reset,
    isDirty,
    rowErrors: attempted ? validation.rowErrors : {},
    templateError: attempted ? validation.templateError : null,
    canSubmit: isDirty && !isSubmitting,
    submit,
    isSubmitting,
    error,
    // Появившаяся правка гасит плашку сама — отдельного `setSavedAt(null)` в каждом сеттере для
    // этого не нужно (и он бы срабатывал на эхо-патч редактора, см. `patchPlatform`).
    savedAt: isDirty ? null : savedAt,
  }
}
