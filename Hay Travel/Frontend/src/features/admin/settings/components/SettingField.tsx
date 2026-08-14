import { useId } from 'react'
import { Field, Input, Select, Textarea } from '@/shared/ui'
import type { SelectOption } from '@/shared/ui'
import { SettingValueType } from '@/features/admin/lib/enums'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import { ImageUrlField } from '@/features/admin/ui/ImageUrlField'
import type { LangKey } from '@/features/admin/types/localized'
import type { SettingFieldState } from '@/features/admin/settings/types'
import type { LocalizedErrors } from '@/features/admin/settings/lib/validation'

interface SettingFieldProps {
  field: SettingFieldState
  label: string
  hint?: string
  /** Blocking per-language errors. Only translatable settings can have them. */
  errors?: LocalizedErrors
  /** Non-blocking, always-visible note about a suspicious value — separate from `hint` (which now
   * hides behind a `HelpButton`) precisely because a warning must stay in view, not require a
   * click to discover. */
  warning?: string
  onChangeValue: (value: string) => void
  onChangeTranslation: (lang: LangKey, value: string) => void
}

/**
 * The single place where a setting's shape decides its control: translatable settings render as
 * the bilingual RU|EN matrix, the rest branch on `valueType`.
 */
export function SettingField({
  field,
  label,
  hint,
  errors,
  warning,
  onChangeValue,
  onChangeTranslation,
}: SettingFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {field.isTranslatable ? (
        <TranslationGroup
          label={label}
          required
          multiline={field.valueType === SettingValueType.MultilineText}
          value={field.translations}
          error={errors?.ru}
          errorEn={errors?.en}
          hint={hint}
          onChange={onChangeTranslation}
        />
      ) : (
        <PlainSettingField
          field={field}
          label={label}
          hint={hint}
          warning={warning}
          onChange={onChangeValue}
        />
      )}
    </div>
  )
}



interface PlainSettingFieldProps {
  field: SettingFieldState
  label: string
  hint?: string
  warning?: string
  onChange: (value: string) => void
}

/** Language-neutral settings: text, multiline text, a link, an image URL with a preview, or one
 * value picked from a server-supplied catalog (`Select`). */
function PlainSettingField({ field, label, hint, warning, onChange }: PlainSettingFieldProps) {
  const id = useId()
  const value = field.value

  if (field.valueType === SettingValueType.ImageUrl) {
    return <ImageUrlField label={label} value={value} hint={hint} warning={warning} onChange={onChange} />
  }

  if (field.valueType === SettingValueType.MultilineText) {
    return (
      <Field label={label} htmlFor={id} hint={hint} warning={warning}>
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    )
  }

  if (field.valueType === SettingValueType.Url) {
    return (
      <Field label={label} htmlFor={id} hint={hint} warning={warning}>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {/* Quick way to check a social link without retyping it into the address bar. */}
          {value.trim() !== '' && (
            <a
              href={value.trim()}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            >
              Открыть ↗
            </a>
          )}
        </div>
      </Field>
    )
  }

  /**
   * `field.options.length > 0` is not a formality: a backend that ships `valueType: 5` before its
   * option catalog would otherwise render an empty, uneditable dropdown. Falling through to the
   * text `Input` below at least lets the admin see and edit the stored value — the same "render
   * the unknown, don't hide it" principle `toValueType` and `labelFor` already follow.
   */
  if (field.valueType === SettingValueType.Select && field.options.length > 0) {
    // Значение, которого больше нет в каталоге (пресет удалили), показываем отдельной
    // disabled-опцией: иначе <select> молча отрисовал бы первую опцию, и админ бы решил,
    // что сохранено именно она.
    const known = field.options.some((o) => o.value === value)
    const options: SelectOption[] =
      known || value === ''
        ? field.options
        : [{ value, label: `${value} — неизвестное значение`, disabled: true }, ...field.options]

    return (
      <Field label={label} htmlFor={id} hint={hint}>
        <Select
          id={id}
          surface="admin"
          value={value}
          onChange={onChange}
          options={options}
          className="max-w-sm"
        />
      </Field>
    )
  }

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
