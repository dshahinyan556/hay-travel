import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import type { Localized } from '@/features/admin/types/form'

/**
 * All interface text of the tour/excursion form (ADR 021).
 *
 * Grouped by the screen area that owns it rather than by component, because several components
 * render the same section from different angles — the route-point editor is used both by a Tour's
 * day accordion and by an Excursion's flat single day, and the price/day labels are shared by the
 * header, the day card and the validation messages.
 *
 * NOT here: the tour's own content (titles, descriptions, route-point texts). That is bilingual
 * DATA the admin types in RU and EN at the same time — `TranslationGroup`/`LocalizedListEditor`
 * always render both language columns regardless of the interface language, and their `'ru'`/`'en'`
 * keys are `LangKey`s, not locales. Only the columns' CAPTIONS follow the interface language, and
 * those live in `features/admin/ui/adminUiCopy.ts`.
 *
 * Type captions for `TourType` are not duplicated here either — they come from
 * `features/admin/lib/adminEnumsCopy.ts`.
 */
export const tourFormCopy = defineCopy(
  {
    /** Reads the interface-language side of a bilingual content value, falling back to the other
     * language when it is untranslated (ADR 021, decision 5). Used for region/tag/place names the
     * admin picks from — the panel shows them in ITS language when the data has one. */
    localizedName: (value: Localized) => value.ru || value.en,

    page: {
      breadcrumbs: 'Хлебные крошки',
      products: 'Продукты',
      createTour: 'Создать тур',
      createExcursion: 'Создать экскурсию',
      editTour: 'Редактировать тур',
      editExcursion: 'Редактировать экскурсию',
    },

    header: {
      type: 'Тип позиции',
      typeLocked: 'Тип нельзя изменить после создания',
      price: 'Цена, ֏',
      totalCaption: 'Цена · сумма дней',
      mainImage: 'Главная картинка — URL',
      title: 'Заголовок',
      shortDescription: 'Краткое описание',
      description: 'Описание',
      duration: 'Длительность',
      publication: 'Публикация',
      isActive: 'Активен — виден на сайте',
      payment: 'Оплата',
      requiresPrepayment: 'Требуется предоплата',
      discount: 'Скидка',
      discountPercent: 'Размер, %',
      discountStartDate: 'Дата начала',
      discountValidUntil: 'Действует до',
      discountHint:
        'Скидка действует с даты начала по дату окончания включительно. После даты окончания она перестаёт применяться сама — снимать вручную не нужно.',
    },

    regions: {
      label: 'Регионы',
      empty: 'Список регионов пуст.',
    },

    tags: {
      label: 'Теги',
      empty: 'Тегов пока нет — добавьте их в «Справочники → Теги».',
      /** Shown when a tag has no name in either language — never expected, but a blank checkbox
       * would be unclickable in practice. */
      fallback: (id: number) => `тег №${id}`,
      limitReached: (max: number) =>
        `На товаре уже ${max} тега — сначала уберите один, чтобы добавить новый.`,
    },

    tabs: {
      label: 'Разделы тура',
      days: 'Дни',
      org: 'Организационные детали',
      restrictions: 'Ограничения',
      included: 'Включено',
      notIncluded: 'Не включено',
      expenses: 'Доп. расходы',
    },

    days: {
      /** `itemLabel` of the day `SortableList` — used in the drag announcements. */
      item: 'День',
      /** Fallback summary title of a day whose own title is still empty. Also the day sub-label
       * in the "fill from another product" picker (`tourMapper.toursToDaySources`). */
      label: (index: number) => `День ${index}`,
      add: 'Добавить день',
      drag: (index: number) => `Перетащить день ${index}, чтобы изменить порядок`,
      remove: (index: number) => `Удалить день ${index}`,
      hasError: '⚠ проверьте день',
      images: (count: number) => `${count} ${pluralizeRu(count, ['картинка', 'картинки', 'картинок'])}`,
      price: 'Цена дня, ֏',
      gallery: 'Галерея дня',
    },

    /** The excursion's single day is rendered flat under the header — same sections as a day
     * card, minus the accordion chrome, so it needs its own wording for two labels. */
    excursion: {
      gallery: 'Галерея',
    },

    routePoints: {
      title: 'Точки маршрута',
      hintDay: 'Порядок точек соответствует маршруту дня.',
      hintExcursion: 'Порядок точек соответствует маршруту экскурсии.',
      empty: 'Точек маршрута пока нет.',
      add: 'Добавить точку',
      /** Accusative singular — goes into "Удалить точку" / "Перетащить точку 2…". */
      noun: 'точку',
      /** Nominative singular — the drag `aria-live` announcements name the row with it. */
      label: 'Точка маршрута',
      unlinkedNoteDay:
        'Точки без привязки к каталогу — свободный текст, их фото не попадут в галерею дня автоматически.',
      unlinkedNoteExcursion:
        'Точки без привязки к каталогу — свободный текст, их фото не попадут в галерею автоматически.',
    },

    placeSelect: {
      noLink: 'Без привязки — свободный текст',
      placeholder: 'Привязать к точке каталога…',
      search: 'Поиск по названию…',
    },

    org: {
      title: 'Организационные детали',
      hint: 'Например: «Гид на русском», «Трансфер включён».',
      empty: 'Организационных деталей пока нет.',
      add: 'Добавить деталь',
      noun: 'деталь',
      label: 'Организационная деталь',
    },

    restrictions: {
      title: 'Ограничения',
      hint: 'Например: «Возраст 6+», «Не для маломобильных гостей».',
      empty: 'Ограничений пока нет.',
      add: 'Добавить ограничение',
      noun: 'ограничение',
      label: 'Ограничение',
    },

    included: {
      title: 'Включено',
      hint: 'Например: «Проживание», «Завтраки», «Входные билеты».',
      empty: 'Пунктов «Включено» пока нет.',
      add: 'Добавить пункт',
      noun: 'пункт',
      label: 'Пункт',
    },

    notIncluded: {
      title: 'Не включено',
      hint: 'Например: «Авиаперелёт», «Личные расходы», «Страховка».',
      empty: 'Пунктов «Не включено» пока нет.',
      add: 'Добавить пункт',
      noun: 'пункт',
      label: 'Пункт',
    },

    listEditor: {
      remove: (noun: string) => `Удалить ${noun}`,
      drag: (noun: string, index: number) => `Перетащить ${noun} ${index}, чтобы изменить порядок`,
    },

    expenses: {
      empty: 'Расходов пока нет. Добавьте, если у позиции есть доплаты (билеты, обеды и т. п.).',
      add: 'Добавить расход',
      remove: 'Удалить расход',
      descriptionLabel: (index: number) => `Описание расхода ${index}`,
      descriptionRu: 'Описание (RU)',
      descriptionEn: 'Описание (EN)',
      amountLabel: (index: number) => `Сумма расхода ${index}, ֏`,
      amountPlaceholder: 'Сумма, ֏',
    },

    fill: {
      trigger: 'Заполнить из другого продукта',
      title: 'Заполнить день из другого продукта',
      empty: 'Других продуктов пока нет.',
      untitled: 'Без названия',
      confirmTitle: 'Заменить содержимое дня?',
      confirmText: (source: string) =>
        `В дне уже есть текст или точки маршрута — заливка из «${source}» полностью заменит их. Цена дня и уже добавленные картинки не меняются; для скопированных точек с привязкой к каталогу в галерею добавятся их фото.`,
      back: 'Назад',
      replace: 'Заменить',
    },

    actions: {
      draftNote: 'Черновик не сохраняется автоматически.',
      invalidNote: 'Проверьте форму: заполните обязательные поля (отмечены *).',
      cancel: 'Отмена',
      save: 'Сохранить',
      saving: 'Сохранение…',
    },

    /** Blocking validation messages. `validateTourForm` is pure and takes this section as a
     * parameter — the hook that owns the form resolves it once per locale. */
    validation: {
      required: 'Обязательное поле',
      mainImageUrl: 'Укажите ссылку на главную картинку',
      minDays: (min: number) => `Для тура нужно минимум ${min} ${pluralizeRu(min, ['день', 'дня', 'дней'])}`,
      negativePrice: 'Цена не может быть отрицательной',
      noRoutePoint: 'Добавьте хотя бы одну точку маршрута',
      discountRange: 'Введите процент от 0 до 100',
      discountNeedsPercent: 'Укажите размер скидки',
      discountNeedsStartDate: 'Укажите дату начала скидки',
      discountNeedsValidUntil: 'Укажите дату, до которой действует скидка',
      discountStartAfterEnd: 'Дата начала не может быть позже даты окончания',
    },

    submitError: {
      server: (status: number) =>
        `Не удалось сохранить: сервер вернул ошибку (${status}). Данные формы сохранены — попробуйте ещё раз.`,
      network: 'Не удалось сохранить: проверьте соединение и попробуйте ещё раз. Данные формы сохранены.',
    },
  },
  {
    localizedName: (value: Localized) => value.en || value.ru,

    page: {
      breadcrumbs: 'Breadcrumbs',
      products: 'Products',
      createTour: 'Create a tour',
      createExcursion: 'Create an excursion',
      editTour: 'Edit tour',
      editExcursion: 'Edit excursion',
    },

    header: {
      type: 'Product type',
      typeLocked: 'The type cannot be changed after creation',
      price: 'Price, ֏',
      totalCaption: 'Price · sum of days',
      mainImage: 'Main image — URL',
      title: 'Title',
      shortDescription: 'Short description',
      description: 'Description',
      duration: 'Duration',
      publication: 'Publishing',
      isActive: 'Active — visible on the site',
      payment: 'Payment',
      requiresPrepayment: 'Prepayment required',
      discount: 'Discount',
      discountPercent: 'Amount, %',
      discountStartDate: 'Start date',
      discountValidUntil: 'Valid until',
      discountHint:
        'The discount applies from the start date through the end date inclusive. After the end date it stops applying on its own — there is nothing to switch off by hand.',
    },

    regions: {
      label: 'Regions',
      empty: 'The region list is empty.',
    },

    tags: {
      label: 'Tags',
      empty: 'No tags yet — add them under “Reference data → Tags”.',
      fallback: (id: number) => `tag #${id}`,
      limitReached: (max: number) =>
        `This product already has ${max} ${pluralizeEn(max, ['tag', 'tags'])} — remove one before adding another.`,
    },

    tabs: {
      label: 'Tour sections',
      days: 'Days',
      org: 'Organizational details',
      restrictions: 'Restrictions',
      included: 'Included',
      notIncluded: 'Not included',
      expenses: 'Extra costs',
    },

    days: {
      item: 'Day',
      label: (index: number) => `Day ${index}`,
      add: 'Add a day',
      drag: (index: number) => `Drag day ${index} to reorder`,
      remove: (index: number) => `Remove day ${index}`,
      hasError: '⚠ check this day',
      images: (count: number) => `${count} ${pluralizeEn(count, ['image', 'images'])}`,
      price: 'Day price, ֏',
      gallery: 'Day gallery',
    },

    excursion: {
      gallery: 'Gallery',
    },

    routePoints: {
      title: 'Route points',
      hintDay: 'The order of the points follows the route of the day.',
      hintExcursion: 'The order of the points follows the route of the excursion.',
      empty: 'No route points yet.',
      add: 'Add a point',
      noun: 'route point',
      label: 'Route point',
      unlinkedNoteDay:
        'Points with no catalog link are free text — their photos will not be added to the day gallery automatically.',
      unlinkedNoteExcursion:
        'Points with no catalog link are free text — their photos will not be added to the gallery automatically.',
    },

    placeSelect: {
      noLink: 'No link — free text',
      placeholder: 'Link to a catalog place…',
      search: 'Search by name…',
    },

    org: {
      title: 'Organizational details',
      hint: 'For example: “Russian-speaking guide”, “Transfer included”.',
      empty: 'No organizational details yet.',
      add: 'Add a detail',
      noun: 'detail',
      label: 'Organizational detail',
    },

    restrictions: {
      title: 'Restrictions',
      hint: 'For example: “Age 6+”, “Not suitable for guests with reduced mobility”.',
      empty: 'No restrictions yet.',
      add: 'Add a restriction',
      noun: 'restriction',
      label: 'Restriction',
    },

    included: {
      title: 'Included',
      hint: 'For example: “Accommodation”, “Breakfasts”, “Entrance tickets”.',
      empty: 'No “Included” items yet.',
      add: 'Add an item',
      noun: 'item',
      label: 'Item',
    },

    notIncluded: {
      title: 'Not included',
      hint: 'For example: “Flights”, “Personal expenses”, “Insurance”.',
      empty: 'No “Not included” items yet.',
      add: 'Add an item',
      noun: 'item',
      label: 'Item',
    },

    listEditor: {
      remove: (noun: string) => `Remove ${noun}`,
      drag: (noun: string, index: number) => `Drag ${noun} ${index} to reorder`,
    },

    expenses: {
      empty: 'No extra costs yet. Add them if the product has surcharges (tickets, lunches and so on).',
      add: 'Add a cost',
      remove: 'Remove cost',
      descriptionLabel: (index: number) => `Cost ${index} description`,
      descriptionRu: 'Description (RU)',
      descriptionEn: 'Description (EN)',
      amountLabel: (index: number) => `Cost ${index} amount, ֏`,
      amountPlaceholder: 'Amount, ֏',
    },

    fill: {
      trigger: 'Fill from another product',
      title: 'Fill the day from another product',
      empty: 'There are no other products yet.',
      untitled: 'Untitled',
      confirmTitle: 'Replace the content of this day?',
      confirmText: (source: string) =>
        `This day already has text or route points — filling it from “${source}” will replace them completely. The day price and the images you added stay untouched; copied points linked to the catalog will add their photos to the gallery.`,
      back: 'Back',
      replace: 'Replace',
    },

    actions: {
      draftNote: 'The draft is not saved automatically.',
      invalidNote: 'Check the form: fill in the required fields (marked with *).',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving…',
    },

    validation: {
      required: 'This field is required',
      mainImageUrl: 'Add a link to the main image',
      minDays: (min: number) => `A tour needs at least ${min} ${pluralizeEn(min, ['day', 'days'])}`,
      negativePrice: 'The price cannot be negative',
      noRoutePoint: 'Add at least one route point',
      discountRange: 'Enter a percentage between 0 and 100',
      discountNeedsPercent: 'Enter the discount amount',
      discountNeedsStartDate: 'Enter the date the discount starts',
      discountNeedsValidUntil: 'Enter the date the discount is valid until',
      discountStartAfterEnd: 'The start date cannot be later than the end date',
    },

    submitError: {
      server: (status: number) =>
        `Could not save: the server returned an error (${status}). Your form data is kept — please try again.`,
      network: 'Could not save: check your connection and try again. Your form data is kept.',
    },
  },
)

/** Resolved copy of one locale — what `useCopy(tourFormCopy)` returns. Pure helpers of this
 * module (`validateTourForm`, `submitErrorMessage`) take the section they need from it as a
 * parameter instead of resolving the locale themselves. */
export type TourFormCopy = ReturnType<typeof tourFormCopy>
