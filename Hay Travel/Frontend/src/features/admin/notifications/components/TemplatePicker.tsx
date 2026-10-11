import { Link } from 'react-router'
import { Select } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { NotificationPlatform } from '@/features/admin/types/notifications'
import type { NotificationTemplateInfoModel } from '@/features/admin/types/notificationTemplates'
import { notificationsCopy } from '../lib/notificationsCopy'

interface TemplatePickerProps {
  platform: NotificationPlatform
  templateId: number | null
  /** Денормализованное имя с сервера — показывается, пока `templates` (список для этой
   * платформы) ещё не загружен доступным пользователю, или когда выбранный шаблон почему-то
   * выпал из отфильтрованного списка (сменили канал шаблона в другом окне). */
  templateName: string | null
  templates: NotificationTemplateInfoModel[]
  disabled: boolean
  /** Общая ошибка карточки («шаблон обязателен»), не привязана к конкретной платформе — родитель
   * решает, когда её показывать (после попытки сохранения). */
  error: string | null
  onChange: (templateId: number | null) => void
}

/**
 * Замена встроенного редактора Subject/Body (2026-08-31): вместо инлайн-текста — выбор готового
 * шаблона из библиотеки Notification Templates + ссылки «Открыть»/«Создать». Контент шаблона
 * редактируется на его собственной карточке, не здесь (Notification Templates — источник
 * правды по тексту, «Настройки уведомлений» только ссылаются на id).
 */
export function TemplatePicker({
  platform,
  templateId,
  templateName,
  templates,
  disabled,
  error,
  onChange,
}: TemplatePickerProps) {
  const copy = useCopy(notificationsCopy)

  const options = templates.map((template) => ({
    value: String(template.id),
    label: template.name,
  }))

  // Выбранный шаблон мог выпасть из списка (сменили канал на его собственной карточке) — тогда
  // подсовываем read-only опцию с последним известным именем, чтобы Select не показывал пустоту
  // молча вместо того, что реально сохранено.
  const hasSelectedInList = templateId !== null && options.some((option) => option.value === String(templateId))
  const selectOptions =
    templateId !== null && !hasSelectedInList
      ? [{ value: String(templateId), label: templateName ?? String(templateId) }, ...options]
      : options

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{copy.templatePickerLabel}</span>
          <Select
            surface="admin"
            className="w-64"
            value={templateId === null ? '' : String(templateId)}
            onChange={(value) => onChange(value === '' ? null : Number(value))}
            options={[{ value: '', label: copy.templatePickerPlaceholder }, ...selectOptions]}
            disabled={disabled}
            error={error !== null}
          />
        </label>

        {templateId !== null && (
          <Link
            to={`/admin/notification-templates/${templateId}`}
            className="pb-2 text-sm font-semibold text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            {copy.templatePickerOpenLink}
          </Link>
        )}
        <Link
          to={`/admin/notification-templates/new?channel=${platform}`}
          className="pb-2 text-sm font-semibold text-neutral-700 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          {copy.templatePickerCreateLink}
        </Link>
      </div>

      {options.length === 0 && (
        <p className="text-sm text-neutral-500">{copy.templatePickerEmpty}</p>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-neutral-900">
          {error}
        </p>
      )}
    </div>
  )
}
