import type { ReactNode } from 'react'

/**
 * Шапка раздела кабинета: заголовок и главное действие раздела.
 *
 * Живёт в самом разделе, а не в оболочке страницы: действие («Добавить контакт») принадлежит
 * разделу и знает его состояние, а вытащить кнопку наверх, оставив внизу список, которым она
 * управляет, значило бы разорвать их.
 *
 * Заголовок — `.card-title` (Manrope 600, 19 px), не Prata: на этом кегле у неё пропадают
 * волосяные штрихи, и заголовок раздела читался бы бледнее собственного текста под ним.
 *
 * Пояснительный подзаголовок под каждым разделом убран целиком (David, 2026-08-31): описание
 * того, что раздел и так показывает, никому не было интересно, и переставало быть верным при
 * первом же изменении экрана — держать его в силе стоило дороже, чем оно того стоило.
 */
export interface AccountSectionHeadProps {
  title: string
  /** Кнопка раздела. На мобильном рендерится под заголовком во всю ширину. */
  action?: ReactNode
}

export function AccountSectionHead({ title, action }: AccountSectionHeadProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <h2 className="card-title min-w-0 text-ink">{title}</h2>
      {action && <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  )
}
