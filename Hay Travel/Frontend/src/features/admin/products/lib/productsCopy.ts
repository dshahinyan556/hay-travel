import { defineCopy } from '@/shared/i18n/defineCopy'

/**
 * Text of the products list — the page header, the view switch, the filters, the table and the
 * permanent-delete confirmation (ADR 021).
 *
 * Generic verbs the whole panel repeats («Отмена», «Удалить») are NOT duplicated here: call sites
 * read them from `features/admin/lib/adminCommonCopy.ts`. Tour-type captions come from
 * `adminEnumsCopy` — except the two TYPE FILTER options below, which are prose around the enum
 * («Только туры»), not the caption itself: Russian needs a plural accusative that cannot be derived
 * from the singular «Тур» the enum copy holds.
 *
 * The `ru` object is deliberately not `as const` — see `shared/i18n/defineCopy.ts`.
 */
export const productsCopy = defineCopy(
  {
    title: 'Продукты',
    subtitle: 'Все туры и экскурсии — поиск, фильтры, архив.',
    create: 'Создать продукт',
    noMatches: 'Ничего не найдено по заданным фильтрам.',

    /** Names of the row mutations, substituted into `errorServer`/`errorNetwork`. Kept as a group
     * so no call site has to spell an action out inline. */
    action: {
      publish: 'опубликовать',
      unpublish: 'снять с публикации',
      archive: 'архивировать',
      restore: 'восстановить',
      feature: 'добавить в избранное',
      unfeature: 'убрать из избранного',
      reorder: 'изменить порядок',
      deleteForever: 'удалить окончательно',
    },
    errorTooManyFeatured: (max: number) =>
      `Уже отмечено ${max} туров — сначала уберите один из «Избранных».`,
    errorServer: (action: string, status: number) =>
      `Не удалось ${action}: сервер вернул ошибку (${status}).`,
    errorNetwork: (action: string) =>
      `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,

    toolbar: {
      tabActive: 'Активные',
      tabFeatured: 'Избранные',
      tabArchived: 'Архив',
      searchPlaceholder: 'Поиск по заголовку (RU/EN)…',
      searchLabel: 'Поиск по заголовку',
      typeFilterLabel: 'Фильтр по типу',
      statusFilterLabel: 'Фильтр по публикации',
      typeAll: 'Все типы',
      typeToursOnly: 'Только туры',
      typeExcursionsOnly: 'Только экскурсии',
      typeTransfersOnly: 'Только трансферы',
      statusAll: 'Все статусы',
      statusPublished: 'На сайте',
      statusHidden: 'Скрыт',
    },

    table: {
      colPhoto: 'Фото',
      /** No "(RU)" qualifier any more: the column follows the interface language with a RU
       * fallback (ADR 021, решение 5). */
      colTitle: 'Заголовок',
      colType: 'Тип',
      colDays: 'Дней',
      colPublication: 'Публикация',
      colOrder: 'Порядок',
      colActions: 'Действия',
      published: 'На сайте',
      hidden: 'Скрыт',
      publish: 'Опубликовать',
      unpublish: 'Снять с публикации',
      feature: 'Добавить в избранное',
      unfeature: 'Убрать из избранного',
      archive: '🗄 В архив',
      removeFromFeatured: '✕ Убрать',
      restore: '↩ Восстановить',
    },

    deleteModal: {
      title: 'Удалить окончательно?',
      /** The confirmation sentence is split around the bolded product title, which stays its own
       * element in the markup. */
      lead: 'Позиция',
      tail: 'и все её данные (дни, переводы, изображения) будут удалены безвозвратно. Это действие нельзя отменить.',
      /** Quotation marks around that title — the Russian guillemets have no place in the English
       * sentence, so they follow the language like the rest of the copy. */
      quoteOpen: '«',
      quoteClose: '»',
      deleting: 'Удаление…',
    },

    empty: {
      title: 'Пока нет ни одной позиции',
      text: 'Создайте первый тур или экскурсию — они появятся здесь и на сайте.',
      featuredTitle: 'Ничего не отмечено',
      featuredText: (max: number) =>
        `Отметьте сердечком до ${max} туров на вкладке «Активные» — они появятся в секции «избранное» на главной странице сайта.`,
      archivedTitle: 'Архив пуст',
      archivedText:
        'Архивированные продукты появятся здесь. Отсюда их можно восстановить или удалить окончательно.',
    },
  },
  {
    title: 'Products',
    subtitle: 'All tours and excursions — search, filters, archive.',
    create: 'New product',
    noMatches: 'Nothing matches the selected filters.',

    action: {
      publish: 'publish it',
      unpublish: 'unpublish it',
      archive: 'archive it',
      restore: 'restore it',
      feature: 'add it to featured',
      unfeature: 'remove it from featured',
      reorder: 'change the order',
      deleteForever: 'delete it permanently',
    },
    errorTooManyFeatured: (max: number) =>
      `${max} tours are already featured — remove one from "Featured" first.`,
    errorServer: (action: string, status: number) =>
      `Could not ${action}: the server returned an error (${status}).`,
    errorNetwork: (action: string) => `Could not ${action}: check your connection and try again.`,

    toolbar: {
      tabActive: 'Active',
      tabFeatured: 'Featured',
      tabArchived: 'Archive',
      searchPlaceholder: 'Search by title (RU/EN)…',
      searchLabel: 'Search by title',
      typeFilterLabel: 'Filter by type',
      statusFilterLabel: 'Filter by publication',
      typeAll: 'All types',
      typeToursOnly: 'Tours only',
      typeExcursionsOnly: 'Excursions only',
      typeTransfersOnly: 'Transfers only',
      statusAll: 'All statuses',
      statusPublished: 'Live',
      statusHidden: 'Hidden',
    },

    table: {
      colPhoto: 'Photo',
      colTitle: 'Title',
      colType: 'Type',
      colDays: 'Days',
      colPublication: 'Publication',
      colOrder: 'Order',
      colActions: 'Actions',
      published: 'Live',
      hidden: 'Hidden',
      publish: 'Publish',
      unpublish: 'Unpublish',
      feature: 'Add to featured',
      unfeature: 'Remove from featured',
      archive: '🗄 Archive',
      removeFromFeatured: '✕ Remove',
      restore: '↩ Restore',
    },

    deleteModal: {
      title: 'Delete permanently?',
      lead: 'The item',
      tail: 'and all of its data (days, translations, images) will be deleted for good. This cannot be undone.',
      quoteOpen: '“',
      quoteClose: '”',
      deleting: 'Deleting…',
    },

    empty: {
      title: 'No items yet',
      text: 'Create your first tour or excursion — it will show up here and on the site.',
      featuredTitle: 'Nothing is featured',
      featuredText: (max: number) =>
        `Mark up to ${max} tours with a heart on the "Active" tab — they will appear in the "featured" section of the site's home page.`,
      archivedTitle: 'The archive is empty',
      archivedText:
        'Archived products show up here. From here they can be restored or deleted permanently.',
    },
  },
)
