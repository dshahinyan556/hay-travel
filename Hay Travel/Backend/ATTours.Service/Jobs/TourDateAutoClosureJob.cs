using ATTours.BusinessServices.Services.Availability;
using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Infrastructure.Time;
using ATTours.Common.Settings;
using Microsoft.EntityFrameworkCore;

namespace ATTours.BusinessServices.Jobs
{
    // Материализация автозакрытия дня в реальные строки ClosureRule (план, §5.1).
    //
    // Запрет бронировать такой день эта задача НЕ обеспечивает — его обеспечивает
    // AutoClosureWindow, который считает порог по времени и работает мгновенно (валидация
    // заказа + публичный список закрытых дат). Задача нужна для другого: без строки в
    // ClosureRule день был бы закрыт «по факту», но невидим как правило тому, кто открыл
    // админ-календарь, и объяснить его закрытие было бы нечем.
    //
    // Правила создаются ПОТУРОВЫЕ (TourId заполнен), а не одно глобальное на день — решение
    // Р4 от 2026-08-29. Причина ровно одна и она обязательная: с появлением исключений
    // (TourAutoCloseOverride) порог у продуктов разный, и глобальное правило, выписанное по
    // первому сработавшему порогу, закрыло бы в админ-календаре и те продукты, у которых до
    // их собственного порога ещё сутки.
    //
    // Идемпотентность держится не на тексте Reason (его правят), а на самом факте наличия
    // ЛЮБОГО применимого к продукту SpecificDate-правила на этот день: ручное правило —
    // в том числе ручное Open — побеждает планировщик и повторно не переписывается.
    public class TourDateAutoClosureJob : TourRepositoryCoreBase<Tour>, IBackgroundJobHandler
    {
        // Ограничение глубины сканирования. Окно автозакрытия измеряется часами, поэтому
        // затрагивает считанные дни вперёд; +1 день — запас на границу суток и на
        // округление вверх, чтобы день, который закроется через минуту после тика, уже
        // попал в этот прогон, а не ждал следующего часа.
        private const int HorizonPaddingDays = 1;

        // Контекст свой: задача перебирает продукты, их расписания и правила, и разводить
        // это по трём независимым соединениям (как было, пока ей хватало одного списка дней)
        // смысла нет. Хендлеры зарегистрированы Scoped, поэтому контекст освобождает DI
        // вместе со скоупом прогона — тот же приём, что у OrderAutoCancellationJob.
        public TourDateAutoClosureJob() : base(CommonSettings.Instance.ATToursConnectionString)
        {
        }

        public async Task<JobRunResult> ExecuteAsync(JobExecutionContext context, CancellationToken cancellationToken)
        {
            // Тот же снимок порогов, которым пользуются валидация заказа и публичный список
            // закрытых дат: глобальная настройка плюс исключения по продуктам. Считать порог
            // здесь самостоятельно нельзя — задача насоздавала бы правил на дни, которые
            // валидация считает открытыми (или наоборот).
            var autoCloseLeadTime = await AutoCloseLeadTimeResolver.LoadAsync(Context, cancellationToken);

            // 0 или меньше = порог выключен. Проверяется МАКСИМУМ из действующих порогов, а
            // не глобальное значение: глобальный ноль («автозакрытие выключено для всех») не
            // отменяет продукта, которому явно завели исключение в 8 часов.
            if (autoCloseLeadTime.MaxLeadTimeHours <= 0)
                return JobRunResult.Skipped(
                    $"Автозакрытие выключено: {SiteSettingKeys.BookingAutoCloseLeadTimeHours} = " +
                    $"{autoCloseLeadTime.GlobalLeadTimeHours}, исключений с положительным порогом нет.");

            var nowUtc = DateTime.UtcNow;
            var today = ArmeniaTimeZone.TodayInArmenia(nowUtc);

            // Горизонт считается по САМОМУ БОЛЬШОМУ порогу: продукт с исключением в 72 часа
            // должен попасть в прогон, даже если глобальных суток на него давно не хватало.
            var horizon = ResolveHorizon(today, autoCloseLeadTime.MaxLeadTimeHours);

            // Снос глобальных автоправил, оставшихся от ПРЕЖНЕЙ версии задачи. До перехода на
            // потуровые пороги (Р4) она закрывала день одной строкой «все продукты», и такая
            // строка сильнее любого исключения: пока она висит на 30.08, продукт с порогом 8 ч
            // остаётся закрытым за те же 24 ч, что и все остальные. Сама задача таких строк
            // больше не создаёт, поэтому встреченная — всегда наследие, и её место в мусоре.
            //
            // Живёт здесь, а не в разовой миграции данных: миграция чинит одну базу один раз,
            // а этот прогон чинит любую базу, куда такие строки успели попасть, и делает это
            // до построения индекса покрытия — иначе задача сочла бы день уже закрытым и не
            // создала бы потуровых правил ему на замену.
            //
            // Только будущее (Date >= today): прошлое — забота closure-rule-cleanup, и лезть
            // в чужую зону ответственности задача не должна.
            var legacyGlobalRules = await Context.Set<ClosureRule>()
                .Where(rule => rule.IsAutoGenerated
                               && rule.TourId == null
                               && rule.TourType == null
                               && rule.Type == ClosureRuleType.SpecificDate
                               && rule.Date >= today)
                .ExecuteDeleteAsync(cancellationToken);

            var products = await LoadBookableProductsAsync(cancellationToken);
            if (products.Count == 0)
                return JobRunResult.Succeeded(0, "Продуктов в продаже нет — закрывать нечего.");

            // Пары «продукт + день», которые ПО ВРЕМЕНИ уже попали в окно. Сканировать
            // дальше горизонта бессмысленно: там порог заведомо не наступил.
            var dueClosures = new List<(ProductSchedule Product, DateOnly Date)>();

            foreach (var product in products)
            {
                for (var day = today; day <= horizon; day = day.AddDays(1))
                {
                    // Порог продукта и точка отсчёта (самый поздний слот дня либо начало дня
                    // у трансфера) — внутри резолвера: второй копии этой формулы в решении
                    // быть не должно.
                    if (autoCloseLeadTime.IsWithinAutoCloseWindow(product.Id, day, product.StartTimes, nowUtc))
                        dueClosures.Add((product, day));

                    if (day == DateOnly.MaxValue)
                        break;
                }
            }

            // Снесённое наследие обязано попадать в текст прогона: админ, у которого со дня
            // на день исчезли строки «Все продукты», должен видеть в истории, кто их убрал.
            var legacySuffix = legacyGlobalRules > 0
                ? $" Снято устаревших глобальных автоправил: {legacyGlobalRules}."
                : string.Empty;

            if (dueClosures.Count == 0)
                return JobRunResult.Succeeded(legacyGlobalRules,
                    "Продуктов и дней, попавших в окно автозакрытия, нет." + legacySuffix);

            var existingRules = await LoadExistingRulesAsync(today, horizon, cancellationToken);

            var missing = dueClosures.Where(closure => !existingRules.Covers(closure.Product, closure.Date)).ToList();

            if (missing.Count == 0)
                return JobRunResult.Succeeded(legacyGlobalRules,
                    $"Все попавшие в окно пары продукт-день ({dueClosures.Count}) уже закрыты правилами — новых не создано."
                    + legacySuffix);

            var rules = missing.Select(closure => new ClosureRule
            {
                // Потуровое правило (Р4): у продуктов разные пороги, и один и тот же день
                // закрывается для них в разное время.
                TourId = closure.Product.Id,
                Type = ClosureRuleType.SpecificDate,
                Action = ClosureAction.Close,
                Date = closure.Date,
                IsAutoGenerated = true,
                Reason = BuildReason(closure.Product, autoCloseLeadTime.Resolve(closure.Product.Id)),

                // BatchId остаётся пустым: группировка на экране «Блокировки» существует
                // ради массовых операций админа, а прогон планировщика — не операция админа
                // и в одну «пачку» с ними складываться не должен.
                BatchId = null
            }).ToList();

            // Через штатный CreationService, а не прямой вставкой: у правила есть валидация
            // формы (тип ↔ заполненные поля, запрет бэкдейтинга), и обходить её роботу
            // нельзя — противоречивое правило резолвер потом просто не поймёт.
            //
            // На контексте задачи и БЕЗ using: контекст принадлежит задаче, и Dispose
            // сервиса закрыл бы чужое соединение (тот же приём, что в
            // ScheduledJobUpdateService.UpsertSettingValuesAsync).
            var creationService = new ClosureRuleCreationService(rules, Context, cancellationToken);
            await creationService.ExecuteEntityChangesAsync();

            var affectedDates = missing.Select(closure => closure.Date).Distinct().OrderBy(date => date).ToList();
            var affectedProducts = missing.Select(closure => closure.Product.Id).Distinct().Count();

            return JobRunResult.Succeeded(rules.Count,
                $"Создано правил автозакрытия: {rules.Count} " +
                $"(продуктов: {affectedProducts}, даты: {string.Join(", ", affectedDates.Select(date => date.ToString("dd.MM.yyyy")))}); " +
                $"глобальный порог {autoCloseLeadTime.GlobalLeadTimeHours} ч." + legacySuffix);
        }

        // Текст объясняет админу, ПОЧЕМУ строка появилась, поэтому точка отсчёта в нём
        // названа честно: у продукта с расписанием это последний старт дня, у трансфера —
        // начало дня (расписания у него нет, время подачи вводит клиент).
        private static string BuildReason(ProductSchedule product, int leadTimeHours)
            => product.StartTimes.Count > 0
                ? $"Автозакрытие: до последнего старта дня менее {leadTimeHours} ч (планировщик)"
                : $"Автозакрытие: до начала дня менее {leadTimeHours} ч (планировщик)";

        // Продукты, которые вообще продаются. Архивные и снятые с публикации пропускаются
        // сознательно: забронировать их нельзя и без правила, а строка «закрыт» на каждый
        // день на каждый архивный продукт — это только мусор в админ-календаре.
        private async Task<List<ProductSchedule>> LoadBookableProductsAsync(CancellationToken cancellationToken)
        {
            return await Context.Set<Tour>()
                                .AsNoTracking()
                                .Where(tour => tour.IsActive && !tour.IsArchived)
                                .Select(tour => new ProductSchedule
                                {
                                    Id = tour.Id,
                                    Type = tour.Type,
                                    StartTimes = tour.StartTimes.Select(startTime => startTime.Time).ToList()
                                })
                                .ToListAsync(cancellationToken);
        }

        // Все точечные правила горизонта одним чтением — и глобальные, и по типу продукта,
        // и потуровые: любое из них означает, что день у этого продукта уже описан правилом
        // и планировщику там делать нечего.
        //
        // Прежняя версия задачи смотрела ТОЛЬКО на глобальные правила, и это было верно ровно
        // до тех пор, пока она сама создавала глобальные: правило одного тура не закрывает
        // день остальным. Теперь правила потуровые, поэтому применимость считается по области
        // действия — иначе задача дублировала бы уже существующие строки каждый час.
        private async Task<ExistingRuleIndex> LoadExistingRulesAsync(DateOnly today, DateOnly horizon,
            CancellationToken cancellationToken)
        {
            // На контексте задачи и без using — по той же причине, что и CreationService выше.
            var info = new ClosureRuleInfo(Context, cancellationToken);

            var existing = await info.GetAllAsync(rule => rule.Type == ClosureRuleType.SpecificDate
                                                          && rule.Date >= today
                                                          && rule.Date <= horizon);

            return ExistingRuleIndex.Build(existing);
        }

        // Последний день, который имеет смысл проверять: дальше него порог заведомо ещё
        // не наступил. Округление вверх — на случай порога, не кратного суткам (например,
        // 36 ч это «сегодня, завтра и послезавтра»).
        private static DateOnly ResolveHorizon(DateOnly today, int leadTimeHours)
        {
            var days = (int)Math.Ceiling(leadTimeHours / 24.0) + HorizonPaddingDays;

            // Защита от переполнения DateOnly при абсурдном значении настройки: AddDays
            // бросил бы ArgumentOutOfRange и задача падала бы вместо того, чтобы работать.
            var maxDays = DateOnly.MaxValue.DayNumber - today.DayNumber;

            return today.AddDays(Math.Min(days, maxDays));
        }

        // Расписание продукта в том виде, в каком его считает порог: id + тип (нужен, чтобы
        // сопоставить продукт с правилом области «все трансферы») + времена стартов.
        //
        // Обычные set-свойства: тип материализуется прямо в EF-запросе, и здесь повторён тот
        // же приём, что у OrderValidationService.TourBookingContext.
        private sealed class ProductSchedule
        {
            public int Id { get; set; }
            public TourType Type { get; set; }
            public List<TimeOnly> StartTimes { get; set; } = [];
        }

        // Что уже описано правилами на горизонте — три множества по областям действия.
        // Отдельный тип, а не три переменные в методе: вопрос «покрыт ли этот продукт в этот
        // день» задаётся в цикле и обязан читаться одной строкой.
        private sealed class ExistingRuleIndex
        {
            private readonly HashSet<DateOnly> globalDates = [];
            private readonly HashSet<(TourType Type, DateOnly Date)> typeDates = [];
            private readonly HashSet<(int TourId, DateOnly Date)> tourDates = [];

            public static ExistingRuleIndex Build(IEnumerable<ClosureRule> rules)
            {
                var index = new ExistingRuleIndex();

                foreach (var rule in rules)
                {
                    if (rule.Date is not { } date)
                        continue;

                    if (rule.TourId is { } tourId)
                        index.tourDates.Add((tourId, date));
                    else if (rule.TourType is { } tourType)
                        index.typeDates.Add((tourType, date));
                    else
                        index.globalDates.Add(date);
                }

                return index;
            }

            // Порядок проверок значения не имеет: любое применимое правило — повод не
            // трогать этот день у этого продукта.
            public bool Covers(ProductSchedule product, DateOnly date)
                => globalDates.Contains(date)
                   || typeDates.Contains((product.Type, date))
                   || tourDates.Contains((product.Id, date));
        }
    }
}
