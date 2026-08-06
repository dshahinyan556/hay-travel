namespace ATTours.Common.Infrastructure.Currencies
{
    // Единственный источник правды по составу валют и правилам их отображения.
    // Добавить валюту = добавить одну строку сюда: ни миграции, ни изменений во
    // фронте не требуется (строка в ExchangeRate появится сама после первого
    // успешного запроса к CBA).
    public static class CurrencyCatalog
    {
        private static readonly IReadOnlyList<CurrencyDefinition> definitions =
        [
            new("AMD", "֏", roundingStep: 100, isBase: true, sortOrder: 0),
            new("USD", "$", roundingStep: 1, isBase: false, sortOrder: 1),
            new("EUR", "€", roundingStep: 1, isBase: false, sortOrder: 2),
            new("RUB", "₽", roundingStep: 100, isBase: false, sortOrder: 3),
        ];

        // Коды сравниваются точно (Ordinal): код — часть контракта API и ISO-идентификатор,
        // а не пользовательский ввод.
        private static readonly IReadOnlyDictionary<string, CurrencyDefinition> definitionsByCode =
            definitions.ToDictionary(definition => definition.Code, StringComparer.Ordinal);

        private static readonly IReadOnlyList<string> fetchCodes =
            definitions.Where(definition => !definition.IsBase)
                       .OrderBy(definition => definition.SortOrder)
                       .Select(definition => definition.Code)
                       .ToList();

        // Все валюты в порядке отображения (базовая — первой).
        public static IReadOnlyList<CurrencyDefinition> All => definitions;

        // Базовая валюта: в ней хранятся все цены в БД, её курс всегда ровно 1.
        public static CurrencyDefinition Base => definitions.First(definition => definition.IsBase);

        // Валюты, курс которых мы тянем из CBA и храним в БД. Одновременно —
        // белый список при разборе ответа: CBA отдаёт ~30 записей, включая XAU/XAG.
        public static IReadOnlyList<string> FetchCodes => fetchCodes;

        // null, если код неизвестен каталогу.
        public static CurrencyDefinition ByCode(string code)
            => code is not null && definitionsByCode.TryGetValue(code, out var definition) ? definition : null;

        public static bool IsFetched(string code)
            => code is not null && definitionsByCode.TryGetValue(code, out var definition) && !definition.IsBase;
    }
}
