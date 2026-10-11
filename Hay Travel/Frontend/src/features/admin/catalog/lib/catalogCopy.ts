/**
 * Interface text of the whole "Справочники" screen (ADR 021) — ONE module for all six tabs rather
 * than one per tab: since 2026-10-11 the tabs are six instances of the same editable table (shared
 * toolbar + draft + grid), so their strings differ only in the noun. Six copy modules would repeat
 * the `common` half six times and make a wording change a six-file edit.
 *
 * Sections mirror the folders: `common` (page, toolbar, grid), `places`, `expenseTemplates`,
 * `noteTemplates`, `tags`, `regions`, `vehicleClasses`.
 *
 * What is NOT here: toolbar button captions (`Отмена`/`Сохранить`/`Добавить`/`Удалить`) come from
 * `AdminToolbar`'s own `ui.toolbar.*` dictionary, tag colour captions from `adminEnumsCopy`. What the
 * admin TYPES — the catalog entries' own names and teasers — is content, stored in RU+EN by
 * `catalogMapper`, and is not translated by the interface locale.
 *
 * `ru` is deliberately not `as const` — see `shared/i18n/defineCopy.ts`.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import { TourNoteType } from '@/features/admin/lib/enums'

const ru = {
  common: {
    title: 'Справочники',
    subtitle:
      'Общие точки маршрута, доп. расходы, заметки и теги для туров, а также классы авто для трансферов.',
    tabsLabel: 'Разделы справочников',
    tabs: {
      places: 'Точки маршрута',
      expenses: 'Доп. расходы',
      notes: 'Заметки',
      regions: 'Регионы',
      tags: 'Теги',
      vehicleClasses: 'Классы авто',
    },
    /** Screen-reader text of the dot on a tab that holds unsaved edits. */
    tabHasChanges: 'есть несохранённые правки',
    searchByName: 'Поиск по названию…',
    changeCount: (count: number) =>
      `${count} ${pluralizeRu(count, ['изменение', 'изменения', 'изменений'])}`,
    noPermission: 'Недостаточно прав',
    colOrder: 'Порядок',
    colSelect: 'Выбор',
    colStatus: 'Состояние',
    colDetails: 'Подробности',
    colNameRu: 'Название RU',
    colNameEn: 'Название EN',
    selectAll: 'Выбрать все строки',
    selectRow: (name: string) => `Выбрать «${name}»`,
    statusNew: 'новая',
    statusChanged: 'изменено',
    statusDeleted: 'удалится',
    restore: 'Вернуть',
    restoreRow: (name: string) => `Вернуть «${name}»`,
    discard: 'Убрать',
    discardRow: (name: string) => `Убрать новую строку «${name}»`,
    details: 'Подробнее',
    showDetails: (name: string) => `Показать подробности: ${name}`,
    hideDetails: (name: string) => `Скрыть подробности: ${name}`,
    newRowFallback: 'Новая строка',
    requiredField: 'Обязательное поле.',
    emptyValue: '—',
    nothingFoundFor: (query: string) => `Ничего не найдено по «${query}».`,
    reorderDisabledBySearch: 'Изменение порядка недоступно во время поиска — очистите поле.',
    dragToReorder: (name: string) => `Перетащить «${name}», чтобы изменить порядок`,
    banners: {
      validation: (tabs: string) =>
        `Не сохранено: исправьте подсвеченные поля (${tabs}). Остальные правки ждут в черновике.`,
      partial: (count: number, tabs: string) =>
        `Сохранено не всё: ${count} ${pluralizeRu(count, ['строка не сохранилась', 'строки не сохранились', 'строк не сохранились'])} (${tabs}) — они подсвечены и остались в черновике. Остальные правки применены.`,
    },
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
    empty: 'Точек маршрута пока нет.',
    colSlug: 'Слаг',
    colRegion: 'Регион',
    colPhotos: 'Фото',
    sortableItem: 'Точка маршрута',
    slugHint: 'Уникальный, латиницей, напр. «garni-temple».',
    slugError: 'Укажите слаг.',
    regionPlaceholder: 'Выберите регион',
    /** Help of the region column when the role has no `catalog.regions` view right. */
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
      save: 'сохранить точку',
      add: 'добавить точку',
      delete: 'удалить точку',
    },
  },

  expenseTemplates: {
    empty: 'Доп. расходов пока нет.',
    sortableItem: 'Доп. расход',
    rowFallback: (id: number) => `расход №${id}`,
    actions: {
      save: 'сохранить расход',
      add: 'добавить расход',
      delete: 'удалить расход',
    },
  },

  noteTemplates: {
    empty: 'Заметок пока нет.',
    emptyOfType: 'Заметок этого типа пока нет.',
    colType: 'Тип',
    typeFilterLabel: 'Тип заметки',
    reorderDisabledByFilter: 'Изменение порядка недоступно во время фильтрации — сбросьте поиск и тип.',
    sortableItem: 'Заметка',
    rowFallback: (id: number) => `заметка №${id}`,
    /** Full captions — the `Тип` column's select. */
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
      save: 'сохранить заметку',
      add: 'добавить заметку',
      delete: 'удалить заметку',
    },
  },

  tags: {
    empty: 'Тегов пока нет.',
    sortableItem: 'Тег',
    rowFallback: (id: number) => `тег №${id}`,
    colColor: 'Цвет',
    colorGroupLabel: (name: string) => `Цвет тега «${name}»`,
    actions: {
      save: 'сохранить тег',
      add: 'добавить тег',
      delete: 'удалить тег',
    },
  },

  regions: {
    empty: 'Регионов нет.',
    notice:
      'Список регионов зафиксирован на бэкенде — добавление, переименование и удаление здесь недоступны. Редактируется только тизер (короткое описание под названием на карте).',
    colName: 'Название',
    colTours: 'Туров',
    teaserRu: 'Тизер (RU)',
    teaserEn: 'Тизер (EN)',
    actions: {
      save: 'сохранить тизер региона',
    },
  },

  vehicleClasses: {
    empty: 'Классов авто пока нет.',
    sortableItem: 'Класс авто',
    /** Тексту API-ошибки 2010 нужна своя формулировка — общий `common.errors.inUse` говорит
     * «используется в турах», что для класса авто звучит неточно (он привязан к трансферу/заказу,
     * не к турам вообще). */
    deleteInUseError:
      'Этот класс авто используется в трансферах или заказах — сначала уберите его оттуда, затем удалите.',
    rowFallback: (id: number) => `класс №${id}`,
    colCapacity: 'Мест',
    capacityHint: 'Вместимость в пассажирах, без учёта водителя.',
    capacityError: 'Минимум 1 пассажир.',
    colLuggage: 'Багаж, ед.',
    luggageCapacityHint: 'Лимит багажа в единицах: средний чемодан = 3 единицы, большой чемодан = 5 единиц.',
    luggageCapacityError: '0 или больше.',
    colActive: 'Активен',
    activeHint: 'Только активные классы доступны для выбора в трансферах. Неактивный класс не удаляется.',
    actions: {
      save: 'сохранить класс авто',
      add: 'добавить класс авто',
      delete: 'удалить класс авто',
    },
  },
}

export const catalogCopy = defineCopy(ru, {
  common: {
    title: 'Reference data',
    subtitle:
      'Shared route points, extra expenses, notes and tags for tours, plus vehicle classes for transfers.',
    tabsLabel: 'Reference data sections',
    tabs: {
      places: 'Route points',
      expenses: 'Extra expenses',
      notes: 'Notes',
      regions: 'Regions',
      tags: 'Tags',
      vehicleClasses: 'Vehicle classes',
    },
    tabHasChanges: 'has unsaved edits',
    searchByName: 'Search by name…',
    changeCount: (count: number) => `${count} ${pluralizeEn(count, ['change', 'changes'])}`,
    noPermission: 'Not enough permissions',
    colOrder: 'Order',
    colSelect: 'Select',
    colStatus: 'Status',
    colDetails: 'Details',
    colNameRu: 'Name RU',
    colNameEn: 'Name EN',
    selectAll: 'Select all rows',
    selectRow: (name: string) => `Select “${name}”`,
    statusNew: 'new',
    statusChanged: 'changed',
    statusDeleted: 'will be deleted',
    restore: 'Restore',
    restoreRow: (name: string) => `Restore “${name}”`,
    discard: 'Remove',
    discardRow: (name: string) => `Remove the new row “${name}”`,
    details: 'Details',
    showDetails: (name: string) => `Show details: ${name}`,
    hideDetails: (name: string) => `Hide details: ${name}`,
    newRowFallback: 'New row',
    requiredField: 'This field is required.',
    emptyValue: '—',
    nothingFoundFor: (query: string) => `Nothing found for “${query}”.`,
    reorderDisabledBySearch: 'Reordering is unavailable while searching — clear the field.',
    dragToReorder: (name: string) => `Drag “${name}” to change the order`,
    banners: {
      validation: (tabs: string) =>
        `Not saved: fix the highlighted fields (${tabs}). Your other edits are still in the draft.`,
      partial: (count: number, tabs: string) =>
        `Not everything was saved: ${count} ${pluralizeEn(count, ['row', 'rows'])} failed (${tabs}) — they are highlighted and kept in the draft. All other edits were applied.`,
    },
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
    empty: 'No route points yet.',
    colSlug: 'Slug',
    colRegion: 'Region',
    colPhotos: 'Photos',
    sortableItem: 'Route point',
    slugHint: 'Unique, Latin letters, e.g. “garni-temple”.',
    slugError: 'Enter a slug.',
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
      save: 'save the route point',
      add: 'add the route point',
      delete: 'delete the route point',
    },
  },

  expenseTemplates: {
    empty: 'No extra expenses yet.',
    sortableItem: 'Extra expense',
    rowFallback: (id: number) => `expense #${id}`,
    actions: {
      save: 'save the expense',
      add: 'add the expense',
      delete: 'delete the expense',
    },
  },

  noteTemplates: {
    empty: 'No notes yet.',
    emptyOfType: 'No notes of this type yet.',
    colType: 'Type',
    typeFilterLabel: 'Note type',
    reorderDisabledByFilter: 'Reordering is unavailable while filtering — clear the search and the type.',
    sortableItem: 'Note',
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
      save: 'save the note',
      add: 'add the note',
      delete: 'delete the note',
    },
  },

  tags: {
    empty: 'No tags yet.',
    sortableItem: 'Tag',
    rowFallback: (id: number) => `tag #${id}`,
    colColor: 'Colour',
    colorGroupLabel: (name: string) => `Colour of the tag “${name}”`,
    actions: {
      save: 'save the tag',
      add: 'add the tag',
      delete: 'delete the tag',
    },
  },

  regions: {
    empty: 'No regions.',
    notice:
      'The list of regions is fixed on the backend — adding, renaming and deleting are not available here. Only the teaser (the short description under the name on the map) is editable.',
    colName: 'Name',
    colTours: 'Tours',
    teaserRu: 'Teaser (RU)',
    teaserEn: 'Teaser (EN)',
    actions: {
      save: 'save the region teaser',
    },
  },

  vehicleClasses: {
    empty: 'No vehicle classes yet.',
    sortableItem: 'Vehicle class',
    deleteInUseError:
      'This vehicle class is used in transfers or orders — remove it from them first, then delete it.',
    rowFallback: (id: number) => `vehicle class #${id}`,
    colCapacity: 'Seats',
    capacityHint: 'Passenger capacity, not counting the driver.',
    capacityError: 'At least 1 passenger.',
    colLuggage: 'Luggage, units',
    luggageCapacityHint: 'Luggage limit in units: a medium suitcase = 3 units, a large suitcase = 5 units.',
    luggageCapacityError: '0 or more.',
    colActive: 'Active',
    activeHint: 'Only active classes can be picked for transfers. An inactive class is not deleted.',
    actions: {
      save: 'save the vehicle class',
      add: 'add the vehicle class',
      delete: 'delete the vehicle class',
    },
  },
})

export type CatalogCopy = ReturnType<typeof catalogCopy>
