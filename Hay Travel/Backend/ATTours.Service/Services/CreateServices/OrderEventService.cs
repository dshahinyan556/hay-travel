using ArmeniaTours.DataLayer;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Services.CreateServices
{
    // Запись строки журнала заказа (spec 007). Сюда же вынесено дочитывание контекста
    // (строка/проводка/тур), из которого OrderEventLog собирает текст события — контроллер
    // отдаёт только идентификаторы и не делает лишних запросов ради лога.
    //
    // Наружу этот сервис напрямую не вызывается: точка входа — статический OrderEventLog,
    // который гасит любые ошибки записи (ADR 020).
    public class OrderEventService : RepositoryCoreBase<OrderEvent, ATToursContextFactory>
    {
        // Ровно столько же, сколько в OrderEventConfiguration. Текст StatusChanged несёт
        // RejectReason (до 2000 символов) — без обрезки такое событие молча потерялось бы
        // на вставке, а журнал должен пережить длинную причину отказа.
        private const int MaxDescriptionLength = 1000;
        private const string Ellipsis = "…";

        private readonly CancellationToken cancellationToken;

        public OrderEventService(CancellationToken cancellationToken = default)
            : base(CommonSettings.Instance.ATToursConnectionString)
        {
            this.cancellationToken = cancellationToken;
        }

        public async Task WriteAsync(int orderId, int? actorUserId, OrderEventType type, string description)
        {
            var orderEvent = new OrderEvent
            {
                OrderId = orderId,
                Type = type,
                Description = Truncate(description),
                ActorUserId = actorUserId,
                ActorFullName = actorUserId is null ? null : await ResolveActorFullNameAsync(actorUserId.Value),
                CreatedAtUtc = DateTime.UtcNow
            };

            Context.Set<OrderEvent>().Add(orderEvent);
            await Context.SaveChangesAsync(cancellationToken);
        }

        // Возвращает null, если строки уже нет (например, событие пишется по гонке с удалением).
        public async Task<OrderEventLineContext?> GetLineContextAsync(int lineId)
        {
            var line = await Context.Set<OrderLine>()
                                    .AsNoTracking()
                                    .Where(x => x.Id == lineId)
                                    .Select(x => new OrderEventLineContext
                                    {
                                        OrderId = x.OrderId,
                                        TourTitle = x.Tour.Translations
                                                     .Where(translation => translation.Type == TourTranslationType.Title)
                                                     .OrderBy(translation => translation.LanguageCode == LanguageCode.Russian ? 0 : 1)
                                                     .Select(translation => translation.Value)
                                                     .FirstOrDefault(),
                                        TourDate = x.TourDate,
                                        GuestCount = x.GuestCount,
                                        RequiresPrepayment = x.RequiresPrepayment,
                                        PrepaymentAmount = x.PrepaymentAmount,
                                        // Заполненность деталей теперь считается по
                                        // исполнителям строки: плоских полей на OrderLine
                                        // больше нет (редизайн 2026-08-23).
                                        HasPickupDetails = x.Employees.Any(assignment =>
                                            assignment.PickupDetails != null && assignment.PickupDetails != ""),
                                        HasNavigatorLink = x.Employees.Any(assignment =>
                                            assignment.NavigatorLink != null && assignment.NavigatorLink != "")
                                    })
                                    .FirstOrDefaultAsync(cancellationToken);

            return line;
        }

        // Возвращает null, если проводки уже нет.
        public async Task<OrderEventPaymentContext?> GetPaymentContextAsync(int paymentId)
        {
            return await Context.Set<OrderPayment>()
                                .AsNoTracking()
                                .Where(x => x.Id == paymentId)
                                .Select(x => new OrderEventPaymentContext
                                {
                                    OrderId = x.OrderLine.OrderId,
                                    Number = x.Number,
                                    Type = x.Type,
                                    Amount = x.Amount,
                                    Currency = x.OrderLine.Order.Currency,
                                    TourTitle = x.OrderLine.Tour.Translations
                                                 .Where(translation => translation.Type == TourTranslationType.Title)
                                                 .OrderBy(translation => translation.LanguageCode == LanguageCode.Russian ? 0 : 1)
                                                 .Select(translation => translation.Value)
                                                 .FirstOrDefault(),
                                    TourDate = x.OrderLine.TourDate
                                })
                                .FirstOrDefaultAsync(cancellationToken);
        }

        // Для события «удалена строка»: самой строки в БД уже нет, а название тура нужно.
        // Правило выбора перевода то же, что в MappingProfile.ResolveTourTitle: RU, иначе любой.
        public async Task<string?> GetTourTitleAsync(int tourId)
        {
            return await Context.Set<TourInfoTranslation>()
                                .AsNoTracking()
                                .Where(x => x.TourId == tourId && x.Type == TourTranslationType.Title)
                                .OrderBy(x => x.LanguageCode == LanguageCode.Russian ? 0 : 1)
                                .Select(x => x.Value)
                                .FirstOrDefaultAsync(cancellationToken);
        }

        // Снапшот имени на момент события. Учётка могла быть удалена (soft-delete) или
        // переименована — фильтра по IsDeleted здесь нет сознательно: автор действия
        // остаётся автором, даже если аккаунт потом закрыли.
        private async Task<string?> ResolveActorFullNameAsync(int actorUserId)
        {
            var actor = await Context.Set<User>()
                                     .AsNoTracking()
                                     .Where(x => x.Id == actorUserId)
                                     .Select(x => new { x.FirstName, x.LastName, x.Username })
                                     .FirstOrDefaultAsync(cancellationToken);

            if (actor is null)
                return null;

            var fullName = $"{actor.FirstName} {actor.LastName}".Trim();
            return string.IsNullOrWhiteSpace(fullName) ? actor.Username : fullName;
        }

        private static string Truncate(string description)
        {
            if (string.IsNullOrEmpty(description) || description.Length <= MaxDescriptionLength)
                return description;

            return string.Concat(description.AsSpan(0, MaxDescriptionLength - Ellipsis.Length), Ellipsis);
        }
    }

    public class OrderEventLineContext
    {
        public int OrderId { get; set; }
        public string? TourTitle { get; set; }
        public DateOnly TourDate { get; set; }
        public int GuestCount { get; set; }
        public bool RequiresPrepayment { get; set; }
        public decimal PrepaymentAmount { get; set; }

        // Не сами тексты, а факт их наличия: журнал печатает «указано»/«не указано»,
        // а деталей теперь несколько (по одной карточке на исполнителя).
        public bool HasPickupDetails { get; set; }
        public bool HasNavigatorLink { get; set; }
    }

    public class OrderEventPaymentContext
    {
        public int OrderId { get; set; }
        public string? Number { get; set; }
        public OrderPaymentType Type { get; set; }
        public decimal Amount { get; set; }
        public string? Currency { get; set; }
        public string? TourTitle { get; set; }
        public DateOnly TourDate { get; set; }
    }
}
