/**
 * Состояние карточки одного шаблона: черновик, dirty, локальная валидация и сохранение.
 * Построено по образцу `useNotificationEventForm`/`useRoleForm` — `useState` + baseline,
 * заменяемый ОТВЕТОМ СЕРВЕРА после успешного PUT/POST (санитизированный HTML/CSS).
 */

import { useEffect, useRef, useState } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import {
  createNotificationTemplate,
  updateNotificationTemplate,
} from '@/features/admin/api/adminNotificationTemplates'
import {
  NotificationPlatform,
  NotificationTemplateEntity,
  NotificationTemplateTrigger,
  type NotificationTemplateInfoModel,
  type NotificationTemplateUpdateModel,
} from '@/features/admin/types/notificationTemplates'
import { notificationTemplatesCopy, notificationTemplatesErrorMessage } from '../lib/notificationTemplatesCopy'

export interface TemplateDraft {
  name: string
  description: string
  channel: NotificationPlatform
  boundEntity: NotificationTemplateEntity
  trigger: NotificationTemplateTrigger
  isActive: boolean
  subject: string
  subjectEn: string
  bodyHtml: string
  bodyHtmlEn: string
  customCss: string
}

function toDraft(template: NotificationTemplateInfoModel | null, initialChannel: NotificationPlatform): TemplateDraft {
  if (template === null) {
    return {
      name: '',
      description: '',
      channel: initialChannel,
      boundEntity: NotificationTemplateEntity.None,
      trigger: NotificationTemplateTrigger.None,
      isActive: true,
      subject: '',
      subjectEn: '',
      bodyHtml: '',
      bodyHtmlEn: '',
      customCss: '',
    }
  }
  return {
    name: template.name,
    description: template.description ?? '',
    channel: template.channel,
    boundEntity: template.boundEntity,
    trigger: template.trigger,
    isActive: template.isActive,
    subject: template.subject ?? '',
    subjectEn: template.subjectEn ?? '',
    bodyHtml: template.bodyHtml ?? '',
    bodyHtmlEn: template.bodyHtmlEn ?? '',
    customCss: template.customCss ?? '',
  }
}

function isDraftEqual(a: TemplateDraft, b: TemplateDraft): boolean {
  return (Object.keys(a) as (keyof TemplateDraft)[]).every((key) => a[key] === b[key])
}

function toUpdateModel(draft: TemplateDraft): NotificationTemplateUpdateModel {
  const isEmail = draft.channel === NotificationPlatform.Email
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    channel: draft.channel,
    boundEntity: draft.boundEntity,
    trigger: draft.trigger,
    isActive: draft.isActive,
    subject: isEmail ? draft.subject.trim() : null,
    subjectEn: isEmail ? draft.subjectEn.trim() || null : null,
    bodyHtml: draft.bodyHtml,
    bodyHtmlEn: draft.bodyHtmlEn.trim() || null,
    customCss: isEmail ? draft.customCss.trim() || null : null,
  }
}

export interface UseNotificationTemplateFormArgs {
  template: NotificationTemplateInfoModel | null
  /** Канал предзаполнения при создании — из `?channel=` (пришли с карточки события). */
  initialChannel: NotificationPlatform
}

export function useNotificationTemplateForm({ template, initialChannel }: UseNotificationTemplateFormArgs) {
  const copy = useCopy(notificationTemplatesCopy)
  const isNew = template === null

  const [draft, setDraft] = useState<TemplateDraft>(() => toDraft(template, initialChannel))
  const [baseline, setBaseline] = useState<TemplateDraft>(() => toDraft(template, initialChannel))
  const [savedTemplate, setSavedTemplate] = useState<NotificationTemplateInfoModel | null>(template)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const isDirty = !isDraftEqual(draft, baseline)

  // `RichTextEditor` parses the loaded HTML into a TipTap document on mount and reports it back
  // through `onChange` — the reported string can differ byte-for-byte from what the server sent
  // (e.g. attribute-order/whitespace normalization by the underlying HTML parser) even though
  // nothing about the CONTENT changed. Without this guard, opening an existing template with a
  // body ends up "dirty" before the admin has touched anything. `settlingRef` treats every patch
  // that arrives before the editor has had its first paint as re-normalization noise, not a user
  // edit, and folds it into `baseline` too so it does not count as a change.
  const settlingRef = useRef(true)
  useEffect(() => {
    const id = setTimeout(() => {
      settlingRef.current = false
    }, 0)
    return () => clearTimeout(id)
  }, [])

  function patch(partial: Partial<TemplateDraft>) {
    if (settlingRef.current) {
      setDraft((prev) => ({ ...prev, ...partial }))
      setBaseline((prev) => ({ ...prev, ...partial }))
      return
    }
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function reset() {
    setDraft(baseline)
    setError(null)
    setSavedAt(null)
  }

  const canSubmit = isDirty && !isSubmitting && draft.name.trim() !== ''

  function submit(onCreated?: (id: number) => void) {
    if (isSubmitting || !canSubmit) return
    setSavedAt(null)
    setSubmitting(true)
    setError(null)

    void (async () => {
      try {
        const model = toUpdateModel(draft)
        const saved = isNew
          ? await createNotificationTemplate(model)
          : await updateNotificationTemplate(template!.id, model)

        const savedDraft = toDraft(saved, initialChannel)
        setDraft(savedDraft)
        setBaseline(savedDraft)
        setSavedTemplate(saved)
        setSavedAt(Date.now())

        if (isNew) onCreated?.(saved.id)
      } catch (err) {
        const name = draft.name.trim() || copy.newTemplateTitle
        setError(notificationTemplatesErrorMessage(copy, err, copy.errorActions.saveTemplate(name)))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return {
    draft,
    patch,
    reset,
    isDirty,
    canSubmit,
    submit,
    isSubmitting,
    error,
    savedAt: isDirty ? null : savedAt,
    /** Usages/id самого свежего сохранённого состояния — нужно карточке для блока «Используется
     * в» и для генерации ссылок сразу после создания, без перезагрузки лоадера. */
    savedTemplate,
  }
}
