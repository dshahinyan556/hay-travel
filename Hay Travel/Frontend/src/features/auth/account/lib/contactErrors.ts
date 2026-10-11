/**
 * Реэкспорт: модуль уехал в `shared/contacts/lib/contactErrors.ts` (батч контактов 2026-08-29).
 *
 * Вместе с переездом у него сменился запасной путь: в `shared` он падает сразу в
 * `authErrorMessageKey`, а не в `accountErrors.ts`. Для справочника контактов это одно и то же —
 * коды 22xx (смена почты, привязка Telegram) `api/Account/Contacts` не возвращает.
 */

export {
  ContactErrorCode,
  contactErrorMessageKey,
} from '@/shared/contacts/lib/contactErrors'
