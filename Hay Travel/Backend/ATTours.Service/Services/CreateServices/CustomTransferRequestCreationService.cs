using ArmeniaTours.DataLayer;
using ATTours.BusinessServices.DataConversion.Core.Bases;
using ATTours.BusinessServices.DataConversion.DTO.Interfaces;
using ATTours.BusinessServices.Services.Shared;
using ATTours.BusinessServices.Services.ValidationServices;
using ATTours.Common.DTO.Init;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Кастомная заявка на трансфер (решения 0.11-0.14 чек-листа
    // checklist-transfers-format-2026-08-29): клиент собрал маршрут в конструкторе, продукта
    // в каталоге под это нет, цену согласует менеджер.
    //
    // Заявка — это ОБЫЧНЫЙ заказ в статусе Request с одной строкой LineKind == CustomTransfer:
    // отдельной сущности-заявки и отдельного экрана нет (решение 0.11), иначе у заказов
    // появился бы второй жизненный цикл, вторая история и второй список.
    //
    // Отдельный сервис, а не ветка в OrderCreationService: у заявки нет ни продукта, ни
    // корзины, ни цены — общего с чекаутом у неё только сборка агрегата. Смешивать их
    // значило бы прошить оба сценария условиями «если заявка».
    //
    // Атомарность — та же, что у чекаута: один агрегат (Order -> Line -> Details -> Stops),
    // валидация до сохранения, ровно один SaveChangesAsync базового класса.
    public class CustomTransferRequestCreationService : CreateVerifiableEntityBase<Order, ATToursContextFactory>
    {
        // Валюта заказа на бэке всегда AMD, даже когда суммы ещё нет: строка заказа без
        // валюты не бывает, а согласованную цену менеджер проставит в ней же.
        private const string BaseCurrency = "AMD";

        private readonly int userId;
        private readonly CustomTransferRequestCreateModel request;

        public CustomTransferRequestCreationService(CustomTransferRequestCreateModel request, int userId,
            CancellationToken cancellationToken = default)
            : base(new Order(), CommonSettings.Instance.ATToursConnectionString, cancellationToken)
        {
            this.userId = userId;
            this.request = request ?? new CustomTransferRequestCreateModel();
        }

        public CustomTransferRequestCreationService(CustomTransferRequestCreateModel request, int userId,
            IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(new Order(), context, cancellationToken)
        {
            this.userId = userId;
            this.request = request ?? new CustomTransferRequestCreateModel();
        }

        // FailFast: в заявке ровно одна строка, и пер-строчный отчёт корзины ей не нужен —
        // клиент получает плоский код, как при правке своей брони.
        protected override IEntityValidation GetEntityValidation()
            => new OrderValidationService(Entities, Context);

        protected override async Task ExecuteEntityChangesFactoryAsync()
        {
            await EnrichAsync();
            await base.ExecuteEntityChangesFactoryAsync();
        }

        private async Task EnrichAsync()
        {
            var order = Entities.Single();

            order.UserId = userId;
            order.Currency = BaseCurrency;
            order.CreatedAtUtc = DateTime.UtcNow;
            order.Number = await OrderNumberGenerator.GenerateAsync(Context, order.CreatedAtUtc, CancellationToken);
            // Заявка не участвует в обычном флоу «Открыт / Ожидает оплаты»: пока цены нет,
            // платить нечего, и статус говорит менеджеру, что с ней надо связаться.
            order.Status = OrderStatus.Request;

            order.Lines.Add(BuildLine());

            // Контакты — снимок значений (ADR 032). Контракт контактов у заявки тот же, что
            // у чекаута, поэтому и сборщик общий. Отказ при 0/>3/не-одном основном принимает
            // OrderValidationService, здесь только сборка.
            foreach (var contact in OrderContactBuilder.Build(request.Contacts))
                order.Contacts.Add(contact);
        }

        private OrderLine BuildLine()
        {
            // Гости на строке и пассажиры в деталях — одно и то же число, но разного смысла:
            // на строке это «за скольких считать», в деталях — «подо что подбирать машину».
            var passengerCount = request.PassengerCount;

            return new OrderLine
            {
                LineKind = OrderLineKind.CustomTransfer,
                // Продукта в каталоге нет — это и есть суть заявки.
                TourId = null,
                TourDate = request.PickupDate,
                StartTime = request.PickupTime,
                GuestCount = passengerCount,
                IsRoundTrip = request.IsRoundTrip,
                // Обратные поля хранятся, только если обратный рейс заказан: иначе они
                // «мусор из формы», который потом кто-нибудь примет за настоящий рейс.
                ReturnDate = request.IsRoundTrip ? request.ReturnDate : null,
                ReturnTime = request.IsRoundTrip ? request.ReturnTime : null,
                // Класс авто на строке — это ВЫБРАННЫЙ класс с ценой; у заявки он только
                // ЖЕЛАЕМЫЙ и живёт в деталях. Ставить его сюда нельзя: строка выглядела бы
                // как оплаченная бронь конкретной машины.
                VehicleClassId = null,
                VehicleClassNameSnapshot = null,
                // Цены нет и предоплаты нет (решение 0.11) — обе появятся, только когда
                // менеджер проставит сумму (PUT Order/UpdateLine).
                RequiresPrepayment = false,
                PrepaymentAmount = 0m,
                PriceSnapshot = 0m,
                DiscountPercent = null,
                LineTotal = 0m,
                Format = null,
                CustomTransferDetails = BuildDetails(passengerCount)
            };
        }

        private CustomTransferDetails BuildDetails(int passengerCount)
        {
            var details = new CustomTransferDetails
            {
                PassengerCount = passengerCount,
                // Отрицательные значения из тела запроса обнуляются здесь, а не отбиваются
                // ошибкой: «минус один чемодан» — это не сообщение клиента, а мусор формы.
                LuggageMediumCount = Math.Max(request.LuggageMediumCount, 0),
                LuggageLargeCount = Math.Max(request.LuggageLargeCount, 0),
                LuggageOther = Normalize(request.LuggageOther),
                DesiredVehicleClassId = request.DesiredVehicleClassId,
                Comment = Normalize(request.Comment)
            };

            foreach (var stop in BuildStops())
                details.Stops.Add(stop);

            return details;
        }

        // Порядок маршрута задаёт СЕРВЕР: «откуда» первым, промежуточные в порядке, который
        // прислал клиент (drag-n-drop), «куда» последним. Доверять SortOrder из тела запроса
        // нельзя — от него зависит, как маршрут прочитает водитель.
        private List<CustomTransferStop> BuildStops()
        {
            var requested = request.Stops ?? [];

            var ordered = requested.Where(stop => stop.Kind == TransferRoutePointKind.From)
                                   .Concat(requested.Where(stop => stop.Kind == TransferRoutePointKind.Stop)
                                                    .OrderBy(stop => stop.SortOrder))
                                   .Concat(requested.Where(stop => stop.Kind == TransferRoutePointKind.To))
                                   .ToList();

            var sortOrder = 0;
            return [.. ordered.Select(stop => new CustomTransferStop
            {
                Kind = stop.Kind,
                SortOrder = sortOrder++,
                Text = Normalize(stop.Text)
            })];
        }

        // Пустая строка и пробелы — это «клиент ничего не написал», а не значение: в БД
        // уезжает null, чтобы админка не показывала пустой блок «комментарий».
        private static string? Normalize(string value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
