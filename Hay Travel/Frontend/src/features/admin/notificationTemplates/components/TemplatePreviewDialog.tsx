import { useMemo } from 'react'
import { Modal } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { notificationTemplatesCopy } from '../lib/notificationTemplatesCopy'

export interface TemplatePreviewDialogProps {
  open: boolean
  onClose: () => void
  /** `null` — канал без темы (Telegram). */
  subject: string | null
  bodyHtml: string
  /** Пусто у Telegram (поля нет). */
  customCss: string
}

/**
 * Предпросмотр шаблона — рендер в `<iframe srcDoc>`, ИЗОЛИРОВАННО от страницы админки: кастомный
 * CSS шаблона не должен просочиться на саму админку (решение 2026-08-31, п.8 чек-листа). JS в
 * шаблоне не бывает (поле не заводили), поэтому полноценная sandbox-песочница не требуется —
 * изоляция здесь только про контейнеризацию стилей, не про XSS.
 */
export function TemplatePreviewDialog({ open, onClose, subject, bodyHtml, customCss }: TemplatePreviewDialogProps) {
  const copy = useCopy(notificationTemplatesCopy)

  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>body{font-family:Arial,sans-serif;margin:0;padding:16px;color:#111}</style>` +
      (customCss ? `<style>${customCss}</style>` : '') +
      `</head><body>${bodyHtml || ''}</body></html>`,
    [bodyHtml, customCss],
  )

  return (
    <Modal open={open} onClose={onClose} title={copy.previewTitle}>
      <div className="flex flex-col gap-3">
        {subject !== null && (
          <p className="text-sm">
            <span className="font-semibold text-neutral-700">{copy.subjectLabel}: </span>
            {subject}
          </p>
        )}
        <iframe
          title={copy.previewTitle}
          srcDoc={srcDoc}
          className="h-[420px] w-full rounded-lg border border-neutral-200 bg-white"
        />
      </div>
    </Modal>
  )
}
