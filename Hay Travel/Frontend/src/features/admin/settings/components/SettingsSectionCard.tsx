import { useId } from 'react'
import { Card } from '@/shared/ui'
import { hintFor, labelFor } from '@/features/admin/settings/lib/settingsCopy'
import type { SettingFieldState } from '@/features/admin/settings/types'
import type { SettingsValidation } from '@/features/admin/settings/lib/validation'
import type { SettingsFormActions } from '@/features/admin/settings/hooks/useSettingsForm'
import { SettingField } from './SettingField'

interface SettingsSectionCardProps {
  title: string
  description?: string
  /** Already picked and ordered by the parent — this component neither filters nor sorts. */
  fields: SettingFieldState[]
  validation: SettingsValidation
  actions: SettingsFormActions
}

/** One catalog group rendered as one card. Purely presentational. */
export function SettingsSectionCard({
  title,
  description,
  fields,
  validation,
  actions,
}: SettingsSectionCardProps) {
  const titleId = useId()

  return (
    <Card padding="lg">
      <section aria-labelledby={titleId} className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h2 id={titleId} className="text-base font-bold text-neutral-900">
            {title}
          </h2>
          {description && <p className="text-sm text-neutral-500">{description}</p>}
        </header>

        {fields.map((field) => (
          <SettingField
            key={field.key}
            field={field}
            label={labelFor(field.key)}
            hint={hintFor(field.key)}
            errors={validation.errors[field.key]}
            warning={validation.warnings[field.key]}
            onChangeValue={(value) => actions.setValue(field.key, value)}
            onChangeTranslation={(lang, value) => actions.setTranslation(field.key, lang, value)}
          />
        ))}
      </section>
    </Card>
  )
}
