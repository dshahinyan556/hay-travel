import { useId } from 'react'
import { Field, Input, Textarea } from '@/shared/ui'
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
  /** Non-blocking note about a suspicious value; replaces `hint` while it is set. */
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
          onChange={onChangeTranslation}
        />
      ) : (
        <PlainSettingField
          field={field}
          label={label}
          hint={warning ?? hint}
          onChange={onChangeValue}
        />
      )}
      {/* A translatable setting has no language-neutral control to hang the hint on, so its
          helper text goes here, under the RU/EN pair. */}
      {field.isTranslatable && hint && <p className="text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}



interface PlainSettingFieldProps {
  field: SettingFieldState
  label: string
  hint?: string
  onChange: (value: string) => void
}

/** Language-neutral settings: text, multiline text, a link, or an image URL with a preview. */
function PlainSettingField({ field, label, hint, onChange }: PlainSettingFieldProps) {
  const id = useId()
  const value = field.value

  if (field.valueType === SettingValueType.ImageUrl) {
    return <ImageUrlField label={label} value={value} hint={hint} onChange={onChange} />
  }

  if (field.valueType === SettingValueType.MultilineText) {
    return (
      <Field label={label} htmlFor={id} hint={hint}>
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    )
  }

  if (field.valueType === SettingValueType.Url) {
    return (
      <Field label={label} htmlFor={id} hint={hint}>
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

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}
