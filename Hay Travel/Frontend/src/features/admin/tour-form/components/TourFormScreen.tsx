import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AdminToolbar, DataEntryScreenLayout } from '@/shared/ui'
import { useCopy } from '@/shared/i18n/defineCopy'
import { adminEnumsCopy } from '@/features/admin/lib/adminEnumsCopy'
import type { TourType } from '@/features/admin/lib/enums'
import { tourFormCopy } from '@/features/admin/tour-form/lib/tourFormCopy'

/** Мягкое удаление продукта («В архив»). Передаётся ТОЛЬКО на экране редактирования и только при
 * наличии права `products.Delete` — иначе кнопки в тулбаре нет вовсе (не «заблокирована»): у
 * несохранённого продукта архивировать нечего, а отсутствие права не объясняется ничем, чего нет
 * в «Ролях и правах». */
export interface TourFormArchiveAction {
  pending: boolean
  onRequest: () => void
}

export interface TourFormScreenProps {
  /** Тип продукта — только для хлебных крошек; форма читает его из собственного состояния. */
  type: TourType
  title: string
  subtitle: string
  /** Ошибка страницы: неудачное сохранение ИЛИ неудачная архивация. Обе живут в одном слоте
   * `message` шаблона A и показываются одинаково, поэтому вызывающая страница схлопывает их в
   * одну строку сама. */
  error: string | null
  isValid: boolean
  /** True после первой попытки сохранения — до неё красных подсказок на экране нет. */
  hasAttemptedSubmit: boolean
  isDirty: boolean
  isSubmitting: boolean
  onSave: () => void
  onCancel: () => void
  archive?: TourFormArchiveAction
  /** Тело экрана — `TourForm` со своими вкладками. */
  children: ReactNode
}

/**
 * Шаблон A («Экран ввода данных», `DataEntryScreenLayout`) для формы продукта: хлебные крошки →
 * заголовок/подзаголовок → control zone → слот сообщений → тело с вкладками.
 *
 * Save/Отмена/«В архив» лежат в `AdminToolbar` — та же конвенция «тулбар + черновик + Save», что и
 * на экране заказа (эталон), вместо прежней липкой панели внизу формы. Подписи Save/Отмена берутся
 * из общего словаря `ui.toolbar.*` — здесь переопределяется только Delete, потому что удаление тут
 * мягкое: «В архив», а не «Удалить».
 *
 * Состояния черновика компонент не хранит: `isDirty`/`isValid`/`isSubmitting` приходят из
 * `useTourForm`, который остаётся единственным владельцем формы.
 */
export function TourFormScreen({
  type,
  title,
  subtitle,
  error,
  isValid,
  hasAttemptedSubmit,
  isDirty,
  isSubmitting,
  onSave,
  onCancel,
  archive,
  children,
}: TourFormScreenProps) {
  const copy = useCopy(tourFormCopy)
  const typeLabels = useCopy(adminEnumsCopy).tourType
  const showInvalidWarning = hasAttemptedSubmit && !isValid
  const busy = isSubmitting || Boolean(archive?.pending)

  return (
    <DataEntryScreenLayout
      breadcrumbs={
        <>
          <Link to="/admin/products" className="transition-colors hover:text-neutral-800">
            {copy.page.products}
          </Link>
          <span aria-hidden="true"> · </span>
          <span className="font-semibold text-neutral-800">{typeLabels[type]}</span>
        </>
      }
      breadcrumbsLabel={copy.page.breadcrumbs}
      title={title}
      subtitle={subtitle}
      controlZone={
        <AdminToolbar
          className="w-full sm:w-auto"
          onCancel={onCancel}
          onSave={onSave}
          // «В архив» вместо «Удалить»: окончательное удаление осталось только в архиве списка
          // продуктов (решение Давида 2026-08-29, п. 0.1).
          onDelete={archive ? archive.onRequest : undefined}
          labels={{ delete: copy.archive.button }}
          cancelState={{ disabled: busy }}
          // Сохранить остаётся кликабельной и на невалидной форме — `onSave` сам ничего не
          // отправит и покажет ошибки полей; заблокированная кнопка не объяснила бы, почему
          // сохранение не произошло. Это поведение прежней панели, оно сохранено намеренно.
          saveState={{ disabled: busy, pending: isSubmitting }}
          deleteState={{ disabled: isSubmitting, pending: archive?.pending }}
        />
      }
      message={
        error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        ) : showInvalidWarning ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span aria-hidden="true">⚠️</span>
            <span>{copy.actions.invalidNote}</span>
          </div>
        ) : isDirty ? (
          // Нейтральная строка о черновике — только когда терять действительно есть что; без
          // `role`, чтобы скринридер не зачитывал её при каждом нажатии клавиши в форме.
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {copy.actions.draftNote}
          </p>
        ) : null
      }
    >
      {children}
    </DataEntryScreenLayout>
  )
}
