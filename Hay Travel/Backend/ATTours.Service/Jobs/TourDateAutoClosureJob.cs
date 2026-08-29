using ATTours.BusinessServices.Services.Availability;
using ATTours.BusinessServices.Services.CreateServices;
using ATTours.BusinessServices.Services.InfoServices;
using ATTours.Common.Constants;
using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Infrastructure.Jobs;
using ATTours.Common.Infrastructure.Time;
using ATTours.Common.Settings;

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
    // Идемпотентность держится не на тексте Reason (его правят), а на самом факте наличия
    // ЛЮБОГО глобального SpecificDate-правила на этот день: ручное правило — в том числе
    // ручное Open — побеждает планировщик и повторно не переписывается.
    public class TourDateAutoClosureJob : IBackgroundJobHandler
    {
        // Ограничение глубины сканирования. Окно автозакрытия измеряется часами, поэтому
        // затрагивает считанные дни вперёд; +1 день — запас на границу суток и на
        // округление вверх, чтобы день, который закроется через минуту после тика, уже
        // попал в этот прогон, а не ждал следующего часа.
        private const int HorizonPaddingDays = 1;

        public async Task<JobRunResult> ExecuteAsync(JobExecutionContext context, CancellationToken cancellationToken)
        {
            int leadTimeHours;

            await using (var settings = new SiteSettingsInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken))
                leadTimeHours = await settings.GetNumberAsync(SiteSettingKeys.BookingAutoCloseLeadTimeHours);

            // 0 или меньше = порог выключен. То же чтение этого значения делает и
            // AutoClosureWindow (там оно означает «ничего не закрывать»), и расходиться
            // с ним здесь нельзя: иначе задача насоздавала бы правил на дни, которые
            // валидация считает открытыми.
            if (leadTimeHours <= 0)
                return JobRunResult.Skipped($"Автозакрытие выключено: {SiteSettingKeys.BookingAutoCloseLeadTimeHours} = {leadTimeHours}.");

            var nowUtc = DateTime.UtcNow;
            var today = ArmeniaTimeZone.TodayInArmenia(nowUtc);
            var horizon = ResolveHorizon(today, leadTimeHours);

            // Дни, которые ПО ВРЕМЕНИ уже попали в окно. Сканировать дальше горизонта
            // бессмысленно: у них порог ещё не наступил, и правило на них создавать рано.
            var dueDates = new List<DateOnly>();
            for (var day = today; day <= horizon; day = day.AddDays(1))
            {
                if (AutoClosureWindow.IsWithinAutoCloseWindow(day, leadTimeHours, nowUtc))
                    dueDates.Add(day);

                if (day == DateOnly.MaxValue)
                    break;
            }

            if (dueDates.Count == 0)
                return JobRunResult.Succeeded(0, "Дней, попавших в окно автозакрытия, нет.");

            HashSet<DateOnly> alreadyRuled;
            await using (var info = new ClosureRuleInfo(CommonSettings.Instance.ATToursConnectionString, cancellationToken))
            {
                // Только глобальные точечные правила: правило конкретного тура закрывает
                // один тур, а день целиком остаётся открытым для остальных — такой день
                // задача обязана закрыть глобально. TourType == null по той же причине:
                // «закрыты только трансферы» (решение 0.27) — это НЕ закрытый день,
                // и принять его за таковой значило бы оставить туры открытыми в окне.
                var existing = await info.GetAllAsync(rule => rule.TourId == null
                                                              && rule.TourType == null
                                                              && rule.Type == ClosureRuleType.SpecificDate
                                                              && rule.Date >= today
                                                              && rule.Date <= horizon);

                alreadyRuled = [.. existing.Where(rule => rule.Date is not null).Select(rule => rule.Date!.Value)];
            }

            var missing = dueDates.Where(date => !alreadyRuled.Contains(date)).ToList();

            if (missing.Count == 0)
                return JobRunResult.Succeeded(0,
                    $"Все дни окна ({dueDates.Count}) уже закрыты правилами — новых не создано.");

            var rules = missing.Select(date => new ClosureRule
            {
                // Глобальное правило: день закрывается для всех туров сразу. Дробить его
                // по турам значило бы плодить по строке на каждый тур на каждый день.
                TourId = null,
                Type = ClosureRuleType.SpecificDate,
                Action = ClosureAction.Close,
                Date = date,
                IsAutoGenerated = true,
                Reason = $"Автозакрытие: до начала дня менее {leadTimeHours} ч (планировщик)",

                // BatchId остаётся пустым: группировка на экране «Блокировки» существует
                // ради массовых операций админа, а прогон планировщика — не операция админа
                // и в одну «пачку» с ними складываться не должен.
                BatchId = null
            }).ToList();

            // Через штатный CreationService, а не прямой вставкой: у правила есть валидация
            // формы (тип ↔ заполненные поля, запрет бэкдейтинга), и обходить её роботу
            // нельзя — противоречивое правило резолвер потом просто не поймёт.
            using (var creationService = new ClosureRuleCreationService(rules, cancellationToken))
                await creationService.ExecuteEntityChangesAsync();

            return JobRunResult.Succeeded(rules.Count,
                $"Создано правил автозакрытия: {rules.Count} " +
                $"({string.Join(", ", missing.Select(date => date.ToString("dd.MM.yyyy")))}); порог {leadTimeHours} ч.");
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
    }
}
