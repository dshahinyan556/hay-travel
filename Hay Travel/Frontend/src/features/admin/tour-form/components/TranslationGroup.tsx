import { useId } from 'react'
import { Input, Textarea } from '@/shared/ui'
import type { Localized } from '@/features/admin/types/form'
import type { LangKey } from '@/features/admin/tour-form/reducer/tourFormReducer'

interface TranslationGroupProps {
  /** Field caption shown above the RU/EN pair. */
  label: string
  value: Localized
  onChange: (lang: LangKey, value: string) => void
  /** Render `Textarea`s instead of single-line `Input`s. */
  multiline?: boolean
  /** Marks the RU column as required (visible `*` + error styling when `error` is set). */
  required?: boolean
  /** Error for the RU value (RU is the required language across the form). */
  error?: string
}

const langMeta: Record<LangKey, { name: string; flag: string }> = {
  ru: { name: 'Русский', flag: 'bg-gradient-to-b from-white from-33% via-blue-700 via-33% to-red-600 to-66%' },
  en: { name: 'English', flag: 'bg-blue-900' },
}

/**
 * One bilingual field rendered as the mockup's side-by-side matrix: a caption above two
 * columns (RU | English) so the admin sees both languages — and any missing translation — at
 * once. Reused for every localized field of the tour and of each day.
 */
export function TranslationGroup({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  error,
}: TranslationGroupProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold text-neutral-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-rose-700">
            *
          </span>
        )}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <LangCell
          lang="ru"
          fieldLabel={label}
          value={value.ru}
          onChange={(v) => onChange('ru', v)}
          multiline={multiline}
          error={error}
        />
        <LangCell
          lang="en"
          fieldLabel={label}
          value={value.en}
          onChange={(v) => onChange('en', v)}
          multiline={multiline}
        />
      </div>
    </fieldset>
  )
}

interface LangCellProps {
  lang: LangKey
  fieldLabel: string
  value: string
  onChange: (value: string) => void
  multiline: boolean
  error?: string
}

function LangCell({ lang, fieldLabel, value, onChange, multiline, error }: LangCellProps) {
  const id = useId()
  const meta = langMeta[lang]
  const control = multiline ? Textarea : Input

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
      >
        <span aria-hidden="true" className={`h-3 w-4 shrink-0 rounded-[2px] ${meta.flag}`} />
        {meta.name}
      </label>
      {control === Textarea ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={Boolean(error)}
          aria-label={`${fieldLabel} — ${meta.name}`}
          className="min-h-[52px]"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={Boolean(error)}
          aria-label={`${fieldLabel} — ${meta.name}`}
        />
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
}
