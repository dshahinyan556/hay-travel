import { defineCopy } from '@/shared/i18n/defineCopy'
import {
  EmailActionKey,
  NotificationPlatform,
  NotificationRecipientSource,
  NotificationRecipientType,
  OrderLinkedRecipient,
} from '@/features/admin/types/notifications'
import {
  NotificationTemplateEntity,
  NotificationTemplateTrigger,
} from '@/features/admin/types/notificationTemplates'
import {
  EmployeeJobRole,
  LanguageCode,
  TagColor,
  TourFormat,
  TourType,
  TransferRoutePointKind,
} from './enums'

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
      [TourType.Transfer]: 'Трансфер',
    } as Record<TourType, string>,
    tourFormat: {
      [TourFormat.Individual]: 'Индивидуальный',
      [TourFormat.Group]: 'Групповой',
      [TourFormat.Both]: 'Оба',
    } as Record<TourFormat, string>,
    /** Роль точки в маршруте — и у предопределённого трансфера, и в кастомной заявке. Форма
     * продукта пишет свои («Откуда»/«Куда» как заголовки полей), эти — для ЧТЕНИЯ уже собранного
     * маршрута, где все три вида идут одним списком. */
    transferRoutePointKind: {
      [TransferRoutePointKind.From]: 'Откуда',
      [TransferRoutePointKind.Stop]: 'Остановка',
      [TransferRoutePointKind.To]: 'Куда',
    } as Record<TransferRoutePointKind, string>,
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
      // Добавлено вместе с Notification Templates (2026-08-31) — тот же пробел, что и в
      // types/notifications.ts: 5-е событие существовало на бэке, но фронт про него не знал.
      [EmailActionKey.OrderAutoCancelled]: 'Автоотмена неподтверждённой брони',
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
    /** Сущность для мердж-полей шаблона (Notification Templates, 2026-08-31). */
    notificationTemplateEntity: {
      [NotificationTemplateEntity.None]: 'Нет (свободный шаблон)',
      [NotificationTemplateEntity.Order]: 'Заказ',
      [NotificationTemplateEntity.User]: 'Пользователь',
      [NotificationTemplateEntity.Tour]: 'Тур',
      [NotificationTemplateEntity.Employee]: 'Сотрудник',
    } as Record<NotificationTemplateEntity, string>,
    notificationTemplateTrigger: {
      [NotificationTemplateTrigger.None]: 'Не привязан',
      [NotificationTemplateTrigger.VerifyEmail]: 'Подтверждение регистрации',
      [NotificationTemplateTrigger.ResetPassword]: 'Восстановление пароля',
      [NotificationTemplateTrigger.EmailChangeCode]: 'Код смены почты',
      [NotificationTemplateTrigger.EmailChangeConfirm]: 'Подтверждение новой почты',
    } as Record<NotificationTemplateTrigger, string>,
  },
  {
    tourType: {
      [TourType.Tour]: 'Tour',
      [TourType.Excursion]: 'Excursion',
      [TourType.Transfer]: 'Transfer',
    } as Record<TourType, string>,
    tourFormat: {
      [TourFormat.Individual]: 'Individual',
      [TourFormat.Group]: 'Group',
      [TourFormat.Both]: 'Both',
    } as Record<TourFormat, string>,
    transferRoutePointKind: {
      [TransferRoutePointKind.From]: 'From',
      [TransferRoutePointKind.Stop]: 'Stop',
      [TransferRoutePointKind.To]: 'To',
    } as Record<TransferRoutePointKind, string>,
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
      [EmailActionKey.OrderAutoCancelled]: 'Unconfirmed booking auto-cancelled',
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
    notificationTemplateEntity: {
      [NotificationTemplateEntity.None]: 'None (free-form template)',
      [NotificationTemplateEntity.Order]: 'Order',
      [NotificationTemplateEntity.User]: 'User',
      [NotificationTemplateEntity.Tour]: 'Tour',
      [NotificationTemplateEntity.Employee]: 'Employee',
    } as Record<NotificationTemplateEntity, string>,
    notificationTemplateTrigger: {
      [NotificationTemplateTrigger.None]: 'Not linked',
      [NotificationTemplateTrigger.VerifyEmail]: 'Registration confirmation',
      [NotificationTemplateTrigger.ResetPassword]: 'Password reset',
      [NotificationTemplateTrigger.EmailChangeCode]: 'Email change code',
      [NotificationTemplateTrigger.EmailChangeConfirm]: 'New email confirmation',
    } as Record<NotificationTemplateTrigger, string>,
  },
)
