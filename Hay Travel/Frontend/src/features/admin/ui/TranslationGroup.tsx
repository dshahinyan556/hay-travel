import { useId } from 'react'
import { Input, Textarea } from '@/shared/ui'
import { HelpButton } from '@/shared/ui/HelpButton'
import { HelpRevealZone } from '@/shared/ui/HelpReveal'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { LangKey, Localized } from '@/features/admin/types/localized'
import { adminUiCopy } from './adminUiCopy'
import { LANG_FLAG_CLASS } from './langFlag'

interface TranslationGroupProps {
  /** Field caption shown above the RU/EN pair. */
  label: string
  value: Localized
  onChange: (lang: LangKey, value: string) => void
  /** Render `Textarea`s instead of single-line `Input`s. */
  multiline?: boolean
  /** Marks the field as required (visible `*` + error styling when an error is set). */
  required?: boolean
  /** Error for the RU value. On the tour form RU is the only required language, so this is
   * usually the only one set. */
  error?: string
  /** Error for the EN value. Used by the settings screen, where a translatable key requires
   * BOTH languages (the backend does not fall back to RU when EN is empty). */
  errorEn?: string
  /** Explanation surfaced through a `HelpButton` next to the legend — same pattern `Field` uses
   * for non-translatable settings (2026-08-14). */
  hint?: string
}

/**
 * One bilingual field rendered as the mockup's side-by-side matrix: a caption above two
 * columns (RU | English) so the admin sees both languages — and any missing translation — at
 * once. Shared by every admin screen that edits a translatable field (ADR 004): the tour form
 * and the settings screen today, dictionaries next.
 *
 * Purely presentational — it knows nothing about tours, settings, reducers or the network.
 */
export function TranslationGroup({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  error,
  errorEn,
  hint,
}: TranslationGroupProps) {
  return (
    <HelpRevealZone as="fieldset" enabled={Boolean(hint)} className="flex flex-col gap-1.5">
      {/* The help trigger lives INSIDE `legend` (legend accepts phrasing content, including a
          `<button>`) rather than beside it in a wrapping `<div>` — a `<legend>` is only picked up
          as the fieldset's accessible name while it is the fieldset's own first child; wrapping it
          would silently break that association. */}
      <legend className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-neutral-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-rose-700">
            *
          </span>
        )}
        {hint && (
          <HelpButton surface="admin" title={label}>
            {hint}
          </HelpButton>
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
          error={errorEn}
        />
      </div>
    </HelpRevealZone>
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
  const copy = useCopy(adminUiCopy).translation
  const langName = copy.langName[lang]
  const control = multiline ? Textarea : Input

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
      >
        <span aria-hidden="true" className={`h-3 w-4 shrink-0 rounded-[2px] ${LANG_FLAG_CLASS[lang]}`} />
        {langName}
      </label>
      {control === Textarea ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={Boolean(error)}
          aria-label={copy.fieldInLang(fieldLabel, langName)}
          className="min-h-[52px]"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={Boolean(error)}
          aria-label={copy.fieldInLang(fieldLabel, langName)}
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
