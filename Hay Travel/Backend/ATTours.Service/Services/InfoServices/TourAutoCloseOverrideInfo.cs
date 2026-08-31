using ATTours.BusinessServices.Core.Info;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Settings;
using ATTours.ContextRepository.ContextAbstraction;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Чтение потуровых исключений из глобального порога автозакрытия (батч 2026-08-29).
    //
    // Два способа читать одну и ту же таблицу, и оба нужны: словарь — рабочему коду
    // (AutoCloseLeadTimeResolver, три потребителя порога), проекция с названием продукта —
    // экрану «Автозакрытие дат». Разводить их по двум сервисам незачем, а вот отдавать
    // экранную проекцию рабочему коду — лишний join на каждой валидации заказа.
    public class TourAutoCloseOverrideInfo : EntityInfoBase<TourAutoCloseOverride>
    {
        private readonly CancellationToken cancellationToken;

        public TourAutoCloseOverrideInfo() : base(CommonSettings.Instance.ATToursConnectionString) { }

        public TourAutoCloseOverrideInfo(string connectionString, CancellationToken cancellationToken = default)
            : base(connectionString, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        public TourAutoCloseOverrideInfo(IApplicationDbContext context, CancellationToken cancellationToken = default)
            : base(context, cancellationToken)
        {
            this.cancellationToken = cancellationToken;
        }

        // Порог по продукту одним чтением. Ключ уникален индексом, поэтому словарь строится
        // напрямую — второй строки на тот же продукт быть не может по конструкции таблицы.
        public async Task<Dictionary<int, int>> GetLeadTimeHoursByTourAsync()
        {
            var rows = await GetEntityQueryableRepository()
                             .Select(row => new { row.TourId, row.LeadTimeHours })
                             .ToListAsync(cancellationToken);

            return rows.ToDictionary(row => row.TourId, row => row.LeadTimeHours);
        }

        // Проекция экрана. Сортировка по названию делается на сервере, чтобы порядок строк
        // не зависел от того, кто и как отрисовал таблицу; продукт без названия уезжает
        // в конец, а не в начало (иначе пустая строка возглавляла бы список).
        public async Task<List<TourAutoCloseOverrideView>> GetViewsAsync()
        {
            var rows = await GetEntityQueryableRepository()
                             .Select(row => new TourAutoCloseOverrideView
                             {
                                 TourId = row.TourId,
                                 TourName = row.Tour.Translations
                                               .Where(translation => translation.Type == TourTranslationType.Title)
                                               .OrderBy(translation => translation.LanguageCode == LanguageCode.Russian ? 0 : 1)
                                               .Select(translation => translation.Value)
                                               .FirstOrDefault(),
                                 LeadTimeHours = row.LeadTimeHours
                             })
                             .ToListAsync(cancellationToken);

            return [.. rows.OrderBy(row => string.IsNullOrWhiteSpace(row.TourName))
                           .ThenBy(row => row.TourName, StringComparer.CurrentCultureIgnoreCase)];
        }
    }
}
