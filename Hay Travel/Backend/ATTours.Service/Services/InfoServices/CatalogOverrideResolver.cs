namespace ATTours.BusinessServices.Services.InfoServices
{
    // Разрешение эффективного значения каталожного override (D-5): own(lang) ?? template(lang).
    // Бизнес-правило приоритета живёт в слое Service (не в маппере, не в Common, не в SQL).
    // Используется на публичном пути чтения тура (пункт 3.5), где граф тура превращается в
    // эффективные значения. В 3.4 резолвер создаётся, но ещё не вызывается (D-7: админский путь
    // чтения остаётся «сырым»).
    //
    // Селекторы вместо общего интерфейса переводов: entity-translation (RoutePointTranslation,
    // PlaceTranslation, …) не имеют общего контракта, а расширять существующие переводы, не
    // входящие в список правок 3.4, здесь нельзя — поэтому извлечение (LanguageCode, Value)
    // задаётся вызывающим кодом.
    public static class CatalogOverrideResolver
    {
        // Эффективное значение по языку: сначала собственная строка перевода (override),
        // при её отсутствии — строка перевода шаблона. Override гранулярен по языку.
        // Может вернуть null, если ни своей строки, ни строки шаблона на язык нет.
        public static string? Resolve<TOwn, TTemplate>(
            IEnumerable<TOwn> ownTranslations,
            IEnumerable<TTemplate> templateTranslations,
            int languageCode,
            Func<TOwn, (int LanguageCode, string Value)> ownSelector,
            Func<TTemplate, (int LanguageCode, string Value)> templateSelector)
        {
            var ownValue = ResolveSide(ownTranslations, languageCode, ownSelector);
            if (ownValue is not null)
                return ownValue;

            return ResolveSide(templateTranslations, languageCode, templateSelector);
        }

        private static string? ResolveSide<T>(
            IEnumerable<T> translations,
            int languageCode,
            Func<T, (int LanguageCode, string Value)> selector)
        {
            if (translations is null)
                return null;

            foreach (var translation in translations)
            {
                var projected = selector(translation);
                if (projected.LanguageCode == languageCode)
                    return projected.Value;
            }

            return null;
        }
    }
}
