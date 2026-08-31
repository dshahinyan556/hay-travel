/**
 * Реэкспорт: сами классы уехали в `shared/ui/publicButton.ts` (батч контактов 2026-08-29).
 *
 * Причина переезда — там же, в доке нового модуля: карточка и форма контакта переехали в
 * `shared/contacts`, а `shared` не может импортировать `features`.
 *
 * Прежнее имя сохранено намеренно: в кабинете этими классами набраны все шесть разделов, и
 * массовое переименование ради одного переезда трогало бы файлы, к которым у этой задачи нет
 * никакого отношения.
 */

export {
  publicButtonClass as accountButtonClass,
  type PublicButtonVariant as AccountButtonVariant,
} from '@/shared/ui/publicButton'
