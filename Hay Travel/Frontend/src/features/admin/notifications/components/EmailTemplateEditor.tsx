import { useMemo } from 'react'
import { useCopy } from '@/shared/i18n/defineCopy'
import type { LangKey } from '@/features/admin/types/localized'
import { TranslationGroup } from '@/features/admin/ui/TranslationGroup'
import { LANG_FLAG_CLASS } from '@/features/admin/ui/langFlag'
import { RICH_TEXT_TOOLSETS, RichTextEditor } from '@/features/admin/ui/RichTextEditor'
import { notificationsCopy } from '../lib/notificationsCopy'
import { placeholderItems } from '../lib/placeholderLabels'

export interface EmailTemplateEditorProps {
  subject: string
  subjectEn: string
  bodyHtml: string
  bodyHtmlEn: string
  availablePlaceholders: string[]
  disabled: boolean
  /** «Тема/текст не могут быть пустыми» — только после попытки сохранения. */
  error: string | null
  onChange: (
    patch: Partial<Pick<EmailTemplateEditorProps, 'subject' | 'subjectEn' | 'bodyHtml' | 'bodyHtmlEn'>>,
  ) => void
}

/**
 * Билингвальный редактор письма: тема RU/EN + текст RU/EN.
 *
 * Тема — готовый `TranslationGroup` (он ровно для пары однострочных полей). Текста письма это
 * не покрывает: `TranslationGroup` рендерит `Input`/`Textarea`, а здесь нужны два
 * `RichTextEditor`. Билингвального RTE в проекте нет и в `shared/ui` он не заводится — «добавляй
 * с экраном, которому нужно»; пара живёт здесь, а общей у неё с `TranslationGroup` остаётся
 * полоска-флаг (`LANG_FLAG_CLASS`), чтобы две пары не разъехались визуально.
 *
 * Русская версия обязательна, английская — нет: при пустой EN англоязычному получателю уходит
 * русская, по каждому полю независимо (это делает сервер).
 */
export function EmailTemplateEditor({
  subject,
  subjectEn,
  bodyHtml,
  bodyHtmlEn,
  availablePlaceholders,
  disabled,
  error,
  onChange,
}: EmailTemplateEditorProps) {
  const copy = useCopy(notificationsCopy)
  const placeholders = useMemo(
    () => placeholderItems(availablePlaceholders),
    [availablePlaceholders],
  )

  const langName: Record<LangKey, string> = { ru: copy.langRu, en: copy.langEn }
  const isSubjectEmpty = error !== null && subject.trim() === ''

  function bodyColumn(lang: LangKey, value: string, onValue: (html: string) => void) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          <span aria-hidden="true" className={`h-3 w-4 shrink-0 rounded-[2px] ${LANG_FLAG_CLASS[lang]}`} />
          {langName[lang]}
        </span>
        <RichTextEditor
          value={value}
          onChange={onValue}
          disabled={disabled}
          toolset={RICH_TEXT_TOOLSETS.email}
          placeholders={placeholders}
          placeholder={copy.bodyPlaceholder}
          minHeight="md"
          invalid={lang === 'ru' && error !== null && value.trim() === ''}
          aria-label={copy.bodyInLangAria(langName[lang])}
        />
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <TranslationGroup
        label={copy.subjectLabel}
        required
        value={{ ru: subject, en: subjectEn }}
        error={isSubjectEmpty ? copy.errorTemplateInvalid : undefined}
        onChange={(lang, value) =>
          onChange(lang === 'ru' ? { subject: value } : { subjectEn: value })
        }
      />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
          {copy.templateTitle}
          <span aria-hidden="true" className="ml-0.5 text-rose-700">
            *
          </span>
        </legend>
        {/* Ниже `sm` колонки складываются в стек: редактор с панелью инструментов в половину
            телефонного экрана не читается. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {bodyColumn('ru', bodyHtml, (html) => onChange({ bodyHtml: html }))}
          {bodyColumn('en', bodyHtmlEn, (html) => onChange({ bodyHtmlEn: html }))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1 text-xs text-neutral-400">
        <p>{copy.placeholdersHint}</p>
        <p>{copy.translationFallbackHint}</p>
      </div>
    </section>
  )
}
