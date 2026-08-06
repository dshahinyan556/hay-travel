namespace ATTours.Common.Infrastructure.Currencies
{
    // Метаданные одной валюты. Живут в коде, а не в БД — тот же раскол, что у
    // SiteSettingCatalog (ADR 002): метаданные в коде, значения (курсы) в БД.
    // Символ и шаг округления никем не редактируются, а шаг округления — правило
    // отображения цены, которое должно быть описано ровно в одном месте системы.
    public class CurrencyDefinition
    {
        public CurrencyDefinition(string code, string symbol, int roundingStep, bool isBase, int sortOrder)
        {
            Code = code;
            Symbol = symbol;
            RoundingStep = roundingStep;
            IsBase = isBase;
            SortOrder = sortOrder;
        }

        // ISO-4217 в верхнем регистре.
        public string Code { get; }

        // Глиф валюты. Язык-нейтрален, поэтому не переводится.
        public string Symbol { get; }

        // Шаг округления итоговой цены в этой валюте (AMD/RUB — 100, USD/EUR — 1).
        // Уезжает во фронт в ответе эндпоинта: фронт не хардкодит правил округления.
        public int RoundingStep { get; }

        // Базовая валюта расчётов. Ровно одна на каталог; её курс всегда 1 и в БД не хранится.
        public bool IsBase { get; }

        // Порядок в выпадающем списке валют на сайте (базовая — первой).
        public int SortOrder { get; }
    }
}
