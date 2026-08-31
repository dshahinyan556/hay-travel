import { defineCopy } from '@/shared/i18n/defineCopy'

/**
 * Copy of the panel's chrome — sidebar, mobile top bar/drawer, the access refusal and the route
 * error boundary. Everything a signed-in employee sees regardless of which section they opened.
 *
 * Section pages own their own `<module>Copy.ts`; nothing feature-specific belongs here.
 */
export const adminLayoutCopy = defineCopy(
  {
    brandSubtitle: 'Панель администратора',
    openMenu: 'Открыть меню',
    closeMenu: 'Закрыть меню',
    menuLabel: 'Меню панели',
    backToSite: 'На сайт',
    logout: 'Выйти',
    logoutPending: 'Выходим…',
    languageLabel: 'Язык интерфейса',
    nav: {
      dashboard: 'Дашборд',
      products: 'Продукты',
      calendar: 'Календарь',
      orders: 'Заказы',
      catalog: 'Справочники',
      users: 'Пользователи',
      roles: 'Роли и права',
      notifications: 'Уведомления',
      notificationTemplates: 'Шаблоны уведомлений',
      jobs: 'Фоновые задачи',
      settings: 'Настройки',
    },
    accessDenied: {
      title: 'Недостаточно прав',
      // Split around the account address so the email can stay a highlighted `<span>` instead of
      // being interpolated into one flat string.
      messageBefore: 'Аккаунт ',
      messageAfter: ' не имеет доступа к панели администратора.',
    },
    errorBoundary: {
      sessionExpiredTitle: 'Сессия истекла',
      sessionExpiredMessage:
        'Вы слишком долго не выполняли действий или вход был выполнен на другом устройстве. ' +
        'Войдите снова, чтобы продолжить работу.',
      signInAgain: 'Войти снова',
      notFoundTitle: 'Раздел не найден',
      notFoundMessage: 'Похоже, такой страницы админки нет.',
      forbiddenTitle: 'Недостаточно прав',
      forbiddenMessage: 'У вашей роли нет доступа к этому разделу.',
      /** Second paragraph of the 403 screen. The server enforces the permissions baked into the
       * access token, so a rights change reaches it only on the next rotation — without this note a
       * freshly-granted employee would think the change did not work. */
      forbiddenLagHint:
        'Если права вам только что выдали — они вступят в силу в течение 15 минут или сразу ' +
        'после повторного входа.',
      genericTitle: 'Не удалось загрузить данные',
      genericMessage: 'Сервер не ответил. Проверьте соединение и попробуйте снова.',
      retry: 'Повторить',
    },
  },
  {
    brandSubtitle: 'Admin panel',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menuLabel: 'Panel menu',
    backToSite: 'Back to site',
    logout: 'Sign out',
    logoutPending: 'Signing out…',
    languageLabel: 'Interface language',
    nav: {
      dashboard: 'Dashboard',
      products: 'Products',
      calendar: 'Calendar',
      orders: 'Orders',
      catalog: 'Reference data',
      users: 'Users',
      roles: 'Roles & permissions',
      notifications: 'Notifications',
      notificationTemplates: 'Notification templates',
      jobs: 'Background jobs',
      settings: 'Settings',
    },
    accessDenied: {
      title: 'Access denied',
      messageBefore: 'The account ',
      messageAfter: ' cannot open the admin panel.',
    },
    errorBoundary: {
      sessionExpiredTitle: 'Session expired',
      sessionExpiredMessage:
        'You have been inactive for too long, or you signed in on another device. ' +
        'Sign in again to continue.',
      signInAgain: 'Sign in again',
      notFoundTitle: 'Section not found',
      notFoundMessage: 'There seems to be no such page in the panel.',
      forbiddenTitle: 'Access denied',
      forbiddenMessage: 'Your role has no access to this section.',
      forbiddenLagHint:
        'If you have just been granted these rights, they take effect within 15 minutes, or as ' +
        'soon as you sign in again.',
      genericTitle: 'Could not load the data',
      genericMessage: 'The server did not respond. Check your connection and try again.',
      retry: 'Retry',
    },
  },
)
