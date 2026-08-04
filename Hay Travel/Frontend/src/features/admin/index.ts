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
export { TourCreatePage, tourCreateLoader } from './tour-form/TourCreatePage'
export { TourEditPage, tourEditLoader } from './tour-form/TourEditPage'
export { SettingsPage, settingsLoader } from './settings/SettingsPage'
export { CatalogPage, catalogLoader } from './catalog/CatalogPage'
export { UsersPage, usersLoader } from './users/UsersPage'
