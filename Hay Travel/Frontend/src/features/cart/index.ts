/**
 * Public surface of the "cart" feature — `app/router.tsx` imports only from here.
 *
 * The STORE is not here: it lives in `@/shared/cart`, because `features/tours` writes to it and
 * `app/layout` reads it for the header badge, and features may not import from one another.
 */
export { CartPage, cartLoader } from './CartPage'
export type { CartLoaderData } from './CartPage'
