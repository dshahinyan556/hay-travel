using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.EntityValidations;
using ATTours.BusinessServices.Services.Availability;
using ATTours.BusinessServices.Services.Shared;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.ContextRepository.ContextAbstraction;
using ATTours.Exceptions;
using ATTours.Helper.Enums;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace ATTours.BusinessServices.Services.ValidationServices
{
    // Как упаковывать отказ валидации.
    //
    // FailFast — историческое поведение: бросить плоский ErrorModelException с кодом первой
    // сработавшей проверки. Так читает ошибки правка своей брони (OrderUpdateService ->
    // PUT Order/Update): там заказ всегда однострочный, и фронт разбирает именно плоский код
    // (2014/2015/2016/2004). Менять ей контракт эта фича не должна. Тем же режимом пользуется
    // кастомная заявка (CustomTransferRequestCreationService): в ней ровно одна строка.
    //
    // PerLine — чекаут корзины (ADR 025): собрать ошибки по ВСЕМ строкам и бросить
    // OrderLinesValidationException, чтобы клиент подсветил каждую отклонённую позицию.
    internal enum OrderValidationReporting
    {
        FailFast,
        PerLine
    }

    // Валидация заказа — по каждой его строке (ADR 019: тур/дата/гости живут на OrderLine,
    // не на Order). Здесь же — серверная блокировка брони на закрытую дату: фронт гасит дни
    // только для удобства, решение принимает бэкенд через ClosureRuleResolver.
    //
    // Окно бронирования («не дальше 3 месяцев вперёд») сознательно НЕ проверяется — это
    // фронтовый лимит (см. спецификацию 001, §8). Бэкенд отбивает прошедшие и закрытые дни.
    //
    // Батч «Трансферы + формат» (2026-08-29) добавил сюда три группы правил: выбор слота и
    // формата, места группового формата (решения 0.19/0.20) и корректность строки-заявки
    // кастомного трансфера (маршрут, класс авто, багаж — решения 0.12-0.14).
    //
    // Батч «Контакты в заказах» (2026-08-29) добавил четвёртую группу — контакты для связи
    // (1..3, ровно один основной, значение соответствует способу). Она живёт здесь, а не в
    // сервисах создания, сознательно: правило принадлежит АГРЕГАТУ заказа и обязано
    // достаться любому будущему пути создания автоматически (ADR 032 Р2).
    internal class OrderValidationService : EntityValidationContextDependentBase<Order, ATToursContextFactory>
    {
        private readonly OrderValidationReporting reporting;

        // Пороги автозакрытия (глобальный + потуровые исключения). Снимок берётся ОДИН раз
        // на всю валидацию, а не на каждую строку: в чекауте корзины строк до 10, и десять
        // походов в SiteSetting за одним и тем же числом — чистая трата. Заодно все строки
        // одного заказа судятся по одному значению, даже если админ поменяет настройку ровно
        // в этот момент.
        //
        // null! вместо nullable-типа: снимок нельзя собрать в конструкторе (загрузка
        // асинхронная), но к моменту, когда его читают, он гарантированно заполнен —
        // ValidateEntitiesAsync это единственный вход в класс, и заполняет он его первой
        // строкой. Nullable-поле здесь означало бы «?» на каждом обращении ради состояния,
        // которого не бывает.
        private AutoCloseLeadTimeResolver autoCloseLeadTime = null!;

        // Момент отсчёта тоже фиксируется один раз — по той же причине: соседние строки
        // одного заказа не должны попадать по разные стороны границы окна.
        private DateTime nowUtc;

        // Справочные данные всех упомянутых строками продуктов и классов авто — ОДНИМ
        // запросом на вид, а не по запросу на строку (та же причина, что у
        // OrderCreationService.LoadTourPricingAsync: в корзине до 10 позиций).
        private Dictionary<int, TourBookingContext> tours = [];
        private Dictionary<int, VehicleClassContext> vehicleClasses = [];
        private HashSet<(int TourId, int VehicleClassId)> transferPriceKeys = [];

        // Занятость слотов группового формата в пределах ОДНОГО валидируемого заказа: уже
        // сохранённая бронь из БД плюс места, разобранные предыдущими строками этого же
        // заказа. Без второго слагаемого две одинаковые позиции корзины прошли бы обе, каждая
        // «увидев» пустой слот.
        private readonly Dictionary<(int TourId, DateOnly TourDate, TimeOnly StartTime), int> seatUsage = [];

        public OrderValidationService(List<Order> entities, IApplicationDbContext context,
            OrderValidationReporting reporting = OrderValidationReporting.FailFast)
            : base(entities, context)
        {
            this.reporting = reporting;
        }

        public override async Task ValidateEntitiesAsync()
        {
            // Тот же контекст, что у валидации: своего соединения снимку порогов не нужно,
            // и освобождать чужое здесь нельзя — он принадлежит вызывающему.
            autoCloseLeadTime = await AutoCloseLeadTimeResolver.LoadAsync(Context);
            nowUtc = DateTime.UtcNow;

            await LoadReferenceDataAsync();

            var lineErrors = new List<OrderLineValidationError>();

            foreach (var order in Entities)
            {
                ValidateLineCount(order);
                ValidateContacts(order);

                // Места считаются в пределах одного заказа: две позиции корзины на один слот
                // складываются, но заказы друг друга через этот счётчик не видят — чужие
                // брони приезжают из БД.
                seatUsage.Clear();

                // Индекс — позиция строки в коллекции агрегата. Порядок задан
                // OrderCreationService.EnrichAsync и совпадает с порядком строк в запросе,
                // то есть с позициями корзины на клиенте (удалений из коллекции до валидации
                // нет). Дополнительная страховка для фронта — пара TourId+TourDate в ответе.
                var index = 0;
                foreach (var line in order.Lines)
                {
                    var errorCode = await ResolveLineErrorAsync(order, line);

                    if (errorCode is not null)
                    {
                        if (reporting == OrderValidationReporting.FailFast)
                            throw BuildFlatException(errorCode.Value, line);

                        lineErrors.Add(new OrderLineValidationError
                        {
                            Index = index,
                            // null у строки-заявки: продукта у неё нет, и «тур №0» был бы
                            // выдумкой. Такая строка сопоставляется с позицией по Index.
                            TourId = line.TourId,
                            TourDate = line.TourDate,
                            ErrorCode = (int)errorCode.Value
                        });
                    }

                    index++;
                }
            }

            if (lineErrors.Count > 0)
                throw new OrderLinesValidationException(GlobalErrorCode.OrderHasInvalidLines, lineErrors);
        }

        // Ошибки формы самой заявки, а не конкретной позиции: приходят плоским ErrorModel
        // без массива lines (spec 013 §3).
        private static void ValidateLineCount(Order order)
        {
            if (order.Lines.Count == 0)
                throw new ErrorModelException(GlobalErrorCode.OrderMustHaveAtLeastOneLine, HttpStatusCode.BadRequest,
                    "Order must have at least one line.");

            if (order.Lines.Count > OrderLimits.MaxOrderLines)
                throw new ErrorModelException(GlobalErrorCode.OrderTooManyLines, HttpStatusCode.BadRequest,
                    $"Order cannot have more than {OrderLimits.MaxOrderLines} lines, got {order.Lines.Count}.");
        }

        // Контакты — правило ШАПКИ заказа, поэтому бросается плоско даже в режиме PerLine:
        // привязать «нет контакта» к позиции корзины нельзя, её вины тут нет.
        //
        // Правило применяется только к СОБИРАЕМОМУ заказу (Id == 0, ещё не вставлен), а не к
        // уже существующей строке. Причина конкретная: этот же валидатор третьей точкой
        // вызывает OrderUpdateService (правка своей брони, PUT Order/Update), и заказ туда
        // приезжает загруженным с Include(Lines) — БЕЗ Contacts. Без этой проверки правка
        // любой брони падала бы с OrderContactRequired на пустой невыгруженной коллекции,
        // а заказы, созданные до батча 2026-08-29, стали бы нередактируемыми навсегда
        // (их сознательно не бэкфиллили). Контакты заказа неизменяемы по конструкции —
        // это снимок (ADR 032 Р1), — поэтому на пути правки проверять нечего.
        private static void ValidateContacts(Order order)
        {
            if (order.Id != 0)
                return;

            if (order.Contacts.Count < ContactLimits.MinOrderContacts)
                throw new ErrorModelException(GlobalErrorCode.OrderContactRequired, HttpStatusCode.BadRequest,
                    "Order must have at least one client contact.");

            if (order.Contacts.Count > ContactLimits.MaxOrderContacts)
                throw new ErrorModelException(GlobalErrorCode.OrderTooManyContacts, HttpStatusCode.BadRequest,
                    $"Order cannot have more than {ContactLimits.MaxOrderContacts} client contacts, got {order.Contacts.Count}.");

            if (order.Contacts.Count(contact => contact.IsPrimary) != 1)
                throw new ErrorModelException(GlobalErrorCode.OrderPrimaryContactInvalid, HttpStatusCode.BadRequest,
                    "Exactly one client contact must be marked as primary.");

            foreach (var contact in order.Contacts)
            {
                // Фамилия НЕ обязательна (решение Давида, 2026-08-29): у клиента её может не
                // быть в удобной форме, а менеджеру для звонка достаточно имени и номера.
                // Имя обязательно — без него в заказе стоял бы безымянный номер.
                if (string.IsNullOrWhiteSpace(contact.FirstName))
                    throw new ErrorModelException(GlobalErrorCode.RequiredFieldMissing, HttpStatusCode.BadRequest,
                        "Client contact requires a first name.");

                if (!ContactMethodValidator.IsValid(contact.Type, contact.Value))
                    throw new ErrorModelException(GlobalErrorCode.InvalidContactValue, HttpStatusCode.BadRequest,
                        $"Contact value is not valid for method {contact.Type}.");
            }
        }

        // Продукты, классы авто и цены трансферов, упомянутые ВСЕМИ строками всех
        // валидируемых заказов. Тур грузится без фильтра по публикации: «не найден» и
        // «снят с публикации» здесь одно и то же (TourNotFound), но решать это должен код,
        // а не пустой результат запроса.
        private async Task LoadReferenceDataAsync()
        {
            var allLines = Entities.SelectMany(order => order.Lines).ToList();

            var tourIds = allLines.Where(line => line.TourId is not null)
                                  .Select(line => line.TourId!.Value)
                                  .Distinct()
                                  .ToList();

            if (tourIds.Count > 0)
            {
                tours = await Context.Set<Tour>()
                                     .AsNoTracking()
                                     .Where(tour => tourIds.Contains(tour.Id))
                                     .Select(tour => new TourBookingContext
                                     {
                                         Id = tour.Id,
                                         Type = tour.Type,
                                         Format = tour.Format,
                                         IsActive = tour.IsActive,
                                         IsArchived = tour.IsArchived,
                                         GroupCapacity = tour.GroupCapacity,
                                         StartTimes = tour.StartTimes.Select(startTime => startTime.Time).ToList()
                                     })
                                     .ToDictionaryAsync(tour => tour.Id);

                transferPriceKeys = [.. (await Context.Set<TransferPrice>()
                                                      .AsNoTracking()
                                                      .Where(price => tourIds.Contains(price.TourId))
                                                      .Select(price => new { price.TourId, price.VehicleClassId })
                                                      .ToListAsync())
                                        .Select(price => (price.TourId, price.VehicleClassId))];
            }

            // Класс авто участвует в двух ролях: выбранный класс брони предопределённого
            // трансфера и желаемый класс заявки. Обе резолвятся из одного словаря.
            var vehicleClassIds = allLines.Select(line => line.VehicleClassId)
                                          .Concat(allLines.Select(line => line.CustomTransferDetails?.DesiredVehicleClassId))
                                          .Where(id => id is not null)
                                          .Select(id => id!.Value)
                                          .Distinct()
                                          .ToList();

            if (vehicleClassIds.Count > 0)
                vehicleClasses = await Context.Set<VehicleClass>()
                                              .AsNoTracking()
                                              .Where(vehicleClass => vehicleClassIds.Contains(vehicleClass.Id))
                                              .Select(vehicleClass => new VehicleClassContext
                                              {
                                                  Id = vehicleClass.Id,
                                                  Capacity = vehicleClass.Capacity,
                                                  LuggageCapacity = vehicleClass.LuggageCapacity
                                              })
                                              .ToDictionaryAsync(vehicleClass => vehicleClass.Id);
        }

        // Первая сработавшая причина на строку — для UI одной достаточно, а порядок проверок
        // задаёт приоритет: гости -> прошлое -> тур существует -> дата открыта -> выбор
        // клиента (слот/формат/класс) -> места.
        // null = строка валидна.
        private async Task<GlobalErrorCode?> ResolveLineErrorAsync(Order order, OrderLine line)
        {
            if (line.GuestCount < 1)
                return GlobalErrorCode.InvalidGuestCount;

            if (IsDateInPast(line))
                return GlobalErrorCode.OrderDateInPast;

            // Строка-заявка живёт по своим правилам: продукта у неё нет, значит нет ни
            // публикации, ни расписания, ни правил закрытия КОНКРЕТНОГО тура. А вот
            // правила закрытия «весь сайт» и «все трансферы» её касаются наравне с бронью
            // (решение 0.27): выходной день — это выходной и для заявки тоже, иначе она
            // приедет менеджеру на день, в который никто не работает.
            if (line.LineKind == OrderLineKind.CustomTransfer)
            {
                // Живое окно автозакрытия применяется к заявке наравне с бронью (решение Р7
                // от 2026-08-29). До этого заявку судили ТОЛЬКО материализованные правила, а
                // публичный ClosureRuleInfo.GetClosedDatesAsync окно конструктору трансфера
                // уже применял — то есть календарь на сайте день гасил, а бэкенд ту же
                // заявку принимал. Расхождение между тем, что показано клиенту, и тем, что
                // принято сервером, недопустимо в любую сторону.
                //
                // tourId == null: продукта у заявки нет, значит нет и исключения — порог
                // глобальный. startTimes == null: расписания нет тем более (время подачи
                // вводит сам клиент), поэтому отсчёт идёт от начала календарного дня —
                // ровно то же поведение, что у предопределённого трансфера (решение Р5).
                //
                // Обратная дата (ReturnDate) этой проверкой НЕ покрывается, и это осознанно.
                // Окно закрывает только ближайшие ко «сейчас» дни, а ReturnDate по
                // определению не раньше TourDate (ValidateReturnTrip): дата, лежащая позже
                // даты поездки, не может оказаться в окне, если сама поездка в него не
                // попала. Проверять её здесь означало бы лишний вызов ради заведомо
                // ложного условия — и, хуже, перебить кодом TourDateUnavailable честный
                // InvalidReturnTrip у строки с перевёрнутым диапазоном, потому что форму
                // обратного рейса проверяет ValidateCustomTransferLine НИЖЕ. Правила
                // закрытия — другое дело: они адресуют произвольный день сколь угодно
                // далеко вперёд, поэтому IsDateClosedAsync обратную дату смотрит.
                //
                // Код ошибки тот же, что у закрытого дня (TourDateUnavailable): снаружи это
                // неотличимо от обычной блокировки, и заводить второй код ради внутренней
                // механики не нужно — так же сделано у обычных строк ниже.
                if (await IsDateClosedAsync(line, tourId: null, TourType.Transfer)
                    || autoCloseLeadTime.IsWithinAutoCloseWindow(tourId: null, line.TourDate,
                        startTimes: null, nowUtc))
                {
                    return GlobalErrorCode.TourDateUnavailable;
                }

                return ValidateCustomTransferLine(line);
            }

            // Верхняя граница гостей — только для брони ПРОДУКТА, и только после ветки
            // заявки выше: у кастомной заявки потолка нет (решение 0.14, см.
            // OrderLimits.MaxGuestsPerLine).
            if (line.GuestCount > OrderLimits.MaxGuestsPerLine)
                return GlobalErrorCode.InvalidGuestCount;

            if (!IsTourBookable(line))
                return GlobalErrorCode.TourNotFound;

            var tour = tours[line.TourId!.Value];

            // Тип продукта передаётся резолверу: без него правило области «все трансферы»
            // (решение 0.27) не применилось бы, и трансфер бронировался бы в закрытый для
            // трансферов день.
            if (await IsDateClosedAsync(line, line.TourId, tour.Type))
                return GlobalErrorCode.TourDateUnavailable;

            // Силовой чек окна автозакрытия: тот же порог, но посчитанный по времени, а не
            // по материализованным правилам. Нужен потому, что TourDateAutoClosureJob тикает
            // раз в час — между тиками правила на день ещё нет, а бронировать его уже поздно.
            //
            // Порог берётся с учётом исключения этого продукта, а отсчёт идёт от самого
            // позднего слота дня (решение Р1): расписание уже загружено в tour.StartTimes,
            // отдельного запроса на строку не нужно. У трансфера список пуст — там отсчёт
            // остаётся от начала дня.
            //
            // Код ошибки НАМЕРЕННО тот же, что у закрытого дня (TourDateUnavailable): снаружи
            // это неотличимо от обычной блокировки, отдельного кода/сообщения фронт не
            // получает и объяснять клиенту внутреннюю механику не нужно.
            if (autoCloseLeadTime.IsWithinAutoCloseWindow(tour.Id, line.TourDate, tour.StartTimes, nowUtc))
                return GlobalErrorCode.TourDateUnavailable;

            return tour.Type == TourType.Transfer
                ? ValidateTransferLine(line, tour)
                : await ValidateBookableProductLineAsync(order, line, tour);
        }

        // Предопределённый трансфер: время подачи обязательно (решение 0.9), класс авто —
        // тоже, потому что цена строки это ЦЕНА КЛАССА, а не цена продукта.
        private GlobalErrorCode? ValidateTransferLine(OrderLine line, TourBookingContext tour)
        {
            if (line.StartTime is null)
                return GlobalErrorCode.InvalidStartTimeSelection;

            var returnTripError = ValidateReturnTrip(line);
            if (returnTripError is not null)
                return returnTripError;

            if (line.VehicleClassId is null || !transferPriceKeys.Contains((tour.Id, line.VehicleClassId.Value)))
                return GlobalErrorCode.VehicleClassNotAvailable;

            if (!vehicleClasses.TryGetValue(line.VehicleClassId.Value, out var vehicleClass))
                return GlobalErrorCode.VehicleClassNotFound;

            if (line.GuestCount > vehicleClass.Capacity)
                return GlobalErrorCode.PassengersExceedVehicleCapacity;

            return null;
        }

        // Тур/экскурсия: слот из расписания продукта, определённый формат и — у группового —
        // свободные места на выбранном выезде.
        private async Task<GlobalErrorCode?> ValidateBookableProductLineAsync(Order order, OrderLine line, TourBookingContext tour)
        {
            // Слот обязан быть ИЗ РАСПИСАНИЯ продукта (решение 0.21: клиент выбирает время,
            // а не вводит своё). Проверка списка действует ВСЕГДА, когда время передано.
            if (line.StartTime is not null && !tour.StartTimes.Contains(line.StartTime.Value))
                return GlobalErrorCode.InvalidStartTimeSelection;

            // Сама ОБЯЗАТЕЛЬНОСТЬ времени (решение 0.28) — правило НОВОЙ строки, а не
            // существующей. Прежнее послабление «пустое время допускается у индивидуального
            // формата» снято для новых броней: время старта это часть брони («на какой выезд
            // человек записан»), и «не указано» делает её неисполнимой.
            //
            // Но у строк, оформленных ДО этого батча, времени нет вовсе, и правка такой
            // живой брони (OrderUpdateService: клиент меняет дату/гостей) не должна падать
            // из-за поля, которого в тот момент не существовало и которое он не трогает.
            // Признак «строка уже в БД» — присвоенный Id: агрегат чекаута и заявки собирается
            // из новых сущностей с Id == 0, а OrderUpdateService правит tracked-граф.
            if (line.StartTime is null && IsNewLine(line))
                return GlobalErrorCode.InvalidStartTimeSelection;

            var format = OrderLinePricing.ResolveEffectiveFormat(tour.Format, line.Format);
            if (format is null)
                return GlobalErrorCode.OrderLineFormatRequired;

            if (format != TourFormat.Group)
                return null;

            // У группового формата поблажки для старой строки нет и быть не может: остаток
            // мест считается по паре (дата + время старта), и без слота выезд нечем
            // адресовать. Достижимо, если продукт перевели в групповой формат уже ПОСЛЕ
            // того, как бронь была оформлена, — тогда правку придётся делать админу.
            if (line.StartTime is null)
                return GlobalErrorCode.InvalidStartTimeSelection;

            return await ResolveSeatsErrorAsync(order, line, tour);
        }

        // Строка ещё не в БД. EntityBase.Id остаётся нулевым до SaveChanges, поэтому
        // «Id == 0» и есть «новая строка»: агрегат чекаута (OrderCreationService) и заявки
        // (CustomTransferRequestCreationService) собирается из свежесозданных сущностей, а
        // OrderUpdateService правит tracked-граф, у которого Id уже проставлены.
        //
        // Это единственное место, где валидация различает создание и правку. Отдельный флаг
        // в конструкторе был бы честнее по замыслу, но его пришлось бы прокинуть через три
        // сервиса ради одного правила — а Id и так уже несёт ровно эту информацию.
        private static bool IsNewLine(OrderLine line) => line.Id == 0;

        // Места группового формата (решения 0.19/0.20). Ёмкость — одно число на продукт,
        // остаток считается на пару (дата + время старта).
        private async Task<GlobalErrorCode?> ResolveSeatsErrorAsync(Order order, OrderLine line, TourBookingContext tour)
        {
            // Ёмкость обязана быть у группового продукта (валидация продукта не даёт его
            // сохранить без неё). Ноль у старой записи означал бы «мест нет вообще» — это
            // отказ, а не «безлимит».
            var capacity = tour.GroupCapacity ?? 0;
            var slot = (tour.Id, line.TourDate, line.StartTime!.Value);

            if (!seatUsage.TryGetValue(slot, out var used))
            {
                // Собственные строки заказа из БД исключаются: при правке уже сохранённой
                // брони её прежние гости лежат в базе, и без исключения бронь конфликтовала
                // бы сама с собой. Их место занимают строки этого же агрегата (ниже).
                used = await GroupSeatsCalculator.GetBookedSeatsAsync(Context, tour.Id, line.TourDate,
                    line.StartTime.Value, order.Id);
            }

            if (used + line.GuestCount > capacity)
                return GlobalErrorCode.NoSeatsLeft;

            seatUsage[slot] = used + line.GuestCount;
            return null;
        }

        // Строка-заявка кастомного трансфера (решения 0.12-0.14). Детали могут быть не
        // загружены (правка существующего заказа читает граф без них) — тогда проверять
        // нечего: заявка уже принята, а её маршрут этим путём не меняется.
        private GlobalErrorCode? ValidateCustomTransferLine(OrderLine line)
        {
            if (line.StartTime is null)
                return GlobalErrorCode.InvalidStartTimeSelection;

            var returnTripError = ValidateReturnTrip(line);
            if (returnTripError is not null)
                return returnTripError;

            var details = line.CustomTransferDetails;
            if (details is null)
                return null;

            var routeError = ValidateCustomTransferRoute(details);
            if (routeError is not null)
                return routeError;

            // Желаемый класс — необязателен (решение 0.14: если пассажиров больше любой
            // машины, клиент отправляет заявку вообще без класса). Но если он назван, заявка
            // обязана в него влезать — иначе менеджер получит заведомо невыполнимое пожелание.
            if (details.DesiredVehicleClassId is null)
                return null;

            if (!vehicleClasses.TryGetValue(details.DesiredVehicleClassId.Value, out var vehicleClass))
                return GlobalErrorCode.VehicleClassNotFound;

            if (details.PassengerCount > vehicleClass.Capacity)
                return GlobalErrorCode.PassengersExceedVehicleCapacity;

            // Багаж заполнять НЕ обязательно (решение 0.13): 0/0 — «клиент про багаж ничего
            // не сказал», и сверять тут нечего. «Другое» текстом в единицы не переводится.
            var luggageUnits = LuggageUnits.Resolve(details.LuggageMediumCount, details.LuggageLargeCount);
            if (luggageUnits > 0 && luggageUnits > vehicleClass.LuggageCapacity)
                return GlobalErrorCode.LuggageExceedsVehicleCapacity;

            return null;
        }

        // Маршрут заявки: ровно одна точка «откуда», ровно одна «куда», стопов сколько угодно
        // (тот же контракт, что у маршрута предопределённого трансфера).
        private static GlobalErrorCode? ValidateCustomTransferRoute(CustomTransferDetails details)
        {
            var stops = details.Stops?.ToList() ?? [];

            if (stops.Count(stop => stop.Kind == TransferRoutePointKind.From) != 1
                || stops.Count(stop => stop.Kind == TransferRoutePointKind.To) != 1
                || stops.Any(stop => string.IsNullOrWhiteSpace(stop.Text)))
                return GlobalErrorCode.InvalidTransferRoute;

            return null;
        }

        // Обратный рейс — своя дата и своё время (решение 0.12), и он не может начинаться
        // раньше самой поездки. Без IsRoundTrip обратных полей быть не должно вовсе: их
        // обнуляют сервисы создания, поэтому здесь проверяется только положительный случай.
        private static GlobalErrorCode? ValidateReturnTrip(OrderLine line)
        {
            if (!line.IsRoundTrip)
                return null;

            if (line.ReturnDate is null || line.ReturnTime is null)
                return GlobalErrorCode.InvalidReturnTrip;

            if (line.ReturnDate < line.TourDate)
                return GlobalErrorCode.InvalidReturnTrip;

            if (line.ReturnDate == line.TourDate && line.StartTime is not null && line.ReturnTime < line.StartTime)
                return GlobalErrorCode.InvalidReturnTrip;

            return null;
        }

        // Сообщения сохранены прежними — их читают логи и (в FailFast) существующие клиенты.
        private static ErrorModelException BuildFlatException(GlobalErrorCode errorCode, OrderLine line)
        {
            var message = errorCode switch
            {
                GlobalErrorCode.InvalidGuestCount => $"Guest count must be between 1 and {OrderLimits.MaxGuestsPerLine} for a product line, got {line.GuestCount}.",
                GlobalErrorCode.OrderDateInPast => $"Tour date {line.TourDate:yyyy-MM-dd} is in the past.",
                GlobalErrorCode.TourNotFound => $"Tour with id {line.TourId} does not exist or is not available for booking.",
                GlobalErrorCode.TourDateUnavailable => $"Tour date {line.TourDate:yyyy-MM-dd} is closed for booking.",
                GlobalErrorCode.NoSeatsLeft => $"Not enough seats left for tour {line.TourId} on {line.TourDate:yyyy-MM-dd} {line.StartTime}.",
                GlobalErrorCode.InvalidStartTimeSelection => $"Start time {line.StartTime} is missing or not offered by tour {line.TourId}.",
                GlobalErrorCode.OrderLineFormatRequired => $"Format must be specified for tour {line.TourId}.",
                GlobalErrorCode.VehicleClassNotAvailable => $"Vehicle class {line.VehicleClassId} is not available for transfer {line.TourId}.",
                GlobalErrorCode.VehicleClassNotFound => "Vehicle class not found.",
                GlobalErrorCode.PassengersExceedVehicleCapacity => "Passenger count exceeds the capacity of the selected vehicle class.",
                GlobalErrorCode.LuggageExceedsVehicleCapacity => "Luggage exceeds the luggage capacity of the selected vehicle class.",
                GlobalErrorCode.InvalidTransferRoute => "Transfer route must have exactly one 'from' point and exactly one 'to' point.",
                GlobalErrorCode.InvalidReturnTrip => "Return trip requires a date and time not earlier than the outbound trip.",
                _ => $"Order line for tour {line.TourId} is invalid."
            };

            return new ErrorModelException(errorCode, HttpStatusCode.BadRequest, message);
        }

        // Сравнение по UTC-дню: сервер не знает часового пояса клиента, а TourDate — это
        // календарный день без зоны (ADR 012).
        private static bool IsDateInPast(OrderLine line)
            => line.TourDate < DateOnly.FromDateTime(DateTime.UtcNow);

        // Забронировать можно только опубликованный тур: черновик/архив для клиента
        // не существует (тот же фильтр, что и на публичном чтении тура). Флаги приезжают
        // вместе с остальными полями продукта (LoadReferenceDataAsync) — отдельного запроса
        // на строку больше нет.
        private bool IsTourBookable(OrderLine line)
            => line.TourId is not null
               && tours.TryGetValue(line.TourId.Value, out var tour)
               && tour is { IsActive: true, IsArchived: false };

        // Закрыт ли день поездки — и, если рейс с возвратом, день обратного рейса.
        //
        // tourId == null у строки-заявки (продукта нет), tourType задан всегда: без него
        // правила области «все продукты этого типа» (решение 0.27) не применились бы.
        private async Task<bool> IsDateClosedAsync(OrderLine line, int? tourId, TourType? tourType)
        {
            // Грузим применимые правила (глобальные, правила типа продукта и правила этого
            // тура — у первых двух TourId == null) и отдаём решение резолверу: precedence
            // правил нельзя выразить SQL-фильтром «дата закрыта».
            var rules = await Context.Set<ClosureRule>()
                                     .Where(rule => rule.TourId == null || rule.TourId == tourId)
                                     .ToListAsync();

            if (ClosureRuleResolver.IsClosed(rules, line.TourDate, tourId, tourType))
                return true;

            // Обратный рейс — это вторая поездка в другой день (решение 0.12), и закрытый
            // день закрывает её так же, как день «туда». Проверяется только когда обратный
            // рейс действительно заказан и его дата пришла: пустую дату отобьёт
            // ValidateReturnTrip своим кодом, подменять его закрытием дня нельзя.
            return line.IsRoundTrip
                   && line.ReturnDate is not null
                   && ClosureRuleResolver.IsClosed(rules, line.ReturnDate.Value, tourId, tourType);
        }

        // Поля продукта, нужные валидации строки. Проекция, а не сущность: граф тура с
        // переводами, днями и галереей здесь не нужен.
        private sealed class TourBookingContext
        {
            public int Id { get; set; }
            public TourType Type { get; set; }
            public TourFormat? Format { get; set; }
            public bool IsActive { get; set; }
            public bool IsArchived { get; set; }
            public int? GroupCapacity { get; set; }
            public List<TimeOnly> StartTimes { get; set; } = [];
        }

        private sealed class VehicleClassContext
        {
            public int Id { get; set; }
            public int Capacity { get; set; }
            public int LuggageCapacity { get; set; }
        }
    }
}
