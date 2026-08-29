/**
 * Публичная поверхность раздела «Трансферы» (батч 2026-08-29).
 *
 * Три экрана: список готовых маршрутов, страница одного трансфера с бронью и конструктор
 * собственного маршрута. Всё, что снаружи — `app/router.tsx`, — видит только эти шесть имён;
 * компоненты и хуки внутри фичи никому за её пределами не нужны.
 */

export { TransfersPage, transfersLoader } from './TransfersPage'
export { TransferDetailPage, transferDetailLoader } from './TransferDetailPage'
export { TransferRequestPage, transferRequestLoader } from './TransferRequestPage'
