import type { RichTextPlaceholder } from '@/features/admin/ui/RichTextEditor'

/**
 * `{{Token}}` → human name, for the email body editor's "Вставить поле" menu (spec 011 §4.2).
 * Domain knowledge about ORDER emails specifically — lives here, not in the editor itself, which
 * must not know what an order or a client is (ADR 023).
 *
 * Kept in sync BY HAND with `ATTours.Common/Constants/EmailPlaceholders.cs`. A token missing here
 * is not an error: `placeholderItems` below falls back to the raw token, so a new backend
 * placeholder just shows up undressed instead of disappearing from the menu.
 */
const LABELS: Record<string, { label: string; hint?: string }> = {
  OrderNumber: { label: 'Номер заказа', hint: 'Например, 240816-0007' },
  TourTitle: { label: 'Название тура' },
  TourDate: { label: 'Дата тура' },
  GuestCount: { label: 'Количество гостей' },
  ClientName: { label: 'Имя клиента' },
  ClientEmail: { label: 'Email клиента' },
  EmployeeName: { label: 'Имя исполнителя' },
  EmployeeRole: { label: 'Роль исполнителя', hint: 'Гид, водитель и т.д.' },
  AssignmentDetails: { label: 'Детали назначения', hint: 'Список позиций заказа — бэкенд собирает его сам' },
  OrderLines: { label: 'Строки заказа', hint: 'Все позиции заказа списком — бэкенд собирает его сам' },
}

/** `['{{OrderNumber}}', …]` (as `NotificationTemplateInfoModel.availablePlaceholders` sends it) → menu
 * items. An unrecognised token is shown as-is rather than hidden — nothing breaks when the
 * backend adds one before this map catches up. */
export function placeholderItems(tokens: readonly string[]): RichTextPlaceholder[] {
  return tokens.map((token) => {
    const bareToken = token.replace(/^\{\{|\}\}$/g, '')
    const known = LABELS[bareToken]
    return known ? { token, label: known.label, hint: known.hint } : { token, label: token }
  })
}
