/**
 * Public surface of the cart store (ADR 022). `features/tours` (adds), `features/cart` (reads and
 * mutates) and `app/layout` (badge) import from here, never from a file inside.
 *
 * The cart lives in `shared/` and not in `features/cart/` for the same reason `shared/auth` does:
 * three unrelated places need the same state, and features may not import from one another.
 */

export type {
  AddCartItemInput,
  AddCartItemResult,
  CartItem,
  CartItemSnapshot,
  CartState,
  CartTransferSelection,
} from './types'

export {
  CART_STORAGE_KEY,
  CART_STORAGE_VERSION,
  MAX_CART_ITEMS,
  addCartItem,
  clearCart,
  findCartItem,
  getCartState,
  isReturnLegValid,
  removeCartItem,
  subscribeCart,
  updateCartItem,
} from './cartStore'

export { useCart, useCartCount } from './useCart'
