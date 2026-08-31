/**
 * Реэкспорт: сам клиент `api/Account/Contacts` уехал в `shared/contacts/api/contacts.ts`
 * (батч контактов 2026-08-29).
 *
 * Переезд вынужденный и правильный: тот же справочник читает блок «с кем связаться по этому
 * заказу» в корзине и в конструкторе трансфера, а `features/cart` не имеет права импортировать
 * `features/auth` — такого направления в проекте нет.
 */

export {
  createContact,
  deleteContact,
  getContacts,
  setPrimaryContact,
  updateContact,
  type ContactMethodInput,
} from '@/shared/contacts/api/contacts'
