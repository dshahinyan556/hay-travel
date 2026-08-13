using ATTours.Common.Entities;
using ATTours.Common.Enums;

namespace ATTours.BusinessServices.Services.Availability
{
    // Единственный источник правды о том, закрыт ли день (ADR 012). Чистая функция без БД:
    // правило precedence — бизнес-логика, поэтому живёт в Service, а не в репозитории и не
    // в SQL-фильтре. Все три потребителя (валидация заказа, публичный GetClosedDates,
    // админ-календарь) обязаны звать именно её, а не фильтровать даты запросом.
    public static class ClosureRuleResolver
    {
        // Специфичность правила: побеждает самое узкое применимое.
        // Tour+SpecificDate > Global+SpecificDate > Tour+Weekly > Global+Weekly.
        private const int TourSpecificDateRank = 4;
        private const int GlobalSpecificDateRank = 3;
        private const int TourWeeklyRank = 2;
        private const int GlobalWeeklyRank = 1;

        // true = день закрыт для брони этого тура (или закрыт глобально, если tourId == null).
        // Нет применимых правил -> день открыт (дефолт).
        public static bool IsClosed(IEnumerable<ClosureRule> rules, DateOnly date, int? tourId)
            => Resolve(rules, date, tourId) is { Action: ClosureAction.Close };

        // Тот же resolve, что использует IsClosed, но отдаёт наружу победившее правило
        // целиком — нужен вызывающим, которым помимо факта закрытия нужна причина
        // (ClosureRule.Reason), например админ-календарю (B12, 2026-08-13).
        public static ClosureRule? Resolve(IEnumerable<ClosureRule> rules, DateOnly date, int? tourId)
        {
            if (rules is null)
                return null;

            ClosureRule? winner = null;
            var winnerRank = 0;

            foreach (var rule in rules)
            {
                if (!IsApplicable(rule, date, tourId))
                    continue;

                var rank = GetSpecificityRank(rule);

                // Тай-брейк по Id — на случай двух правил одинаковой специфичности на один
                // день (данные противоречивы: Close и Open рядом). Побеждает более поздняя
                // строка, то есть последнее действие админа; иначе исход зависел бы от
                // порядка выборки из БД.
                if (rank > winnerRank || (rank == winnerRank && winner is not null && rule.Id > winner.Id))
                {
                    winner = rule;
                    winnerRank = rank;
                }
            }

            return winner;
        }

        // Область действия: глобальное правило применимо всегда; правило тура — только
        // когда спрашивают про этот же тур. Запрос с tourId == null (глобальный срез
        // календаря) видит только глобальные правила.
        private static bool IsApplicable(ClosureRule rule, DateOnly date, int? tourId)
        {
            if (rule.TourId is not null && rule.TourId != tourId)
                return false;

            return rule.Type switch
            {
                // Точечная дата адресует день сама — границы EffectiveFrom/To к ней
                // не применяются (они существуют ради recurring-правил).
                ClosureRuleType.SpecificDate => rule.Date == date,
                ClosureRuleType.Weekly => rule.DayOfWeek == date.DayOfWeek && IsWithinEffectiveRange(rule, date),
                _ => false
            };
        }

        // Границы включительны, null = без границы с этой стороны.
        private static bool IsWithinEffectiveRange(ClosureRule rule, DateOnly date)
        {
            if (rule.EffectiveFrom is not null && date < rule.EffectiveFrom.Value)
                return false;

            if (rule.EffectiveTo is not null && date > rule.EffectiveTo.Value)
                return false;

            return true;
        }

        private static int GetSpecificityRank(ClosureRule rule)
        {
            if (rule.Type == ClosureRuleType.SpecificDate)
                return rule.TourId is not null ? TourSpecificDateRank : GlobalSpecificDateRank;

            return rule.TourId is not null ? TourWeeklyRank : GlobalWeeklyRank;
        }
    }
}
