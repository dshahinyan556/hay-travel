/**
 * Interface text of the whole "Справочники" screen (ADR 021) — ONE module for all five tabs
 * rather than one per tab: the tabs are five instances of the same shell (search box + sortable
 * table + side panel form + delete confirmation), so their strings differ only in the noun. Five
 * copy modules would repeat the `common` half five times and make a wording change a five-file
 * edit.
 *
 * Sections mirror the folders: `common` (the shell), `places`, `expenseTemplates`,
 * `noteTemplates`, `tags`, `regions`.
 *
 * What is NOT here: generic verbs (`Сохранить`, `Отмена`, `Добавить`, `Изменить`, `Удалить`) come
 * from `adminCommonCopy`, and tag colour captions from `adminEnumsCopy`. What the admin TYPES —
 * the catalog entries' own names and teasers — is content, stored in RU+EN by `catalogMapper`,
 * and is not translated by the interface locale.
 *
 * `ru` is deliberately not `as const` — see `shared/i18n/defineCopy.ts`.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import { TourNoteType } from '@/features/admin/lib/enums'

const ru = {
  common: {
    title: 'Справочники',
    subtitle: 'Общие точки маршрута, доп. расходы, заметки и теги, которые можно подставлять в туры.',
    tabsLabel: 'Разделы справочников',
    tabs: {
      places: 'Точки маршрута',
      expenses: 'Доп. расходы',
      notes: 'Заметки',
      regions: 'Регионы',
      tags: 'Теги',
    },
    searchByName: 'Поиск по названию…',
    colOrder: 'Порядок',
    colName: 'Название',
    nameField: 'Название',
    requiredField: 'Обязательное поле.',
    savingButton: 'Сохранение…',
    deletingButton: 'Удаление…',
    emptyValue: '—',
    nothingFoundFor: (query: string) => `Ничего не найдено по «${query}».`,
    reorderDisabledBySearch: 'Изменение порядка недоступно во время поиска — очистите поле.',
    dragToReorder: (name: string) => `Перетащить «${name}», чтобы изменить порядок`,
    errors: {
      inUse: 'Эта запись используется в турах — сначала уберите её оттуда, затем удалите.',
      invalidData: (action: string) =>
        `Не удалось ${action}: проверьте введённые данные (например, уникальность значения).`,
      server: (action: string, status: number) => `Не удалось ${action}: сервер вернул ошибку (${status}).`,
      network: (action: string) => `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
    },
  },

  places: {
    searchPlaceholder: 'Поиск по названию, слагу, региону…',
    addButton: 'Добавить точку',
    empty: 'Точек маршрута пока нет.',
    colSlug: 'Слаг',
    colRegion: 'Регион',
    sortableItem: 'Точка маршрута',
    panelEdit: 'Точка маршрута',
    panelCreate: 'Новая точка маршрута',
    deleteTitle: 'Удалить точку?',
    deleteBefore: 'Точка «',
    deleteAfter: '» будет удалена безвозвратно. Если она используется в турах, сначала уберите её оттуда.',
    slugLabel: 'Слаг',
    slugHint: 'Уникальный, латиницей, напр. «garni-temple».',
    slugError: 'Укажите слаг.',
    regionLabel: 'Регион',
    regionPlaceholder: 'Выберите регион',
    /** Shown under a disabled region picker: the role has no `catalog.regions` view right. */
    regionsUnavailableHint:
      'Список регионов недоступен вашей роли — попросите администратора выдать право на просмотр справочника регионов.',
    regionError: 'Выберите регион.',
    latitudeLabel: 'Широта',
    longitudeLabel: 'Долгота',
    optionalHint: 'Необязательно.',
    coverLabel: 'Обложка — URL',
    coverHint: 'Необязательно. Используется, пока у точки нет фотографий ниже.',
    photosLabel: 'Фотографии',
    photosHint:
      'Добавляются в галерею дня автоматически, когда эта точка выбрана из справочника в маршруте (не для точек, введённых свободным текстом).',
    actions: {
      reorder: 'изменить порядок точек',
      save: 'сохранить точку',
      add: 'добавить точку',
      delete: 'удалить точку',
    },
  },

  expenseTemplates: {
    addButton: 'Добавить расход',
    empty: 'Доп. расходов пока нет.',
    sortableItem: 'Доп. расход',
    panelEdit: 'Доп. расход',
    panelCreate: 'Новый доп. расход',
    deleteTitle: 'Удалить расход?',
    deleteBefore: 'Расход «',
    deleteAfter: '» будет удалён безвозвратно. Если он используется в турах, сначала уберите его оттуда.',
    rowFallback: (id: number) => `расход №${id}`,
    actions: {
      reorder: 'изменить порядок расходов',
      save: 'сохранить расход',
      add: 'добавить расход',
      delete: 'удалить расход',
    },
  },

  noteTemplates: {
    addButton: 'Добавить заметку',
    empty: 'Заметок пока нет.',
    emptyOfType: 'Заметок этого типа пока нет.',
    colType: 'Тип',
    typeField: 'Тип',
    typeFilterLabel: 'Тип заметки',
    reorderDisabledByFilter: 'Изменение порядка недоступно во время фильтрации — сбросьте поиск и тип.',
    sortableItem: 'Заметка',
    panelEdit: 'Заметка',
    panelCreate: 'Новая заметка',
    deleteTitle: 'Удалить заметку?',
    deleteBefore: 'Заметка «',
    deleteAfter: '» будет удалена безвозвратно. Если она используется в турах, сначала уберите её оттуда.',
    rowFallback: (id: number) => `заметку №${id}`,
    /** Full captions — the `Тип` column and the form's select. */
    typeLabels: {
      [TourNoteType.OrganizationalDetail]: 'Организационная деталь',
      [TourNoteType.Restriction]: 'Ограничение',
      [TourNoteType.Included]: 'Включено',
      [TourNoteType.NotIncluded]: 'Не включено',
    } as Record<number, string>,
    /** Short captions — the filter pills have to fit five in a row on a 375px viewport. */
    filterAll: 'Все',
    filterOrganizational: 'Орг. детали',
    filterRestriction: 'Ограничения',
    filterIncluded: 'Включено',
    filterNotIncluded: 'Не включено',
    actions: {
      reorder: 'изменить порядок заметок',
      save: 'сохранить заметку',
      add: 'добавить заметку',
      delete: 'удалить заметку',
    },
  },

  tags: {
    addButton: 'Добавить тег',
    empty: 'Тегов пока нет.',
    sortableItem: 'Тег',
    panelEdit: 'Тег',
    panelCreate: 'Новый тег',
    deleteTitle: 'Удалить тег?',
    deleteBefore: 'Тег «',
    deleteAfter: '» будет удалён безвозвратно. Если он назначен турам, сначала уберите его оттуда.',
    rowFallback: (id: number) => `тег №${id}`,
    colorLabel: 'Цвет',
    colorGroupLabel: 'Цвет тега',
    actions: {
      reorder: 'изменить порядок тегов',
      save: 'сохранить тег',
      add: 'добавить тег',
      delete: 'удалить тег',
    },
  },

  regions: {
    notice:
      'Список регионов зафиксирован на бэкенде — добавление, переименование и удаление здесь недоступны. Редактируется только тизер (короткое описание под названием на карте).',
    tourCount: (count: number) => `${count} ${pluralizeRu(count, ['тур', 'тура', 'туров'])}`,
    teaserRu: 'Тизер (RU)',
    teaserEn: 'Тизер (EN)',
    saveServerError: (status: number) => `Не удалось сохранить: сервер вернул ошибку (${status}).`,
    saveNetworkError: 'Не удалось сохранить: проверьте соединение и попробуйте ещё раз.',
  },
}

export const catalogCopy = defineCopy(ru, {
  common: {
    title: 'Reference data',
    subtitle: 'Shared route points, extra expenses, notes and tags you can drop into any tour.',
    tabsLabel: 'Reference data sections',
    tabs: {
      places: 'Route points',
      expenses: 'Extra expenses',
      notes: 'Notes',
      regions: 'Regions',
      tags: 'Tags',
    },
    searchByName: 'Search by name…',
    colOrder: 'Order',
    colName: 'Name',
    nameField: 'Name',
    requiredField: 'This field is required.',
    savingButton: 'Saving…',
    deletingButton: 'Deleting…',
    emptyValue: '—',
    nothingFoundFor: (query: string) => `Nothing found for “${query}”.`,
    reorderDisabledBySearch: 'Reordering is unavailable while searching — clear the field.',
    dragToReorder: (name: string) => `Drag “${name}” to change the order`,
    errors: {
      inUse: 'This entry is used by tours — remove it from them first, then delete it.',
      invalidData: (action: string) =>
        `Could not ${action}: check the values you entered (a value may need to be unique).`,
      server: (action: string, status: number) => `Could not ${action}: the server returned an error (${status}).`,
      network: (action: string) => `Could not ${action}: check your connection and try again.`,
    },
  },

  places: {
    searchPlaceholder: 'Search by name, slug or region…',
    addButton: 'Add route point',
    empty: 'No route points yet.',
    colSlug: 'Slug',
    colRegion: 'Region',
    sortableItem: 'Route point',
    panelEdit: 'Route point',
    panelCreate: 'New route point',
    deleteTitle: 'Delete route point?',
    deleteBefore: 'The route point “',
    deleteAfter: '” will be deleted permanently. If it is used in tours, remove it from them first.',
    slugLabel: 'Slug',
    slugHint: 'Unique, Latin letters, e.g. “garni-temple”.',
    slugError: 'Enter a slug.',
    regionLabel: 'Region',
    regionPlaceholder: 'Select a region',
    regionsUnavailableHint:
      'The region list is not available to your role — ask an administrator to grant view access to the regions reference.',
    regionError: 'Select a region.',
    latitudeLabel: 'Latitude',
    longitudeLabel: 'Longitude',
    optionalHint: 'Optional.',
    coverLabel: 'Cover image — URL',
    coverHint: 'Optional. Used while the route point has no photos below.',
    photosLabel: 'Photos',
    photosHint:
      'Added to the day gallery automatically when this point is picked from the catalog in an itinerary (not for points typed in as free text).',
    actions: {
      reorder: 'reorder route points',
      save: 'save the route point',
      add: 'add the route point',
      delete: 'delete the route point',
    },
  },

  expenseTemplates: {
    addButton: 'Add expense',
    empty: 'No extra expenses yet.',
    sortableItem: 'Extra expense',
    panelEdit: 'Extra expense',
    panelCreate: 'New extra expense',
    deleteTitle: 'Delete expense?',
    deleteBefore: 'The expense “',
    deleteAfter: '” will be deleted permanently. If it is used in tours, remove it from them first.',
    rowFallback: (id: number) => `expense #${id}`,
    actions: {
      reorder: 'reorder extra expenses',
      save: 'save the expense',
      add: 'add the expense',
      delete: 'delete the expense',
    },
  },

  noteTemplates: {
    addButton: 'Add note',
    empty: 'No notes yet.',
    emptyOfType: 'No notes of this type yet.',
    colType: 'Type',
    typeField: 'Type',
    typeFilterLabel: 'Note type',
    reorderDisabledByFilter: 'Reordering is unavailable while filtering — clear the search and the type.',
    sortableItem: 'Note',
    panelEdit: 'Note',
    panelCreate: 'New note',
    deleteTitle: 'Delete note?',
    deleteBefore: 'The note “',
    deleteAfter: '” will be deleted permanently. If it is used in tours, remove it from them first.',
    rowFallback: (id: number) => `note #${id}`,
    typeLabels: {
      [TourNoteType.OrganizationalDetail]: 'Organisational detail',
      [TourNoteType.Restriction]: 'Restriction',
      [TourNoteType.Included]: 'Included',
      [TourNoteType.NotIncluded]: 'Not included',
    } as Record<number, string>,
    filterAll: 'All',
    filterOrganizational: 'Org. details',
    filterRestriction: 'Restrictions',
    filterIncluded: 'Included',
    filterNotIncluded: 'Not included',
    actions: {
      reorder: 'reorder notes',
      save: 'save the note',
      add: 'add the note',
      delete: 'delete the note',
    },
  },

  tags: {
    addButton: 'Add tag',
    empty: 'No tags yet.',
    sortableItem: 'Tag',
    panelEdit: 'Tag',
    panelCreate: 'New tag',
    deleteTitle: 'Delete tag?',
    deleteBefore: 'The tag “',
    deleteAfter: '” will be deleted permanently. If it is assigned to tours, remove it from them first.',
    rowFallback: (id: number) => `tag #${id}`,
    colorLabel: 'Colour',
    colorGroupLabel: 'Tag colour',
    actions: {
      reorder: 'reorder tags',
      save: 'save the tag',
      add: 'add the tag',
      delete: 'delete the tag',
    },
  },

  regions: {
    notice:
      'The list of regions is fixed on the backend — adding, renaming and deleting are not available here. Only the teaser (the short description under the name on the map) is editable.',
    tourCount: (count: number) => `${count} ${pluralizeEn(count, ['tour', 'tours'])}`,
    teaserRu: 'Teaser (RU)',
    teaserEn: 'Teaser (EN)',
    saveServerError: (status: number) => `Could not save: the server returned an error (${status}).`,
    saveNetworkError: 'Could not save: check your connection and try again.',
  },
})

export type CatalogCopy = ReturnType<typeof catalogCopy>
