using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Constants;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.Availability
{
    // Эффективный порог автозакрытия: исключение конкретного продукта, иначе глобальная
    // настройка booking.autoCloseLeadTimeHours (решение Р2 от 2026-08-29).
    //
    // Зачем отдельный объект, а не статический метод: оба источника читаются из БД, но
    // читаться они обязаны ОДИН раз на операцию, а применяться — многократно (валидация
    // корзины идёт по строкам, публичный GetClosedDates — по дням диапазона, задача — по
    // продуктам и дням). Загруженный снимок заодно гарантирует, что все строки одного заказа
    // и все дни одного календаря судятся по одному и тому же порогу, даже если админ правит
    // настройку ровно в этот момент.
    //
    // Формулу окна этот класс НЕ повторяет: считает её AutoClosureWindow, здесь только выбор
    // числа часов. Три потребителя ходят сюда, а не собирают порог у себя — иначе
    // разъехавшиеся копии дали бы дату, закрытую на бэке и открытую в календаре.
    public sealed class AutoCloseLeadTimeResolver
    {
        private readonly int globalLeadTimeHours;
        private readonly IReadOnlyDictionary<int, int> leadTimeHoursByTour;

        private AutoCloseLeadTimeResolver(int globalLeadTimeHours, IReadOnlyDictionary<int, int> leadTimeHoursByTour)
        {
            this.globalLeadTimeHours = globalLeadTimeHours;
            this.leadTimeHoursByTour = leadTimeHoursByTour;
        }

        // Загрузка на ЧУЖОМ контексте: своего соединения этому снимку не нужно, а освобождать
        // чужое ему нельзя — поэтому info-сервисы здесь сознательно не оборачиваются в using
        // (тот же приём, что в ClosureRuleInfo и ScheduledJobUpdateService).
        public static async Task<AutoCloseLeadTimeResolver> LoadAsync(IApplicationDbContext context,
            CancellationToken cancellationToken = default)
        {
            var globalLeadTimeHours = await new SiteSettingsInfo(context, cancellationToken)
                .GetNumberAsync(SiteSettingKeys.BookingAutoCloseLeadTimeHours);

            var overrides = await new TourAutoCloseOverrideInfo(context, cancellationToken)
                .GetLeadTimeHoursByTourAsync();

            return new AutoCloseLeadTimeResolver(globalLeadTimeHours, overrides);
        }

        // Перегрузки «по строке подключения» здесь сознательно нет: все три потребителя
        // работают на своём контексте (у фоновой задачи он тоже свой, см.
        // TourDateAutoClosureJob), а неиспользуемый второй способ загрузки — это второй
        // способ получить снимок, который однажды разъедется с первым.

        // Порог «по умолчанию» — тот, что действует на продукты без исключения. Наружу нужен
        // ровно одному месту: тексту в истории прогонов задачи.
        public int GlobalLeadTimeHours => globalLeadTimeHours;

        // Самый большой порог из действующих. Нужен планировщику, чтобы понять, насколько
        // далеко вперёд вообще имеет смысл сканировать дни: глобальные 24 часа не отменяют
        // продукта с исключением в 72.
        public int MaxLeadTimeHours => leadTimeHoursByTour.Count == 0
            ? globalLeadTimeHours
            : Math.Max(globalLeadTimeHours, leadTimeHoursByTour.Values.Max());

        // Порог конкретного продукта. tourId == null (запрос без продукта — конструктор
        // кастомного трансфера) исключения иметь не может по определению, ему достаётся
        // глобальное значение.
        public int Resolve(int? tourId)
            => tourId is not null && leadTimeHoursByTour.TryGetValue(tourId.Value, out var leadTimeHours)
                ? leadTimeHours
                : globalLeadTimeHours;

        // Единственная точка, которой пользуются все три потребителя: порог продукта плюс
        // окно от самого позднего слота дня. Разбирать её на «взять порог» + «посчитать
        // окно» на стороне вызывающего не нужно — именно так копии формулы и появляются.
        public bool IsWithinAutoCloseWindow(int? tourId, DateOnly date, IReadOnlyCollection<TimeOnly>? startTimes,
            DateTime nowUtc)
            => AutoClosureWindow.IsWithinAutoCloseWindow(date, startTimes, Resolve(tourId), nowUtc);
    }
}
