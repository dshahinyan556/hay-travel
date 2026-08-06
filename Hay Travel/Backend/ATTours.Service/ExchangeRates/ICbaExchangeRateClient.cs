namespace ATTours.BusinessServices.ExchangeRates
{
    // Исходящий адаптер к SOAP-сервису ЦБ Армении. Без БД и без бизнес-правил —
    // ровно как ATTours.BusinessServices.Email: протокол наружу, не вертикаль данных.
    // Подменяется в тестах, поэтому ExchangeRateRefreshService принимает интерфейс.
    public interface ICbaExchangeRateClient
    {
        // Бросает при любой сетевой/протокольной ошибке: решение «деградировать или
        // упасть» принимает вызывающий (ExchangeRateInfo), а не адаптер.
        Task<CbaRatesSnapshot> GetLatestAsync(CancellationToken cancellationToken = default);
    }
}
