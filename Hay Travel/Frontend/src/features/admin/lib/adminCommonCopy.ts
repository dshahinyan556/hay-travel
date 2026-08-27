import { defineCopy } from '@/shared/i18n/defineCopy'

/**
 * Strings more than one admin module needs — the generic verbs and states every screen repeats
 * ("Сохранить", "Ничего не найдено", "Нет связи с сервером").
 *
 * Modules READ this file and do not write to it: eight modules are localised in parallel, and a
 * shared append-only file would be the one guaranteed merge conflict. A module that needs its own
 * wording for something similar puts it in its own `<module>Copy.ts` instead — a slightly longer
 * copy module is cheaper than a shared file everybody edits.
 *
 * `ru` is intentionally NOT `as const` — see `shared/i18n/defineCopy.ts` for why literal types
 * would break the `en` half's type check.
 */
export const adminCommonCopy = defineCopy(
  {
    save: 'Сохранить',
    saving: 'Сохраняем…',
    saved: 'Сохранено.',
    cancel: 'Отмена',
    add: 'Добавить',
    delete: 'Удалить',
    edit: 'Изменить',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    back: 'Назад',
    retry: 'Повторить',
    clear: 'Сбросить',
    search: 'Поиск',
    searchPlaceholder: 'Поиск…',
    loading: 'Загрузка…',
    empty: 'Пока пусто.',
    nothingFound: 'Ничего не найдено.',
    dash: '—',
    yes: 'Да',
    no: 'Нет',
    all: 'Все',
    required: 'Обязательное поле',
    unknownError: 'Что-то пошло не так. Попробуйте ещё раз.',
    networkError: 'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.',
    forbiddenError: 'Недостаточно прав для этого действия.',
    serverError: (status: number) => `Сервер вернул ошибку (${status}).`,
  },
  {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved.',
    cancel: 'Cancel',
    add: 'Add',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    retry: 'Retry',
    clear: 'Reset',
    search: 'Search',
    searchPlaceholder: 'Search…',
    loading: 'Loading…',
    empty: 'Nothing here yet.',
    nothingFound: 'Nothing found.',
    dash: '—',
    yes: 'Yes',
    no: 'No',
    all: 'All',
    required: 'This field is required',
    unknownError: 'Something went wrong. Please try again.',
    networkError: 'No connection to the server. Check your network and try again.',
    forbiddenError: 'You do not have permission for this action.',
    serverError: (status: number) => `The server returned an error (${status}).`,
  },
)
