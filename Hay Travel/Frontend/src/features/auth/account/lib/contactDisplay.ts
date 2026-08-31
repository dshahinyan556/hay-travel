/**
 * Реэкспорт: модуль уехал в `shared/contacts/lib/contactDisplay.ts` (батч контактов 2026-08-29).
 * Названия контакта словами нужны и кабинету, и блоку контактов заказа, а `shared` не может
 * зависеть от `features`.
 */

export {
  contactFullName,
  contactNameAndValue,
  describeContact,
  type ContactLike,
} from '@/shared/contacts/lib/contactDisplay'
