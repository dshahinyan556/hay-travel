import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'

/**
 * Text of the products list — the page header, the view chips, the filters, the rows of each view,
 * the featured-order draft, the archive bulk actions and the permanent-delete confirmation
 * (ADR 021).
 *
 * Generic verbs the whole panel repeats («Отмена», «Удалить») are NOT duplicated here: call sites
 * read them from `features/admin/lib/adminCommonCopy.ts` (and the toolbar's own from the shared
 * dictionary). Tour-type captions come from `adminEnumsCopy` — except the TYPE FILTER options
 * below, which are prose around the enum («Только туры»): Russian needs a plural accusative that
 * cannot be derived from the singular «Тур» the enum copy holds. The row's format caption is prose
 * too («инд. + групповой» — a compact list label, not the enum's «Оба»).
 *
 * The `ru` object is deliberately not `as const` — see `shared/i18n/defineCopy.ts`.
 */
export const productsCopy = defineCopy(
  {
    title: 'Продукты',
    subtitle: 'Туры, экскурсии и трансферы. Нажмите на строку, чтобы открыть карточку продукта.',
    create: 'Создать продукт',
    /** Tooltip on a locked action — same wording as the orders screen's. */
    noPermissionHint: 'Недостаточно прав',
    noMatches: 'Ничего не найдено по заданным фильтрам.',
    productsUnit: (count: number) =>
      `${count} ${pluralizeRu(count, ['продукт', 'продукта', 'продуктов'])}`,

    views: {
      label: 'Вид списка продуктов',
      active: 'Активные',
      featured: 'Избранные',
      archived: 'Архив',
    },

    filters: {
      searchPlaceholder: 'Поиск по названию (RU/EN)…',
      searchLabel: 'Поиск по названию',
      typeFilterLabel: 'Фильтр по типу',
      statusFilterLabel: 'Фильтр по публикации',
      typeAll: 'Все типы',
      typeToursOnly: 'Только туры',
      typeExcursionsOnly: 'Только экскурсии',
      typeTransfersOnly: 'Только трансферы',
      statusAll: 'Любая публикация',
      statusPublished: 'Опубликованные',
      statusHidden: 'Скрытые',
    },

    row: {
      published: 'Опубликован',
      hidden: 'Скрыт',
      featured: 'Избранное',
      days: (count: number) => `${count} ${pluralizeRu(count, ['день', 'дня', 'дней'])}`,
      startTimes: (times: string) => `старт ${times}`,
      formatIndividual: 'индивидуальный',
      formatGroup: 'групповой',
      formatBoth: 'инд. + групповой',
      vehicleClasses: (count: number) =>
        `${count} ${pluralizeRu(count, ['класс', 'класса', 'классов'])} авто`,
      priceFrom: (price: string) => `от ${price}`,
      pricePerPerson: (price: string) => `${price} / чел.`,
      noPrice: 'Цена не задана',
    },

    /** Row «⋮» menu of the «Активные» view — immediate actions, each one request, no draft. */
    menu: {
      label: (title: string) => `Действия: ${title}`,
      publish: 'Опубликовать',
      unpublish: 'Снять с публикации',
      feature: 'Добавить в избранное',
      unfeature: 'Убрать из избранного',
      archive: 'В архив',
      deleteForever: 'Удалить навсегда',
      actionPublish: 'опубликовать продукт',
      actionUnpublish: 'снять продукт с публикации',
      actionFeature: 'добавить продукт в избранное',
      actionUnfeature: 'убрать продукт из избранного',
      actionArchive: 'перенести продукт в архив',
      tooManyFeatured: (max: number) => `В «Избранном» уже ${max} продуктов — уберите один на вкладке «Избранные», затем добавьте этот.`,
      hasOrders: 'Продукт нельзя удалить навсегда: по нему есть заказы. Перенесите его в архив.',
    },

    featured: {
      lead: 'Порядок, в котором продукты стоят в блоке «Избранное» на главной',
      ofMax: (count: number, max: number) => `${count} из ${max}`,
      /** The server counts archived featured products towards the limit (archiving does not clear
       * the flag), but they are not shown here and not on the site. */
      archivedNote: (count: number) => `в т.ч. ${count} в архиве — на сайте не показываются`,
      changes: (count: number) =>
        `${count} ${pluralizeRu(count, ['изменение', 'изменения', 'изменений'])}`,
      moved: 'перемещён',
      removed: 'уберётся',
      remove: (title: string) => `Убрать «${title}» из избранного`,
      undo: 'Вернуть',
      undoLabel: (title: string) => `Вернуть «${title}» в избранное`,
      drag: (title: string) => `Перетащить «${title}», чтобы изменить порядок`,
      itemLabel: 'Продукт',
      switchTitle: 'Переключить вид без сохранения?',
      switchMessage:
        'Порядок и состав «Избранного» изменены, но не сохранены. Если переключить вид, эти правки пропадут.',
      switchConfirm: 'Переключить',
    },

    archive: {
      selectAll: 'Выбрать все',
      select: (title: string) => `Выбрать «${title}»`,
      selected: (count: number) => `Выбрано: ${count}`,
      restore: 'Восстановить',
      deleteForever: 'Удалить навсегда',
    },

    /** Names of the mutations, substituted into `errorServer`/`errorNetwork`. Kept as a group
     * so no call site has to spell an action out inline. */
    action: {
      restore: 'восстановить',
      deleteForever: 'удалить окончательно',
      saveFeatured: 'сохранить «Избранное»',
    },
    errorServer: (action: string, status: number) =>
      `Не удалось ${action}: сервер вернул ошибку (${status}).`,
    errorNetwork: (action: string) =>
      `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
    /** Appended when a bulk action failed only for part of the selection. */
    errorPartial: (failed: number, total: number) => `Не выполнено для ${failed} из ${total}.`,

    deleteModal: {
      title: 'Удалить окончательно?',
      /** The confirmation sentence is split around the bolded product title, which stays its own
       * element in the markup. */
      lead: 'Позиция',
      tail: 'и все её данные (дни, переводы, изображения) будут удалены безвозвратно. Это действие нельзя отменить.',
      /** Several products at once — no titles listed, the count is what the admin confirms. */
      many: (count: number) =>
        `${count} ${pluralizeRu(count, ['продукт', 'продукта', 'продуктов'])} и все их данные (дни, переводы, изображения) будут удалены безвозвратно. Это действие нельзя отменить.`,
      /** Quotation marks around that title — the Russian guillemets have no place in the English
       * sentence, so they follow the language like the rest of the copy. */
      quoteOpen: '«',
      quoteClose: '»',
      confirm: 'Удалить навсегда',
      deleting: 'Удаление…',
    },

    empty: {
      title: 'Пока нет ни одной позиции',
      text: 'Создайте первый тур, экскурсию или трансфер — они появятся здесь и на сайте.',
      featuredTitle: 'Ничего не отмечено',
      featuredText: (max: number) =>
        `Отметьте «Показывать в избранном» в карточке продукта (до ${max} продуктов) — они появятся в блоке «Избранное» на главной странице сайта.`,
      archivedTitle: 'Архив пуст',
      archivedText:
        'Архивированные продукты появятся здесь. Отсюда их можно восстановить или удалить окончательно.',
    },
  },
  {
    title: 'Products',
    subtitle: 'Tours, excursions and transfers. Click a row to open the product card.',
    create: 'New product',
    noPermissionHint: 'Not enough permissions',
    noMatches: 'Nothing matches the selected filters.',
    productsUnit: (count: number) => `${count} ${pluralizeEn(count, ['product', 'products'])}`,

    views: {
      label: 'Products list view',
      active: 'Active',
      featured: 'Featured',
      archived: 'Archive',
    },

    filters: {
      searchPlaceholder: 'Search by title (RU/EN)…',
      searchLabel: 'Search by title',
      typeFilterLabel: 'Filter by type',
      statusFilterLabel: 'Filter by publication',
      typeAll: 'All types',
      typeToursOnly: 'Tours only',
      typeExcursionsOnly: 'Excursions only',
      typeTransfersOnly: 'Transfers only',
      statusAll: 'Any publication',
      statusPublished: 'Published',
      statusHidden: 'Hidden',
    },

    row: {
      published: 'Published',
      hidden: 'Hidden',
      featured: 'Featured',
      days: (count: number) => `${count} ${pluralizeEn(count, ['day', 'days'])}`,
      startTimes: (times: string) => `starts ${times}`,
      formatIndividual: 'individual',
      formatGroup: 'group',
      formatBoth: 'individual + group',
      vehicleClasses: (count: number) =>
        `${count} vehicle ${pluralizeEn(count, ['class', 'classes'])}`,
      priceFrom: (price: string) => `from ${price}`,
      pricePerPerson: (price: string) => `${price} / person`,
      noPrice: 'No price set',
    },

    menu: {
      label: (title: string) => `Actions: ${title}`,
      publish: 'Publish',
      unpublish: 'Unpublish',
      feature: 'Add to featured',
      unfeature: 'Remove from featured',
      archive: 'Archive',
      deleteForever: 'Delete permanently',
      actionPublish: 'publish the product',
      actionUnpublish: 'unpublish the product',
      actionFeature: 'add the product to featured',
      actionUnfeature: 'remove the product from featured',
      actionArchive: 'archive the product',
      tooManyFeatured: (max: number) => `"Featured" already holds ${max} products — remove one on the "Featured" tab, then add this one.`,
      hasOrders: 'This product has orders and cannot be deleted permanently. Archive it instead.',
    },

    featured: {
      lead: 'The order in which products appear in the "Featured" block on the home page',
      ofMax: (count: number, max: number) => `${count} of ${max}`,
      archivedNote: (count: number) => `incl. ${count} archived — not shown on the site`,
      changes: (count: number) => `${count} ${pluralizeEn(count, ['change', 'changes'])}`,
      moved: 'moved',
      removed: 'will be removed',
      remove: (title: string) => `Remove “${title}” from featured`,
      undo: 'Undo',
      undoLabel: (title: string) => `Put “${title}” back into featured`,
      drag: (title: string) => `Drag “${title}” to reorder`,
      itemLabel: 'Product',
      switchTitle: 'Switch the view without saving?',
      switchMessage:
        'The order and contents of "Featured" were changed but not saved. If you switch the view, these edits will be lost.',
      switchConfirm: 'Switch',
    },

    archive: {
      selectAll: 'Select all',
      select: (title: string) => `Select “${title}”`,
      selected: (count: number) => `Selected: ${count}`,
      restore: 'Restore',
      deleteForever: 'Delete forever',
    },

    action: {
      restore: 'restore it',
      deleteForever: 'delete it permanently',
      saveFeatured: 'save "Featured"',
    },
    errorServer: (action: string, status: number) =>
      `Could not ${action}: the server returned an error (${status}).`,
    errorNetwork: (action: string) => `Could not ${action}: check your connection and try again.`,
    errorPartial: (failed: number, total: number) => `Failed for ${failed} of ${total}.`,

    deleteModal: {
      title: 'Delete permanently?',
      lead: 'The item',
      tail: 'and all of its data (days, translations, images) will be deleted for good. This cannot be undone.',
      many: (count: number) =>
        `${count} ${pluralizeEn(count, ['product', 'products'])} and all of their data (days, translations, images) will be deleted for good. This cannot be undone.`,
      quoteOpen: '“',
      quoteClose: '”',
      confirm: 'Delete forever',
      deleting: 'Deleting…',
    },

    empty: {
      title: 'No items yet',
      text: 'Create your first tour, excursion or transfer — it will show up here and on the site.',
      featuredTitle: 'Nothing is featured',
      featuredText: (max: number) =>
        `Tick "Show in featured" on a product card (up to ${max} products) — they will appear in the "Featured" block on the site's home page.`,
      archivedTitle: 'The archive is empty',
      archivedText:
        'Archived products show up here. From here they can be restored or deleted permanently.',
    },
  },
)

export type ProductsCopy = ReturnType<typeof productsCopy>
