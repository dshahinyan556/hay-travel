/**
 * Public surface of the "admin" feature. `app/router.tsx` imports only from here.
 * The create/edit form (built separately) appends its own exports below — keep additions
 * additive so both parts coexist.
 */
export { AdminLayout } from './layout/AdminLayout'
export { adminRootLoader } from './layout/adminRootLoader'
export { AdminErrorBoundary } from './layout/AdminErrorBoundary'
export { DashboardPage, dashboardLoader } from './dashboard/DashboardPage'
export { ProductsPage, productsLoader } from './products/ProductsPage'
export { CalendarPage, calendarLoader } from './calendar/CalendarPage'
export { OrdersPage, ordersLoader } from './orders/OrdersPage'
export { OrderDetailPage, orderDetailLoader } from './orders/OrderDetailPage'
export { TourCreatePage, tourCreateLoader } from './tour-form/TourCreatePage'
export { TourEditPage, tourEditLoader } from './tour-form/TourEditPage'
export { SettingsPage, settingsLoader } from './settings/SettingsPage'
export { CatalogPage, catalogLoader } from './catalog/CatalogPage'
export { UsersPage, usersLoader } from './users/UsersPage'
export { UserDetailPage, userDetailLoader } from './users/UserDetailPage'
export { NotificationsPage, notificationsLoader } from './notifications/NotificationsPage'
export { NotificationEventPage, notificationEventLoader } from './notifications/NotificationEventPage'
export { RolesPage, rolesLoader } from './roles/RolesPage'
export { RoleDetailPage, roleDetailLoader } from './roles/RoleDetailPage'
