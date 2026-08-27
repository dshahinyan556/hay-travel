import { defineCopy } from '@/shared/i18n/defineCopy'
import {
  EmailActionKey,
  NotificationPlatform,
  NotificationRecipientSource,
  NotificationRecipientType,
  OrderLinkedRecipient,
} from '@/features/admin/types/notifications'
import { EmployeeJobRole, LanguageCode, TagColor, TourType } from './enums'

/**
 * Interface labels for the wire enums.
 *
 * They used to live in `enums.ts` next to the values themselves, but that module is a PROTOCOL
 * module — imported by mappers and by the API layer, both of which have no business carrying UI
 * text, let alone locale-dependent UI text. `enums.ts` now holds only values and types; every
 * human-readable caption for them is here.
 *
 * English captions are the enum members' own names (`Driver` → "Driver", `Gold` → "Gold"). They
 * are labels for a fixed technical vocabulary, not prose — inventing synonyms would only make the
 * panel and the API disagree.
 */
export const adminEnumsCopy = defineCopy(
  {
    tourType: {
      [TourType.Tour]: 'Тур',
      [TourType.Excursion]: 'Экскурсия',
    } as Record<TourType, string>,
    tagColor: {
      [TagColor.Gold]: 'Золотой',
      [TagColor.Wine]: 'Бордовый',
      [TagColor.Success]: 'Зелёный',
      [TagColor.Danger]: 'Красный',
      [TagColor.Warning]: 'Оранжевый',
    } as Record<TagColor, string>,
    employeeJobRole: {
      [EmployeeJobRole.Driver]: 'Водитель',
      [EmployeeJobRole.Guide]: 'Гид',
      [EmployeeJobRole.DriverGuide]: 'Гид-водитель',
    } as Record<EmployeeJobRole, string>,
    /** Язык писем получателя (редизайн 2026-08-23) — не язык интерфейса панели и не язык
     * контента тура, хотя enum на всё это один. */
    languageCode: {
      [LanguageCode.Russian]: 'Русский',
      [LanguageCode.English]: 'Английский',
    } as Record<LanguageCode, string>,
    /** Подписи событий уведомлений. Сервер шлёт свой `displayName`, но всегда по-русски — он
     * остаётся только фолбэком на случай, если бэкенд заведёт пятое событие раньше фронта. */
    emailActionKey: {
      [EmailActionKey.OrderCreated]: 'Новая бронь с сайта',
      [EmailActionKey.OrderAssignEmployee]: 'Назначение исполнителя',
      [EmailActionKey.OrderUnassignEmployee]: 'Снятие исполнителя',
      [EmailActionKey.OrderSendToClient]: 'Отправка заказа клиенту',
    } as Record<EmailActionKey, string>,
    notificationPlatform: {
      [NotificationPlatform.Email]: 'Email',
      [NotificationPlatform.Telegram]: 'Telegram',
    } as Record<NotificationPlatform, string>,
    notificationRecipientType: {
      [NotificationRecipientType.To]: 'Кому',
      [NotificationRecipientType.Cc]: 'Копия',
      [NotificationRecipientType.Bcc]: 'Скрытая копия',
    } as Record<NotificationRecipientType, string>,
    notificationRecipientSource: {
      [NotificationRecipientSource.User]: 'Пользователь',
      [NotificationRecipientSource.OrderLinked]: 'Привязан к заказу',
      [NotificationRecipientSource.CustomEmail]: 'Свой адрес',
      [NotificationRecipientSource.AdminMailbox]: 'Служебный ящик',
    } as Record<NotificationRecipientSource, string>,
    orderLinkedRecipient: {
      [OrderLinkedRecipient.Client]: 'Клиент заказа',
      [OrderLinkedRecipient.Employee]: 'Исполнитель заказа',
    } as Record<OrderLinkedRecipient, string>,
  },
  {
    tourType: {
      [TourType.Tour]: 'Tour',
      [TourType.Excursion]: 'Excursion',
    } as Record<TourType, string>,
    tagColor: {
      [TagColor.Gold]: 'Gold',
      [TagColor.Wine]: 'Wine',
      [TagColor.Success]: 'Green',
      [TagColor.Danger]: 'Red',
      [TagColor.Warning]: 'Orange',
    } as Record<TagColor, string>,
    employeeJobRole: {
      [EmployeeJobRole.Driver]: 'Driver',
      [EmployeeJobRole.Guide]: 'Guide',
      [EmployeeJobRole.DriverGuide]: 'Driver-guide',
    } as Record<EmployeeJobRole, string>,
    languageCode: {
      [LanguageCode.Russian]: 'Russian',
      [LanguageCode.English]: 'English',
    } as Record<LanguageCode, string>,
    emailActionKey: {
      [EmailActionKey.OrderCreated]: 'New booking from the site',
      [EmailActionKey.OrderAssignEmployee]: 'Employee assigned',
      [EmailActionKey.OrderUnassignEmployee]: 'Employee unassigned',
      [EmailActionKey.OrderSendToClient]: 'Order sent to the client',
    } as Record<EmailActionKey, string>,
    notificationPlatform: {
      [NotificationPlatform.Email]: 'Email',
      [NotificationPlatform.Telegram]: 'Telegram',
    } as Record<NotificationPlatform, string>,
    notificationRecipientType: {
      [NotificationRecipientType.To]: 'To',
      [NotificationRecipientType.Cc]: 'Cc',
      [NotificationRecipientType.Bcc]: 'Bcc',
    } as Record<NotificationRecipientType, string>,
    notificationRecipientSource: {
      [NotificationRecipientSource.User]: 'User',
      [NotificationRecipientSource.OrderLinked]: 'Order-linked',
      [NotificationRecipientSource.CustomEmail]: 'Custom address',
      [NotificationRecipientSource.AdminMailbox]: 'Service mailbox',
    } as Record<NotificationRecipientSource, string>,
    orderLinkedRecipient: {
      [OrderLinkedRecipient.Client]: 'Order client',
      [OrderLinkedRecipient.Employee]: 'Order employee',
    } as Record<OrderLinkedRecipient, string>,
  },
)
