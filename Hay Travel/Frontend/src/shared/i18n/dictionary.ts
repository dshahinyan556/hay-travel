/**
 * UI dictionary of the PUBLIC site plus the built-in copy of the `shared/ui` primitives — RU is the
 * source of truth (`ru`); TypeScript enforces that `en` defines exactly the same key set
 * (`Record<TranslationKey, string>` below), so a key added to one without the other is a build
 * error rather than a silently-blank string on the missing side.
 *
 * Scope: `app/layout`, `features/home|tours|regions|auth`, and the `ui.*` keys of the `shared/ui`
 * primitives themselves — including the admin-facing ones (`AdminToolbar` default labels, `Select`
 * placeholders, `SortableList` drag announcements), because a shared primitive must not import a
 * feature's copy module.
 *
 * The admin panel is NOT Russian-only any more — that decision was deliberately reversed, see
 * ADR 021 (`docs/adr/021-admin-panel-localization.md`). `/admin` is localized, but its copy does
 * NOT live here: admin strings sit next to their feature, in `features/admin/<module>/lib/` +
 * `<module>Copy.ts`, as `defineCopy(ru, en)` modules, so they stay inside the lazily-loaded admin
 * chunk instead of weighing down every public visitor's initial bundle. Both mechanisms are driven
 * by the same `LocaleProvider`/`useLocale()`, so one switch changes both.
 *
 * Keys are flat, dot-namespaced strings rather than a nested object — greppable, and a missing
 * key is a single failed lookup instead of an optional-chaining trail.
 */

const ru = {
  // ── Common ────────────────────────────────────────────────────────────────────────────────
  'common.close': 'Закрыть',
  'common.expand': 'Развернуть',
  'common.collapse': 'Свернуть',

  // ── Header / mobile tab bar ──────────────────────────────────────────────────────────────
  'nav.home': 'Главная',
  'nav.trips': 'Путешествия',
  'nav.regions': 'Карта регионов',
  'nav.regionsShort': 'Карта',
  'nav.transfers': 'Трансферы',
  'nav.transfersShort': 'Трансфер',
  'nav.login': 'Войти',
  'nav.account': 'Аккаунт',
  'nav.mainAriaLabel': 'Основная навигация',

  // ── Footer ────────────────────────────────────────────────────────────────────────────────
  // 'footer.tagline'/'footer.address' moved to the backend (`Настройки → Тексты`/`→ Контакты`,
  // 2026-08-02) — see `shared/api/siteSettings.ts` `getContentText`/`getContacts`.
  'footer.navigation': 'Навигация',
  'footer.contacts': 'Контакты',
  'footer.rights': 'Все права защищены.',

  // ── Theme toggle ──────────────────────────────────────────────────────────────────────────
  'theme.light': 'Светлая тема',
  'theme.dark': 'Тёмная тема',

  // ── Language switch ───────────────────────────────────────────────────────────────────────
  /* Ниже 640px обе шапки схлопывают переключатель в ОДНУ кнопку с текущим языком (тап —
     переключить), чтобы освободить место под иконку корзины. Видимая подпись при этом называет
     текущий язык, а действие — противоположное, поэтому кнопке нужно собственное имя. */
  'language.switchTo': 'Переключить на {language}',

  // ── Currency switch ───────────────────────────────────────────────────────────────────────
  // Currency NAMES are deliberately not translated: an option row is a symbol plus its ISO code,
  // which reads identically in every locale.
  'currency.switchAriaLabel': 'Валюта отображения цен',
  'currency.optionAriaLabel': '{code}',
  'currency.unavailable': 'Курсы валют временно недоступны — цены показаны в драмах',
  // Desktop panel only (2026-08 redesign) — mobile's `Sheet` rows stay symbol+code, no rate line.
  'currency.rateNote': '1 {code} ≈ {amount}',
  'currency.baseCurrency': 'Базовая валюта',
  'currency.updatedAt': 'Курс обновлён в {time}',
  'currency.rateStale': 'Курс мог устареть',

  // ── Home page ─────────────────────────────────────────────────────────────────────────────
  // 'home.hero.season' removed (2026-08-14) — the season eyebrow above the hero heading is gone.
  'home.hero.regionsCta': 'Карта регионов',
  // 'home.featured.eyebrow' removed (2026-08-02) — the eyebrow above the heading is gone, see
  // `FeaturedTours`. 'home.featured.title' moved to the backend, same as the footer above.
  'home.featured.allCatalog': 'Весь каталог',
  'home.testimonials.eyebrow': 'Отзывы',
  'home.testimonials.title': 'Что говорят гости',
  'home.testimonials.rating': 'Оценка {rating} из 5',

  // Fallback hero copy — shown until the admin fills in `Настройки → Hero`, or if that fetch fails.
  'hero.fallback.title': 'Армения за пределами путеводителей',
  'hero.fallback.subtitle':
    'Монастыри в ущельях, чёрный туф Гюмри, вино Арени и Севан на рассвете. Небольшие группы ' +
    'и местные гиды — от однодневных экскурсий до маршрутов на весь юг.',
  'hero.fallback.ctaLabel': 'Смотреть путешествия',

  // ── Regions / map ─────────────────────────────────────────────────────────────────────────
  'regions.eyebrow': 'Интерактивная карта',
  'regions.title': 'Армения по регионам',
  'regions.subtitle': '11 регионов, у каждого свой характер. Выберите регион на карте — покажем, что можно посмотреть именно там.',
  'regions.expand': 'Исследовать по регионам',
  'regions.collapse': 'Свернуть карту',
  'regions.mapAriaLabel': 'Карта регионов Армении',
  'regions.empty.placeholder': 'Выберите регион',
  'regions.empty.hint': 'Наведите на регион, чтобы увидеть, сколько там маршрутов, и нажмите — покажем список.',
  'regions.panel.label': 'Регион',
  'regions.panel.close': 'Закрыть панель региона',
  'regions.panel.expand': 'Развернуть панель региона',
  'regions.panel.collapse': 'Свернуть панель региона',
  'regions.panel.retry': 'Повторить',
  'regions.panel.errorTitle': 'Не удалось загрузить туры',
  'regions.panel.errorBody': 'Проверьте соединение — данные не пришли.',
  'regions.panel.emptyTitle': 'В этом регионе пока нет маршрутов',
  'regions.panel.emptyBody': 'Мы готовим программы для {region}. Посмотрите соседние регионы или весь каталог.',
  'regions.panel.allCatalog': 'Весь каталог',
  'regions.previewBar.label': 'Выбранный регион',
  'regions.previewBar.open': 'Смотреть',
  'regions.previewBar.dismiss': 'Снять выделение региона',

  // ── Tours catalog / filters ───────────────────────────────────────────────────────────────
  'tours.eyebrow': 'Каталог',
  // 'tours.title'/'tours.subtitle' moved to the backend (2026-08-02), same as the footer above.
  'tours.empty.title': 'Под эти условия ничего нет',
  'tours.empty.body': 'Попробуйте убрать часть фильтров — например, поднять цену или выбрать другой регион.',
  'tours.empty.reset': 'Сбросить фильтры',
  'filter.kind.all': 'Всё',
  'filter.kind.tour': 'Туры',
  'filter.kind.excursion': 'Экскурсии',
  'filter.kind.ariaLabel': 'Тип продукта',
  'filter.search.placeholder': 'Поиск по названию…',
  'filter.search.ariaLabel': 'Поиск по названию',
  'filter.region.label': 'Регион',
  'filter.region.all': 'Все регионы',
  'filter.region.count': 'Регионы ({count})',
  'filter.region.ariaLabel': 'Регионы',
  'filter.price.label': 'Цена',
  'filter.price.ariaLabel': 'Цена и сортировка',
  'filter.price.range': 'Диапазон цены',
  'filter.price.from': 'Цена от',
  'filter.price.to': 'Цена до',
  'filter.price.fromShort': 'от',
  'filter.price.toShort': 'до',
  'filter.price.fromPlaceholder': 'от {value}',
  'filter.price.toPlaceholder': 'до {value}',
  'filter.price.sort': 'Сортировка',
  'filter.price.sortDefault': 'По умолчанию',
  'filter.price.sortCheaper': 'Сначала дешевле',
  'filter.price.sortPricier': 'Сначала дороже',
  'filter.price.cheaperShort': 'дешевле',
  'filter.price.pricierShort': 'дороже',
  'filter.price.reset': 'Сбросить цену и сортировку',
  'filter.resultCount': 'Найдено: {count}',
  'filter.reset': 'Сбросить',

  // ── Tour card ─────────────────────────────────────────────────────────────────────────────
  'tourCard.priceFrom': 'цена от',
  'tourCard.discountUntil': 'до {date}',
  'chip.tour': 'Тур',
  'chip.excursion': 'Экскурсия',
  'chip.transfer': 'Трансфер',
  /* Формат продажи (батч 2026-08-29). `Both` — одна подпись, а не два бейджа: см. FormatChip. */
  'chip.formatIndividual': 'Индивидуальный',
  'chip.formatGroup': 'Групповой',
  'chip.formatBoth': 'Индивидуальный / групповой',
  /* Карточка группового продукта показывает цену ЗА ЧЕЛОВЕКА — «цена от» там было бы про
     другой тариф (решение 0.18). */
  'tourCard.pricePerPerson': 'за человека',

  // ── Tour detail ───────────────────────────────────────────────────────────────────────────
  'tourDetail.breadcrumb': 'Каталог',
  'tourDetail.itineraryOneDay': 'Программа дня',
  'tourDetail.itineraryMultiDay': 'Программа по дням',
  'tourDetail.included': 'Включено',
  'tourDetail.notIncluded': 'Не включено',
  'tourDetail.organizationalDetails': 'Организационные детали',
  'tourDetail.restrictions': 'Ограничения',
  'tourDetail.expenses': 'Дополнительные расходы',
  'tourDetail.moreIn': 'Ещё в {region}',
  'tourDetail.andUp': 'и выше',
  'tourDetail.dayFallback': 'День {n}',
  'tourDetail.notFound': 'Тур не найден',

  // ── Gallery ───────────────────────────────────────────────────────────────────────────────
  'gallery.openFullscreen': 'Открыть фото на весь экран',
  'gallery.prev': 'Предыдущее фото',
  'gallery.next': 'Следующее фото',
  'gallery.photoAlt': 'Фото {n}',
  'gallery.close': 'Закрыть',
  'gallery.counter': '{current} / {total}',

  // ── Booking card ──────────────────────────────────────────────────────────────────────────
  'booking.smallGroup': 'малая группа',
  'booking.dateLabel': 'Дата выезда',
  'booking.dateMissing': 'Выберите дату выезда',
  'booking.guests': 'Гостей',
  'booking.guestsFewer': 'Меньше гостей',
  'booking.guestsMore': 'Больше гостей',
  'booking.total': 'Итого',
  'booking.prepayment': 'Предоплата 20%',
  'booking.submitHint': 'Бронь без оплаты — подтвердим и пришлём детали',
  // 7+ гостей: цена не показывается, кнопка остаётся активной — это единственный путь к действию,
  // о котором просит текст приглашения.
  'booking.submitHintLargeGroup': 'Рассчитаем стоимость для вашей группы и свяжемся с вами',
  // Используется ТОЛЬКО если настройка `content.largeGroupInvitation` пустая: иначе блок цены
  // просто исчез бы без объяснения.
  'booking.largeGroupFallback':
    'Для групп от 7 человек мы считаем стоимость индивидуально — оставьте заявку, и мы вернёмся с ценой.',
  /* Ключи ошибок остаются общими: их читает и корзина (пер-строчные причины отказа), и форма
     тура. Ставшие мёртвыми `booking.submit*`/`booking.submitted*`/`booking.auth*`/
     `booking.orderNumber`/`booking.editSubmission` удалены вместе с одношаговой бронью
     (spec 008 §10) — заказ теперь создаётся только на `/cart`. */
  'booking.dateUnavailable': 'Эта дата уже недоступна — выберите другую.',
  'booking.datePast': 'Эта дата уже прошла — выберите другую.',
  'booking.submitFailed': 'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.',
  'booking.sessionExpired': 'Сессия истекла — войдите заново, чтобы завершить бронь.',

  /* ── Формат, время старта и места (батч 2026-08-29) ──────────────────────────────────────
     Подписи формата переиспользуют ключи бейджа (`chip.format*`): переключатель в блоке брони
     и бейдж на карточке обязаны называть один и тот же формат одним и тем же словом. */
  'booking.formatLabel': 'Формат',
  'booking.formatIndividualHint': 'Только ваша компания, цена за всю бронь',
  'booking.formatGroupHint': 'Сборная группа, цена за человека',
  'booking.startTimeLabel': 'Время выезда',
  'booking.startTimeMissing': 'Выберите время выезда',
  // Расписания у продукта может не быть (запись, до которой не дошла миграция) — тогда блок
  // брони говорит это словами, а не показывает пустой список кнопок.
  'booking.startTimeUnavailable':
    'Запись на это путешествие пока недоступна — время выезда ещё не назначено. Напишите нам, и мы подберём дату.',
  'booking.perPerson': '{price} за человека',
  'booking.seatsLeft': 'Осталось мест: {count}',
  // Формулировка владельца (решение 0.20) — менять только по его слову.
  'booking.noSeats': 'На этот день свободных мест нет, попробуйте выбрать другую дату',
  'booking.notEnoughSeats': 'На этот выезд осталось мест: {count} — уменьшите число гостей',
  'booking.startTimeInvalid': 'Это время выезда больше недоступно — выберите другое.',
  'booking.formatRequired': 'Выберите формат — индивидуальный или групповой.',

  // ── Cart ──────────────────────────────────────────────────────────────────────────────────
  'cart.nav.aria': 'Корзина, позиций: {count}',
  'cart.title': 'Корзина',
  'cart.subtitle': 'Проверьте даты и число гостей — заявку отправим одним нажатием',
  'cart.addToCart': 'Добавить в корзину',
  'cart.added.title': 'Добавлено в корзину',
  'cart.added.titleUpdated': 'Обновлено в корзине',
  'cart.added.goToCart': 'Перейти в корзину',
  'cart.added.continue': 'Продолжить выбор',
  'cart.error.full': 'В корзине максимум 10 позиций — отправьте заявку или удалите лишнее',
  'cart.error.tooManyLines': 'В одной заявке не больше 10 позиций — удалите лишнее и попробуйте снова',
  'cart.empty.title': 'Корзина пуста',
  'cart.empty.body': 'Выберите путешествие, укажите дату и число гостей — они появятся здесь',
  'cart.empty.action': 'Смотреть путешествия',
  'cart.line.remove': 'Удалить из корзины',
  'cart.line.price': 'Стоимость',
  'cart.line.unavailable': 'Это путешествие больше недоступно — удалите его, чтобы отправить заявку',
  'cart.line.guestCountInvalid': 'Недопустимое число гостей — измените и попробуйте снова',
  /* Строка корзины показывает выбранный выезд целиком: без времени две позиции одного тура на
     один день выглядели бы одинаково (батч 2026-08-29). Править время в корзине нельзя —
     другое время это другой выезд, он выбирается в блоке брони. */
  'cart.line.startTime': 'Время выезда',
  'cart.summary.total': 'Итого',
  'cart.summary.itemCount': 'Позиций: {count}',
  'cart.summary.quoteNote': 'По части позиций стоимость рассчитаем индивидуально',
  'cart.summary.submit': 'Отправить заявку',
  'cart.summary.submitting': 'Отправляем…',
  'cart.summary.blockedUnavailable': 'Удалите недоступные путешествия, чтобы продолжить',
  'cart.summary.blockedLines': 'Исправьте отмеченные позиции и отправьте заявку снова',
  'cart.summary.hint': 'Заявка без оплаты — подтвердим и пришлём детали',
  /* Важная строка: при пер-строчном отказе посетитель обязан понять, что частично ничего не ушло
     и повторная отправка не создаст дубль. */
  'cart.summary.rejectedNote': 'Заявка не создана — ни одна позиция не отправлена',
  'cart.auth.title': 'Нужен вход в аккаунт',
  'cart.auth.body': 'Войдите — корзина сохранится, ничего выбирать заново не придётся',
  'cart.auth.action': 'Войти и продолжить',
  'cart.result.title': 'Заявка отправлена',
  'cart.result.body':
    'Мы свяжемся с вами в течение дня и подтвердим даты. Предоплата — после подтверждения.',
  'cart.result.orderNumberLabel': 'Номер заказа',
  'cart.result.orderNumber': 'Заказ №{number}',
  'cart.result.lineCount': 'Позиций в заявке: {count}',
  'cart.result.lineCountTotal': 'Позиций в заявке: {count} · на сумму {total}',
  'cart.result.continue': 'Смотреть другие путешествия',
  /* Строка-трансфер в корзине. Дата и число пассажиров правятся, всё остальное — нет: класс
     авто и обратный рейс это выбор, сделанный на странице трансфера, и менять его надо там же,
     где видно цену обоих вариантов. */
  'cart.line.pickupTime': 'Время подачи',
  'cart.line.vehicleClass': 'Класс авто',
  'cart.line.return': 'Обратно',
  'cart.line.oneWay': 'В одну сторону',
  'cart.line.passengers': 'Пассажиров',
  'cart.line.transferUnavailable':
    'Этот трансфер больше недоступен — удалите его, чтобы отправить заявку',

  // ── Трансферы (батч 2026-08-29) ───────────────────────────────────────────────────────────
  'transfers.eyebrow': 'Трансферы по Армении',
  'transfers.title': 'Готовые маршруты',
  'transfers.subtitle':
    'Встреча в аэропорту, переезды между городами и поездки к достопримечательностям. ' +
    'Цена фиксированная и известна заранее.',
  /* Подпись стоит вплотную к цифре на всех экранах: у тура цена читается как «за человека», и
     у трансфера это неверно — молчание здесь рождает спор при оплате. */
  'transfers.pricePerCar': 'цена за авто',
  'transfers.priceFrom': 'от',
  'transfers.found': 'Найдено: {count}',
  'transfers.priceUnknown': 'по запросу',

  // Фильтры «Откуда / Куда» — на странице ВСЕГДА, при любом числе трансферов (решение 0.25).
  'transfers.filter.from': 'Откуда',
  'transfers.filter.to': 'Куда',
  'transfers.filter.all': 'Все',
  'transfers.filter.reset': 'Сбросить',
  'transfers.filter.fromAria': 'Фильтр: откуда',
  'transfers.filter.toAria': 'Фильтр: куда',

  'transfers.builder.eyebrow': 'Свой маршрут',
  'transfers.builder.title': 'Не нашли нужное направление?',
  'transfers.builder.body':
    'Соберите маршрут сами — укажите точки, дату и время. Менеджер подберёт машину и подтвердит цену.',
  'transfers.builder.action': 'Собрать свой трансфер',

  'transfers.empty.title': 'Готовых маршрутов пока нет',
  'transfers.empty.body':
    'Но трансфер всё равно можно заказать — соберите маршрут сами, и мы подберём машину и цену.',
  /* Пустой результат фильтров называет САМ маршрут, а не «ничего не найдено»: так сразу видно,
     какой запрос не сработал. Главное действие — собрать этот маршрут, а не сбросить фильтры:
     выбор посетителя не выкидывается, он переносится в конструктор. */
  'transfers.emptyFiltered.title': '{route} мы ещё не собрали',
  'transfers.emptyFiltered.body':
    'Готового трансфера по этому направлению нет. Но именно его можно заказать в конструкторе — маршрут уже подставим.',
  'transfers.emptyFiltered.action': 'Собрать {route}',
  'transfers.emptyFiltered.showAll': 'Показать все маршруты',

  'transfers.notFound.title': 'Трансфер не найден',
  'transfers.notFound.body': 'Возможно, маршрут снят с продажи или ссылка неверна.',
  'transfers.notFound.action': 'Все трансферы',

  // ── Детальная /transfers/:id ───────────────────────────────────────────────────────────────
  'transfers.detail.routeHeading': 'Маршрут',
  'transfers.detail.pointFrom': 'Откуда',
  'transfers.detail.pointStop': 'Остановка',
  'transfers.detail.pointTo': 'Куда',
  'transfers.detail.dateLabel': 'Дата поездки',
  'transfers.detail.pickupTimeLabel': 'Время подачи',
  'transfers.detail.pickupTimePlaceholder': 'Выберите время',
  'transfers.detail.returnToggle': 'Нужен обратный трансфер',
  'transfers.detail.returnDateLabel': 'Дата обратно',
  'transfers.detail.returnTimeLabel': 'Время обратно',
  'transfers.detail.passengers': 'Пассажиров',
  'transfers.detail.passengersFewer': 'Меньше пассажиров',
  'transfers.detail.passengersMore': 'Больше пассажиров',
  'transfers.detail.vehicleLabel': 'Класс автомобиля',
  'transfers.detail.vehicleHelpTitle': 'Класс автомобиля',
  'transfers.detail.vehicleHelpBody':
    'Цена указана за автомобиль целиком, а не за человека. Если ни один класс не подходит по числу ' +
    'пассажиров или багажу — соберите заявку, и менеджер подберёт транспорт и согласует цену.',
  'transfers.detail.capacity': 'до {count} пассажиров',
  'transfers.detail.luggage': 'багаж {count} ед.',
  'transfers.detail.oneWayPrice': 'в одну сторону {price}',
  'transfers.detail.roundTripPrice': 'туда-обратно {price}',
  'transfers.detail.totalOneWay': 'Итого · в одну сторону',
  'transfers.detail.totalRoundTrip': 'Итого · туда-обратно',
  'transfers.detail.perCarNote': 'за автомобиль, не за человека',
  'transfers.detail.submitHint': 'Оплата после подтверждения менеджером',
  'transfers.detail.noVehicles':
    'Забронировать этот трансфер пока нельзя — цены по классам автомобилей ещё не заданы. Напишите нам, и мы посчитаем стоимость.',
  'transfers.detail.dateMissing': 'Выберите дату поездки',
  'transfers.detail.timeMissing': 'Укажите время подачи',
  'transfers.detail.returnMissing': 'Укажите дату и время обратного рейса',
  'transfers.detail.returnInvalid': 'Обратный рейс не может быть раньше самой поездки',
  'transfers.detail.vehicleMissing': 'Выберите класс автомобиля',
  'transfers.detail.dateClosed': 'На эту дату трансферы недоступны — выберите другую',
  /* Пассажиров больше вместимости ЛЮБОГО класса (решение 0.14): человек ничего не сделал
     неправильно, поэтому тон янтарный, а не красный, и путь назад открыт — уменьшил счётчик,
     вернулась обычная бронь с ценой. */
  'transfers.detail.overCapacityTitle': 'Нужен транспорт больше',
  'transfers.detail.overCapacityBody':
    'Самый вместительный класс рассчитан на {count} пассажиров. Для {passengers} мы подберём транспорт и согласуем цену индивидуально.',
  'transfers.detail.priceOnRequest': 'Согласуем индивидуально',
  'transfers.detail.priceLabel': 'Стоимость',
  'transfers.detail.requestAction': 'Оформить заявку',
  'transfers.detail.requestHint': 'Вместо оплаты — заявка. Менеджер свяжется и назовёт цену.',
  'transfers.detail.vehicleTooSmall': 'мест меньше, чем пассажиров',

  // ── Конструктор /transfers/custom ─────────────────────────────────────────────────────────
  'transfers.request.eyebrow': 'Свой маршрут',
  'transfers.request.title': 'Соберите трансфер',
  'transfers.request.notice': 'Это заявка: точную цену подтвердит менеджер после того, как подберёт машину.',
  'transfers.request.noticeHelpTitle': 'Почему здесь нет цены',
  'transfers.request.noticeHelpBody':
    'Стоимость своего маршрута зависит от расстояния, числа остановок и класса машины. Менеджер посчитает её ' +
    'и свяжется с вами — платить до подтверждения не нужно.',

  'transfers.request.step1': 'Маршрут',
  'transfers.request.fromLabel': 'Откуда',
  'transfers.request.fromPlaceholder': 'Например, Ереван, аэропорт Звартноц',
  'transfers.request.toLabel': 'Куда',
  'transfers.request.toPlaceholder': 'Например, Дилижан',
  'transfers.request.stopsLabel': 'Промежуточные остановки',
  'transfers.request.stopPlaceholder': 'Например, Гарни',
  'transfers.request.stopNumber': 'Остановка {n}',
  'transfers.request.stopAdd': 'Добавить остановку',
  'transfers.request.stopRemove': 'Удалить остановку',
  'transfers.request.stopUp': 'Переместить выше',
  'transfers.request.stopDown': 'Переместить ниже',
  'transfers.request.stopDrag': 'Перетащить остановку',
  'transfers.request.stopItemLabel': 'Остановка',
  'transfers.request.stopLimit': 'Больше {count} остановок в трансфере не бывает — это уже тур',
  'transfers.request.suggestionsEmpty': 'В каталоге такой точки нет — оставьте свой текст',

  'transfers.request.step2': 'Когда',
  'transfers.request.dateLabel': 'Дата',
  'transfers.request.step3': 'Пассажиры и багаж',
  'transfers.request.luggageLabel': 'Багаж — не обязательно',
  'transfers.request.luggageHelpTitle': 'Как считается багаж',
  'transfers.request.luggageHelpBody':
    'Один средний чемодан занимает 3 единицы места, большой — 5. У каждого класса автомобиля свой лимит; ' +
    'если багаж не указан, мы просто ничего не проверяем.',
  'transfers.request.luggageMedium': 'Средний чемодан',
  'transfers.request.luggageMediumUnits': 'Средний чемодан · 3 ед. каждый',
  'transfers.request.luggageLarge': 'Большой чемодан',
  'transfers.request.luggageLargeUnits': 'Большой чемодан · 5 ед. каждый',
  'transfers.request.luggageFewer': 'Меньше на одно место',
  'transfers.request.luggageMore': 'Больше на одно место',
  'transfers.request.luggageOtherLabel': 'Другое — коляска, лыжи, велосипед',
  'transfers.request.luggageOtherPlaceholder': 'Свободным текстом',

  'transfers.request.step4': 'Пожелания',
  'transfers.request.vehicleLabel': 'Желаемый класс автомобиля',
  'transfers.request.vehicleAny': 'Не важно — подберите сами',
  'transfers.request.commentLabel': 'Комментарий менеджеру',
  'transfers.request.commentPlaceholder': 'Детское кресло, встреча с табличкой, особые пожелания…',

  'transfers.request.submit': 'Отправить заявку',
  'transfers.request.submitting': 'Отправляем…',
  'transfers.request.submitHint': 'Менеджер свяжется в течение рабочего дня и подтвердит стоимость.',
  'transfers.request.submitLock': 'Не закрывайте страницу',

  'transfers.request.fromMissing': 'Укажите, откуда забрать',
  'transfers.request.toMissing': 'Укажите, куда ехать',
  'transfers.request.stopEmpty': 'Заполните остановку или удалите её',
  'transfers.request.luggageTooMuchTitle': 'Багаж не помещается в «{vehicle}»',
  'transfers.request.luggageTooMuchBody':
    'Указано {units} ед. ({medium} средних + {large} больших), а в этот класс входит {capacity}. Выберите класс просторнее или уменьшите багаж.',
  'transfers.request.luggageShort': 'не хватает {count} ед. багажа',
  'transfers.request.capacityTooSmall': 'мест меньше, чем пассажиров',

  'transfers.auth.title': 'Войдите, чтобы отправить заявку',
  'transfers.auth.body':
    'Заявка привязывается к вашему аккаунту — так вы увидите её статус и ответ менеджера.',
  'transfers.auth.action': 'Войти или зарегистрироваться',
  'transfers.auth.saved': 'Всё, что вы заполнили, сохранится',

  'transfers.result.title': 'Заявка принята',
  'transfers.result.body': 'Менеджер свяжется с вами в течение рабочего дня и подтвердит стоимость.',
  'transfers.result.numberLabel': 'Номер заявки',
  'transfers.result.number': '№ {number}',
  'transfers.result.routeLabel': 'Маршрут',
  'transfers.result.summary': '{date}, {time} · пассажиров: {passengers}',
  'transfers.result.orders': 'Мои заказы',
  'transfers.result.home': 'На главную',

  // Отказы сервера, которые фронт умеет назвать словами (правило 0.29 — те же проверки есть и на бэке).
  'transfers.error.route': 'Проверьте маршрут: нужны и «откуда», и «куда».',
  'transfers.error.returnTrip': 'Обратный рейс не может быть раньше самой поездки.',
  'transfers.error.vehicle': 'Выбранный класс автомобиля больше недоступен — выберите другой.',
  'transfers.error.passengers': 'Пассажиров больше, чем вмещает выбранный класс автомобиля.',
  'transfers.error.luggage': 'Багаж не помещается в выбранный класс автомобиля.',
  'transfers.error.dateClosed': 'На эту дату трансферы недоступны — выберите другую.',
  'transfers.error.datePast': 'Эта дата уже прошла — выберите другую.',
  'transfers.error.time': 'Укажите время подачи.',
  'transfers.error.generic': 'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.',
  'transfers.error.session': 'Сессия истекла — войдите заново, чтобы отправить заявку.',

  // ── Date picker ───────────────────────────────────────────────────────────────────────────
  'datePicker.placeholder': 'Выберите дату',
  /* Суффикс к `aria-label` погашенной даты: визуальное отличие (зачёркивание) должно быть
     продублировано словом. */
  'datePicker.unavailable': 'недоступно',
  /* Суффикс к `aria-label` дня внутри диапазона скидки: красная лента «-15%» нарисована
     как графика (`aria-hidden`), поэтому смысл дублируется словами. */
  'datePicker.discount': 'скидка {percent}%',
  'datePicker.prevMonth': 'Предыдущий месяц',
  'datePicker.nextMonth': 'Следующий месяц',
  'datePicker.month.0': 'Январь',
  'datePicker.month.1': 'Февраль',
  'datePicker.month.2': 'Март',
  'datePicker.month.3': 'Апрель',
  'datePicker.month.4': 'Май',
  'datePicker.month.5': 'Июнь',
  'datePicker.month.6': 'Июль',
  'datePicker.month.7': 'Август',
  'datePicker.month.8': 'Сентябрь',
  'datePicker.month.9': 'Октябрь',
  'datePicker.month.10': 'Ноябрь',
  'datePicker.month.11': 'Декабрь',
  'datePicker.weekdayShort.0': 'Пн',
  'datePicker.weekdayShort.1': 'Вт',
  'datePicker.weekdayShort.2': 'Ср',
  'datePicker.weekdayShort.3': 'Чт',
  'datePicker.weekdayShort.4': 'Пт',
  'datePicker.weekdayShort.5': 'Сб',
  'datePicker.weekdayShort.6': 'Вс',

  // ── 404 / route error ─────────────────────────────────────────────────────────────────────
  'notFound.title': 'Страница не найдена',
  'notFound.body': 'Возможно, маршрут снят с продажи или ссылка неверна.',
  'notFound.allTrips': 'Все путешествия',
  'error.title': 'Что-то пошло не так',
  'error.body': 'Попробуйте обновить страницу или вернуться позже.',
  'error.reload': 'Обновить',

  // ── Auth ─────────────────────────────────────────────────────────────────────────────────
  // Covers all six screens under `/auth` (`features/auth`). The ADMIN panel is Russian-only by
  // design and does NOT read these — `features/admin/users` keeps its own literals, the same way
  // `catalogErrors.ts` does.
  'auth.welcomeBack': 'С возвращением',
  'auth.createAccount': 'Создать аккаунт',
  'auth.subtitleLogin': 'Войдите, чтобы видеть свои брони и избранное.',
  'auth.subtitleRegister': 'Сохраняйте избранные маршруты и следите за бронями.',
  'auth.tabLogin': 'Вход',
  'auth.tabRegister': 'Регистрация',
  'auth.modeToggleLabel': 'Вход или регистрация',
  'auth.firstName': 'Имя',
  'auth.lastName': 'Фамилия (необязательно)',
  'auth.username': 'Логин',
  'auth.usernameOrEmail': 'Логин или email',
  'auth.email': 'Email',
  'auth.phone': 'Телефон',
  'auth.phonePlaceholder': '55 123 456',
  'auth.phoneHelpTitle': 'Зачем номер телефона',
  'auth.phoneHelpAria': 'Справка: зачем номер телефона',
  'auth.phoneHelpBody':
    'Нужен только для связи по бронированию — подтвердим детали тура и адрес отправления.',
  'auth.phoneIncomplete': 'Похоже, номер введён не полностью',
  'auth.countrySelectLabel': 'Код страны',
  'auth.countrySearchPlaceholder': 'Найти страну',
  'auth.countryNoResults': 'Страна не найдена',
  'auth.password': 'Пароль',
  'auth.confirmPassword': 'Повторите пароль',
  'auth.forgotPassword': 'Забыли пароль?',
  /** Чекбокс «запомнить меня» на форме входа (spec 014 §4): без него сессия живёт час без
   * активности и заканчивается вместе с вкладкой, с ним — 14 дней. */
  'auth.rememberMe': 'Запомнить меня',
  'auth.submitLogin': 'Войти',
  'auth.submitRegister': 'Зарегистрироваться',
  'auth.submitting': 'Отправляем…',
  'auth.terms': 'Продолжая, вы соглашаетесь с условиями сервиса.',
  'auth.backHome': 'Вернуться на главную',

  // Split screen `/auth` only (Spec 005) — the photo column's copy and the sign-in states.
  // Deliberately dictionary strings, not `SiteSetting` keys: nothing here is copy David has
  // asked to tune, and adding four admin fields for it would be four fields to maintain.
  'auth.photo.eyebrow': 'Личный кабинет',
  'auth.photo.title': 'Ваши поездки по Армении',
  'auth.photo.titleShort': 'Ваши поездки',
  'auth.photo.subtitle': 'Бронирования, история и данные для связи — в одном месте.',
  'auth.photo.trust1': '11 регионов, только Армения',
  'auth.photo.trust2': 'Подтверждение брони на почту',
  'auth.photo.trust3': 'Предоплата 20 %, остальное на месте',
  'auth.checking': 'Проверяем…',
  'auth.successLogin': 'Готово. Открываем ваш личный кабинет…',
  'auth.signedIn': 'Вход выполнен',

  // Registration → «письмо отправлено»
  'auth.checkEmailTitle': 'Проверьте почту',
  'auth.checkEmailBody':
    'Мы отправили ссылку для подтверждения на {email}. Перейдите по ней, чтобы активировать аккаунт — без этого вход невозможен.',
  /** Fallback address for a direct visit to `/auth/check-email`, which carries no router state. */
  'auth.yourEmail': 'вашу почту',
  'auth.devTokenHint': 'Режим разработки: письма не отправляются, подтвердите по ссылке ниже.',
  'auth.devTokenOpen': 'Подтвердить сейчас',
  /** Кнопка переотправки письма (2026-08-27). Обратный отсчёт — часть подписи, а не отдельная
   *  строка рядом: кнопка в это время выключена, и её собственное имя должно объяснять почему. */
  'auth.resendAction': 'Отправить письмо ещё раз',
  'auth.resendCooldown': 'Отправить ещё раз можно через {seconds} с',
  /** Формулировка намеренно условная: эндпоинт отвечает одинаково и когда письмо ушло, и когда
   *  адрес неизвестен/уже подтверждён/попал в кулдаун — экран не должен выдавать разницу. */
  'auth.resendSent':
    'Если аккаунт ещё ждёт подтверждения, письмо отправлено повторно. Проверьте почту и папку «Спам».',

  // Verify email
  'auth.verifyTitle': 'Подтверждение почты',
  'auth.verifyPending': 'Проверяем ссылку…',
  'auth.verifySuccess': 'Почта подтверждена. Теперь можно войти.',
  'auth.verifyAction': 'Войти',

  // Forgot password
  'auth.forgotTitle': 'Восстановление пароля',
  'auth.forgotSubtitle': 'Укажите email — пришлём ссылку для установки нового пароля.',
  'auth.forgotSubmit': 'Отправить ссылку',
  'auth.forgotSent':
    'Если такой аккаунт существует, письмо со ссылкой уже отправлено. Проверьте почту.',

  // Reset password
  'auth.resetTitle': 'Новый пароль',
  'auth.resetSubmit': 'Сохранить пароль',
  'auth.resetSuccess': 'Пароль изменён. Войдите с новым паролем.',

  // Change password
  'auth.changePasswordTitle': 'Смена пароля',
  'auth.currentPassword': 'Текущий пароль',
  'auth.newPassword': 'Новый пароль',
  'auth.changeSubmit': 'Сменить пароль',
  'auth.changeSuccess': 'Пароль обновлён.',
  'auth.forceChangeNotice': 'Прежде чем продолжить, нужно сменить пароль.',

  // Account (signed in)
  'auth.accountMenu': 'Меню аккаунта',
  'auth.accountRole': 'Роль',
  'auth.role.regular': 'Пользователь',
  'auth.role.tourManager': 'Тур-менеджер',
  'auth.role.admin': 'Администратор',
  'auth.role.employee': 'Исполнитель',
  // Роль, созданная в панели: у неё нет `RoleType`, а её внутреннее имя — не для клиента.
  'auth.role.custom': 'Сотрудник',
  'auth.goToPanel': 'Панель',
  'auth.logout': 'Выйти',

  // ── Личный кабинет `/account` ─────────────────────────────────────────────────────────────
  'account.title': 'Личный кабинет',
  'account.fullName': 'Имя и фамилия',
  'account.emailStatus': 'Статус почты',
  'account.emailVerified': 'Подтверждена',
  'account.emailUnverified': 'Не подтверждена',
  'account.change': 'Изменить',
  'account.close': 'Свернуть',
  'account.cancel': 'Отмена',
  'account.changeEmailAria': 'Изменить email',
  'account.changePhoneAria': 'Изменить телефон',
  'account.changePasswordAria': 'Изменить пароль',
  'account.phoneNotSet': 'Не указан',
  'account.phoneSubmit': 'Сохранить телефон',
  'account.phoneSaved': 'Телефон обновлён.',

  // Смена email — шаги 1-3 здесь, шаг 4 на отдельной странице.
  'account.emailIntro':
    'Смена почты в два подтверждения: сначала код на текущий адрес {email}, затем ссылка на новый.',
  'account.emailStart': 'Сменить email',
  'account.emailCodeSent': 'Мы отправили код на {email}. Введите его ниже.',
  'account.emailCodeLabel': 'Код из письма',
  'account.emailCodeSubmit': 'Подтвердить код',
  'account.emailCodeAccepted': 'Код принят. Укажите новый адрес — на него придёт ссылка.',
  'account.newEmailLabel': 'Новый email',
  'account.newEmailSubmit': 'Отправить ссылку',
  'account.emailLinkSent': 'Ссылка отправлена на {email}. Откройте её, чтобы завершить смену.',
  'account.emailLinkLogoutWarning':
    'После подтверждения нужно будет войти заново — уже с новым адресом.',
  'account.devCodeHint': 'Режим разработки: письма не отправляются, код ниже.',

  // Шаг 4 — страница по ссылке из письма.
  'account.confirmTitle': 'Смена email',
  'account.confirmPending': 'Проверяем ссылку…',
  'account.confirmSuccess': 'Email изменён. Войдите заново с новым адресом.',

  // Привязка Telegram (ADR 031). Статус обновляется при следующем заходе на страницу —
  // подтверждение происходит в мессенджере, а не здесь, поллинга нет намеренно.
  'account.telegram': 'Telegram',
  'account.telegramAria': 'Настроить Telegram',
  'account.telegramNotLinked': 'Не подключён',
  'account.telegramLinked': 'Подключён',
  'account.telegramStatusUnknown': 'Статус недоступен',
  'account.telegramIntro':
    'Подключите Telegram, чтобы получать уведомления о заказах в мессенджере.',
  'account.telegramGetCode': 'Получить код',
  'account.telegramGetNewCode': 'Получить новый код',
  'account.telegramCodeLabel': 'Код привязки',
  'account.telegramCodeHint':
    'Откройте бота по кнопке ниже и нажмите «Старт» — код подставится сам. Если открываете бота ' +
    'вручную, отправьте ему команду /start и этот код.',
  'account.telegramCodeExpires': 'Код действует {minutes} мин. Новый код отменяет предыдущий.',
  'account.telegramOpenInApp': 'Открыть в Telegram',
  'account.telegramCopy': 'Скопировать',
  'account.telegramCopied': 'Скопировано',
  'account.telegramCopyAria': 'Скопировать код привязки',
  'account.telegramRefreshHint':
    'Страница обновится сама — возвращаться и нажимать F5 не нужно.',
  'account.telegramWaiting': 'Ждём ответ от Telegram…',
  'account.telegramWaitingHint':
    'Нажмите «Старт» в чате с ботом и возвращайтесь — мы сразу покажем результат.',
  'account.telegramNotYet':
    'Пока не видим подключения. Если вы уже нажали «Старт», подождите пару секунд — проверка идёт.',
  'account.telegramJustLinked': 'Telegram подключён.',
  'account.telegramLinkedAccount': 'Аккаунт Telegram',
  'account.telegramLinkedHint': 'Уведомления о заказах приходят в этот чат.',
  'account.telegramDisconnect': 'Отключить',
  'account.telegramDisconnected': 'Telegram отключён.',

  // Активные сеансы (spec 017 §4). Раздел свёрнут по умолчанию и грузит список только при первом
  // раскрытии — см. `SessionsSection`.
  'account.sessions': 'Активные сеансы',
  'account.sessionsAria': 'Показать активные сеансы',
  'account.sessionsShow': 'Показать',
  'account.sessionsSummary': 'Устройства, на которых выполнен вход',
  'account.sessionsIntro':
    'Здесь видно, откуда выполнен вход в ваш аккаунт. Если какое-то устройство вам незнакомо — ' +
    'завершите его сеанс и смените пароль.',
  'account.sessionsLoading': 'Загружаем список устройств…',
  'account.sessionsLoadFailed': 'Не удалось загрузить список устройств.',
  'account.sessionsRetry': 'Повторить',
  'account.sessionsEmpty': 'Других активных сеансов нет.',
  'account.sessionsCurrent': 'Это устройство',
  'account.sessionsUnknownDevice': 'Устройство не определено',
  'account.sessionsSignedInAt': 'Вход: {moment}',
  'account.sessionsExpiresAt': 'Действует до {moment}',
  'account.sessionsRevoke': 'Завершить',
  'account.sessionsRevoking': 'Завершаем…',
  'account.sessionsRevokeAria': 'Завершить сеанс: {device}',
  'account.sessionsRevokeOthers': 'Выйти на других устройствах',
  'account.sessionsRevokedOne': 'Сеанс завершён.',
  'account.sessionsRevokedOthers': 'Сеансы на других устройствах завершены.',

  'account.error.codeInvalid': 'Код неверный или уже истёк.',
  'account.error.linkInvalid': 'Ссылка недействительна или устарела.',
  'account.error.notConfirmed': 'Сначала подтвердите код со старого адреса.',
  'account.error.emailTaken': 'Этот email уже занят другим аккаунтом.',
  'account.error.telegramNotConfigured':
    'Telegram-бот пока не настроен на сервере — привязка временно недоступна.',

  // ── Кабинет · Способы связи (батч 2026-08-29) ────────────────────────────────────────────
  // Заголовок раздела — общий `account.sectionContacts` (он же подпись в рельсе): две строки с
  // одним смыслом рано или поздно разъезжаются, и тогда рельс и заголовок называют разное.
  'account.contacts.desc':
    'Мы используем их при оформлении заказа — вам не придётся вводить контакты заново. ' +
    'Можно указать и не свой контакт.',
  'account.contacts.listLabel': 'Сохранённые способы связи',
  'account.contacts.add': 'Добавить контакт',
  'account.contacts.primaryBadge': 'Основной',
  'account.contacts.makePrimary': 'Сделать основным',
  'account.contacts.makePrimaryAria': 'Сделать основным контактом: {contact}',
  'account.contacts.edit': 'Изменить',
  'account.contacts.editAria': 'Изменить контакт: {contact}',
  'account.contacts.delete': 'Удалить',
  'account.contacts.deleteAria': 'Удалить контакт: {contact}',
  'account.contacts.primaryNote':
    'Основной контакт всегда один. Назначая основным другой, вы снимаете метку с прежнего — ' +
    'отдельно этого делать не нужно.',
  'account.contacts.limitNote': 'В профиле уже {max} контактов — больше добавить нельзя.',

  'account.contacts.formTitleNew': 'Новый контакт',
  'account.contacts.formTitleEdit': 'Изменение контакта',
  'account.contacts.fillFromProfile': 'Заполнить из профиля',
  'account.contacts.firstName': 'Имя',
  'account.contacts.lastName': 'Фамилия',
  'account.contacts.method': 'Способ связи',
  'account.contacts.valueLabelPhone': 'Номер телефона',
  'account.contacts.valueLabelEmail': 'Адрес почты',
  'account.contacts.valueLabelTelegram': 'Имя пользователя Telegram',
  'account.contacts.hintPhone': 'Международный формат: + и от 8 до 15 цифр.',
  'account.contacts.hintEmail': 'Например, name@example.com.',
  'account.contacts.hintTelegram': '@имя_пользователя или номер телефона с «+».',
  'account.contacts.isPrimaryField': 'Сделать основным контактом',
  'account.contacts.isPrimaryLocked':
    'Это основной контакт — метка снимется, когда вы назначите основным другой.',
  'account.contacts.save': 'Сохранить контакт',
  'account.contacts.saving': 'Сохраняем…',
  'account.contacts.saved': 'Контакт «{contact}» сохранён.',
  'account.contacts.primaryChanged': 'Основной контакт — «{contact}».',
  'account.contacts.removed': 'Контакт «{contact}» удалён.',

  'account.contacts.methodPhone': 'Телефон',
  'account.contacts.methodWhatsApp': 'WhatsApp',
  'account.contacts.methodTelegram': 'Telegram',
  'account.contacts.methodViber': 'Viber',
  'account.contacts.methodEmail': 'Почта',

  'account.contacts.errorPhone':
    'Номер должен начинаться с «+» и содержать от 8 до 15 цифр — например, +374 91 23 45 67.',
  'account.contacts.errorEmail': 'Введите адрес почты — например, name@example.com.',
  'account.contacts.errorTelegram': 'Укажите @имя_пользователя или номер телефона с «+».',
  'account.contacts.errorFirstName': 'Укажите имя.',
  'account.contacts.errorLastName': 'Укажите фамилию.',

  'account.contacts.emptyTitle': 'Контактов пока нет',
  'account.contacts.emptyBody':
    'Добавьте способ связи — при оформлении заказа он подставится сам, и вводить его каждый ' +
    'раз не придётся.',
  'account.contacts.emptyManual': 'Добавить вручную',
  'account.contacts.loadFailedTitle': 'Не удалось загрузить контакты',
  'account.contacts.loadFailedBody':
    'Проверьте соединение и попробуйте ещё раз. Остальные разделы кабинета при этом работают.',
  'account.contacts.retry': 'Повторить',

  'account.contacts.deleteTitle': 'Удалить контакт?',
  'account.contacts.deleteBody':
    '{contact}. Контакт исчезнет из подсказок при оформлении заказа. На уже созданные заказы ' +
    'это не влияет.',
  'account.contacts.deleteConfirm': 'Удалить',
  'account.contacts.deleting': 'Удаляем…',

  'account.error.contactValueInvalid': 'Значение не подходит выбранному способу связи.',
  'account.error.contactLimit': 'В профиле не может быть больше {max} контактов.',
  'account.error.contactNotFound': 'Контакт не найден — возможно, он уже удалён.',

  // ── Кабинет · Мои заказы (батч 2026-08-29) ───────────────────────────────────────────────
  'account.orders.desc': 'Заказы и заявки, оформленные под этим аккаунтом. Новые — сверху.',
  'account.orders.listLabel': 'Мои заказы и заявки',
  'account.orders.number': '№ {number}',
  'account.orders.created': 'создан {date}',
  'account.orders.totalLabel': 'Итого',
  'account.orders.priceNegotiated': 'Цена согласовывается',
  'account.orders.colService': 'Услуга',
  'account.orders.colDate': 'Дата',
  'account.orders.colGuests': 'Гостей',
  'account.orders.colEmployee': 'Исполнитель',
  'account.orders.linesLabel': 'Состав заказа № {number}',
  'account.orders.employeeNone': 'Ещё не назначен',
  'account.orders.employeePending': 'Назначим после согласования',
  'account.orders.employeeNotAssigned': '—',
  'account.orders.roundTrip': 'Туда-обратно',
  'account.orders.requestNotice':
    'Мы получили заявку и считаем стоимость. Менеджер свяжется по основному контакту — {contact}.',
  'account.orders.requestNoticeNoContact':
    'Мы получили заявку и считаем стоимость. Менеджер свяжется с вами в ближайшее время.',

  'account.orders.statusOpen': 'Открыт',
  'account.orders.statusHold': 'На удержании',
  'account.orders.statusApproved': 'Одобрен',
  'account.orders.statusRejected': 'Отклонён',
  'account.orders.statusReadyForAssignment': 'Готов к назначению',
  'account.orders.statusPendingPayment': 'Ждёт оплаты',
  'account.orders.statusCompleted': 'Завершён',
  'account.orders.statusRequest': 'Заявка',

  'account.orders.roleDriver': 'водитель',
  'account.orders.roleGuide': 'гид',
  'account.orders.roleDriverGuide': 'водитель-гид',

  'account.orders.emptyTitle': 'Заказов пока нет',
  'account.orders.emptyBody':
    'Здесь появятся ваши бронирования и заявки на трансфер — с номером, статусом и составом поездки.',
  'account.orders.emptyTrips': 'Смотреть туры',
  'account.orders.emptyTransfer': 'Заказать трансфер',
  'account.orders.loadFailedTitle': 'Не удалось загрузить заказы',
  'account.orders.loadFailedBody':
    'Сервер не ответил. Ваши заказы никуда не делись — попробуйте обновить список.',
  'account.orders.retry': 'Повторить',
  'account.orders.loading': 'Загружаем заказы',

  // Errors
  'auth.error.invalidCredentials': 'Неверный логин или пароль.',
  'auth.error.accountLocked':
    'Аккаунт временно заблокирован из-за неудачных попыток входа. Попробуйте через 15 минут.',
  'auth.error.emailNotVerified': 'Почта не подтверждена — перейдите по ссылке из письма.',
  'auth.error.verificationTokenInvalid': 'Ссылка недействительна или устарела.',
  'auth.error.resetTokenInvalid': 'Ссылка для смены пароля недействительна или устарела.',
  'auth.error.usernameTaken': 'Такой логин уже занят.',
  'auth.error.validation': 'Проверьте правильность заполнения полей.',
  'auth.error.network': 'Нет связи с сервером. Проверьте соединение и попробуйте ещё раз.',
  'auth.error.generic': 'Что-то пошло не так. Попробуйте ещё раз.',
  'auth.error.passwordTooShort': 'Пароль должен быть не короче {min} символов.',
  'auth.error.passwordMismatch': 'Пароли не совпадают.',
  'auth.error.usernameTooShort': 'Логин должен быть не короче {min} символов.',

  // ── shared/ui primitives ──────────────────────────────────────────────────────────────────
  // The built-in copy of the primitives themselves — NOT feature strings. A primitive may not
  // import a feature's copy module (`shared` → `features` is backwards), so its own defaults live
  // here and are read with `t()`. Several of these surface only inside `/admin`; that is fine —
  // it is ~20 keys, and the alternative would be a second dictionary for the same components.
  'ui.select.placeholder': 'Выберите…',
  'ui.select.searchPlaceholder': 'Поиск…',
  'ui.select.noResults': 'Ничего не найдено',
  'ui.toolbar.cancel': 'Отмена',
  'ui.toolbar.save': 'Сохранить',
  'ui.toolbar.add': 'Добавить',
  'ui.toolbar.delete': 'Удалить',
  'ui.spinner.loading': 'Загрузка',
  'ui.help.trigger': 'Справка: {title}',
  'ui.help.close': 'Закрыть',
  'ui.unsaved.title': 'Уйти без сохранения?',
  'ui.unsaved.message':
    'Изменения ещё не сохранены. Если уйти со страницы сейчас, они будут потеряны.',
  'ui.unsaved.confirm': 'Уйти',
  'ui.unsaved.stay': 'Остаться',
  'ui.sortable.itemFallback': 'Элемент',
  'ui.sortable.dragHandle': 'Перетащить, чтобы изменить порядок',
  'ui.sortable.instructions':
    'Чтобы взять элемент для перемещения, нажмите пробел или Enter. Пока элемент взят, ' +
    'перемещайте его стрелками вверх и вниз, затем нажмите пробел или Enter ещё раз, чтобы ' +
    'отпустить на новой позиции, либо Escape, чтобы отменить.',
  'ui.sortable.dragStart': 'Начато перемещение: «{item}», позиция {index} из {total}.',
  'ui.sortable.dragOver': '«{item}» перемещён на позицию {index} из {total}.',
  'ui.sortable.dragEnd': 'Перемещение завершено. «{item}» теперь на позиции {index} из {total}.',
  'ui.sortable.dragCancel': 'Перемещение отменено. «{item}» остался на позиции {index} из {total}.',

  // ── Кабинет: разделы (мокап «Личный кабинет», 2026-08-29) ─────────────────────────────────
  'account.eyebrow': 'Аккаунт',
  'account.navAria': 'Разделы личного кабинета',
  /* Полные подписи — для вертикального рельса на десктопе. Короткие — для полосы разделов на
     телефоне: шесть пунктов не влезают в 375 px ни при каком размере шрифта, полоса прокручивается,
     и «Способы связи» съедали бы треть экрана, удлиняя эту прокрутку без пользы. */
  'account.sectionProfile': 'Профиль',
  'account.sectionContacts': 'Способы связи',
  'account.sectionContactsShort': 'Контакты',
  'account.sectionOrders': 'Мои заказы',
  'account.sectionOrdersShort': 'Заказы',
  'account.sectionPreferences': 'Предпочтения',
  'account.sectionConnections': 'Подключения',
  'account.sectionSecurity': 'Безопасность',
  'account.profileDesc':
    'Данные аккаунта. Имя и логин меняет менеджер — напишите нам, если в них ошибка.',
  /** Предупреждение вместо красной строки в карточке: цвет без действия рядом ничего не решает. */
  'account.emailUnverifiedTitle': 'Почта не подтверждена',
  'account.emailUnverifiedBody':
    'Без подтверждения мы не сможем прислать подтверждение заказа. Письмо уходит на {email}.',
  'account.emailVerifySend': 'Отправить письмо',
  'account.securityDesc':
    'Данные для входа в аккаунт. Это не способы связи для заказа — их редактируют в разделе «Способы связи».',
  'account.connectionsDesc':
    'Внешние сервисы, через которые мы можем с вами связаться. Это не способ входа в аккаунт.',
  // ── Кабинет: «Предпочтения» (§7 мокапа «Личный кабинет», 2026-08-29) ──────────────────────
  /* Главное, что раздел обязан сообщить: это НЕ «настройки страницы», а «мои настройки» — они
     переезжают на другое устройство, и те же переключатели стоят в шапке сайта. */
  'account.pref.description':
    'Сохраняются в аккаунте — на другом устройстве вы увидите то же самое. Переключатели в шапке сайта меняют эти же настройки.',
  'account.pref.loading': 'Загружаем настройки',
  'account.pref.loadFailedTitle': 'Настройки не загрузились',
  'account.pref.loadFailedBody':
    'Мы не смогли получить ваши предпочтения. Проверьте связь и попробуйте ещё раз.',
  'account.pref.retry': 'Повторить',

  'account.pref.theme': 'Тема',
  'account.pref.themeHintDark': 'Сейчас на сайте по умолчанию тёмная.',
  'account.pref.themeHintLight': 'Сейчас на сайте по умолчанию светлая.',
  'account.pref.themeDark': 'Тёмная',
  'account.pref.themeLight': 'Светлая',

  'account.pref.palette': 'Палитра',
  'account.pref.paletteHint': 'Личный выбор. Не тронете — останется та, что выбрана на сайте.',
  /* Названия пресетов живут здесь, а не приходят с сервера: `GetPublic` отдаёт
     `theme.activePalette` одним id, каталога названий у него нет. Новый пресет — новая пара. */
  'account.pref.paletteObsidian': 'Обсидиан + золото',
  'account.pref.paletteBasalt': 'Базальт и медь',
  'account.pref.paletteDefaultChip': 'по умолчанию',
  'account.pref.paletteFollowsSite': 'Текущая палитра сайта',
  'account.pref.palettePersonal': 'Личный выбор',

  'account.pref.currency': 'Валюта',
  'account.pref.currencyHint': 'Цены пересчитываются по курсу; счёт всё равно в драмах.',

  'account.pref.language': 'Язык',
  'account.pref.languageHint': 'На этом же языке приходят письма и сообщения о заказах.',

  'account.pref.notifications': 'Уведомления о заказах',
  'account.pref.notificationsHint': 'Хотя бы один канал должен остаться включённым.',
  'account.pref.channelEmail': 'Email',
  'account.pref.channelTelegram': 'Telegram',
  'account.pref.telegramNotLinked': 'Аккаунт не привязан — включать нечего.',
  'account.pref.telegramUnknown': 'Не удалось проверить привязку — попробуйте обновить страницу.',
  'account.pref.telegramConnect': 'Подключить Telegram',
  /* Заказчик решил, что настройка каналов распространяется и на служебные письма. Человек обязан
     узнать об этом В МОМЕНТ выключения email, а не через месяц, когда забудет пароль. */
  'account.pref.emailOffTitle': 'Тогда и вход в аккаунт пойдёт через Telegram',
  'account.pref.emailOffBody':
    'Письмо для сброса пароля и подтверждение почты придут в Telegram, а не на email. Потеряете доступ к мессенджеру — восстановить аккаунт будет нечем.',
  'account.pref.lastChannel':
    'Нельзя выключить оба канала — иначе вы не узнаете о собственном заказе.',

  'account.pref.saved': 'Настройки сохранены.',
  'account.pref.saveFailed': 'Не удалось сохранить — проверьте связь и попробуйте ещё раз.',
  'account.pref.errorNoChannels':
    'Сервер не принял пустой набор каналов: хотя бы один должен остаться включённым.',
  'account.pref.errorTelegramUnavailable':
    'Telegram не привязан к аккаунту — включить этот канал не получится.',
  'account.pref.errorUnknownValue':
    'Сервер не знает такую настройку — обновите страницу и попробуйте ещё раз.',

  // ── Контакт для связи по заказу (OrderContactsPicker, батч 2026-08-29) ───────────────────
  // Один блок на корзину и на конструктор трансфера, поэтому копия НЕ под `cart.*`.
  'orderContacts.title': 'Контакт для связи',
  'orderContacts.subtitle':
    'По этим контактам менеджер свяжется именно по этому заказу — можно указать местный номер, а не тот, что в профиле.',
  'orderContacts.count': 'Выбрано: {count} из {max}',
  'orderContacts.primaryBadge': 'Основной',
  'orderContacts.primaryNote': 'Основному контакту позвонят первым.',
  'orderContacts.makePrimary': 'Сделать основным',
  'orderContacts.makePrimaryAria': 'Сделать основным контактом заказа: {contact}',
  'orderContacts.remove': 'Убрать',
  'orderContacts.removeAria': 'Убрать контакт из заказа: {contact}',
  'orderContacts.savedTitle': 'Сохранённые контакты',
  'orderContacts.pick': 'Добавить',
  'orderContacts.pickAria': 'Добавить в заказ контакт: {contact}',
  'orderContacts.addManual': 'Добавить ещё контакт',
  'orderContacts.formTitle': 'Контакт для этого заказа',
  'orderContacts.formSubmit': 'Добавить контакт',
  'orderContacts.loading': 'Загружаем сохранённые контакты…',
  'orderContacts.loadFailed':
    'Сохранённые контакты не загрузились — введите контакт вручную, на отправку заявки это не влияет.',
  'orderContacts.anonymous':
    'Сохранённые контакты появятся после входа в аккаунт — сейчас впишите контакт вручную.',
  'orderContacts.directoryEmpty':
    'В профиле пока нет сохранённых контактов — заполните форму или подставьте данные аккаунта.',
  'orderContacts.limitReached': 'В одном заказе не больше {max} контактов.',
  'orderContacts.duplicate': 'Такой контакт уже добавлен в заказ.',
  // Отказы сервера (2060-2063). Формулировки называют, что именно исправить, — «ошибка 2063»
  // не подсказывает ничего.
  'orderContacts.error.required':
    'Добавьте контакт для связи — без него заявку принять не получится.',
  'orderContacts.error.tooMany': 'Больше {max} контактов на один заказ — уберите лишние.',
  'orderContacts.error.primary':
    'Основным должен быть отмечен ровно один контакт — выберите, кому звонить первым.',
  'orderContacts.error.value':
    'Один из контактов не подходит выбранному способу связи — проверьте номер или адрес.',
  // Отправку блокирует не позиция, а отсутствие контакта — текст ведёт к блоку контактов,
  // а не к списку, в котором ничего не отмечено.
  'cart.summary.blockedContacts': 'Добавьте контакт для связи, чтобы отправить заявку',
  // ── Мастер заявки на трансфер: 3 шага (2026-08-29) ────────────────────────────────────────
  /* Названия шагов называют РЕЗУЛЬТАТ, а не действие: «Маршрут и время» отвечает на вопрос «что
     я здесь заполню», а «Заполните маршрут» — команда, которую человек и так выполняет. Они же
     стоят заголовками групп в сводке на последнем шаге, поэтому обязаны читаться и как
     существительное. */
  'transfers.request.wizardStep1': 'Маршрут и время',
  'transfers.request.wizardStep2': 'Пассажиры и багаж',
  'transfers.request.wizardStep3': 'Контакты и отправка',
  'transfers.request.wizardCounter': 'Шаг {current} из {total}',
  'transfers.request.wizardNext': 'Далее',
  'transfers.request.wizardBack': 'Назад',
  'transfers.request.wizardNavAria': 'Шаги заявки',
  'transfers.request.wizardProgressAria': 'Прогресс заполнения заявки',
  'transfers.request.wizardGoTo': 'Вернуться к шагу {n}: {title}',

  'transfers.request.summaryTitle': 'Проверьте заявку',
  'transfers.request.summaryRoute': 'Маршрут',
  'transfers.request.summaryWhen': 'Когда',
  'transfers.request.summaryWhenValue': '{date}, {time}',
  'transfers.request.summaryReturn': 'Обратно',
  'transfers.request.summaryLuggage': 'Багаж',
  'transfers.request.summaryLuggageValue': 'средних: {medium}, больших: {large}',
  'transfers.request.summaryVehicle': 'Класс авто',
  'transfers.request.summaryComment': 'Комментарий',
  'transfers.request.summaryEdit': 'Изменить',
  'transfers.request.summaryEditAria': 'Изменить: {section}',

} as const

export type TranslationKey = keyof typeof ru

const en: Record<TranslationKey, string> = {
  'common.close': 'Close',
  'common.expand': 'Expand',
  'common.collapse': 'Collapse',

  'nav.home': 'Home',
  'nav.trips': 'Trips',
  'nav.regions': 'Region map',
  'nav.regionsShort': 'Map',
  'nav.transfers': 'Transfers',
  'nav.transfersShort': 'Transfer',
  'nav.login': 'Log in',
  'nav.account': 'Account',
  'nav.mainAriaLabel': 'Main navigation',

  'footer.navigation': 'Navigation',
  'footer.contacts': 'Contacts',
  'footer.rights': 'All rights reserved.',

  'theme.light': 'Light theme',
  'theme.dark': 'Dark theme',

  'language.switchTo': 'Switch to {language}',

  'currency.switchAriaLabel': 'Display currency',
  'currency.optionAriaLabel': '{code}',
  'currency.unavailable': 'Exchange rates are unavailable — prices are shown in drams',
  'currency.rateNote': '1 {code} ≈ {amount}',
  'currency.baseCurrency': 'Base currency',
  'currency.updatedAt': 'Rate updated at {time}',
  'currency.rateStale': 'Rate may be outdated',

  'home.hero.regionsCta': 'Region map',
  'home.featured.allCatalog': 'View all',
  'home.testimonials.eyebrow': 'Reviews',
  'home.testimonials.title': 'What our guests say',
  'home.testimonials.rating': 'Rating {rating} out of 5',

  'hero.fallback.title': 'Armenia beyond the guidebooks',
  'hero.fallback.subtitle':
    'Monasteries tucked into gorges, the black tuff of Gyumri, Areni wine and Sevan at sunrise. ' +
    'Small groups and local guides — from day trips to routes across the whole south.',
  'hero.fallback.ctaLabel': 'View trips',

  'regions.eyebrow': 'Interactive map',
  'regions.title': 'Armenia by region',
  'regions.subtitle': '11 regions, each with its own character. Pick a region on the map — we’ll show what to see there.',
  'regions.expand': 'Explore by region',
  'regions.collapse': 'Collapse map',
  'regions.mapAriaLabel': 'Map of Armenia’s regions',
  'regions.empty.placeholder': 'Pick a region',
  'regions.empty.hint': 'Hover a region to see how many routes it has, then click — we’ll show the list.',
  'regions.panel.label': 'Region',
  'regions.panel.close': 'Close region panel',
  'regions.panel.expand': 'Expand region panel',
  'regions.panel.collapse': 'Collapse region panel',
  'regions.panel.retry': 'Retry',
  'regions.panel.errorTitle': 'Couldn’t load trips',
  'regions.panel.errorBody': 'Check your connection — no data came through.',
  'regions.panel.emptyTitle': 'No routes here yet',
  'regions.panel.emptyBody': 'We’re preparing programs for {region}. Check neighbouring regions or the full catalog.',
  'regions.panel.allCatalog': 'Full catalog',
  'regions.previewBar.label': 'Selected region',
  'regions.previewBar.open': 'View',
  'regions.previewBar.dismiss': 'Clear region selection',

  'tours.eyebrow': 'Catalog',
  'tours.empty.title': 'Nothing matches these filters',
  'tours.empty.body': 'Try loosening a filter — raise the price ceiling or pick a different region.',
  'tours.empty.reset': 'Reset filters',
  'filter.kind.all': 'All',
  'filter.kind.tour': 'Tours',
  'filter.kind.excursion': 'Excursions',
  'filter.kind.ariaLabel': 'Product type',
  'filter.search.placeholder': 'Search by name…',
  'filter.search.ariaLabel': 'Search by name',
  'filter.region.label': 'Region',
  'filter.region.all': 'All regions',
  'filter.region.count': 'Regions ({count})',
  'filter.region.ariaLabel': 'Regions',
  'filter.price.label': 'Price',
  'filter.price.ariaLabel': 'Price and sorting',
  'filter.price.range': 'Price range',
  'filter.price.from': 'Price from',
  'filter.price.to': 'Price to',
  'filter.price.fromShort': 'from',
  'filter.price.toShort': 'to',
  'filter.price.fromPlaceholder': 'from {value}',
  'filter.price.toPlaceholder': 'to {value}',
  'filter.price.sort': 'Sort by',
  'filter.price.sortDefault': 'Default',
  'filter.price.sortCheaper': 'Price: low to high',
  'filter.price.sortPricier': 'Price: high to low',
  'filter.price.cheaperShort': 'low to high',
  'filter.price.pricierShort': 'high to low',
  'filter.price.reset': 'Reset price and sorting',
  'filter.resultCount': 'Found: {count}',
  'filter.reset': 'Reset',

  'tourCard.priceFrom': 'from',
  'tourCard.discountUntil': 'until {date}',
  'chip.tour': 'Tour',
  'chip.excursion': 'Excursion',
  'chip.transfer': 'Transfer',
  'chip.formatIndividual': 'Individual',
  'chip.formatGroup': 'Group',
  'chip.formatBoth': 'Individual / group',
  'tourCard.pricePerPerson': 'per person',

  'tourDetail.breadcrumb': 'Catalog',
  'tourDetail.itineraryOneDay': 'Day plan',
  'tourDetail.itineraryMultiDay': 'Day-by-day plan',
  'tourDetail.included': 'Included',
  'tourDetail.notIncluded': 'Not included',
  'tourDetail.organizationalDetails': 'Good to know',
  'tourDetail.restrictions': 'Restrictions',
  'tourDetail.expenses': 'Additional expenses',
  'tourDetail.moreIn': 'More in {region}',
  'tourDetail.andUp': 'and up',
  'tourDetail.dayFallback': 'Day {n}',
  'tourDetail.notFound': 'Tour not found',

  'gallery.openFullscreen': 'Open photo fullscreen',
  'gallery.prev': 'Previous photo',
  'gallery.next': 'Next photo',
  'gallery.photoAlt': 'Photo {n}',
  'gallery.close': 'Close',
  'gallery.counter': '{current} / {total}',

  'booking.smallGroup': 'small group',
  'booking.dateLabel': 'Departure date',
  'booking.dateMissing': 'Pick a departure date',
  'booking.guests': 'Guests',
  'booking.guestsFewer': 'Fewer guests',
  'booking.guestsMore': 'More guests',
  'booking.total': 'Total',
  'booking.prepayment': '20% prepayment',
  'booking.submitHint': 'No payment now — we’ll confirm and send the details',
  'booking.submitHintLargeGroup': 'We’ll price your group and get back to you',
  'booking.largeGroupFallback':
    'For groups of 7 and more we quote individually — send a request and we’ll come back with a price.',
  'booking.dateUnavailable': 'That date is no longer available — please pick another.',
  'booking.datePast': 'That date is in the past — please pick another.',
  'booking.submitFailed': 'Could not send the request. Check your connection and try again.',
  'booking.sessionExpired': 'Your session expired — sign in again to finish booking.',

  'booking.formatLabel': 'Format',
  'booking.formatIndividualHint': 'Your group only, priced per booking',
  'booking.formatGroupHint': 'Shared group, priced per person',
  'booking.startTimeLabel': 'Departure time',
  'booking.startTimeMissing': 'Pick a departure time',
  'booking.startTimeUnavailable':
    'This trip cannot be booked yet — no departure time has been scheduled. Message us and we will arrange a date.',
  'booking.perPerson': '{price} per person',
  'booking.seatsLeft': '{count} seat(s) left',
  'booking.noSeats': 'No seats left for this day — please try another date',
  'booking.notEnoughSeats': 'Only {count} seat(s) left for this departure — reduce the guest count',
  'booking.startTimeInvalid': 'That departure time is no longer available — please pick another.',
  'booking.formatRequired': 'Pick a format — individual or group.',

  'cart.nav.aria': 'Cart, {count} item(s)',
  'cart.title': 'Cart',
  'cart.subtitle': 'Check the dates and guest counts — one tap sends the whole request',
  'cart.addToCart': 'Add to cart',
  'cart.added.title': 'Added to cart',
  'cart.added.titleUpdated': 'Updated in cart',
  'cart.added.goToCart': 'Go to cart',
  'cart.added.continue': 'Keep browsing',
  'cart.error.full': 'The cart holds 10 trips at most — send the request or remove something',
  'cart.error.tooManyLines': 'One request can hold 10 trips at most — remove something and try again',
  'cart.empty.title': 'Your cart is empty',
  'cart.empty.body': 'Pick a trip, choose a date and a guest count — it will show up here',
  'cart.empty.action': 'Browse trips',
  'cart.line.remove': 'Remove from cart',
  'cart.line.price': 'Price',
  'cart.line.unavailable': 'This trip is no longer available — remove it to send the request',
  'cart.line.guestCountInvalid': 'Invalid guest count — change it and try again',
  'cart.line.startTime': 'Departure time',
  'cart.summary.total': 'Total',
  'cart.summary.itemCount': '{count} item(s)',
  'cart.summary.quoteNote': 'Some of these trips are quoted individually',
  'cart.summary.submit': 'Send request',
  'cart.summary.submitting': 'Sending…',
  'cart.summary.blockedUnavailable': 'Remove the unavailable trips to continue',
  'cart.summary.blockedLines': 'Fix the marked trips and send the request again',
  'cart.summary.hint': 'No payment now — we’ll confirm and send the details',
  'cart.summary.rejectedNote': 'The request was not created — nothing has been sent',
  'cart.auth.title': 'Sign in to continue',
  'cart.auth.body': 'Sign in — your cart is kept, nothing has to be picked again',
  'cart.auth.action': 'Sign in and continue',
  'cart.result.title': 'Request sent',
  'cart.result.body':
    'We’ll get in touch within a day to confirm dates. The deposit is due after confirmation.',
  'cart.result.orderNumberLabel': 'Order number',
  'cart.result.orderNumber': 'Order #{number}',
  'cart.result.lineCount': 'Trips in this request: {count}',
  'cart.result.lineCountTotal': 'Trips in this request: {count} · {total} in total',
  'cart.result.continue': 'Browse other trips',
  'cart.line.pickupTime': 'Pickup time',
  'cart.line.vehicleClass': 'Vehicle class',
  'cart.line.return': 'Return',
  'cart.line.oneWay': 'One way',
  'cart.line.passengers': 'Passengers',
  'cart.line.transferUnavailable':
    'This transfer is no longer available — remove it to send the request',

  'transfers.eyebrow': 'Transfers across Armenia',
  'transfers.title': 'Ready-made routes',
  'transfers.subtitle':
    'Airport pickups, city-to-city rides and trips to the landmarks. The price is fixed and known upfront.',
  'transfers.pricePerCar': 'price per car',
  'transfers.priceFrom': 'from',
  'transfers.found': 'Found: {count}',
  'transfers.priceUnknown': 'on request',

  'transfers.filter.from': 'From',
  'transfers.filter.to': 'To',
  'transfers.filter.all': 'All',
  'transfers.filter.reset': 'Reset',
  'transfers.filter.fromAria': 'Filter: departure point',
  'transfers.filter.toAria': 'Filter: destination',

  'transfers.builder.eyebrow': 'Your own route',
  'transfers.builder.title': 'Cannot find the route you need?',
  'transfers.builder.body':
    'Build it yourself — set the points, the date and the time. A manager will pick the car and confirm the price.',
  'transfers.builder.action': 'Build your own transfer',

  'transfers.empty.title': 'No ready-made routes yet',
  'transfers.empty.body':
    'You can still book a transfer — build the route yourself and we will pick the car and the price.',
  'transfers.emptyFiltered.title': 'We have not built {route} yet',
  'transfers.emptyFiltered.body':
    'There is no ready-made transfer for this direction. But this is exactly what the builder is for — the route is already filled in.',
  'transfers.emptyFiltered.action': 'Build {route}',
  'transfers.emptyFiltered.showAll': 'Show all routes',

  'transfers.notFound.title': 'Transfer not found',
  'transfers.notFound.body': 'This route may have been taken down, or the link is wrong.',
  'transfers.notFound.action': 'All transfers',

  'transfers.detail.routeHeading': 'Route',
  'transfers.detail.pointFrom': 'From',
  'transfers.detail.pointStop': 'Stop',
  'transfers.detail.pointTo': 'To',
  'transfers.detail.dateLabel': 'Trip date',
  'transfers.detail.pickupTimeLabel': 'Pickup time',
  'transfers.detail.pickupTimePlaceholder': 'Pick a time',
  'transfers.detail.returnToggle': 'I need a return transfer',
  'transfers.detail.returnDateLabel': 'Return date',
  'transfers.detail.returnTimeLabel': 'Return time',
  'transfers.detail.passengers': 'Passengers',
  'transfers.detail.passengersFewer': 'Fewer passengers',
  'transfers.detail.passengersMore': 'More passengers',
  'transfers.detail.vehicleLabel': 'Vehicle class',
  'transfers.detail.vehicleHelpTitle': 'Vehicle class',
  'transfers.detail.vehicleHelpBody':
    'The price is for the whole car, not per person. If no class fits your passenger count or luggage, ' +
    'send a request instead — a manager will find the vehicle and agree the price with you.',
  'transfers.detail.capacity': 'up to {count} passengers',
  'transfers.detail.luggage': '{count} luggage units',
  'transfers.detail.oneWayPrice': 'one way {price}',
  'transfers.detail.roundTripPrice': 'round trip {price}',
  'transfers.detail.totalOneWay': 'Total · one way',
  'transfers.detail.totalRoundTrip': 'Total · round trip',
  'transfers.detail.perCarNote': 'per car, not per person',
  'transfers.detail.submitHint': 'Payment after a manager confirms',
  'transfers.detail.noVehicles':
    'This transfer cannot be booked yet — prices per vehicle class are not set. Write to us and we will quote it.',
  'transfers.detail.dateMissing': 'Pick the trip date',
  'transfers.detail.timeMissing': 'Set the pickup time',
  'transfers.detail.returnMissing': 'Set the return date and time',
  'transfers.detail.returnInvalid': 'The return leg cannot start before the trip itself',
  'transfers.detail.vehicleMissing': 'Pick a vehicle class',
  'transfers.detail.dateClosed': 'Transfers are unavailable on this date — pick another one',
  'transfers.detail.overCapacityTitle': 'A bigger vehicle is needed',
  'transfers.detail.overCapacityBody':
    'The largest class seats {count} passengers. For {passengers} we will find the vehicle and agree the price individually.',
  'transfers.detail.priceOnRequest': 'Price agreed individually',
  'transfers.detail.priceLabel': 'Price',
  'transfers.detail.requestAction': 'Send a request',
  'transfers.detail.requestHint': 'A request instead of a payment. A manager will call and quote it.',
  'transfers.detail.vehicleTooSmall': 'fewer seats than passengers',

  'transfers.request.eyebrow': 'Your own route',
  'transfers.request.title': 'Build your transfer',
  'transfers.request.notice':
    'This is a request: a manager will confirm the exact price once the car is picked.',
  'transfers.request.noticeHelpTitle': 'Why there is no price here',
  'transfers.request.noticeHelpBody':
    'The price of a custom route depends on the distance, the number of stops and the class of the car. ' +
    'A manager will work it out and get back to you — nothing is due before you confirm.',

  'transfers.request.step1': 'Route',
  'transfers.request.fromLabel': 'From',
  'transfers.request.fromPlaceholder': 'For example, Yerevan, Zvartnots Airport',
  'transfers.request.toLabel': 'To',
  'transfers.request.toPlaceholder': 'For example, Dilijan',
  'transfers.request.stopsLabel': 'Intermediate stops',
  'transfers.request.stopPlaceholder': 'For example, Garni',
  'transfers.request.stopNumber': 'Stop {n}',
  'transfers.request.stopAdd': 'Add a stop',
  'transfers.request.stopRemove': 'Remove the stop',
  'transfers.request.stopUp': 'Move up',
  'transfers.request.stopDown': 'Move down',
  'transfers.request.stopDrag': 'Drag the stop',
  'transfers.request.stopItemLabel': 'Stop',
  'transfers.request.stopLimit': 'More than {count} stops is no longer a transfer — that is a tour',
  'transfers.request.suggestionsEmpty': 'Not in our catalogue — your own text works too',

  'transfers.request.step2': 'When',
  'transfers.request.dateLabel': 'Date',
  'transfers.request.step3': 'Passengers and luggage',
  'transfers.request.luggageLabel': 'Luggage — optional',
  'transfers.request.luggageHelpTitle': 'How luggage is counted',
  'transfers.request.luggageHelpBody':
    'One medium suitcase takes 3 units of space, a large one takes 5. Every vehicle class has its own limit; ' +
    'if you leave luggage empty, we simply check nothing.',
  'transfers.request.luggageMedium': 'Medium suitcase',
  'transfers.request.luggageMediumUnits': 'Medium suitcase · 3 units each',
  'transfers.request.luggageLarge': 'Large suitcase',
  'transfers.request.luggageLargeUnits': 'Large suitcase · 5 units each',
  'transfers.request.luggageFewer': 'One item fewer',
  'transfers.request.luggageMore': 'One item more',
  'transfers.request.luggageOtherLabel': 'Anything else — pram, skis, bicycle',
  'transfers.request.luggageOtherPlaceholder': 'In your own words',

  'transfers.request.step4': 'Preferences',
  'transfers.request.vehicleLabel': 'Preferred vehicle class',
  'transfers.request.vehicleAny': 'No preference — pick for me',
  'transfers.request.commentLabel': 'Note for the manager',
  'transfers.request.commentPlaceholder': 'Child seat, meet-and-greet sign, anything special…',

  'transfers.request.submit': 'Send request',
  'transfers.request.submitting': 'Sending…',
  'transfers.request.submitHint': 'A manager will call within the working day and confirm the price.',
  'transfers.request.submitLock': 'Do not close the page',

  'transfers.request.fromMissing': 'Say where to pick you up',
  'transfers.request.toMissing': 'Say where to take you',
  'transfers.request.stopEmpty': 'Fill the stop in or remove it',
  'transfers.request.luggageTooMuchTitle': 'Luggage does not fit into "{vehicle}"',
  'transfers.request.luggageTooMuchBody':
    'You listed {units} units ({medium} medium + {large} large), and this class takes {capacity}. Pick a roomier class or reduce the luggage.',
  'transfers.request.luggageShort': '{count} luggage units short',
  'transfers.request.capacityTooSmall': 'fewer seats than passengers',

  'transfers.auth.title': 'Sign in to send the request',
  'transfers.auth.body':
    'The request is tied to your account — that is how you see its status and the manager’s reply.',
  'transfers.auth.action': 'Sign in or create an account',
  'transfers.auth.saved': 'Everything you filled in is saved',

  'transfers.result.title': 'Request received',
  'transfers.result.body': 'A manager will call you within the working day and confirm the price.',
  'transfers.result.numberLabel': 'Request number',
  'transfers.result.number': '#{number}',
  'transfers.result.routeLabel': 'Route',
  'transfers.result.summary': '{date}, {time} · passengers: {passengers}',
  'transfers.result.orders': 'My orders',
  'transfers.result.home': 'Home',

  'transfers.error.route': 'Check the route: both a start and a destination are required.',
  'transfers.error.returnTrip': 'The return leg cannot start before the trip itself.',
  'transfers.error.vehicle': 'The chosen vehicle class is no longer available — pick another one.',
  'transfers.error.passengers': 'More passengers than the chosen vehicle class seats.',
  'transfers.error.luggage': 'The luggage does not fit into the chosen vehicle class.',
  'transfers.error.dateClosed': 'Transfers are unavailable on this date — pick another one.',
  'transfers.error.datePast': 'This date is already in the past — pick another one.',
  'transfers.error.time': 'Set the pickup time.',
  'transfers.error.generic': 'Could not send the request. Check your connection and try again.',
  'transfers.error.session': 'Your session expired — sign in again to send the request.',

  'datePicker.placeholder': 'Pick a date',
  'datePicker.unavailable': 'unavailable',
  'datePicker.discount': '{percent}% off',
  'datePicker.prevMonth': 'Previous month',
  'datePicker.nextMonth': 'Next month',
  'datePicker.month.0': 'January',
  'datePicker.month.1': 'February',
  'datePicker.month.2': 'March',
  'datePicker.month.3': 'April',
  'datePicker.month.4': 'May',
  'datePicker.month.5': 'June',
  'datePicker.month.6': 'July',
  'datePicker.month.7': 'August',
  'datePicker.month.8': 'September',
  'datePicker.month.9': 'October',
  'datePicker.month.10': 'November',
  'datePicker.month.11': 'December',
  'datePicker.weekdayShort.0': 'Mo',
  'datePicker.weekdayShort.1': 'Tu',
  'datePicker.weekdayShort.2': 'We',
  'datePicker.weekdayShort.3': 'Th',
  'datePicker.weekdayShort.4': 'Fr',
  'datePicker.weekdayShort.5': 'Sa',
  'datePicker.weekdayShort.6': 'Su',

  'notFound.title': 'Page not found',
  'notFound.body': 'This route may have been taken down, or the link is wrong.',
  'notFound.allTrips': 'All trips',
  'error.title': 'Something went wrong',
  'error.body': 'Try reloading the page, or come back later.',
  'error.reload': 'Reload',

  'auth.welcomeBack': 'Welcome back',
  'auth.createAccount': 'Create an account',
  'auth.subtitleLogin': 'Log in to see your bookings and favourites.',
  'auth.subtitleRegister': 'Save favourite routes and track your bookings.',
  'auth.tabLogin': 'Log in',
  'auth.tabRegister': 'Sign up',
  'auth.modeToggleLabel': 'Log in or sign up',
  'auth.firstName': 'First name',
  'auth.lastName': 'Last name (optional)',
  'auth.username': 'Username',
  'auth.usernameOrEmail': 'Username or email',
  'auth.email': 'Email',
  'auth.phone': 'Phone',
  'auth.phonePlaceholder': '55 123 456',
  'auth.phoneHelpTitle': 'Why we ask for a phone number',
  'auth.phoneHelpAria': 'Help: why we ask for a phone number',
  'auth.phoneHelpBody':
    "It's only used to reach you about a booking — to confirm the trip's details and pickup address.",
  'auth.phoneIncomplete': "That number doesn't look complete yet",
  'auth.countrySelectLabel': 'Country code',
  'auth.countrySearchPlaceholder': 'Find a country',
  'auth.countryNoResults': 'No country found',
  'auth.password': 'Password',
  'auth.confirmPassword': 'Repeat password',
  'auth.forgotPassword': 'Forgot password?',
  'auth.rememberMe': 'Remember me',
  'auth.submitLogin': 'Log in',
  'auth.submitRegister': 'Sign up',
  'auth.submitting': 'Sending…',
  'auth.terms': 'By continuing, you agree to the terms of service.',
  'auth.backHome': 'Back to home',

  'auth.photo.eyebrow': 'Your account',
  'auth.photo.title': 'Your trips across Armenia',
  'auth.photo.titleShort': 'Your trips',
  'auth.photo.subtitle': 'Bookings, history and contact details in one place.',
  'auth.photo.trust1': '11 regions, Armenia only',
  'auth.photo.trust2': 'Booking confirmation by email',
  'auth.photo.trust3': '20% deposit, the rest on arrival',
  'auth.checking': 'Checking…',
  'auth.successLogin': 'Done. Opening your account…',
  'auth.signedIn': 'Signed in',

  'auth.checkEmailTitle': 'Check your email',
  'auth.checkEmailBody':
    'We sent a confirmation link to {email}. Follow it to activate your account — you cannot log in until you do.',
  'auth.yourEmail': 'your email',
  'auth.devTokenHint': 'Development mode: no email is actually sent, use the link below.',
  'auth.devTokenOpen': 'Confirm now',
  'auth.resendAction': 'Send the email again',
  'auth.resendCooldown': 'You can resend in {seconds}s',
  'auth.resendSent':
    'If the account is still waiting for confirmation, the email has been sent again. Check your inbox and the spam folder.',

  'auth.verifyTitle': 'Email confirmation',
  'auth.verifyPending': 'Checking the link…',
  'auth.verifySuccess': 'Email confirmed. You can log in now.',
  'auth.verifyAction': 'Log in',

  'auth.forgotTitle': 'Password recovery',
  'auth.forgotSubtitle': 'Enter your email and we will send a link to set a new password.',
  'auth.forgotSubmit': 'Send the link',
  'auth.forgotSent': 'If that account exists, the link is already on its way. Check your email.',

  'auth.resetTitle': 'New password',
  'auth.resetSubmit': 'Save password',
  'auth.resetSuccess': 'Password changed. Log in with the new one.',

  'auth.changePasswordTitle': 'Change password',
  'auth.currentPassword': 'Current password',
  'auth.newPassword': 'New password',
  'auth.changeSubmit': 'Change password',
  'auth.changeSuccess': 'Password updated.',
  'auth.forceChangeNotice': 'You must change your password before continuing.',

  'auth.accountMenu': 'Account menu',
  'auth.accountRole': 'Role',
  'auth.role.regular': 'Customer',
  'auth.role.tourManager': 'Tour manager',
  'auth.role.admin': 'Administrator',
  'auth.role.employee': 'Employee',
  'auth.role.custom': 'Staff',
  'auth.goToPanel': 'Panel',
  'auth.logout': 'Log out',

  'account.title': 'My account',
  'account.fullName': 'Full name',
  'account.emailStatus': 'Email status',
  'account.emailVerified': 'Verified',
  'account.emailUnverified': 'Not verified',
  'account.change': 'Change',
  'account.close': 'Collapse',
  'account.cancel': 'Cancel',
  'account.changeEmailAria': 'Change email',
  'account.changePhoneAria': 'Change phone number',
  'account.changePasswordAria': 'Change password',
  'account.phoneNotSet': 'Not set',
  'account.phoneSubmit': 'Save phone number',
  'account.phoneSaved': 'Phone number updated.',

  'account.emailIntro':
    'Changing your email takes two confirmations: a code sent to {email}, then a link sent to the new address.',
  'account.emailStart': 'Change email',
  'account.emailCodeSent': 'We sent a code to {email}. Enter it below.',
  'account.emailCodeLabel': 'Code from the email',
  'account.emailCodeSubmit': 'Confirm code',
  'account.emailCodeAccepted': 'Code accepted. Enter the new address — we will send a link to it.',
  'account.newEmailLabel': 'New email',
  'account.newEmailSubmit': 'Send the link',
  'account.emailLinkSent': 'A link was sent to {email}. Open it to finish the change.',
  'account.emailLinkLogoutWarning':
    'Once confirmed, you will need to log in again — with the new address.',
  'account.devCodeHint': 'Development mode: no email is sent, the code is below.',

  'account.confirmTitle': 'Email change',
  'account.confirmPending': 'Checking the link…',
  'account.confirmSuccess': 'Email changed. Log in again with the new address.',

  'account.telegram': 'Telegram',
  'account.telegramAria': 'Set up Telegram',
  'account.telegramNotLinked': 'Not connected',
  'account.telegramLinked': 'Connected',
  'account.telegramStatusUnknown': 'Status unavailable',
  'account.telegramIntro': 'Connect Telegram to get order notifications in the messenger.',
  'account.telegramGetCode': 'Get a code',
  'account.telegramGetNewCode': 'Get a new code',
  'account.telegramCodeLabel': 'Link code',
  'account.telegramCodeHint':
    'Open the bot with the button below and press “Start” — the code is filled in for you. If you ' +
    'open the bot by hand, send it the /start command together with this code.',
  'account.telegramCodeExpires':
    'The code is valid for {minutes} min. A new code cancels the previous one.',
  'account.telegramOpenInApp': 'Open in Telegram',
  'account.telegramCopy': 'Copy',
  'account.telegramCopied': 'Copied',
  'account.telegramCopyAria': 'Copy the link code',
  'account.telegramRefreshHint':
    'This page updates itself — there is no need to come back and hit refresh.',
  'account.telegramWaiting': 'Waiting for Telegram…',
  'account.telegramWaitingHint':
    'Press “Start” in the chat with the bot and come back — we will show the result right away.',
  'account.telegramNotYet':
    'We do not see the connection yet. If you already pressed “Start”, give it a couple of seconds — we are checking.',
  'account.telegramJustLinked': 'Telegram connected.',
  'account.telegramLinkedAccount': 'Telegram account',
  'account.telegramLinkedHint': 'Order notifications arrive in this chat.',
  'account.telegramDisconnect': 'Disconnect',
  'account.telegramDisconnected': 'Telegram disconnected.',

  'account.sessions': 'Active sessions',
  'account.sessionsAria': 'Show active sessions',
  'account.sessionsShow': 'Show',
  'account.sessionsSummary': 'Devices you are signed in on',
  'account.sessionsIntro':
    'This is where your account is currently signed in from. If you do not recognise a device, ' +
    'end its session and change your password.',
  'account.sessionsLoading': 'Loading your devices…',
  'account.sessionsLoadFailed': 'Could not load your devices.',
  'account.sessionsRetry': 'Try again',
  'account.sessionsEmpty': 'There are no other active sessions.',
  'account.sessionsCurrent': 'This device',
  'account.sessionsUnknownDevice': 'Unrecognised device',
  'account.sessionsSignedInAt': 'Signed in: {moment}',
  'account.sessionsExpiresAt': 'Valid until {moment}',
  'account.sessionsRevoke': 'End session',
  'account.sessionsRevoking': 'Ending…',
  'account.sessionsRevokeAria': 'End session: {device}',
  'account.sessionsRevokeOthers': 'Sign out on other devices',
  'account.sessionsRevokedOne': 'Session ended.',
  'account.sessionsRevokedOthers': 'Sessions on your other devices have been ended.',

  'account.error.codeInvalid': 'That code is wrong or has expired.',
  'account.error.linkInvalid': 'This link is invalid or has expired.',
  'account.error.notConfirmed': 'Confirm the code from your old address first.',
  'account.error.emailTaken': 'That email already belongs to another account.',
  'account.error.telegramNotConfigured':
    'The Telegram bot is not configured on the server yet — linking is temporarily unavailable.',

  'account.contacts.desc':
    'We use them when you place an order, so you never have to type them in again. ' +
    'The contact does not have to be your own.',
  'account.contacts.listLabel': 'Saved contact methods',
  'account.contacts.add': 'Add a contact',
  'account.contacts.primaryBadge': 'Primary',
  'account.contacts.makePrimary': 'Make primary',
  'account.contacts.makePrimaryAria': 'Make this the primary contact: {contact}',
  'account.contacts.edit': 'Edit',
  'account.contacts.editAria': 'Edit contact: {contact}',
  'account.contacts.delete': 'Delete',
  'account.contacts.deleteAria': 'Delete contact: {contact}',
  'account.contacts.primaryNote':
    'There is always exactly one primary contact. Making another one primary clears the mark ' +
    'from the previous one — you do not have to do it separately.',
  'account.contacts.limitNote': 'Your profile already holds {max} contacts — that is the maximum.',

  'account.contacts.formTitleNew': 'New contact',
  'account.contacts.formTitleEdit': 'Edit contact',
  'account.contacts.fillFromProfile': 'Fill from profile',
  'account.contacts.firstName': 'First name',
  'account.contacts.lastName': 'Last name',
  'account.contacts.method': 'Contact method',
  'account.contacts.valueLabelPhone': 'Phone number',
  'account.contacts.valueLabelEmail': 'Email address',
  'account.contacts.valueLabelTelegram': 'Telegram username',
  'account.contacts.hintPhone': 'International format: + and 8 to 15 digits.',
  'account.contacts.hintEmail': 'For example, name@example.com.',
  'account.contacts.hintTelegram': '@username or a phone number starting with “+”.',
  'account.contacts.isPrimaryField': 'Make this the primary contact',
  'account.contacts.isPrimaryLocked':
    'This is the primary contact — the mark moves once you make another one primary.',
  'account.contacts.save': 'Save contact',
  'account.contacts.saving': 'Saving…',
  'account.contacts.saved': 'Contact “{contact}” saved.',
  'account.contacts.primaryChanged': 'Primary contact is now “{contact}”.',
  'account.contacts.removed': 'Contact “{contact}” deleted.',

  'account.contacts.methodPhone': 'Phone',
  'account.contacts.methodWhatsApp': 'WhatsApp',
  'account.contacts.methodTelegram': 'Telegram',
  'account.contacts.methodViber': 'Viber',
  'account.contacts.methodEmail': 'Email',

  'account.contacts.errorPhone':
    'The number must start with “+” and contain 8 to 15 digits — for example, +374 91 23 45 67.',
  'account.contacts.errorEmail': 'Enter an email address — for example, name@example.com.',
  'account.contacts.errorTelegram': 'Enter an @username or a phone number starting with “+”.',
  'account.contacts.errorFirstName': 'Enter a first name.',
  'account.contacts.errorLastName': 'Enter a last name.',

  'account.contacts.emptyTitle': 'No contacts yet',
  'account.contacts.emptyBody':
    'Add a contact method — it will be filled in for you at checkout instead of being typed ' +
    'in every time.',
  'account.contacts.emptyManual': 'Add manually',
  'account.contacts.loadFailedTitle': 'Could not load your contacts',
  'account.contacts.loadFailedBody':
    'Check your connection and try again. The rest of the account still works.',
  'account.contacts.retry': 'Try again',

  'account.contacts.deleteTitle': 'Delete this contact?',
  'account.contacts.deleteBody':
    '{contact}. It will no longer be suggested at checkout. Orders you already placed are ' +
    'not affected.',
  'account.contacts.deleteConfirm': 'Delete',
  'account.contacts.deleting': 'Deleting…',

  'account.error.contactValueInvalid': 'That value does not match the selected contact method.',
  'account.error.contactLimit': 'A profile cannot hold more than {max} contacts.',
  'account.error.contactNotFound': 'Contact not found — it may have been deleted already.',

  'account.orders.desc': 'Orders and requests placed with this account. Newest first.',
  'account.orders.listLabel': 'My orders and requests',
  'account.orders.number': 'No. {number}',
  'account.orders.created': 'created {date}',
  'account.orders.totalLabel': 'Total',
  'account.orders.priceNegotiated': 'Price to be agreed',
  'account.orders.colService': 'Service',
  'account.orders.colDate': 'Date',
  'account.orders.colGuests': 'Guests',
  'account.orders.colEmployee': 'Assigned to',
  'account.orders.linesLabel': 'Contents of order no. {number}',
  'account.orders.employeeNone': 'Not assigned yet',
  'account.orders.employeePending': 'Assigned once agreed',
  'account.orders.employeeNotAssigned': '—',
  'account.orders.roundTrip': 'Round trip',
  'account.orders.requestNotice':
    'We have your request and are working out the price. A manager will reach you on your ' +
    'primary contact — {contact}.',
  'account.orders.requestNoticeNoContact':
    'We have your request and are working out the price. A manager will be in touch shortly.',

  'account.orders.statusOpen': 'Open',
  'account.orders.statusHold': 'On hold',
  'account.orders.statusApproved': 'Approved',
  'account.orders.statusRejected': 'Rejected',
  'account.orders.statusReadyForAssignment': 'Ready to assign',
  'account.orders.statusPendingPayment': 'Awaiting payment',
  'account.orders.statusCompleted': 'Completed',
  'account.orders.statusRequest': 'Request',

  'account.orders.roleDriver': 'driver',
  'account.orders.roleGuide': 'guide',
  'account.orders.roleDriverGuide': 'driver-guide',

  'account.orders.emptyTitle': 'No orders yet',
  'account.orders.emptyBody':
    'Your bookings and transfer requests will appear here — with their number, status and ' +
    'what the trip is made of.',
  'account.orders.emptyTrips': 'Browse tours',
  'account.orders.emptyTransfer': 'Book a transfer',
  'account.orders.loadFailedTitle': 'Could not load your orders',
  'account.orders.loadFailedBody':
    'The server did not respond. Your orders are safe — try refreshing the list.',
  'account.orders.retry': 'Try again',
  'account.orders.loading': 'Loading your orders',

  'auth.error.invalidCredentials': 'Wrong username or password.',
  'auth.error.accountLocked':
    'The account is temporarily locked after too many failed attempts. Try again in 15 minutes.',
  'auth.error.emailNotVerified': 'Email is not confirmed — follow the link we sent you.',
  'auth.error.verificationTokenInvalid': 'This link is invalid or has expired.',
  'auth.error.resetTokenInvalid': 'This password reset link is invalid or has expired.',
  'auth.error.usernameTaken': 'That username is already taken.',
  'auth.error.validation': 'Please check the fields and try again.',
  'auth.error.network': 'No connection to the server. Check your network and try again.',
  'auth.error.generic': 'Something went wrong. Please try again.',
  'auth.error.passwordTooShort': 'The password must be at least {min} characters long.',
  'auth.error.passwordMismatch': 'The passwords do not match.',
  'auth.error.usernameTooShort': 'The username must be at least {min} characters long.',

  'ui.select.placeholder': 'Select…',
  'ui.select.searchPlaceholder': 'Search…',
  'ui.select.noResults': 'Nothing found',
  'ui.toolbar.cancel': 'Cancel',
  'ui.toolbar.save': 'Save',
  'ui.toolbar.add': 'Add',
  'ui.toolbar.delete': 'Delete',
  'ui.spinner.loading': 'Loading',
  'ui.help.trigger': 'Help: {title}',
  'ui.help.close': 'Close',
  'ui.unsaved.title': 'Leave without saving?',
  'ui.unsaved.message': 'Your changes are not saved yet. If you leave now, they will be lost.',
  'ui.unsaved.confirm': 'Leave',
  'ui.unsaved.stay': 'Stay',
  'ui.sortable.itemFallback': 'Item',
  'ui.sortable.dragHandle': 'Drag to reorder',
  'ui.sortable.instructions':
    'To pick up an item, press Space or Enter. While holding, move it with the arrow keys, ' +
    'then press Space or Enter again to drop it in the new position, or Escape to cancel.',
  'ui.sortable.dragStart': 'Started moving “{item}”, position {index} of {total}.',
  'ui.sortable.dragOver': '“{item}” moved to position {index} of {total}.',
  'ui.sortable.dragEnd': 'Move finished. “{item}” is now at position {index} of {total}.',
  'ui.sortable.dragCancel': 'Move cancelled. “{item}” stayed at position {index} of {total}.',

  'account.eyebrow': 'Account',
  'account.navAria': 'Account sections',
  'account.sectionProfile': 'Profile',
  'account.sectionContacts': 'Ways to reach you',
  'account.sectionContactsShort': 'Contacts',
  'account.sectionOrders': 'My orders',
  'account.sectionOrdersShort': 'Orders',
  'account.sectionPreferences': 'Preferences',
  'account.sectionConnections': 'Connections',
  'account.sectionSecurity': 'Security',
  'account.profileDesc':
    'Your account details. The name and username are changed by a manager — write to us if anything is wrong.',
  'account.emailUnverifiedTitle': 'Email is not confirmed',
  'account.emailUnverifiedBody':
    'Until it is confirmed we cannot send you an order confirmation. The letter goes to {email}.',
  'account.emailVerifySend': 'Send the email',
  'account.securityDesc':
    'What you sign in with. These are not the contacts for an order — those live in «Ways to reach you».',
  'account.connectionsDesc':
    'External services we can reach you through. This is not a way to sign in.',
  'account.pref.description':
    'Stored in your account — you will see the same on another device. The switches in the site header change these very settings.',
  'account.pref.loading': 'Loading your settings',
  'account.pref.loadFailedTitle': 'Settings did not load',
  'account.pref.loadFailedBody':
    'We could not fetch your preferences. Check your connection and try again.',
  'account.pref.retry': 'Try again',

  'account.pref.theme': 'Theme',
  'account.pref.themeHintDark': 'The site currently opens in dark by default.',
  'account.pref.themeHintLight': 'The site currently opens in light by default.',
  'account.pref.themeDark': 'Dark',
  'account.pref.themeLight': 'Light',

  'account.pref.palette': 'Palette',
  'account.pref.paletteHint': 'Your own pick. Leave it alone and the site keeps its own palette.',
  'account.pref.paletteObsidian': 'Obsidian + gold',
  'account.pref.paletteBasalt': 'Basalt and copper',
  'account.pref.paletteDefaultChip': 'default',
  'account.pref.paletteFollowsSite': 'The palette the site uses now',
  'account.pref.palettePersonal': 'Your own pick',

  'account.pref.currency': 'Currency',
  'account.pref.currencyHint':
    'Prices are converted at the current rate; the invoice is still in drams.',

  'account.pref.language': 'Language',
  'account.pref.languageHint': 'Emails and order messages arrive in this same language.',

  'account.pref.notifications': 'Order notifications',
  'account.pref.notificationsHint': 'At least one channel has to stay on.',
  'account.pref.channelEmail': 'Email',
  'account.pref.channelTelegram': 'Telegram',
  'account.pref.telegramNotLinked': 'No account is linked — there is nothing to switch on.',
  'account.pref.telegramUnknown': 'We could not check the link — try reloading the page.',
  'account.pref.telegramConnect': 'Connect Telegram',
  'account.pref.emailOffTitle': 'Signing in will then go through Telegram too',
  'account.pref.emailOffBody':
    'The password-reset letter and the email confirmation will arrive in Telegram, not by email. Lose access to the messenger and there is nothing left to recover the account with.',
  'account.pref.lastChannel':
    'Both channels cannot be off — you would not hear about your own order.',

  'account.pref.saved': 'Settings saved.',
  'account.pref.saveFailed': 'Could not save — check your connection and try again.',
  'account.pref.errorNoChannels':
    'The server rejected an empty set of channels: at least one has to stay on.',
  'account.pref.errorTelegramUnavailable':
    'Telegram is not linked to the account — this channel cannot be switched on.',
  'account.pref.errorUnknownValue':
    'The server does not know this setting — reload the page and try again.',

  // ── Order contact (OrderContactsPicker, 2026-08-29) ──────────────────────────────────────
  'orderContacts.title': 'Contact for this order',
  'orderContacts.subtitle':
    'This is how the manager reaches you about THIS order — a local number works, it need not be the one in your profile.',
  'orderContacts.count': 'Selected: {count} of {max}',
  'orderContacts.primaryBadge': 'Primary',
  'orderContacts.primaryNote': 'The primary contact is the one we call first.',
  'orderContacts.makePrimary': 'Make primary',
  'orderContacts.makePrimaryAria': 'Make the primary contact of this order: {contact}',
  'orderContacts.remove': 'Remove',
  'orderContacts.removeAria': 'Remove this contact from the order: {contact}',
  'orderContacts.savedTitle': 'Saved contacts',
  'orderContacts.pick': 'Add',
  'orderContacts.pickAria': 'Add this contact to the order: {contact}',
  'orderContacts.addManual': 'Add another contact',
  'orderContacts.formTitle': 'Contact for this order',
  'orderContacts.formSubmit': 'Add contact',
  'orderContacts.loading': 'Loading your saved contacts…',
  'orderContacts.loadFailed':
    'Your saved contacts did not load — type a contact in by hand, the request can still be sent.',
  'orderContacts.anonymous': 'Saved contacts appear once you sign in — for now, type one in by hand.',
  'orderContacts.directoryEmpty':
    'No saved contacts yet — fill the form in or pull the details from your account.',
  'orderContacts.limitReached': 'One order holds {max} contacts at most.',
  'orderContacts.duplicate': 'That contact is already on this order.',
  'orderContacts.error.required': 'Add a contact — the request cannot be accepted without one.',
  'orderContacts.error.tooMany': 'More than {max} contacts on one order — remove the extra ones.',
  'orderContacts.error.primary':
    'Exactly one contact has to be marked primary — pick who we should call first.',
  'orderContacts.error.value':
    'One of the contacts does not match its contact method — check the number or the address.',
  'cart.summary.blockedContacts': 'Add a contact so we can reach you about this request',
  // ── Transfer request wizard: 3 steps (2026-08-29) ─────────────────────────────────────────
  'transfers.request.wizardStep1': 'Route and time',
  'transfers.request.wizardStep2': 'Passengers and luggage',
  'transfers.request.wizardStep3': 'Contacts and sending',
  'transfers.request.wizardCounter': 'Step {current} of {total}',
  'transfers.request.wizardNext': 'Next',
  'transfers.request.wizardBack': 'Back',
  'transfers.request.wizardNavAria': 'Request steps',
  'transfers.request.wizardProgressAria': 'Request completion progress',
  'transfers.request.wizardGoTo': 'Back to step {n}: {title}',

  'transfers.request.summaryTitle': 'Check the request',
  'transfers.request.summaryRoute': 'Route',
  'transfers.request.summaryWhen': 'When',
  'transfers.request.summaryWhenValue': '{date}, {time}',
  'transfers.request.summaryReturn': 'Return',
  'transfers.request.summaryLuggage': 'Luggage',
  'transfers.request.summaryLuggageValue': 'medium: {medium}, large: {large}',
  'transfers.request.summaryVehicle': 'Vehicle class',
  'transfers.request.summaryComment': 'Comment',
  'transfers.request.summaryEdit': 'Edit',
  'transfers.request.summaryEditAria': 'Edit: {section}',

}

export const DICTIONARIES = { ru, en } satisfies Record<'ru' | 'en', Record<TranslationKey, string>>
