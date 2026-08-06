namespace ATTours.Common.DTO.Info
{
    // Одна строка курсов для публичного сайта: значение из БД + метаданные из
    // CurrencyCatalog. AutoMapper-профиля у этой модели нет намеренно — Symbol и
    // RoundingStep не существуют на сущности, профиль смог бы отобразить только
    // половину полей (прецедент: SiteSettingsInfo.GetPublicAsync).
    public class ExchangeRateInfoModel
    {
        // ISO-4217: "AMD" | "USD" | "EUR" | "RUB".
        public string Code { get; set; }

        // Глиф валюты: "֏" | "$" | "€" | "₽".
        public string Symbol { get; set; }

        // Сколько AMD стоит 1 единица. У самой AMD — ровно 1.
        public decimal RatePerUnitAmd { get; set; }

        // Шаг округления итоговой цены. Фронт округляет по нему последним шагом
        // и не хранит собственных правил округления (ADR 008).
        public int RoundingStep { get; set; }
    }
}
