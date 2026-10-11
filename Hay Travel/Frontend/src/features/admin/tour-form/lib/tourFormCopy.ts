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
      createTransfer: 'Создать трансфер',
      editTour: 'Редактировать тур',
      editExcursion: 'Редактировать экскурсию',
      editTransfer: 'Редактировать трансфер',
      /** Подзаголовок шаблона A — одна строка о том, что это за экран. */
      subtitleCreate: 'Заполните карточку продукта и сохраните — до сохранения ничего не создаётся.',
      subtitleEdit: 'Правки попадают на сайт только после сохранения.',
    },

    header: {
      type: 'Тип позиции',
      typeLocked: 'Тип нельзя изменить после создания',
      price: 'Цена за группу, ֏',
      /** Подсказка «?» у цены: на одном экране живут два разных смысла цены, и перепутать их
       * дороже всего — отсюда явное объяснение прямо у поля. */
      priceHint:
        'Это фиксированная цена за всю группу: она не умножается на число гостей, к ней применяется наценка за размер группы (1-4 / 5-6 / 7+). Именно её платит клиент при индивидуальном формате. При групповом формате берётся другая цена — «за человека», ниже.',
      totalCaption: 'Цена за группу · сумма дней',
      format: 'Формат',
      formatHint:
        'Индивидуальный — выезд только для этой группы: цена фиксирована за всю группу, работает наценка за размер группы. Групповой — сборный выезд: цена берётся за одного человека и умножается на число гостей, наценки нет, ограничение — свободные места. «Оба» — клиент выбирает формат сам при бронировании.',
      groupPricing: 'Групповой формат',
      groupPricePerPerson: 'Цена за человека, ֏',
      groupPricePerPersonHint:
        'Цена за ОДНОГО гостя: итог считается как эта цена × число гостей. Наценка за размер группы к ней не применяется — это отдельная от «Цены за группу» величина, а не пересчёт из неё.',
      groupCapacity: 'Мест на выезд',
      groupCapacityHint:
        'Сколько гостей помещается на один выезд. Одно число на весь продукт: остаток свободных мест считается отдельно на каждую пару «дата + время старта».',
      mainImage: 'Главная картинка — URL',
      title: 'Заголовок',
      shortDescription: 'Краткое описание',
      description: 'Описание',
      duration: 'Длительность',
      publication: 'Публикация',
      isActive: 'Активен — виден на сайте',
      payment: 'Оплата',
      requiresPrepayment: 'Требуется предоплата',
      isFeatured: 'Показывать в избранном',
      isFeaturedHint: (max: number) =>
        `Продукт появится в блоке «Избранное» на главной странице сайта (если он опубликован). Одновременно там может быть не больше ${max} продуктов. Порядок задаётся в списке продуктов, вид «Избранные». Изменение применяется кнопкой «Сохранить».`,
      /** Тултип у заблокированной галочки «Показывать в избранном» — `SetFeatured` требует права
       * `products.Update`. */
      noPermissionHint: 'Недостаточно прав',
      discount: 'Скидка',
      discountPercent: 'Размер, %',
      discountStartDate: 'Дата начала',
      discountValidUntil: 'Действует до',
      discountHint:
        'Скидка действует с даты начала по дату окончания включительно. После даты окончания она перестаёт применяться сама — снимать вручную не нужно.',
    },

    /** Редактор предопределённых времён начала (решение 0.21). */
    startTimes: {
      title: 'Время начала',
      hint: 'Клиент выбирает одно из этих времён при бронировании — своё время он ввести не может.',
      help: 'Список времён, в которые продукт стартует. Клиент выбирает одно из них и изменить не может. Нужно хотя бы одно время; одинаковые времена задать нельзя. Список сам выстраивается по возрастанию.',
      empty: 'Времён пока нет — добавьте хотя бы одно.',
      add: 'Добавить время',
      remove: 'Удалить время',
      label: (index: number) => `Время ${index}`,
    },

    /** Ветка трансфера: маршрут «откуда → стопы → куда» и таблица цен по классам авто. */
    transfer: {
      routeTitle: 'Маршрут',
      routeHelp:
        'Откуда и куда едет трансфер. Обе точки обязательны. Промежуточные остановки не обязательны — добавляйте их, если маршрут проходит через конкретные места; порядок остановок меняется перетаскиванием.',
      from: 'Откуда',
      to: 'Куда',
      stopsTitle: 'Промежуточные остановки',
      stopsHint: 'Порядок остановок соответствует маршруту.',
      stopsEmpty: 'Остановок нет — трансфер едет напрямую.',
      stopsAdd: 'Добавить остановку',
      /** Винительный падеж — «Удалить остановку» / «Перетащить остановку 2…». */
      stopNoun: 'остановку',
      /** Именительный падеж — для объявлений при перетаскивании. */
      stopLabel: 'Остановка',
      pricesTitle: 'Цены по классам авто',
      pricesHelp:
        'Цена трансфера зависит от класса авто. «Туда-обратно» — самостоятельная цена, а не удвоенная односторонняя: обратный рейс можно продавать дешевле двух отдельных поездок. Нужен хотя бы один класс с ценой; один класс нельзя добавить дважды.',
      pricesEmpty: 'Классов с ценой пока нет — добавьте хотя бы один.',
      pricesAdd: 'Добавить класс',
      priceRemove: 'Удалить строку',
      vehicleClass: 'Класс авто',
      vehicleClassPlaceholder: 'Выберите класс…',
      /** Подпись под названием класса в списке: вместимость и лимит багажа из справочника. */
      vehicleClassMeta: (capacity: number, luggage: number) =>
        `${capacity} ${pluralizeRu(capacity, ['место', 'места', 'мест'])} · багаж ${luggage}`,
      vehicleClassFallback: (id: number) => `класс №${id}`,
      oneWayPrice: 'В одну сторону, ֏',
      roundTripPrice: 'Туда-обратно, ֏',
      /** Пустой справочник классов авто — самостоятельное состояние экрана, не ошибка формы. */
      noVehicleClasses:
        'Классы авто ещё не заведены. Добавьте их в «Справочники → Классы авто» — без них у трансфера не задать цену.',
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

    /** Статус черновика под тулбаром. Подписи самих кнопок Save/Cancel сюда НЕ дублируются: их
     * даёт общий словарь `ui.toolbar.*`, как на экране заказа. */
    actions: {
      draftNote: 'Есть несохранённые изменения — черновик не сохраняется автоматически.',
      invalidNote: 'Проверьте форму: заполните обязательные поля (отмечены *).',
    },

    /** Мягкое удаление продукта прямо из формы: «В архив». Окончательное удаление живёт только в
     * архиве списка продуктов — здесь его нет и не должно быть. */
    archive: {
      button: 'В архив',
      modalTitle: 'Убрать в архив?',
      /** Предложение разорвано вокруг выделенного названия продукта — как в списке продуктов. */
      lead: 'Позиция',
      tail: 'пропадёт с сайта и переедет в архив. Данные останутся на месте — вернуть её можно из архива в списке продуктов.',
      quoteOpen: '«',
      quoteClose: '»',
      /** Показывается только поверх несохранённого черновика — иначе это лишний шум. */
      unsavedNote: 'Несохранённые изменения формы при этом пропадут.',
      confirm: 'В архив',
      pending: 'Убираем…',
      errorServer: (status: number) => `Не удалось убрать в архив: сервер вернул ошибку (${status}).`,
      errorNetwork: 'Не удалось убрать в архив: проверьте соединение и попробуйте ещё раз.',
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
      positiveNumber: 'Введите число больше нуля',
      positiveSeats: 'Введите целое число мест больше нуля',
      noStartTime: 'Добавьте хотя бы одно время начала',
      duplicateStartTime: 'Такое время уже добавлено',
      noTransferPrice: 'Добавьте хотя бы один класс авто с ценой',
      duplicateVehicleClass: 'Этот класс уже добавлен',
    },

    submitError: {
      server: (status: number) =>
        `Не удалось сохранить: сервер вернул ошибку (${status}). Данные формы сохранены — попробуйте ещё раз.`,
      network: 'Не удалось сохранить: проверьте соединение и попробуйте ещё раз. Данные формы сохранены.',
    },

    /** Продукт СОХРАНЁН, не прошёл только `SetFeatured` — текст говорит именно это, чтобы админ
     * не переделывал сохранённое. */
    featuredError: {
      tooMany: (max: number) =>
        `Продукт сохранён, но не добавлен в «Избранное»: там уже ${max} продуктов. Уберите один в списке продуктов (вид «Избранные») и сохраните снова.`,
      server: (status: number) =>
        `Продукт сохранён, но «Показывать в избранном» не применилось: сервер вернул ошибку (${status}). Сохраните ещё раз.`,
      network:
        'Продукт сохранён, но «Показывать в избранном» не применилось: проверьте соединение и сохраните ещё раз.',
    },
  },
  {
    localizedName: (value: Localized) => value.en || value.ru,

    page: {
      breadcrumbs: 'Breadcrumbs',
      products: 'Products',
      createTour: 'Create a tour',
      createExcursion: 'Create an excursion',
      createTransfer: 'Create a transfer',
      editTour: 'Edit tour',
      editExcursion: 'Edit excursion',
      editTransfer: 'Edit transfer',
      subtitleCreate: 'Fill in the product card and save — nothing is created until you do.',
      subtitleEdit: 'Changes reach the site only after you save.',
    },

    header: {
      type: 'Product type',
      typeLocked: 'The type cannot be changed after creation',
      price: 'Price per group, ֏',
      priceHint:
        'A fixed price for the whole group: it is not multiplied by the number of guests, and the group-size surcharge (1-4 / 5-6 / 7+) applies to it. This is what the client pays in the individual format. The group format uses a different price — “per person”, below.',
      totalCaption: 'Price per group · sum of days',
      format: 'Format',
      formatHint:
        'Individual — a private departure for this group only: the price is fixed for the whole group and the group-size surcharge applies. Group — a shared departure: the price is per person and multiplied by the number of guests, with no surcharge; the only limit is the seats left. “Both” — the client picks the format when booking.',
      groupPricing: 'Group format',
      groupPricePerPerson: 'Price per person, ֏',
      groupPricePerPersonHint:
        'The price for ONE guest: the total is this price × the number of guests. The group-size surcharge does not apply to it — it is a separate number from “Price per group”, not derived from it.',
      groupCapacity: 'Seats per departure',
      groupCapacityHint:
        'How many guests fit into a single departure. One number for the whole product: the seats left are counted separately for each date + start time pair.',
      mainImage: 'Main image — URL',
      title: 'Title',
      shortDescription: 'Short description',
      description: 'Description',
      duration: 'Duration',
      publication: 'Publishing',
      isActive: 'Active — visible on the site',
      payment: 'Payment',
      requiresPrepayment: 'Prepayment required',
      isFeatured: 'Show in featured',
      isFeaturedHint: (max: number) =>
        `The product appears in the "Featured" block on the site's home page (if it is published). At most ${max} products can be there at once. Their order is set in the products list, "Featured" view. The change is applied with the "Save" button.`,
      noPermissionHint: 'Not enough permissions',
      discount: 'Discount',
      discountPercent: 'Amount, %',
      discountStartDate: 'Start date',
      discountValidUntil: 'Valid until',
      discountHint:
        'The discount applies from the start date through the end date inclusive. After the end date it stops applying on its own — there is nothing to switch off by hand.',
    },

    startTimes: {
      title: 'Start time',
      hint: 'The client picks one of these times when booking — they cannot enter their own.',
      help: 'The times the product departs at. The client picks one of them and cannot change it. At least one time is required, and two identical times are not allowed. The list keeps itself in ascending order.',
      empty: 'No times yet — add at least one.',
      add: 'Add a time',
      remove: 'Remove time',
      label: (index: number) => `Time ${index}`,
    },

    transfer: {
      routeTitle: 'Route',
      routeHelp:
        'Where the transfer goes from and to. Both points are required. Intermediate stops are optional — add them if the route passes through specific places; drag to reorder them.',
      from: 'From',
      to: 'To',
      stopsTitle: 'Intermediate stops',
      stopsHint: 'The order of the stops follows the route.',
      stopsEmpty: 'No stops — the transfer goes directly.',
      stopsAdd: 'Add a stop',
      stopNoun: 'stop',
      stopLabel: 'Stop',
      pricesTitle: 'Prices by vehicle class',
      pricesHelp:
        'The transfer price depends on the vehicle class. “Round trip” is a price of its own, not double the one-way one: the return leg can be sold cheaper than two separate rides. At least one class with a price is required, and a class cannot be added twice.',
      pricesEmpty: 'No priced classes yet — add at least one.',
      pricesAdd: 'Add a class',
      priceRemove: 'Remove row',
      vehicleClass: 'Vehicle class',
      vehicleClassPlaceholder: 'Pick a class…',
      vehicleClassMeta: (capacity: number, luggage: number) =>
        `${capacity} ${pluralizeEn(capacity, ['seat', 'seats'])} · luggage ${luggage}`,
      vehicleClassFallback: (id: number) => `class #${id}`,
      oneWayPrice: 'One way, ֏',
      roundTripPrice: 'Round trip, ֏',
      noVehicleClasses:
        'No vehicle classes have been created yet. Add them under “Reference data → Vehicle classes” — without them a transfer cannot be priced.',
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
      draftNote: 'You have unsaved changes — the draft is not saved automatically.',
      invalidNote: 'Check the form: fill in the required fields (marked with *).',
    },

    archive: {
      button: 'Archive',
      modalTitle: 'Move to the archive?',
      lead: 'The item',
      tail: 'will disappear from the site and move to the archive. Its data is kept — you can restore it from the archive in the product list.',
      quoteOpen: '“',
      quoteClose: '”',
      unsavedNote: 'Any unsaved changes in the form will be lost.',
      confirm: 'Archive',
      pending: 'Archiving…',
      errorServer: (status: number) => `Could not archive: the server returned an error (${status}).`,
      errorNetwork: 'Could not archive: check your connection and try again.',
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
      positiveNumber: 'Enter a number greater than zero',
      positiveSeats: 'Enter a whole number of seats greater than zero',
      noStartTime: 'Add at least one start time',
      duplicateStartTime: 'This time is already in the list',
      noTransferPrice: 'Add at least one vehicle class with a price',
      duplicateVehicleClass: 'This class is already in the list',
    },

    submitError: {
      server: (status: number) =>
        `Could not save: the server returned an error (${status}). Your form data is kept — please try again.`,
      network: 'Could not save: check your connection and try again. Your form data is kept.',
    },

    featuredError: {
      tooMany: (max: number) =>
        `The product is saved but not added to "Featured": there are already ${max} products there. Remove one in the products list ("Featured" view) and save again.`,
      server: (status: number) =>
        `The product is saved, but "Show in featured" was not applied: the server returned an error (${status}). Save again.`,
      network:
        'The product is saved, but "Show in featured" was not applied: check your connection and save again.',
    },
  },
)

/** Resolved copy of one locale — what `useCopy(tourFormCopy)` returns. Pure helpers of this
 * module (`validateTourForm`, `submitErrorMessage`) take the section they need from it as a
 * parameter instead of resolving the locale themselves. */
export type TourFormCopy = ReturnType<typeof tourFormCopy>
