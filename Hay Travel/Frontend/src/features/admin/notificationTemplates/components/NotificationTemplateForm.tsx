import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  AdminActionButton,
  Checkbox,
  Input,
  Select,
  Textarea,
  UnsavedChangesModal,
} from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { useUnsavedChangesGuard } from '@/shared/hooks'
import { useCopy } from '@/shared/i18n/defineCopy'
import { AdminScreen, useScreenPermission } from '@/shared/auth'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import { RichTextEditor, RICH_TEXT_TOOLSETS } from '@/features/admin/ui/RichTextEditor'
import {
  NotificationPlatform,
  NotificationTemplateEntity,
  NotificationTemplateTrigger,
  type NotificationTemplateInfoModel,
} from '@/features/admin/types/notificationTemplates'
import { useNotificationTemplateForm } from '../hooks/useNotificationTemplateForm'
import { placeholderItems } from '../lib/placeholderLabels'
import { notificationTemplatesCopy } from '../lib/notificationTemplatesCopy'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'
import { TemplateUsagesList } from './TemplateUsagesList'

export interface NotificationTemplateFormProps {
  template: NotificationTemplateInfoModel | null
  initialChannel: NotificationPlatform
}

const ENTITY_OPTIONS = [
  NotificationTemplateEntity.None,
  NotificationTemplateEntity.Order,
  NotificationTemplateEntity.User,
  NotificationTemplateEntity.Tour,
  NotificationTemplateEntity.Employee,
]

const TRIGGER_OPTIONS = [
  NotificationTemplateTrigger.None,
  NotificationTemplateTrigger.VerifyEmail,
  NotificationTemplateTrigger.ResetPassword,
  NotificationTemplateTrigger.EmailChangeCode,
  NotificationTemplateTrigger.EmailChangeConfirm,
]

export function NotificationTemplateForm({ template, initialChannel }: NotificationTemplateFormProps) {
  const copy = useCopy(notificationTemplatesCopy)
  const enums = useCopy(adminEnumsCopy)
  const navigate = useNavigate()
  const permission = useScreenPermission(AdminScreen.NotificationTemplates)

  const form = useNotificationTemplateForm({ template, initialChannel })
  const guard = useUnsavedChangesGuard(form.isDirty && !form.isSubmitting)

  // Один переключатель на Subject И Body сразу — не два одновременно видимых блока RU/EN
  // (решение 2026-08-31, отказ от `TranslationGroup`'s side-by-side матрицы для этого экрана).
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [previewOpen, setPreviewOpen] = useState(false)

  const isEmail = form.draft.channel === NotificationPlatform.Email
  const isNew = template === null
  const canEdit = isNew ? true : permission.canUpdate
  const disabled = !canEdit || form.isSubmitting

  const toolset = isEmail ? RICH_TEXT_TOOLSETS.full : RICH_TEXT_TOOLSETS.telegramLimited
  const placeholders = useMemo(
    () => placeholderItems(template?.availablePlaceholders ?? []),
    [template?.availablePlaceholders],
  )

  const bodyValue = lang === 'ru' ? form.draft.bodyHtml : form.draft.bodyHtmlEn

  return (
    <div className="flex flex-col gap-6">
      {!canEdit && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          {copy.readOnlyHint}
        </p>
      )}
      {form.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span aria-hidden="true">⚠️</span>
          <span>{form.error}</span>
        </div>
      )}
      {form.savedAt !== null && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900">
          <span aria-hidden="true">✓</span>
          <span>{copy.saved}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.nameLabel}</span>
          <Input
            value={form.draft.name}
            onChange={(e) => form.patch({ name: e.target.value })}
            placeholder={copy.namePlaceholder}
            disabled={disabled}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.channelLabel}</span>
          <Select
            surface="admin"
            value={String(form.draft.channel)}
            onChange={(value) => form.patch({ channel: Number(value) as NotificationPlatform })}
            options={[
              { value: String(NotificationPlatform.Email), label: enums.notificationPlatform[NotificationPlatform.Email] },
              { value: String(NotificationPlatform.Telegram), label: enums.notificationPlatform[NotificationPlatform.Telegram] },
            ]}
            disabled={disabled}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium text-neutral-700">{copy.descriptionLabel}</span>
          <Textarea
            value={form.draft.description}
            onChange={(e) => form.patch({ description: e.target.value })}
            placeholder={copy.descriptionPlaceholder}
            disabled={disabled}
            className="min-h-[52px]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.boundEntityLabel}</span>
          <Select
            surface="admin"
            value={String(form.draft.boundEntity)}
            onChange={(value) => form.patch({ boundEntity: Number(value) as NotificationTemplateEntity })}
            options={ENTITY_OPTIONS.map((entity) => ({
              value: String(entity),
              label: enums.notificationTemplateEntity[entity],
            }))}
            disabled={disabled}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-neutral-700">
            {copy.triggerLabel}
            <HelpButton surface="admin" title={copy.triggerLabel}>
              {copy.triggerHint}
            </HelpButton>
          </span>
          <Select
            surface="admin"
            value={String(form.draft.trigger)}
            onChange={(value) => form.patch({ trigger: Number(value) as NotificationTemplateTrigger })}
            options={TRIGGER_OPTIONS.map((trigger) => ({
              value: String(trigger),
              label: enums.notificationTemplateTrigger[trigger],
            }))}
            disabled={disabled}
          />
        </label>

        <Checkbox
          checked={form.draft.isActive}
          onChange={(e) => form.patch({ isActive: e.target.checked })}
          label={copy.activeLabel}
          disabled={disabled}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLang('ru')}
          disabled={disabled}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            lang === 'ru' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          RU
        </button>
        <button
          type="button"
          onClick={() => setLang('en')}
          disabled={disabled}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            lang === 'en' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          EN
        </button>
        <HelpButton surface="admin" title={copy.subjectLabel}>
          {copy.langFallbackHint}
        </HelpButton>
      </div>

      {isEmail && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.subjectLabel}</span>
          <Input
            value={lang === 'ru' ? form.draft.subject : form.draft.subjectEn}
            onChange={(e) =>
              form.patch(lang === 'ru' ? { subject: e.target.value } : { subjectEn: e.target.value })
            }
            disabled={disabled}
          />
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">{copy.bodyLabel}</span>
        <RichTextEditor
          key={lang}
          value={bodyValue}
          onChange={(html) => form.patch(lang === 'ru' ? { bodyHtml: html } : { bodyHtmlEn: html })}
          toolset={toolset}
          placeholders={placeholders}
          disabled={disabled}
          minHeight="lg"
          aria-label={`${copy.bodyLabel} (${lang.toUpperCase()})`}
        />
      </div>

      {isEmail && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-neutral-700">
            {copy.customCssLabel}
            <HelpButton surface="admin" title={copy.customCssLabel}>
              {copy.customCssHint}
            </HelpButton>
          </span>
          <Textarea
            value={form.draft.customCss}
            onChange={(e) => form.patch({ customCss: e.target.value })}
            disabled={disabled}
            spellCheck={false}
            className="min-h-[96px] font-mono text-xs"
          />
        </label>
      )}

      <div>
        <AdminActionButton
          label={copy.previewButton}
          variant="secondary"
          onClick={() => setPreviewOpen(true)}
        />
      </div>

      <TemplateUsagesList usages={template?.usages ?? []} />

      <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
        {form.isDirty && <span className="text-xs text-neutral-500">{copy.dirtyHint}</span>}
        <div className="ml-auto flex items-center gap-3">
          <AdminActionButton
            label={copy.cancelEdits}
            variant="secondary"
            disabled={!form.isDirty || form.isSubmitting}
            onClick={form.reset}
          />
          <AdminActionButton
            label={copy.save}
            pendingLabel={copy.saving}
            variant="primary"
            pending={form.isSubmitting}
            disabled={!form.canSubmit || !canEdit}
            onClick={() =>
              form.submit((id) => navigate(`/admin/notification-templates/${id}`, { replace: true }))
            }
          />
        </div>
      </div>

      <TemplatePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        subject={isEmail ? (lang === 'ru' ? form.draft.subject : form.draft.subjectEn) : null}
        bodyHtml={bodyValue}
        customCss={isEmail ? form.draft.customCss : ''}
      />

      <UnsavedChangesModal open={guard.isBlocking} onCancel={guard.cancel} onConfirm={guard.confirm} />
    </div>
  )
}
