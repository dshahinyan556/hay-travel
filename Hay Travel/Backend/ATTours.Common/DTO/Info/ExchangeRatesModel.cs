namespace ATTours.Common.DTO.Info
{
    // Ответ GET /api/ExchangeRate/GetCurrent. Всё, что нужно фронту, чтобы
    // самостоятельно пересчитать и округлить цену (ADR 008): курс и шаг округления.
    public class ExchangeRatesModel
    {
        // Валюта, в которой хранятся все цены в БД. Всегда "AMD".
        public string BaseCurrency { get; set; }

        // Возраст самого старого из отданных курсов (MIN по строкам), в UTC.
        public DateTime LastUpdatedUtc { get; set; }

        // Дата публикации курсов на стороне CBA (MIN по строкам), в UTC.
        public DateTime RateDateUtc { get; set; }

        // true — курсы старше 3 часов и обновить их не удалось. Ответ при этом
        // всё равно отдаётся: цена на витрине ничего не списывает, и показать курс
        // суточной давности честнее, чем положить каталог целиком.
        public bool IsStale { get; set; }

        // Порядок — CurrencyCatalog.SortOrder, базовая валюта первой.
        public List<ExchangeRateInfoModel> Rates { get; set; } = [];
    }
}
