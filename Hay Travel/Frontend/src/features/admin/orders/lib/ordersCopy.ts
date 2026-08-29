/**
 * Copy and error mapping for the Заказы screens (ADR 019 redesign, 2026-08-16; localised per
 * ADR 021). Translatable text lives inside `defineCopy(ru, en)`; everything else this module owns —
 * the wire error codes, `statusBadgeTone`, `STATUS_ORDER`, the `Intl` formatters — stays a plain
 * export, because none of it is language-dependent in a way a translator could change.
 */

import { defineCopy } from '@/shared/i18n/defineCopy'
import { pluralizeEn, pluralizeRu } from '@/shared/lib/format'
import { ApiError } from '@/shared/lib/http'
import type { Locale } from '@/shared/lib/locale'
import { OrderEventType, OrderStatus } from '@/shared/types/booking'
import type { EmployeeJobRole } from '@/shared/types/employeeRole'

/** `GlobalErrorCode` values this screen's mutations can report. Local numeric constants, same
 * convention `userCopy.ts`/`catalogErrors.ts` follow. */
const TOUR_DATE_UNAVAILABLE = 2014
const INVALID_GUEST_COUNT = 2015
const ORDER_DATE_IN_PAST = 2016
const ORDER_ACCESS_FORBIDDEN = 2019
const ORDER_NOT_FOUND = 2020
const ORDER_NOT_EDITABLE = 2021
const ORDER_LINE_NOT_FOUND = 2026
const USER_IS_NOT_EMPLOYEE = 2027
const ORDER_MUST_HAVE_AT_LEAST_ONE_LINE = 2028
const EMPLOYEE_ROLE_REQUIRED = 2029 // AssignEmployee (Задача D) — employeeRole missing/undefined.
/** UpdateLineEmployee — связку сняли параллельно, править нечего (редизайн 2026-08-23). */
const ORDER_LINE_EMPLOYEE_NOT_FOUND = 2039
/* Батч «Трансферы + формат» (2026-08-29) — отказы `OrderLineService.AddLineAsync`. */
const NO_SEATS_LEFT = 2044
const INVALID_START_TIME_SELECTION = 2045
const ORDER_LINE_FORMAT_REQUIRED = 2046
const VEHICLE_CLASS_NOT_AVAILABLE = 2047
const PASSENGERS_EXCEED_VEHICLE_CAPACITY = 2049
const INVALID_RETURN_TRIP = 2058

export const ordersCopy = defineCopy(
  {
    title: 'Заказы',
    subtitle: 'Заявки с публичного сайта и заказы, оформленные вручную.',

    ordersUnit: (count: number) => `${count} ${pluralizeRu(count, ['заказ', 'заказа', 'заказов'])}`,
    lineUnit: (count: number) => `${count} ${pluralizeRu(count, ['строка', 'строки', 'строк'])}`,
    guestsUnit: (count: number) => `${count} ${pluralizeRu(count, ['гость', 'гостя', 'гостей'])}`,

    statusLabels: {
      [OrderStatus.Open]: 'Открыт',
      [OrderStatus.Hold]: 'На удержании',
      [OrderStatus.Approved]: 'Одобрен',
      [OrderStatus.Rejected]: 'Отклонён',
      [OrderStatus.ReadyForAssignment]: 'Готов к назначению',
      [OrderStatus.PendingPayment]: 'Ждёт оплаты',
      [OrderStatus.Completed]: 'Завершён',
      [OrderStatus.Request]: 'Заявка',
    } as Record<OrderStatus, string>,

    /** Small grey tag pill next to each "История" row — the mockup's §D "тип события". Purely a
     * visual category label; the sentence itself is `event.description` (server-built, verbatim).
     * Rendered `uppercase` by CSS, so these stay lowercase in both languages. */
    eventTypeTagLabels: {
      [OrderEventType.Created]: 'создание',
      [OrderEventType.StatusChanged]: 'статус',
      [OrderEventType.Updated]: 'бронь',
      [OrderEventType.LineAdded]: 'строка',
      [OrderEventType.LineRemoved]: 'строка',
      [OrderEventType.LineUpdated]: 'строка',
      [OrderEventType.EmployeeAssigned]: 'назначение',
      [OrderEventType.EmployeeUnassigned]: 'снятие',
      [OrderEventType.SentToClient]: 'письмо',
      [OrderEventType.PaymentAdded]: 'оплата',
    } as Record<OrderEventType, string>,

    filterAll: 'Все',
    empty: 'Заказов в этом статусе нет.',
    emptyFiltered: 'Ничего не найдено — попробуйте изменить фильтры.',

    filterTourLabel: 'Тур',
    filterTourAll: 'Все туры',
    filterClientLabel: 'Клиент',
    filterClientPlaceholder: 'Имя или email',
    filterNumberLabel: '№ заказа',
    filterNumberPlaceholder: 'Например, 160826-0007',
    filterDateFromLabel: 'Дата тура от',
    filterDateToLabel: 'Дата тура до',
    filtersClear: 'Сбросить фильтры',

    backToList: 'Заказы',
    breadcrumbsLabel: 'Хлебные крошки',
    orderTitle: (number: string) => `Заказ №${number}`,
    createdLabel: 'Создан',
    approvedLabel: 'Одобрен',
    notApprovedYet: 'ещё нет',
    openClient: 'Открыть профиль',
    /** Denormalized `tourTitle` is `null` for a tour deleted after the line was created. */
    tourFallback: (tourId: number) => `Тур #${tourId}`,
    /** Подпись строки БЕЗ продукта (`lineKind === CustomTransfer`). Сервер обычно присылает свою
     * в `tourTitle`; это фолбэк на случай пустого значения — «Тур #null» здесь недопустим. */
    customTransferLine: 'Кастомный трансфер',
    /** Body of the 400 the detail loader throws for a non-numeric `:id`. Never rendered
     * (`AdminErrorBoundary` writes its own text), but it lands in dev tools and logs. */
    invalidOrderId: 'Некорректный идентификатор заказа',

    statusFieldLabel: 'Статус',
    rejectReasonLabel: 'Причина отказа',
    rejectReasonPlaceholder: 'Необязательно',

    tabsLabel: 'Разделы заказа',
    tabOverview: 'Обзор',
    tabPayment: 'Оплата',
    tabFulfillment: 'Детали для выполнения',
    tabHistory: 'История',

    summaryTitle: 'Сводка',
    summaryLines: 'Строк в заказе',
    summaryGuests: 'Гостей',
    summaryGross: 'Сумма по строкам',
    summaryDiscount: 'Скидки',
    summaryPaid: 'Оплачено',
    summaryDue: 'Остаток к оплате',

    actionsLabel: (number: string) => `Дополнительные действия по заказу №${number}`,
    actionsGroupAssign: 'Назначение',
    actionsGroupSend: 'Отправка',
    actionDelete: 'Удалить заказ',
    sendToClientSent: 'Письмо клиенту отправлено.',

    // Contextual action row next to AdminToolbar (checklist §5) — thin wrappers over existing
    // endpoints (SetStatus/AssignEmployee/SendToClient), no new status values introduced.
    /** Tooltip на действии, которое сервер всё равно отклонит по правам (`[RequiresPermission]`
     * → 403). Показывается ИМЕННО как причина недоступности, поэтому побеждает временные
     * `pending`/`frozen` — см. `orderPermissionHints.ts`. */
    noPermissionHint: 'Недостаточно прав',
    actionApprove: 'Одобрить',
    actionApprovePending: 'Одобряем…',
    actionReject: 'Отклонить',
    actionRejectPending: 'Отклоняем…',
    actionReopen: 'Возобновить',
    actionReopenPending: 'Возобновляем…',
    frozenBanner:
      'Заказ отклонён или завершён — редактирование недоступно. Нажмите «Возобновить», чтобы продолжить работу.',
    preDecisionBanner:
      'Заказ ещё не одобрен и не отклонён — редактирование недоступно. Одобрите или отклоните заказ, чтобы продолжить работу.',
    /** Заявка НЕ попадает под `preDecisionBanner`: её как раз и нужно править до одобрения —
     * иначе одобрять было бы нечего (цены у заявки нет). */
    requestBanner:
      'Это заявка: клиент собрал маршрут сам, цены у неё нет. Согласуйте стоимость, проставьте её в блоке «Детали заявки» ниже и сохраните — после этого заказ можно одобрять.',
    actionAssign: 'Назначить исполнителя',
    actionSendToClientLabel: 'Отправить заказ клиенту',
    actionSendToClientPending: 'Отправляем…',
    actionSendToEmployees: 'Отправить заказ исполнителям',
    actionSendToEmployeesPending: 'Отправляем…',
    actionSendToEmployeesHint: 'Сначала назначьте исполнителя хотя бы на одну строку.',
    actionSendToEmployeesSent: 'Письмо исполнителям отправлено повторно.',

    // "Сохранить перед отправкой?" — SendToClient/SendToEmployees don't save the draft themselves
    // (checklist §5); with unsaved changes they ask first, so the PDF/email reflect saved data.
    saveBeforeSendTitle: 'Сохранить перед отправкой?',
    saveBeforeSendBody: 'В заказе есть несохранённые изменения — письмо должно уйти с актуальными данными.',
    saveBeforeSendConfirm: 'Сохранить и отправить',
    saveBeforeSendCancel: 'Отмена',

    // Попап назначения (редизайн 2026-08-23) — мультивыбор людей, у каждого своя роль. Один и
    // тот же попап обслуживает и bulk («на все строки»), и «+ Назначить» в конкретной строке.
    assignTitle: 'Назначить исполнителей',
    assignScopeAllLines: 'Отмеченные сотрудники будут назначены на каждую строку заказа.',
    assignScopeLine: (line: string) => `Отмеченные сотрудники будут назначены на строку: ${line}.`,
    assignFilterPlaceholder: 'Поиск по имени или email',
    // Роль исполнителя (Задача D) — обязательна, дефолт из профиля сотрудника, редактируема.
    assignRoleFieldLabel: 'Роль',
    assignRolePlaceholder: 'Выберите роль…',
    assignRoleAria: (name: string) => `Роль исполнителя: ${name}`,
    assignEmployeeAria: (name: string) => `Выбрать исполнителя: ${name}`,
    /** Метка у уже назначенного человека. Чекбокс при этом НЕ отмечен: назначение аддитивно, и
     * предвыбор разослал бы письма заново всем, кто их уже получил. */
    alreadyAssigned: 'уже назначен',
    assignSubmitSilent: 'Назначить',
    assignSubmitAndSend: 'Назначить и отправить письмо',
    assignCancel: 'Отмена',
    noEmployees: 'В системе нет ни одного пользователя с ролью «Исполнитель».',

    // Снятие исполнителя — адресное (крестик на чипе) или со всей строки сразу.
    unassignLine: 'Снять исполнителя',
    unassignEmployeeAria: (name: string) => `Снять исполнителя: ${name}`,
    unassignConfirmTitleOne: 'Снять исполнителя со строки?',
    unassignConfirmBodyOne: (name: string) =>
      `${name} перестанет быть исполнителем этой строки, его детали для выполнения будут удалены. Уведомление сотруднику отправится, только если включён соответствующий канал в разделе «Настройки уведомлений».`,
    unassignConfirmTitleAll: 'Снять всех исполнителей со строки?',
    unassignConfirmBodyAll:
      'Строка вернётся в статус «Не назначен», детали для выполнения всех её исполнителей будут удалены. Уведомления отправятся, только если включён соответствующий канал в разделе «Настройки уведомлений».',
    unassignConfirmAction: 'Снять',
    unassignConfirmDismiss: 'Отмена',

    // Add → client-only blank draft (checklist §3) — no real creation yet.
    newDraftBanner: 'Новый заказ — черновик. Сохранение появится в отдельной задаче.',
    newDraftSaveHint: 'Создание заказа из этого экрана появится в будущей задаче.',
    newDraftOrderNumber: 'новый',
    newDraftClientPlaceholder: 'Клиент не выбран',

    // Whole-page overlay while a heavy operation (PDF + email) is in flight (checklist §8).
    heavyOpOverlay: 'Формируем PDF и отправляем письмо — это может занять несколько секунд…',

    // "История" tab (checklist §7) — pure readonly timeline.
    historyEmptyTitle: 'Событий пока нет',
    historyEmptyBody: 'Здесь появятся изменения статуса, назначения и платежи по этому заказу.',
    historyAuthorLabel: 'Автор',
    historySystemActor: 'Система',

    deleteConfirmTitle: 'Удалить заказ?',
    deleteConfirmBody: 'Заказ и все его строки/платежи будут удалены безвозвратно.',
    deleteConfirmAction: 'Удалить заказ',
    deleteConfirmDismiss: 'Не удалять',

    linesTitle: 'Строки заказа',
    colProduct: 'Тур',
    colDate: 'Дата',
    colGuests: 'Гостей',
    /** Мн. ч.: у строки теперь 0..N исполнителей (редизайн 2026-08-23). */
    colEmployees: 'Исполнители',
    colPrepayment: 'Предоплата',
    colPrice: 'Цена',
    colDiscount: 'Скидка',
    colTotal: 'Итого',
    employeeUnassigned: 'Не назначен',

    // Параметры строки, появившиеся с трансферами и форматом (батч 2026-08-29). Рисуются
    // чипами под названием продукта, а не отдельными колонками: грид уже 960px минимум, и
    // четыре новые колонки сделали бы его нечитаемым на любом экране.
    lineTimeLabel: 'Время',
    lineFormatLabel: 'Формат',
    lineVehicleClassLabel: 'Класс авто',
    lineRoundTrip: 'Туда-обратно',
    lineReturnLabel: 'Обратно',
    /** Чип у строки-заявки: продукта у неё нет, и это должно быть видно прямо в гриде. */
    lineKindRequest: 'Заявка',

    selectLine: (tour: string) => `Выбрать строку: ${tour}`,
    /** Кнопка «+ Назначить» в ячейке исполнителей — открывает попап с `lineId` этой строки. */
    assignLine: 'Назначить',
    addLine: 'Добавить строку',
    removeLine: 'Удалить строку',
    removeLineSelected: (count: number) => `Удалить (${count})`,

    // Блок «Детали заявки» (пункт 4.5) — рисуется ПОД гридом, обычной карточкой, а не внутри
    // горизонтально прокручиваемой таблицы: маршрут и багаж должны читаться на 375px.
    requestDetailsTitle: 'Детали заявки',
    requestRouteTitle: 'Маршрут',
    requestRouteEmpty: 'Маршрут не указан.',
    requestRouteAria: 'Маршрут заявки',
    requestPassengers: 'Пассажиров',
    requestLuggageTitle: 'Багаж',
    requestLuggageMedium: (count: number) => `Средний чемодан × ${count}`,
    requestLuggageLarge: (count: number) => `Большой чемодан × ${count}`,
    requestLuggageOther: 'Другое',
    requestLuggageUnits: (units: number) => `${units} ${pluralizeRu(units, ['единица', 'единицы', 'единиц'])}`,
    /** Курс «средний = 3, большой = 5» считает сервер (решение 0.13) — за «?», не инлайном. */
    requestLuggageHelp:
      'Багаж считается в условных единицах: средний чемодан — 3 единицы, большой — 5. Итог сравнивается с лимитом багажа выбранного класса авто. «Другое» — свободный текст клиента, в единицы не переводится.',
    requestLuggageEmpty: 'Багаж не указан.',
    requestDesiredClass: 'Желаемый класс авто',
    requestDesiredClassHelp:
      'Это пожелание клиента, а не бронь класса: фактический транспорт и цену согласует менеджер.',
    requestComment: 'Комментарий клиента',
    requestPriceTitle: 'Согласованная цена',
    requestPriceLabel: (currency: string) => `Сумма, ${currency}`,
    requestPriceHelp:
      'Итог строки-заявки проставляется вручную: продукта с ценой у неё нет. Сумма попадёт в «Итого» заказа только после сохранения. У обычной строки по продукту это поле не появляется — там сумма считается сервером.',
    requestPriceNotSet: 'Цена не согласована',

    addLineTitle: 'Новая строка заказа',
    fieldTour: 'Продукт',
    fieldTourPlaceholder: 'Выберите продукт…',
    fieldDate: 'Дата',
    fieldGuests: 'Гостей',
    fieldRequiresPrepayment: 'Требуется предоплата',
    fieldPrepaymentAmount: 'Сумма предоплаты',
    addLineSubmit: 'Добавить',
    addLineCancel: 'Отмена',

    /* ── Поля выбора строки (батч «Трансферы + формат», 2026-08-29, пункт 4.5) ──────────────── */
    fieldStartTime: 'Время старта',
    fieldStartTimePlaceholder: 'Выберите время…',
    fieldPickupTime: 'Время подачи',
    fieldFormat: 'Формат',
    fieldFormatPlaceholder: 'Выберите формат…',
    fieldFormatHint:
      'Продукт продаётся в обоих форматах, и от выбора зависит цена: индивидуальный — фиксированная цена за бронь с наценкой по числу гостей, групповой — цена за человека × гости.',
    fieldVehicleClass: 'Класс авто',
    fieldVehicleClassPlaceholder: 'Выберите класс…',
    fieldRoundTrip: 'Обратный рейс',
    fieldReturnDate: 'Дата обратно',
    fieldReturnTime: 'Время обратно',
    /** Мест в салоне без водителя — подпись у класса авто. */
    seatsUnit: (count: number) => `${count} ${pluralizeRu(count, ['место', 'места', 'мест'])}`,
    vehicleClassFallback: (id: number) => `Класс #${id}`,
    addLineNoStartTimes: 'У продукта не заданы времена старта — строка уйдёт без времени.',
    addLineNoVehicleClasses:
      'У этого трансфера нет ни одного класса авто с ценой — добавьте их в карточке продукта.',

    /* Отказы формы. Каждый зеркалит конкретную серверную проверку `OrderLineService` — правило
       0.29: фронтовая валидация это UX, а не защита. */
    errorTourRequired: 'Выберите продукт.',
    errorDateRequired: 'Укажите дату.',
    errorStartTimeRequired: 'Выберите время старта — оно обязательно.',
    errorPickupTimeRequired: 'Укажите время подачи — оно обязательно.',
    errorFormatRequired: 'Выберите формат — продукт продаётся в обоих.',
    errorVehicleClassRequired: 'Выберите класс авто.',
    errorReturnDateRequired: 'Укажите дату обратного рейса.',
    errorReturnTimeRequired: 'Укажите время обратного рейса.',
    errorReturnBeforeTrip: 'Обратный рейс не может быть раньше самой поездки.',
    errorGuestsOverCapacity: (capacity: number) =>
      `В выбранный класс авто помещается не больше ${capacity}.`,

    discountBadge: (percent: number) => `−${percent}%`,

    paymentsEmpty: 'Проводок по этой строке ещё нет.',
    addPayment: 'Добавить проводку',
    paymentTypeLabel: 'Тип',
    paymentTypePrepayment: 'Предоплата',
    paymentTypePayment: 'Оплата',
    paymentAmountLabel: 'Сумма',
    paymentSubmit: 'Добавить',
    paymentCancel: 'Отмена',
    paymentNumber: (number: string) => `№${number}`,
    linePrepaymentRequired: (amount: string) => `Требуется предоплата: ${amount}`,
    linePrepaymentNotRequired: 'Предоплата не требуется',

    fulfillmentPickupLabel: 'Где забрать клиента',
    fulfillmentPickupPlaceholder: 'Например, у входа в отель «Армения», 09:00',
    fulfillmentNavigatorLabel: 'Ссылка на навигатор',
    fulfillmentNavigatorPlaceholder: 'https://maps.google.com/…',
    // Комментарий исполнителю (редизайн 2026-08-23) — у каждого исполнителя строки свой, RU+EN.
    fulfillmentCommentLabel: 'Комментарий исполнителю',
    fulfillmentCommentPlaceholder: 'Например, у клиента детское кресло и два больших чемодана',
    fulfillmentCommentEnToggle: 'Комментарий на английском',
    fulfillmentCommentEnLabel: 'Комментарий исполнителю (English)',
    /** Факт о поведении системы, не совет: пустой EN-комментарий не «теряется». */
    fulfillmentCommentEnFallbackHint: 'Если оставить пусто, англоязычному исполнителю уйдёт русская версия.',
    fulfillmentLineEmpty: 'На эту строку ещё никто не назначен.',
    fulfillmentEmployeesCount: (count: number) =>
      `${count} ${pluralizeRu(count, ['исполнитель', 'исполнителя', 'исполнителей'])}`,
    fulfillmentSave: 'Сохранить',
    fulfillmentSaved: 'Сохранено.',
    fulfillmentAssignAndSend: 'Назначить и отправить',
    fulfillmentAssignAndSendHint: 'Сначала назначьте на строку хотя бы одного исполнителя.',
    fulfillmentSent: 'Письмо исполнителю отправлено.',

    save: 'Сохранить',
    saving: 'Сохраняем…',
    cancelEdit: 'Отмена',

    dash: '—',

    /** What went wrong. `ordersErrorMessage` picks one of these by `GlobalErrorCode`; the three
     * `action*` templates are the fallbacks that name the failed operation instead. */
    errors: {
      notEditable: 'Заказ уже нельзя редактировать в этом статусе — обновите страницу.',
      notFound: 'Заказ не найден — обновите страницу.',
      lineNotFound: 'Строка заказа не найдена — обновите страницу.',
      lineEmployeeGone: 'Этого исполнителя уже сняли со строки — обновите страницу.',
      forbidden: 'Нет доступа к этому заказу.',
      lastLine: 'Нельзя удалить последнюю строку заказа — удалите весь заказ.',
      notEmployee: 'У выбранного пользователя нет роли «Исполнитель».',
      roleRequired: 'Выберите роль исполнителя — без неё назначить нельзя.',
      dateUnavailable: 'Эта дата закрыта для брони.',
      dateInPast: 'Дата тура не может быть в прошлом.',
      invalidGuestCount: 'Число гостей должно быть не меньше 1.',
      noSeatsLeft: 'На этот выезд не осталось свободных мест — выберите другую дату или время.',
      invalidStartTime: 'Такого времени у продукта нет — обновите страницу и выберите заново.',
      formatRequired: 'Продукт продаётся в обоих форматах — выберите формат.',
      vehicleClassUnavailable: 'У этого трансфера нет цены на выбранный класс авто.',
      passengersOverCapacity: 'Гостей больше, чем помещается в выбранный класс авто.',
      invalidReturnTrip: 'Обратный рейс не может быть раньше самой поездки.',
      actionForbidden: (action: string) => `Не удалось ${action}: недостаточно прав.`,
      actionServer: (action: string, status: number) => `Не удалось ${action}: сервер вернул ошибку (${status}).`,
      actionNetwork: (action: string) => `Не удалось ${action}: проверьте соединение и попробуйте ещё раз.`,
    },

    /** The operation names the `action*` templates above interpolate — a closed set instead of
     * literals at the call sites, so no page hardcodes a sentence fragment. */
    errorActions: {
      approve: 'одобрить заказ',
      reject: 'отклонить заказ',
      reopen: 'возобновить заказ',
      save: 'сохранить заказ',
      saveChanges: 'сохранить изменения',
      delete: 'удалить заказ',
      addLine: 'добавить строку',
      removeLines: 'удалить строки',
      assign: 'назначить исполнителя',
      unassign: 'снять исполнителя',
      assignAndSend: 'назначить и отправить',
      assignAndSendEmail: 'назначить и отправить письмо',
      addPayment: 'добавить проводку',
      sendToClient: 'отправить заказ клиенту',
      sendToEmployees: 'отправить заказ исполнителям',
    },
  },
  {
    title: 'Orders',
    subtitle: 'Requests from the public site and orders created manually.',

    ordersUnit: (count: number) => `${count} ${pluralizeEn(count, ['order', 'orders'])}`,
    lineUnit: (count: number) => `${count} ${pluralizeEn(count, ['line', 'lines'])}`,
    guestsUnit: (count: number) => `${count} ${pluralizeEn(count, ['guest', 'guests'])}`,

    statusLabels: {
      [OrderStatus.Open]: 'Open',
      [OrderStatus.Hold]: 'On hold',
      [OrderStatus.Approved]: 'Approved',
      [OrderStatus.Rejected]: 'Rejected',
      [OrderStatus.ReadyForAssignment]: 'Ready for assignment',
      [OrderStatus.PendingPayment]: 'Pending payment',
      [OrderStatus.Completed]: 'Completed',
      [OrderStatus.Request]: 'Request',
    } as Record<OrderStatus, string>,

    eventTypeTagLabels: {
      [OrderEventType.Created]: 'created',
      [OrderEventType.StatusChanged]: 'status',
      [OrderEventType.Updated]: 'booking',
      [OrderEventType.LineAdded]: 'line',
      [OrderEventType.LineRemoved]: 'line',
      [OrderEventType.LineUpdated]: 'line',
      [OrderEventType.EmployeeAssigned]: 'assigned',
      [OrderEventType.EmployeeUnassigned]: 'unassigned',
      [OrderEventType.SentToClient]: 'email',
      [OrderEventType.PaymentAdded]: 'payment',
    } as Record<OrderEventType, string>,

    filterAll: 'All',
    empty: 'No orders with this status.',
    emptyFiltered: 'Nothing found — try changing the filters.',

    filterTourLabel: 'Tour',
    filterTourAll: 'All tours',
    filterClientLabel: 'Client',
    filterClientPlaceholder: 'Name or email',
    filterNumberLabel: 'Order no.',
    filterNumberPlaceholder: 'For example, 160826-0007',
    filterDateFromLabel: 'Tour date from',
    filterDateToLabel: 'Tour date to',
    filtersClear: 'Reset filters',

    backToList: 'Orders',
    breadcrumbsLabel: 'Breadcrumbs',
    orderTitle: (number: string) => `Order #${number}`,
    createdLabel: 'Created',
    approvedLabel: 'Approved',
    notApprovedYet: 'not yet',
    openClient: 'Open profile',
    tourFallback: (tourId: number) => `Tour #${tourId}`,
    customTransferLine: 'Custom transfer',
    invalidOrderId: 'Invalid order id',

    statusFieldLabel: 'Status',
    rejectReasonLabel: 'Rejection reason',
    rejectReasonPlaceholder: 'Optional',

    tabsLabel: 'Order sections',
    tabOverview: 'Overview',
    tabPayment: 'Payment',
    tabFulfillment: 'Fulfilment details',
    tabHistory: 'History',

    summaryTitle: 'Summary',
    summaryLines: 'Lines in order',
    summaryGuests: 'Guests',
    summaryGross: 'Lines subtotal',
    summaryDiscount: 'Discounts',
    summaryPaid: 'Paid',
    summaryDue: 'Balance due',

    actionsLabel: (number: string) => `More actions for order #${number}`,
    actionsGroupAssign: 'Assignment',
    actionsGroupSend: 'Sending',
    actionDelete: 'Delete order',
    sendToClientSent: 'The email to the client has been sent.',

    noPermissionHint: 'Not enough permissions',
    actionApprove: 'Approve',
    actionApprovePending: 'Approving…',
    actionReject: 'Reject',
    actionRejectPending: 'Rejecting…',
    actionReopen: 'Reopen',
    actionReopenPending: 'Reopening…',
    frozenBanner:
      'The order is rejected or completed — editing is disabled. Press “Reopen” to continue working on it.',
    preDecisionBanner:
      'The order has not been approved or rejected yet — editing is disabled. Approve or reject it to continue working.',
    requestBanner:
      'This is a request: the client assembled the route themselves and it carries no price. Agree the amount, enter it in the “Request details” block below and save — after that the order can be approved.',
    actionAssign: 'Assign an employee',
    actionSendToClientLabel: 'Send the order to the client',
    actionSendToClientPending: 'Sending…',
    actionSendToEmployees: 'Send the order to the employees',
    actionSendToEmployeesPending: 'Sending…',
    actionSendToEmployeesHint: 'Assign an employee to at least one line first.',
    actionSendToEmployeesSent: 'The email to the employees has been sent again.',

    saveBeforeSendTitle: 'Save before sending?',
    saveBeforeSendBody: 'The order has unsaved changes — the email should go out with up-to-date data.',
    saveBeforeSendConfirm: 'Save and send',
    saveBeforeSendCancel: 'Cancel',

    assignTitle: 'Assign employees',
    assignScopeAllLines: 'The checked employees will be assigned to every line of the order.',
    assignScopeLine: (line: string) => `The checked employees will be assigned to the line: ${line}.`,
    assignFilterPlaceholder: 'Search by name or email',
    assignRoleFieldLabel: 'Role',
    assignRolePlaceholder: 'Select a role…',
    assignRoleAria: (name: string) => `Employee role: ${name}`,
    assignEmployeeAria: (name: string) => `Select employee: ${name}`,
    alreadyAssigned: 'already assigned',
    assignSubmitSilent: 'Assign',
    assignSubmitAndSend: 'Assign and send an email',
    assignCancel: 'Cancel',
    noEmployees: 'There is no user with the “Employee” role in the system.',

    unassignLine: 'Unassign employee',
    unassignEmployeeAria: (name: string) => `Unassign employee: ${name}`,
    unassignConfirmTitleOne: 'Unassign the employee from this line?',
    unassignConfirmBodyOne: (name: string) =>
      `${name} will no longer be an employee of this line, and their fulfilment details will be deleted. The employee is notified only if the matching channel is on in “Notification settings”.`,
    unassignConfirmTitleAll: 'Unassign every employee from this line?',
    unassignConfirmBodyAll:
      'The line will go back to “Unassigned”, and the fulfilment details of all of its employees will be deleted. Emails are sent only if the matching channel is on in “Notification settings”.',
    unassignConfirmAction: 'Unassign',
    unassignConfirmDismiss: 'Cancel',

    newDraftBanner: 'New order — a draft. Saving will arrive in a separate task.',
    newDraftSaveHint: 'Creating an order from this screen will arrive in a future task.',
    newDraftOrderNumber: 'new',
    newDraftClientPlaceholder: 'No client selected',

    heavyOpOverlay: 'Generating the PDF and sending the email — this may take a few seconds…',

    historyEmptyTitle: 'No events yet',
    historyEmptyBody: 'Status changes, assignments and payments for this order will show up here.',
    historyAuthorLabel: 'Author',
    historySystemActor: 'System',

    deleteConfirmTitle: 'Delete the order?',
    deleteConfirmBody: 'The order and all of its lines and payments will be deleted permanently.',
    deleteConfirmAction: 'Delete order',
    deleteConfirmDismiss: 'Keep order',

    linesTitle: 'Order lines',
    colProduct: 'Tour',
    colDate: 'Date',
    colGuests: 'Guests',
    colEmployees: 'Employees',
    colPrepayment: 'Prepayment',
    colPrice: 'Price',
    colDiscount: 'Discount',
    colTotal: 'Total',
    employeeUnassigned: 'Unassigned',

    lineTimeLabel: 'Time',
    lineFormatLabel: 'Format',
    lineVehicleClassLabel: 'Vehicle class',
    lineRoundTrip: 'Round trip',
    lineReturnLabel: 'Return',
    lineKindRequest: 'Request',

    selectLine: (tour: string) => `Select line: ${tour}`,
    assignLine: 'Assign',
    addLine: 'Add line',
    removeLine: 'Remove line',
    removeLineSelected: (count: number) => `Remove (${count})`,

    requestDetailsTitle: 'Request details',
    requestRouteTitle: 'Route',
    requestRouteEmpty: 'No route given.',
    requestRouteAria: 'Requested route',
    requestPassengers: 'Passengers',
    requestLuggageTitle: 'Luggage',
    requestLuggageMedium: (count: number) => `Medium suitcase × ${count}`,
    requestLuggageLarge: (count: number) => `Large suitcase × ${count}`,
    requestLuggageOther: 'Other',
    requestLuggageUnits: (units: number) => `${units} ${pluralizeEn(units, ['unit', 'units'])}`,
    requestLuggageHelp:
      'Luggage is counted in units: a medium suitcase is 3 units, a large one is 5. The total is checked against the luggage limit of the chosen vehicle class. “Other” is the client’s free text and is not converted into units.',
    requestLuggageEmpty: 'No luggage given.',
    requestDesiredClass: 'Preferred vehicle class',
    requestDesiredClassHelp:
      'This is the client’s preference, not a booked class: the actual vehicle and the price are agreed by the manager.',
    requestComment: 'Client’s comment',
    requestPriceTitle: 'Agreed price',
    requestPriceLabel: (currency: string) => `Amount, ${currency}`,
    requestPriceHelp:
      'A request line’s total is entered by hand — it has no priced product behind it. The amount reaches the order total only after saving. A regular product line has no such field: there the total is computed by the server.',
    requestPriceNotSet: 'Price not agreed',

    addLineTitle: 'New order line',
    fieldTour: 'Product',
    fieldTourPlaceholder: 'Select a product…',
    fieldDate: 'Date',
    fieldGuests: 'Guests',
    fieldRequiresPrepayment: 'Prepayment required',
    fieldPrepaymentAmount: 'Prepayment amount',
    addLineSubmit: 'Add',
    addLineCancel: 'Cancel',

    fieldStartTime: 'Start time',
    fieldStartTimePlaceholder: 'Select a time…',
    fieldPickupTime: 'Pickup time',
    fieldFormat: 'Format',
    fieldFormatPlaceholder: 'Select a format…',
    fieldFormatHint:
      'The product is sold in both formats and the price follows the choice: individual — a fixed price per booking with a surcharge by guest count, group — price per person × guests.',
    fieldVehicleClass: 'Vehicle class',
    fieldVehicleClassPlaceholder: 'Select a class…',
    fieldRoundTrip: 'Return trip',
    fieldReturnDate: 'Return date',
    fieldReturnTime: 'Return time',
    seatsUnit: (count: number) => `${count} ${pluralizeEn(count, ['seat', 'seats'])}`,
    vehicleClassFallback: (id: number) => `Class #${id}`,
    addLineNoStartTimes: 'The product has no start times — the line will be sent without one.',
    addLineNoVehicleClasses:
      'This transfer has no priced vehicle class — add one on the product page.',

    errorTourRequired: 'Pick a product.',
    errorDateRequired: 'Set the date.',
    errorStartTimeRequired: 'Pick the start time — it is required.',
    errorPickupTimeRequired: 'Set the pickup time — it is required.',
    errorFormatRequired: 'Pick the format — the product is sold in both.',
    errorVehicleClassRequired: 'Pick the vehicle class.',
    errorReturnDateRequired: 'Set the return date.',
    errorReturnTimeRequired: 'Set the return time.',
    errorReturnBeforeTrip: 'The return trip cannot be earlier than the trip itself.',
    errorGuestsOverCapacity: (capacity: number) =>
      `The selected vehicle class fits no more than ${capacity}.`,

    discountBadge: (percent: number) => `−${percent}%`,

    paymentsEmpty: 'No payment entries for this line yet.',
    addPayment: 'Add entry',
    paymentTypeLabel: 'Type',
    paymentTypePrepayment: 'Prepayment',
    paymentTypePayment: 'Payment',
    paymentAmountLabel: 'Amount',
    paymentSubmit: 'Add',
    paymentCancel: 'Cancel',
    paymentNumber: (number: string) => `no. ${number}`,
    linePrepaymentRequired: (amount: string) => `Prepayment required: ${amount}`,
    linePrepaymentNotRequired: 'No prepayment required',

    fulfillmentPickupLabel: 'Where to pick the client up',
    fulfillmentPickupPlaceholder: 'For example, at the entrance of the Armenia hotel, 09:00',
    fulfillmentNavigatorLabel: 'Navigation link',
    fulfillmentNavigatorPlaceholder: 'https://maps.google.com/…',
    fulfillmentCommentLabel: 'Comment for the employee',
    fulfillmentCommentPlaceholder: 'For example, the client has a child seat and two large suitcases',
    fulfillmentCommentEnToggle: 'Comment in English',
    fulfillmentCommentEnLabel: 'Comment for the employee (English)',
    fulfillmentCommentEnFallbackHint:
      'If left empty, an English-speaking employee receives the Russian version.',
    fulfillmentLineEmpty: 'Nobody is assigned to this line yet.',
    fulfillmentEmployeesCount: (count: number) =>
      `${count} ${pluralizeEn(count, ['employee', 'employees'])}`,
    fulfillmentSave: 'Save',
    fulfillmentSaved: 'Saved.',
    fulfillmentAssignAndSend: 'Assign and send',
    fulfillmentAssignAndSendHint: 'Assign at least one employee to the line first.',
    fulfillmentSent: 'The email to the employee has been sent.',

    save: 'Save',
    saving: 'Saving…',
    cancelEdit: 'Cancel',

    dash: '—',

    errors: {
      notEditable: 'The order can no longer be edited in this status — refresh the page.',
      notFound: 'Order not found — refresh the page.',
      lineNotFound: 'Order line not found — refresh the page.',
      lineEmployeeGone: 'This employee has already been unassigned from the line — refresh the page.',
      forbidden: 'You do not have access to this order.',
      lastLine: 'The last line of an order cannot be removed — delete the whole order instead.',
      notEmployee: 'The selected user does not have the “Employee” role.',
      roleRequired: 'Select the employee’s role — an assignment cannot be made without one.',
      dateUnavailable: 'This date is closed for booking.',
      dateInPast: 'The tour date cannot be in the past.',
      invalidGuestCount: 'The number of guests must be at least 1.',
      noSeatsLeft: 'No seats left on this departure — pick another date or time.',
      invalidStartTime: 'The product does not offer that time — refresh the page and pick again.',
      formatRequired: 'The product is sold in both formats — pick one.',
      vehicleClassUnavailable: 'This transfer has no price for the selected vehicle class.',
      passengersOverCapacity: 'More guests than the selected vehicle class fits.',
      invalidReturnTrip: 'The return trip cannot be earlier than the trip itself.',
      actionForbidden: (action: string) => `Could not ${action}: not enough permissions.`,
      actionServer: (action: string, status: number) => `Could not ${action}: the server returned an error (${status}).`,
      actionNetwork: (action: string) => `Could not ${action}: check your connection and try again.`,
    },

    errorActions: {
      approve: 'approve the order',
      reject: 'reject the order',
      reopen: 'reopen the order',
      save: 'save the order',
      saveChanges: 'save the changes',
      delete: 'delete the order',
      addLine: 'add the line',
      removeLines: 'remove the lines',
      assign: 'assign the employee',
      unassign: 'unassign the employee',
      assignAndSend: 'assign and send',
      assignAndSendEmail: 'assign and send the email',
      addPayment: 'add the payment entry',
      sendToClient: 'send the order to the client',
      sendToEmployees: 'send the order to the employees',
    },
  },
)

export type OrdersCopy = ReturnType<typeof ordersCopy>

/** Maps `OrderStatus` to `OrderStatusBadge`'s `tone` (checklist §4 — the badge itself has no
 * knowledge of `OrderStatus`, so the page supplies this). `Approved`/`Completed` read as settled
 * (`strong`, solid black), `Rejected` reads as cold (`muted`), everything else is plain `neutral`. */
export const statusBadgeTone: Record<OrderStatus, 'neutral' | 'strong' | 'muted'> = {
  [OrderStatus.Open]: 'neutral',
  [OrderStatus.Hold]: 'muted',
  [OrderStatus.Approved]: 'strong',
  [OrderStatus.Rejected]: 'muted',
  [OrderStatus.ReadyForAssignment]: 'neutral',
  [OrderStatus.PendingPayment]: 'neutral',
  [OrderStatus.Completed]: 'strong',
  /** Заявка — такое же «в работе», как Open/PendingPayment: решение по ней ещё не принято. */
  [OrderStatus.Request]: 'neutral',
}

/** Status filter/`Select` options, in the order they should list — not `Object.values` order,
 * which would follow the enum's declaration order (fine here, kept explicit for readability). */
export const STATUS_ORDER: OrderStatus[] = [
  /** Первой: заявка — единственный статус, который НИЧЕГО не стоит, пока за него не взялись
   * (цену проставляет менеджер), поэтому вкладка с ней должна попадаться на глаза раньше всех. */
  OrderStatus.Request,
  OrderStatus.Open,
  OrderStatus.PendingPayment,
  OrderStatus.Hold,
  OrderStatus.Approved,
  OrderStatus.ReadyForAssignment,
  OrderStatus.Rejected,
  OrderStatus.Completed,
]

/** Роль исполнителя больше не nullable (редизайн 2026-08-23): назначения без роли не существует,
 * а «нет исполнителя» выражается пустым `line.employees`, а не ролью `null`. Функция осталась
 * ради единой точки — `OrderFulfillmentTab` и чипы грида зовут именно её. Подписи приходят
 * параметром из `adminEnumsCopy` (ADR 021), поэтому это чистая функция. */
export function employeeRoleLabel(
  roleLabels: Record<EmployeeJobRole, string>,
  role: EmployeeJobRole,
): string {
  return roleLabels[role]
}

/** Money is fixed per-line at order/add-line time (ADR 019) — never re-converted, so this is a
 * plain grouping formatter, not `shared/currency/moneyFormat`'s exchange-rate pipeline. Only the
 * digit grouping is locale-dependent; the currency code is printed verbatim either way. */
const MONEY: Record<Locale, Intl.NumberFormat> = {
  ru: new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }),
}

export function formatOrderMoney(amount: number, currency: string, locale: Locale): string {
  return `${MONEY[locale].format(amount)} ${currency}`
}

/** Timestamps on this screen (created/approved, a payment entry, a history row). `en-GB` keeps the
 * day-month-year order the team is used to (Spec 009 §5). */
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const DATE_TIME: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', DATE_TIME_OPTIONS),
  en: new Intl.DateTimeFormat('en-GB', DATE_TIME_OPTIONS),
}

/** Year dropped — the history timeline's mobile byline, where the row is already dated by context. */
const DATE_TIME_SHORT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}

const DATE_TIME_SHORT: Record<Locale, Intl.DateTimeFormat> = {
  ru: new Intl.DateTimeFormat('ru-RU', DATE_TIME_SHORT_OPTIONS),
  en: new Intl.DateTimeFormat('en-GB', DATE_TIME_SHORT_OPTIONS),
}

export function formatOrderDateTime(iso: string, locale: Locale): string {
  return DATE_TIME[locale].format(new Date(iso))
}

export function formatOrderDateTimeShort(iso: string, locale: Locale): string {
  return DATE_TIME_SHORT[locale].format(new Date(iso))
}

function errorCodeOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  const raw = record.errorCode ?? record.ErrorCode
  return typeof raw === 'number' ? raw : undefined
}

/** `copy` comes in as a parameter (Spec 009 §3) — this runs inside `OrderDetailPage`'s `run`
 * helper, which already has the resolved copy, so it must not reach for the locale itself. */
export function ordersErrorMessage(copy: OrdersCopy, err: unknown, action: string): string {
  const errors = copy.errors
  if (err instanceof ApiError) {
    const code = errorCodeOf(err.body)
    if (code === ORDER_NOT_EDITABLE) return errors.notEditable
    if (code === ORDER_NOT_FOUND) return errors.notFound
    if (code === ORDER_LINE_NOT_FOUND) return errors.lineNotFound
    if (code === ORDER_LINE_EMPLOYEE_NOT_FOUND) return errors.lineEmployeeGone
    if (code === ORDER_ACCESS_FORBIDDEN) return errors.forbidden
    if (code === ORDER_MUST_HAVE_AT_LEAST_ONE_LINE) return errors.lastLine
    if (code === USER_IS_NOT_EMPLOYEE) return errors.notEmployee
    if (code === EMPLOYEE_ROLE_REQUIRED) return errors.roleRequired
    if (code === TOUR_DATE_UNAVAILABLE) return errors.dateUnavailable
    if (code === ORDER_DATE_IN_PAST) return errors.dateInPast
    if (code === INVALID_GUEST_COUNT) return errors.invalidGuestCount
    if (code === NO_SEATS_LEFT) return errors.noSeatsLeft
    if (code === INVALID_START_TIME_SELECTION) return errors.invalidStartTime
    if (code === ORDER_LINE_FORMAT_REQUIRED) return errors.formatRequired
    if (code === VEHICLE_CLASS_NOT_AVAILABLE) return errors.vehicleClassUnavailable
    if (code === PASSENGERS_EXCEED_VEHICLE_CAPACITY) return errors.passengersOverCapacity
    if (code === INVALID_RETURN_TRIP) return errors.invalidReturnTrip
    if (err.status === 403) return errors.actionForbidden(action)
    return errors.actionServer(action, err.status)
  }
  return errors.actionNetwork(action)
}
