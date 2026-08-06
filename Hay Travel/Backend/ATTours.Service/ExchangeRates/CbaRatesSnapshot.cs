namespace ATTours.BusinessServices.ExchangeRates
{
    // Один курс из ответа CBA, уже нормализованный «за 1 единицу»:
    // ловушка Rate/Amount не покидает CbaExchangeRateClient.
    public record CbaRate(string Iso, decimal RatePerUnitAmd);

    // Снимок курсов на дату публикации CBA (<CurrentDate>).
    public record CbaRatesSnapshot(DateTime CurrentDate, IReadOnlyList<CbaRate> Rates);
}
