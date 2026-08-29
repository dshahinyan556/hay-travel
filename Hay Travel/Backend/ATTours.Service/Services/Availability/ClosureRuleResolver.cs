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
        // Tour > ТипПродукта > Глобально, и внутри каждой области SpecificDate > Weekly —
        // порядок ADR 012 сохранён, область «тип продукта» (решение 0.27 батча
        // checklist-transfers-format-2026-08-29) вставлена между туром и глобальной.
        private const int TourSpecificDateRank = 6;
        private const int TourTypeSpecificDateRank = 5;
        private const int GlobalSpecificDateRank = 4;
        private const int TourWeeklyRank = 3;
        private const int TourTypeWeeklyRank = 2;
        private const int GlobalWeeklyRank = 1;

        // true = день закрыт для брони этого тура (или закрыт глобально, если tourId == null).
        // Нет применимых правил -> день открыт (дефолт).
        //
        // tourType — тип спрашиваемого продукта. Нужен, чтобы к нему применились правила
        // области «все продукты этого типа»; null = «тип неизвестен/не важен», такие правила
        // тогда не применяются (глобальные и tour-scope продолжают работать как раньше).
        // У кастомной заявки на трансфер продукта нет вовсе: tourId == null,
        // tourType == Transfer.
        public static bool IsClosed(IEnumerable<ClosureRule> rules, DateOnly date, int? tourId, TourType? tourType = null)
            => Resolve(rules, date, tourId, tourType) is { Action: ClosureAction.Close };

        // Тот же resolve, что использует IsClosed, но отдаёт наружу победившее правило
        // целиком — нужен вызывающим, которым помимо факта закрытия нужна причина
        // (ClosureRule.Reason), например админ-календарю (B12, 2026-08-13).
        public static ClosureRule? Resolve(IEnumerable<ClosureRule> rules, DateOnly date, int? tourId, TourType? tourType = null)
        {
            if (rules is null)
                return null;

            ClosureRule? winner = null;
            var winnerRank = 0;

            foreach (var rule in rules)
            {
                if (!IsApplicable(rule, date, tourId, tourType))
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
        // когда спрашивают про этот же тур; правило типа продукта — только когда спрашивают
        // про продукт этого типа. Запрос с tourId == null и tourType == null (глобальный срез
        // календаря) видит только глобальные правила.
        private static bool IsApplicable(ClosureRule rule, DateOnly date, int? tourId, TourType? tourType)
        {
            if (rule.TourId is not null && rule.TourId != tourId)
                return false;

            if (rule.TourType is not null && rule.TourType != tourType)
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

        // TourId и TourType взаимоисключимы (ClosureRuleValidationService), поэтому проверка
        // идёт от самого узкого к самому широкому и ветвиться дальше не нужно.
        private static int GetSpecificityRank(ClosureRule rule)
        {
            var isSpecificDate = rule.Type == ClosureRuleType.SpecificDate;

            if (rule.TourId is not null)
                return isSpecificDate ? TourSpecificDateRank : TourWeeklyRank;

            if (rule.TourType is not null)
                return isSpecificDate ? TourTypeSpecificDateRank : TourTypeWeeklyRank;

            return isSpecificDate ? GlobalSpecificDateRank : GlobalWeeklyRank;
        }
    }
}
