import { defineCopy } from '@/shared/i18n/defineCopy'

/**
 * Text of the dashboard — its header, the four summary counters and the recent-products preview
 * (ADR 021).
 *
 * `stats.missingEn` is the CAPTION of the counter only: what it counts (tours with no English
 * title row) is data logic in `StatCards` and does not follow the interface language.
 *
 * The `ru` object is deliberately not `as const` — see `shared/i18n/defineCopy.ts`.
 */
export const dashboardCopy = defineCopy(
  {
    title: 'Дашборд',
    subtitle: 'Обзор: сводка по всем турам и экскурсиям агентства.',

    stats: {
      total: 'Всего позиций',
      tours: 'Туров',
      excursions: 'Экскурсий',
      missingEn: 'Без EN-перевода',
    },

    emptyTitle: 'Пока нет ни одной позиции',
    emptyText: 'Создайте первый продукт на странице «Продукты» — он появится здесь и на сайте.',
    emptyLink: 'Перейти в «Продукты» →',

    recentTitle: 'Недавние продукты',
    allProducts: 'Все продукты →',
    published: 'На сайте',
    hidden: 'Скрыт',
  },
  {
    title: 'Dashboard',
    subtitle: 'Overview: a summary of every tour and excursion of the agency.',

    stats: {
      total: 'Items total',
      tours: 'Tours',
      excursions: 'Excursions',
      missingEn: 'No EN translation',
    },

    emptyTitle: 'No items yet',
    emptyText: 'Create your first product on the "Products" page — it will show up here and on the site.',
    emptyLink: 'Go to "Products" →',

    recentTitle: 'Recent products',
    allProducts: 'All products →',
    published: 'Live',
    hidden: 'Hidden',
  },
)
