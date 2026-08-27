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

  'account.error.codeInvalid': 'Код неверный или уже истёк.',
  'account.error.linkInvalid': 'Ссылка недействительна или устарела.',
  'account.error.notConfirmed': 'Сначала подтвердите код со старого адреса.',
  'account.error.emailTaken': 'Этот email уже занят другим аккаунтом.',

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

  'account.error.codeInvalid': 'That code is wrong or has expired.',
  'account.error.linkInvalid': 'This link is invalid or has expired.',
  'account.error.notConfirmed': 'Confirm the code from your old address first.',
  'account.error.emailTaken': 'That email already belongs to another account.',

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
}

export const DICTIONARIES = { ru, en } satisfies Record<'ru' | 'en', Record<TranslationKey, string>>
