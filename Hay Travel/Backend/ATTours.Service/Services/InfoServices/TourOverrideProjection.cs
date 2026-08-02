using ATTours.Common.Entities;
using ATTours.Common.Enums;
using ATTours.Common.Extensions;

namespace ATTours.BusinessServices.Services.InfoServices
{
    // Публичный шаг сворачивания графа тура (пункт 3.5). Приоритет own(lang) ?? template(lang) —
    // бизнес-правило, поэтому живёт в слое Service (зовёт CatalogOverrideResolver), а НЕ в
    // LanguageExtensions (Common↔Service граница), НЕ в маппере, НЕ в SQL. Резолв на лету над
    // NoTracking-графом (D-10) — в БД ничего не пишется, правка каталога всегда доходит до
    // непереопределённых туров.
    public static class TourOverrideProjection
    {
        // Детальная тура (D-9): наружу идёт прежний TourInfoModel, но со свёрнутыми значениями.
        // Порядок: сначала общий Common-фильтр «оставить один язык» по всему графу
        // (тур/день/галерея/свободные строки), затем для КАТАЛОГ-привязанных строк
        // (PlaceId/ExpenseTemplateId/TourNoteTemplateId != null) переводы заменяются на одну
        // строку с эффективным значением own(lang) ?? template(lang). Порядок эквивалентен
        // «сначала резолв, потом язык»: фильтр удаляет лишь own-строки чужих языков, а резолвер
        // всё равно смотрит только строку запрошенного языка.
        public static Tour ResolveDetail(Tour tour, int languageCode)
        {
            tour.ExtractWithNeededLanguage(languageCode);

            foreach (var tourDetail in tour.TourDetails)
            {
                foreach (var routePoint in tourDetail.TourDay.RoutePoints)
                {
                    if (routePoint.PlaceId is null)
                        continue;

                    var effective = CatalogOverrideResolver.Resolve(
                        routePoint.Translations,
                        routePoint.Place?.Translations ?? [],
                        languageCode,
                        t => ((int)t.LanguageCode, t.Value),
                        t => ((int)t.LanguageCode, t.Value));

                    routePoint.Translations = BuildSingle(effective, value =>
                        new RoutePointTranslation { LanguageCode = (LanguageCode)languageCode, Value = value });
                }
            }

            foreach (var expense in tour.AdditionalExpenses)
            {
                if (expense.ExpenseTemplateId is null)
                    continue;

                var effective = CatalogOverrideResolver.Resolve(
                    expense.Translations,
                    expense.ExpenseTemplate?.Translations ?? [],
                    languageCode,
                    t => ((int)t.LanguageCode, t.Value),
                    t => ((int)t.LanguageCode, t.Value));

                expense.Translations = BuildSingle(effective, value =>
                    new AdditionalExpenseTranslation
                    {
                        Type = ExpenseTranslationType.Desciption,
                        LanguageCode = (LanguageCode)languageCode,
                        Value = value
                    });
            }

            foreach (var note in tour.Notes)
            {
                if (note.TourNoteTemplateId is null)
                    continue;

                var effective = CatalogOverrideResolver.Resolve(
                    note.Translations,
                    note.TourNoteTemplate?.Translations ?? [],
                    languageCode,
                    t => ((int)t.LanguageCode, t.Value),
                    t => ((int)t.LanguageCode, t.Value));

                note.Translations = BuildSingle(effective, value =>
                    new TourNoteTranslation { LanguageCode = (LanguageCode)languageCode, Value = value });
            }

            return tour;
        }

        // Список карточек (D-11): у карточки каталожных полей нет — резолв не нужен, требуется лишь
        // оставить один язык у ТУР-УРОВНЕВЫХ переводов. Полный граф в карточку не грузится, поэтому
        // здесь НЕЛЬЗЯ звать ExtractWithNeededLanguage(Tour): она обходит tourDetail.TourDay,
        // которого в облегчённом card-графе нет (был бы NRE). Регионы переводов не несут.
        public static List<Tour> ProjectCards(IEnumerable<Tour> tours, int languageCode)
        {
            var result = new List<Tour>();
            foreach (var tour in tours)
            {
                tour.Translations.RemoveWhere(t => (int)t.LanguageCode != languageCode);
                result.Add(tour);
            }

            return result;
        }

        // Эффективное значение из резолвера в единственную строку перевода запрошенного языка
        // (null → пустой список = честное «не заполнено»). Синтезированная строка не несёт
        // исходного Id перевода — публичной проекции он не нужен.
        private static HashSet<T> BuildSingle<T>(string? effective, Func<string, T> factory)
            => effective is null ? [] : [factory(effective)];
    }
}
