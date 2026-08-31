import type { RichTextPlaceholder } from '@/features/admin/ui/RichTextEditor'

/**
 * `{{Token}}` → human name, for the template body editor's "Вставить поле" menu.
 *
 * Kept in sync BY HAND with `ATTours.Common/Constants/EmailPlaceholders.cs` +
 * `ATTours.Common/Constants/NotificationAuthPlaceholders.cs`. A token missing here is not an
 * error: `placeholderItems` below falls back to the raw token, so a new backend placeholder just
 * shows up undressed instead of disappearing from the menu.
 */
const LABELS: Record<string, { label: string; hint?: string }> = {
  // Order (EmailPlaceholders.ForEntity(Order))
  OrderNumber: { label: 'Номер заказа', hint: 'Например, 240816-0007' },
  OrderCreatedDate: { label: 'Дата создания заказа' },
  OrderCurrency: { label: 'Валюта заказа' },
  EventTitle: { label: 'Заголовок события', hint: 'Например, «Новая бронь» — локализуется автоматически' },
  TourTitle: { label: 'Название тура' },
  TourDate: { label: 'Дата тура' },
  GuestCount: { label: 'Количество гостей' },
  ClientName: { label: 'Имя клиента' },
  ClientEmail: { label: 'Email клиента' },
  ClientContact: { label: 'Контакты клиента', hint: 'Все контакты заказа списком — бэкенд собирает сам' },
  EmployeeName: { label: 'Имя исполнителя' },
  EmployeeRole: { label: 'Роль исполнителя', hint: 'Гид, водитель и т.д.' },
  AssignmentDetails: { label: 'Детали назначения', hint: 'Список позиций заказа — бэкенд собирает его сам' },
  OrderLines: { label: 'Строки заказа', hint: 'Все позиции заказа списком — бэкенд собирает его сам' },

  // User
  UserFullName: { label: 'Имя пользователя' },
  UserEmail: { label: 'Email пользователя' },
  UserPhone: { label: 'Телефон пользователя' },

  // Tour
  TourTitleField: { label: 'Название тура' },
  TourPrice: { label: 'Цена тура' },
  TourDurationDays: { label: 'Длительность тура (дней)' },

  // Employee
  EmployeeFullName: { label: 'Имя сотрудника' },
  EmployeeRoleField: { label: 'Роль сотрудника' },
  EmployeePhone: { label: 'Телефон сотрудника' },

  // Auth (NotificationAuthPlaceholders) — фиксированный набор одноразовых токенов потока.
  UserName: { label: 'Имя пользователя' },
  VerifyUrl: { label: 'Ссылка подтверждения email' },
  ResetUrl: { label: 'Ссылка сброса пароля' },
  Code: { label: 'Код подтверждения' },
  ConfirmUrl: { label: 'Ссылка подтверждения новой почты' },
}

/** `['{{OrderNumber}}', …]` → menu items. An unrecognised token is shown as-is rather than
 * hidden — nothing breaks when the backend adds one before this map catches up. */
export function placeholderItems(tokens: readonly string[]): RichTextPlaceholder[] {
  return tokens.map((token) => {
    const bareToken = token.replace(/^\{\{|\}\}$/g, '')
    const known = LABELS[bareToken]
    return known ? { token, label: known.label, hint: known.hint } : { token, label: token }
  })
}
